import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

import type { SatStatus } from '../dto/cfdi-validation-result.dto';

/**
 * Default public SAT "Consulta CFDI" SOAP endpoint. Used as the fallback
 * when `SAT_ENDPOINT_URL` is not set.
 *
 * Exposed by SAT for anyone (no auth) to verify the status of a CFDI by
 * issuer RFC, receiver RFC, total, and UUID. Throttled, so callers should
 * stay polite. May be swapped for an authorised PAC URL via the env var if
 * direct SAT access is ever revoked.
 */
const DEFAULT_SAT_ENDPOINT =
  'https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc';

/** SOAPAction header value required by the SAT endpoint. */
const SOAP_ACTION = 'http://tempuri.org/IConsultaCFDIService/Consulta';

/** Default per-request HTTP timeout. Overridable via `SAT_TIMEOUT_MS`. */
const DEFAULT_REQUEST_TIMEOUT_MS = 8000;

/**
 * Default backoff schedule applied between retries. Overridable via
 * `SAT_RETRY_DELAYS_MS` (comma-separated list). The length of this array
 * also determines the maximum number of retries — with two entries,
 * `verifyCfdi` makes up to 3 total attempts:
 *   Attempt 1: immediate
 *   Attempt 2: after 1000ms
 *   Attempt 3: after 2000ms
 * After all attempts fail, the service returns `SAT_UNAVAILABLE` (never throws).
 */
const DEFAULT_RETRY_DELAYS_MS: readonly number[] = [1000, 2000];

/**
 * Inputs required by SAT's "Consulta CFDI" service.
 *
 * `total` is intentionally a string — SAT compares it character-for-character
 * against the value stamped on the CFDI, so the caller must format it with
 * the same precision the issuer used (typically two decimals, e.g. `"1500.00"`).
 */
export interface SatVerifyParams {
  uuid: string;
  emisorRfc: string;
  receptorRfc: string;
  total: string;
}

/**
 * Outcome of a SAT verification call.
 *
 *   - `satStatus`     — the verdict ("Vigente", "Cancelado", "No Encontrado")
 *                       or `"SAT_UNAVAILABLE"` if the call could not be made.
 *   - `rawResponse`   — full SOAP response body for audit / debugging,
 *                       `null` when no response was received.
 *   - `error`         — the last network / HTTP error message, if any.
 */
export interface SatVerifyResult {
  satStatus: SatStatus;
  rawResponse: string | null;
  error: string | null;
}

/**
 * Calls Mexico's SAT public SOAP web service to verify that a CFDI invoice's
 * UUID exists and what its current status is.
 *
 * Wrapped in its own service so it can be:
 *   - mocked in unit / integration tests,
 *   - rate-limited or queued (SAT throttles aggressive callers),
 *   - swapped for an authorised PAC if direct SAT access is ever revoked.
 */
@Injectable()
export class SatValidatorService {
  private readonly logger = new Logger(SatValidatorService.name);
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly retryDelaysMs: readonly number[];

  constructor(private readonly configService: ConfigService) {
    this.endpoint = this.configService.get<string>(
      'SAT_ENDPOINT_URL',
      DEFAULT_SAT_ENDPOINT,
    );
    this.timeoutMs = Number(
      this.configService.get<string | number>(
        'SAT_TIMEOUT_MS',
        DEFAULT_REQUEST_TIMEOUT_MS,
      ),
    );
    this.retryDelaysMs = parseRetryDelays(
      this.configService.get<string>('SAT_RETRY_DELAYS_MS'),
    );
    this.logger.log(
      `SAT validator configured: endpoint=${this.endpoint} timeout=${this.timeoutMs}ms ` +
        `retryDelays=[${this.retryDelaysMs.join(',')}]ms (max ${this.retryDelaysMs.length + 1} attempts)`,
    );
  }

  /**
   * Verify a single CFDI against SAT.
   *
   * Always resolves — never throws. On unrecoverable network errors after
   * exhausting the retry budget, returns `satStatus: 'SAT_UNAVAILABLE'` so
   * callers can record the result and move on without blowing up the
   * surrounding pipeline.
   *
   * @param params Issuer RFC, receiver RFC, total (string with the same
   *               precision the CFDI was issued with), and UUID.
   * @returns      Structured result containing the parsed SAT status, the
   *               raw SOAP body for audit, and the last transport error
   *               (when applicable).
   */
  async verifyCfdi(params: SatVerifyParams): Promise<SatVerifyResult> {
    const envelope = this.buildSoapEnvelope(params);
    const maxAttempts = this.retryDelaysMs.length + 1;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await axios.post<string>(this.endpoint, envelope, {
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            SOAPAction: SOAP_ACTION,
          },
          timeout: this.timeoutMs,
          responseType: 'text',
          transformResponse: [(data) => data],
        });

        const rawResponse =
          typeof response.data === 'string'
            ? response.data
            : String(response.data);
        const satStatus = this.extractStatus(rawResponse);

        return { satStatus, rawResponse, error: null };
      } catch (err) {
        lastError = this.normaliseError(err);

        if (attempt < maxAttempts) {
          const delayMs = this.retryDelaysMs[attempt - 1];
          this.logger.warn(
            `SAT verifyCfdi attempt ${attempt}/${maxAttempts} failed for UUID ${params.uuid}: ${lastError.message}. Retrying in ${delayMs}ms…`,
          );
          await sleep(delayMs);
        } else {
          this.logger.error(
            `SAT verifyCfdi exhausted all ${maxAttempts} attempts for UUID ${params.uuid}: ${lastError.message}`,
          );
        }
      }
    }

    return {
      satStatus: 'SAT_UNAVAILABLE',
      rawResponse: null,
      error: lastError?.message ?? 'Unknown error',
    };
  }

  /**
   * Quick reachability probe used before kicking off a batch of CFDI
   * verifications, so we can fail fast and surface "SAT is down" to the user
   * instead of hammering the endpoint 1000× with retries.
   *
   * Implementation: sends a HEAD request to the SAT endpoint and treats *any*
   * HTTP response (even 4xx / 5xx) as "reachable". Only true transport
   * failures (DNS, connection refused, timeout) cause a `false` result.
   *
   * @returns `true` if SAT responded at all, `false` on transport failure.
   */
  async isSatReachable(): Promise<boolean> {
    try {
      await axios.head(this.endpoint, {
        timeout: this.timeoutMs,
        validateStatus: () => true,
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`SAT reachability check failed: ${message}`);
      return false;
    }
  }

  /**
   * Build the SOAP envelope sent to SAT.
   *
   * The `expresionImpresa` parameter is a query-string-shaped value containing
   * the four lookup keys SAT needs. Separators are emitted as `&amp;` so the
   * envelope is well-formed XML; SAT's SOAP layer decodes them transparently.
   * Values are XML-escaped defensively (the RFC alphabet legally includes
   * `&`, which would otherwise corrupt the envelope).
   */
  private buildSoapEnvelope(params: SatVerifyParams): string {
    const re = xmlEscape(params.emisorRfc);
    const rr = xmlEscape(params.receptorRfc);
    const tt = xmlEscape(params.total);
    const id = xmlEscape(params.uuid);

    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <Consulta xmlns="http://tempuri.org/">
      <expresionImpresa>?re=${re}&amp;rr=${rr}&amp;tt=${tt}&amp;id=${id}</expresionImpresa>
    </Consulta>
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * Map a SAT SOAP response body to a `SatStatus`.
   *
   * Uses substring matching on the three SAT-defined Spanish status strings
   * (per the spec). Order matters slightly: a response only ever contains one
   * `<EstadoCFDI>...</EstadoCFDI>` value, so the first match wins.
   */
  private extractStatus(rawResponse: string): SatStatus {
    if (rawResponse.includes('Vigente')) return 'Vigente';
    if (rawResponse.includes('Cancelado')) return 'Cancelado';
    if (rawResponse.includes('No Encontrado')) return 'No Encontrado';
    return 'SAT_UNAVAILABLE';
  }

  /**
   * Convert a thrown value (possibly a non-Error, possibly an `AxiosError`)
   * into a regular `Error` whose `.message` is suitable for logging.
   */
  private normaliseError(err: unknown): Error {
    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;
      const code = axiosErr.code;
      const detail = status ? `HTTP ${status}` : (code ?? 'transport error');
      return new Error(`${detail}: ${axiosErr.message}`);
    }
    if (err instanceof Error) return err;
    return new Error(String(err));
  }
}

/**
 * Escape a string for safe inclusion as XML text or attribute content.
 */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Promise-based sleep helper used between retry attempts.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Parse the `SAT_RETRY_DELAYS_MS` env var into a list of millisecond delays.
 * Falls back to the built-in default schedule when the env var is missing or
 * yields no valid positive integers.
 */
function parseRetryDelays(raw: string | undefined): readonly number[] {
  if (!raw) return DEFAULT_RETRY_DELAYS_MS;
  const parsed = raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return parsed.length > 0 ? parsed : DEFAULT_RETRY_DELAYS_MS;
}
