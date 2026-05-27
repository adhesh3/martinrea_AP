import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CfdiValidationResultDto } from '../dto/cfdi-validation-result.dto';
import { AuditLogEntity } from '../entities/audit-log.entity';
import {
  CfdiParserService,
  type CfdiParseResult,
} from './cfdi-parser.service';
import {
  SatValidatorService,
  type SatVerifyResult,
} from './sat-validator.service';

/**
 * INT-04 — Full CFDI validation orchestrator for Mexico-region invoices.
 *
 * Coordinates blob → parse → SAT lookup → audit log, producing a single
 * `CfdiValidationResultDto` that downstream consumers (matching engine,
 * AP UI, ops dashboards) can use to decide invoice routing.
 *
 * ⚠️ BUSINESS RULE — SAT graceful degradation:
 *   If SAT is unavailable after all retries, we do NOT block the invoice.
 *   The invoice proceeds with `cfdiValid: true` and `satStatus: SAT_UNAVAILABLE`
 *   so finance ops can still process it; downstream policy can decide whether
 *   to require a re-check before payment.
 *   THIS MUST BE CONFIRMED WITH MARTINREA COMPLIANCE TEAM BEFORE GO-LIVE.
 */
@Injectable()
export class CfdiValidationService {
  private readonly logger = new Logger(CfdiValidationService.name);

  constructor(
    private readonly parser: CfdiParserService,
    private readonly sat: SatValidatorService,
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepo: Repository<AuditLogEntity>,
  ) {}

  /**
   * Validate a single Mexico-plant invoice end-to-end.
   *
   * Steps:
   *   1. Read the CFDI XML from blob storage.
   *   2. Parse + structurally validate it.
   *   3. If structural validation fails, short-circuit (don't burn a SAT call).
   *   4. Otherwise, verify against SAT.
   *   5. Build the final `CfdiValidationResultDto`.
   *   6. Append an audit-log entry.
   *   7. Return the DTO.
   *
   * Always resolves — never throws. Failures are captured in the result DTO
   * and the audit log so the caller can branch on `cfdiValid` / `satStatus`.
   */
  async validateInvoice(
    invoiceId: string,
    blobPath: string,
  ): Promise<CfdiValidationResultDto> {
    const validatedAt = new Date();
    this.logger.log(
      `Starting CFDI validation for invoice=${invoiceId} blob=${blobPath}`,
    );

    // Step 1: Read XML from blob storage.
    let xmlContent: string;
    try {
      xmlContent = await this.parser.readFromBlob(blobPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Blob read failed for invoice=${invoiceId}: ${message}`,
      );
      const result = this.buildBlobReadFailureResult(
        invoiceId,
        validatedAt,
        message,
      );
      await this.writeAuditLog(invoiceId, result);
      return result;
    }

    // Step 2: Parse + structural validation.
    const parseResult = this.parser.parseAndValidate(xmlContent);

    // Step 3: If XML is structurally invalid, skip SAT entirely.
    if (!parseResult.isValid) {
      this.logger.warn(
        `CFDI structurally invalid for invoice=${invoiceId}: ${parseResult.violations.join('; ')}`,
      );
      const result = this.buildParseFailureResult(
        invoiceId,
        validatedAt,
        parseResult,
      );
      await this.writeAuditLog(invoiceId, result);
      return result;
    }

    // Step 4: Verify with SAT.
    //
    // Non-null assertions are safe here: parseResult.isValid === true
    // guarantees every mandatory field was extracted (see CfdiParserService).
    const satResult = await this.sat.verifyCfdi({
      uuid: parseResult.fields.uuid!,
      emisorRfc: parseResult.fields.emisorRfc!,
      receptorRfc: parseResult.fields.receptorRfc!,
      total: parseResult.fields.total!.toFixed(2),
    });

    // Step 5: Build final DTO.
    const result = this.buildSatLookupResult(
      invoiceId,
      validatedAt,
      parseResult,
      satResult,
    );

    // Step 6: Audit log.
    await this.writeAuditLog(invoiceId, result);

    // Step 7: Done.
    this.logger.log(
      `Finished CFDI validation for invoice=${invoiceId} satStatus=${result.satStatus} cfdiValid=${result.cfdiValid}`,
    );
    return result;
  }

  /**
   * Re-check a previously-validated CFDI against SAT, *without* re-parsing the
   * XML. Used by the Sprint-3 re-validation cron — a CFDI that was `Vigente`
   * at ingestion time can be cancelled later by the supplier, and we need to
   * catch that before payment is released.
   *
   * Skips blob read + parsing entirely. Caller is responsible for passing the
   * already-extracted fields (typically from the previous validation row in
   * Audit_Logs).
   *
   * TODO Sprint 3: wire to a scheduled job that re-validates all `Vigente`
   *      invoices older than N days (or all `SAT_UNAVAILABLE` rows nightly).
   */
  async revalidateInvoice(
    invoiceId: string,
    uuid: string,
    emisorRfc: string,
    receptorRfc: string,
    total: number,
  ): Promise<CfdiValidationResultDto> {
    const validatedAt = new Date();
    this.logger.log(
      `Revalidating CFDI: invoice=${invoiceId} uuid=${uuid}`,
    );
    const satResult = await this.sat.verifyCfdi({
      uuid,
      emisorRfc,
      receptorRfc,
      total: total.toFixed(2),
    });
    // Synthesise a parse-result-like shape so we can reuse the result builder.
    const synthesisedParse: CfdiParseResult = {
      isValid: true,
      fields: {
        uuid,
        emisorRfc,
        receptorRfc,
        sello: '',
        noCertificado: '',
        total,
        iva: 0,
      },
      violations: [],
    };
    const result = this.buildSatLookupResult(
      invoiceId,
      validatedAt,
      synthesisedParse,
      satResult,
    );
    await this.writeAuditLog(invoiceId, result);
    return result;
  }

  // ─────────────────────────── private helpers ───────────────────────────

  /**
   * Result for the "couldn't even read the XML from blob" path.
   * Field values are empty strings / zeros; downstream consumers must look
   * at `cfdiValid` and `violationReason` to decide what to do.
   */
  private buildBlobReadFailureResult(
    invoiceId: string,
    validatedAt: Date,
    errorMessage: string,
  ): CfdiValidationResultDto {
    return Object.assign(new CfdiValidationResultDto(), {
      invoiceId,
      uuid: '',
      emisorRfc: '',
      receptorRfc: '',
      total: 0,
      iva: 0,
      sello: '',
      noCertificado: '',
      cfdiValid: false,
      violationReason: `Failed to read CFDI from blob: ${errorMessage}`,
      satStatus: null,
      validatedAt,
    });
  }

  /**
   * Result for the "structural validation failed" path. Uses any partial
   * field data the parser was able to extract before giving up so the audit
   * log retains as much context as possible.
   */
  private buildParseFailureResult(
    invoiceId: string,
    validatedAt: Date,
    parseResult: CfdiParseResult,
  ): CfdiValidationResultDto {
    return Object.assign(new CfdiValidationResultDto(), {
      invoiceId,
      uuid: parseResult.fields.uuid ?? '',
      emisorRfc: parseResult.fields.emisorRfc ?? '',
      receptorRfc: parseResult.fields.receptorRfc ?? '',
      total: parseResult.fields.total ?? 0,
      iva: parseResult.fields.iva ?? 0,
      sello: parseResult.fields.sello ?? '',
      noCertificado: parseResult.fields.noCertificado ?? '',
      cfdiValid: false,
      violationReason: parseResult.violations.join(', '),
      satStatus: null,
      validatedAt,
    });
  }

  /**
   * Result for the happy "structural validation passed → SAT lookup" path.
   *
   *   Vigente          → cfdiValid: true,  reason: null
   *   Cancelado        → cfdiValid: false, reason: 'Invoice cancelled in SAT system'
   *   No Encontrado    → cfdiValid: false, reason: 'Invoice UUID not found in SAT registry'
   *   SAT_UNAVAILABLE  → cfdiValid: TRUE   (graceful-degradation rule), reason: null
   *
   * The SAT_UNAVAILABLE path is the one to scrutinise: we explicitly do NOT
   * block the invoice, but flag `satStatus = SAT_UNAVAILABLE` so re-validation
   * can revisit it later (see `revalidateInvoice`).
   */
  private buildSatLookupResult(
    invoiceId: string,
    validatedAt: Date,
    parseResult: CfdiParseResult,
    satResult: SatVerifyResult,
  ): CfdiValidationResultDto {
    let cfdiValid: boolean;
    let violationReason: string | null;
    switch (satResult.satStatus) {
      case 'Vigente':
        cfdiValid = true;
        violationReason = null;
        break;
      case 'Cancelado':
        cfdiValid = false;
        violationReason = 'Invoice cancelled in SAT system';
        break;
      case 'No Encontrado':
        cfdiValid = false;
        violationReason = 'Invoice UUID not found in SAT registry';
        break;
      case 'SAT_UNAVAILABLE':
        // Graceful-degradation rule — see class JSDoc.
        cfdiValid = true;
        violationReason = null;
        break;
    }

    return Object.assign(new CfdiValidationResultDto(), {
      invoiceId,
      uuid: parseResult.fields.uuid!,
      emisorRfc: parseResult.fields.emisorRfc!,
      receptorRfc: parseResult.fields.receptorRfc!,
      total: parseResult.fields.total!,
      iva: parseResult.fields.iva!,
      sello: parseResult.fields.sello ?? '',
      noCertificado: parseResult.fields.noCertificado ?? '',
      cfdiValid,
      violationReason,
      satStatus: satResult.satStatus,
      validatedAt,
    });
  }

  /**
   * Append a CFDI-validation event to `audit_logs`.
   *
   * Per Roshni's spec (DAT-01), `audit_logs` is INSERT-ONLY — the table has
   * a Postgres trigger that rejects UPDATE and DELETE. This method only
   * issues a single INSERT via the repo; no code path on `auditLogRepo`
   * mutates an existing row.
   *
   * Audit-log writes are isolated from the validation result: if the write
   * fails (DB down, trigger rejection, etc.) we log a CRITICAL and swallow
   * the error so the validation verdict still reaches the caller. The
   * platform compensates via a Sprint-3 reconciliation job that re-emits
   * missing audit rows from `cfdi_validation_results`.
   */
  private async writeAuditLog(
    invoiceId: string,
    result: CfdiValidationResultDto,
  ): Promise<void> {
    try {
      // `newValue` is a jsonb blob — TypeORM has no reason to validate the
      // shape of its sub-properties, but `QueryDeepPartialEntity` insists on
      // deep-mapping every key, which breaks when a sub-property is `null`
      // (e.g. `satStatus` on the blob-read-failure or parse-failure paths).
      // Cast to silence the deep-partial inference; the runtime contract is
      // a plain JSON object.
      const newValue = {
        cfdiValid: result.cfdiValid,
        satStatus: result.satStatus,
        uuid: result.uuid,
        emisorRfc: result.emisorRfc,
        receptorRfc: result.receptorRfc,
        total: result.total,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
      await this.auditLogRepo.insert({
        actionType: 'CFDI_VALIDATED',
        invoiceId,
        performedBy: null,
        oldValue: null,
        newValue,
        notes: result.violationReason ?? 'CFDI validation completed',
      });
      this.logger.log(
        `[AUDIT] CFDI validation logged: invoice=${invoiceId} uuid=${result.uuid || '<none>'} satStatus=${result.satStatus ?? '<none>'} cfdiValid=${result.cfdiValid}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[AUDIT][CRITICAL] Failed to persist audit_logs row for invoice=${invoiceId}: ${message}. ` +
          `Validation verdict (cfdiValid=${result.cfdiValid}, satStatus=${result.satStatus ?? '<none>'}) was returned to caller but is NOT in the audit trail.`,
      );
    }
  }
}
