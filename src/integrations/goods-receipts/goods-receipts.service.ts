import { Injectable, Logger } from '@nestjs/common';

import {
  CanadaGoodsReceiptWire,
  MexicoGoodsReceiptWire,
  MockEpicorService,
  USGoodsReceiptWire,
} from '../../mock-epicor/mock-epicor.service';
import {
  EpicorInstance,
  getInstanceById,
} from '../config/epicor-instances.config';
import {
  GoodsReceiptDto,
  GoodsReceiptLineItem,
  GoodsReceiptSource,
} from '../dto/goods-receipt.dto';

/** Marker error thrown when an Epicor fetch overruns the 3-second SLA. */
export const EPICOR_TIMEOUT_ERROR = 'EPICOR_TIMEOUT';

const FETCH_TIMEOUT_MS = 3000;

interface RawUSReceiptLine {
  LineNum: number;
  PartNum: string;
  PartDescription: string;
  POLine: number;
  OrderQty: number;
  OurJobReceivedQty: number;
  UnitCost: number;
}

interface RawMexicoReceiptLine {
  NumLinea: number;
  ClaveParte: string;
  DescripcionArticulo: string;
  NumLineaOrden: number;
  CantidadOrdenada: number;
  CantidadRecibida: number;
  CostoUnitario: number;
}

interface PaginationView<T> {
  paginatedData: T[];
  total: number;
  hasMore: boolean;
}

/**
 * Live goods-receipt API service for INT-03.
 *
 * Fetches receipt rows from a single Epicor instance (currently the mock
 * Epicor service), normalises them onto `GoodsReceiptDto` regardless of US
 * vs. Mexico source format, and returns a paginated view to the matching
 * workbench.
 *
 * Hard SLA: every fetch must respond within 3 seconds end-to-end. If Epicor
 * is slow, the controller surfaces a 503 instead of hanging the UI.
 */
@Injectable()
export class GoodsReceiptsService {
  private readonly logger = new Logger(GoodsReceiptsService.name);

  constructor(private readonly mockEpicor: MockEpicorService) {}

  /**
   * Public entrypoint used by the controller.
   *
   * Returns the paginated `data` *and* the unpaginated `total` so the
   * controller can build a single response with full pagination metadata.
   * Throws an `Error('EPICOR_TIMEOUT')` if Epicor exceeds the 3-second SLA.
   */
  async getGoodsReceipts(
    poNumber: string,
    instanceId: number,
    page: number,
    limit: number,
  ): Promise<{ data: GoodsReceiptDto[]; total: number; hasMore: boolean }> {
    const instance = getInstanceById(instanceId);
    if (!instance) {
      this.logger.warn(
        `Unknown instanceId=${instanceId} when querying GR for PO=${poNumber}`,
      );
      return { data: [], total: 0, hasMore: false };
    }

    const region = this.regionToSource(instance);
    const receipts = await this.fetchFromEpicor(poNumber, instance, region);

    const view = this.applyPagination(receipts, page, limit);
    return {
      data: view.paginatedData,
      total: view.total,
      hasMore: view.hasMore,
    };
  }

  // ── Fetch ───────────────────────────────────────────────────────

  /**
   * Race the (mock) Epicor fetch against a 3-second timeout. If real Epicor
   * goes silent, the matching workbench gets a 503 and prompts the user to
   * retry rather than spinning forever.
   *
   * TODO: Replace mock with real Epicor connection.
   *   - US: ODBC query on `ReceiptHdr` + `ReceiptDtl`:
   *     SELECT rh.ReceiptNum, rh.PONum, rd.PartNum, rd.OurJobReceivedQty,
   *            rd.UnitCost, rd.ReceiptDate, rd.PartDescription, pd.OrderQty
   *       FROM ReceiptHdr rh
   *       JOIN ReceiptDtl rd ON rh.ReceiptNum = rd.ReceiptNum
   *       JOIN PODetail   pd ON rd.PONum = pd.PONum
   *      WHERE rh.PONum = @poNumber
   *   - Mexico: same query against the Spanish-named tables.
   */
  private async fetchFromEpicor(
    poNumber: string,
    instance: EpicorInstance,
    source: GoodsReceiptSource,
  ): Promise<GoodsReceiptDto[]> {
    const actualFetch = async (): Promise<GoodsReceiptDto[]> => {
      // Pay the per-instance connection latency first — this is what makes
      // instance #7 (which then sleeps another 2.8s in the GR fetch) reliably
      // overrun the 3-second SLA below.
      await this.mockEpicor.simulateConnectionDelay(instance.instanceId);
      if (source === 'MEXICO') {
        const rows = await this.mockEpicor.getMexicoGoodsReceipts(
          poNumber,
          instance.instanceId,
        );
        return rows.map((row) =>
          this.assembleMexicoReceipt(row, instance.instanceId),
        );
      }
      if (source === 'CANADA') {
        const rows = await this.mockEpicor.getCanadaGoodsReceipts(
          poNumber,
          instance.instanceId,
        );
        return rows.map((row) =>
          this.assembleEnglishReceipt(row, instance.instanceId, 'CANADA'),
        );
      }
      const rows = await this.mockEpicor.getUSGoodsReceipts(
        poNumber,
        instance.instanceId,
      );
      return rows.map((row) =>
        this.assembleEnglishReceipt(row, instance.instanceId, 'US'),
      );
    };

    // Hold the timer handle so we can clear it once the race settles —
    // otherwise the (unfired) SLA timeout keeps the event loop alive after a
    // fast fetch wins, which surfaces as a "worker failed to exit" leak in
    // tests and a dangling timer in production.
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        actualFetch(),
        new Promise<GoodsReceiptDto[]>((_resolve, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error(EPICOR_TIMEOUT_ERROR)),
            FETCH_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  // ── Normalisation ───────────────────────────────────────────────

  /**
   * Map a single raw US line onto a canonical `GoodsReceiptLineItem`.
   *
   *   ReceiptNum         → grNumber (handled at receipt level)
   *   PONum              → poNumber (handled at receipt level)
   *   PartDescription    → description
   *   OrderQty           → orderedQty
   *   OurJobReceivedQty  → receivedQty
   *   UnitCost           → unitPrice
   *   receivedQty * unitPrice → lineTotal
   *   ReceiptDate        → receivedDate (handled at receipt level)
   */
  normalizeUSFormat(raw: RawUSReceiptLine): GoodsReceiptLineItem {
    const orderedQty = toNumber(raw.OrderQty);
    const receivedQty = toNumber(raw.OurJobReceivedQty);
    const unitPrice = toNumber(raw.UnitCost);
    return {
      lineNum: toNumber(raw.LineNum),
      description: raw.PartDescription ?? '',
      orderedQty,
      receivedQty,
      unitPrice,
      lineTotal: round2(receivedQty * unitPrice),
    };
  }

  /**
   * Map a single raw Mexico line onto a canonical `GoodsReceiptLineItem`.
   *
   *   NumRecepcion         → grNumber (handled at receipt level)
   *   OrdenCompra          → poNumber (handled at receipt level)
   *   DescripcionArticulo  → description
   *   CantidadOrdenada     → orderedQty
   *   CantidadRecibida     → receivedQty
   *   CostoUnitario        → unitPrice
   *   CantidadRecibida * CostoUnitario → lineTotal
   *   FechaRecepcion       → receivedDate (handled at receipt level)
   */
  normalizeMexicoFormat(raw: RawMexicoReceiptLine): GoodsReceiptLineItem {
    const orderedQty = toNumber(raw.CantidadOrdenada);
    const receivedQty = toNumber(raw.CantidadRecibida);
    const unitPrice = toNumber(raw.CostoUnitario);
    return {
      lineNum: toNumber(raw.NumLinea),
      description: raw.DescripcionArticulo ?? '',
      orderedQty,
      receivedQty,
      unitPrice,
      lineTotal: round2(receivedQty * unitPrice),
    };
  }

  // ── Pagination ──────────────────────────────────────────────────

  /**
   * In-memory pagination over an already-fetched array.
   *
   * TODO: Push pagination to the Epicor query level. Currently we load
   * everything then slice — fine for mocks, slow for real datasets. Replace
   * with `LIMIT`/`OFFSET` (or keyset pagination on receipt timestamp) once
   * real connections land.
   */
  applyPagination<T>(
    data: T[],
    page: number,
    limit: number,
  ): PaginationView<T> {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safeLimit = Math.max(1, Math.floor(limit) || 1);
    const start = (safePage - 1) * safeLimit;
    const end = safePage * safeLimit;
    return {
      paginatedData: data.slice(start, end),
      total: data.length,
      hasMore: end < data.length,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────

  private regionToSource(instance: EpicorInstance): GoodsReceiptSource {
    if (instance.region === 'MEXICO') return 'MEXICO';
    if (instance.region === 'CANADA') return 'CANADA';
    return 'US';
  }

  /**
   * Assemble a receipt from the English (US / Canada) Epicor shape. Both
   * regions stream the identical `ReceiptHdr` / `ReceiptDtl` field names, so
   * a single assembler handles both — `source` only tags which region the
   * row actually came from.
   */
  private assembleEnglishReceipt(
    row: USGoodsReceiptWire | CanadaGoodsReceiptWire,
    instanceId: number,
    source: 'US' | 'CANADA',
  ): GoodsReceiptDto {
    return {
      grId: deterministicUuid(`gr:${instanceId}:${row.ReceiptNum}`),
      grNumber: row.ReceiptNum,
      poNumber: row.PONum,
      lineItems: row.Lines.map((l) => this.normalizeUSFormat(l)),
      receivedDate: new Date(row.ReceiptDate),
      instanceId,
      rawSource: source,
    };
  }

  private assembleMexicoReceipt(
    row: MexicoGoodsReceiptWire,
    instanceId: number,
  ): GoodsReceiptDto {
    return {
      grId: deterministicUuid(`gr:${instanceId}:${row.NumRecepcion}`),
      grNumber: row.NumRecepcion,
      poNumber: row.OrdenCompra,
      lineItems: row.Lineas.map((l) => this.normalizeMexicoFormat(l)),
      receivedDate: new Date(row.FechaRecepcion),
      instanceId,
      rawSource: 'MEXICO',
    };
  }
}

// ─── Helpers ───────────────────────────────────────────────────────

function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function deterministicUuid(seed: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let out = (h >>> 0).toString(16).padStart(8, '0');
  while (out.length < 32) {
    h = Math.imul(h ^ out.length, 0x01000193);
    out += (h >>> 0).toString(16).padStart(8, '0');
  }
  out = out.slice(0, 32);
  return `${out.slice(0, 8)}-${out.slice(8, 12)}-${out.slice(12, 16)}-${out.slice(16, 20)}-${out.slice(20, 32)}`;
}
