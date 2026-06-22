import { Injectable, Logger } from '@nestjs/common';

import {
  CANADA_GOODS_RECEIPTS,
  CanadaGoodsReceiptRecord,
} from './data/canada-goods-receipts.mock';
import {
  CANADA_PURCHASE_ORDERS,
  CanadaPurchaseOrderRecord,
} from './data/canada-purchase-orders.mock';
import {
  CANADA_SUPPLIERS,
  CanadaSupplierRecord,
} from './data/canada-suppliers.mock';
import {
  MEXICO_GOODS_RECEIPTS,
  MexicoGoodsReceiptRecord,
} from './data/mexico-goods-receipts.mock';
import {
  MEXICO_PURCHASE_ORDERS,
  MexicoPurchaseOrderRecord,
} from './data/mexico-purchase-orders.mock';
import {
  MEXICO_SUPPLIERS,
  MexicoSupplierRecord,
} from './data/mexico-suppliers.mock';
import {
  US_GOODS_RECEIPTS,
  USGoodsReceiptRecord,
} from './data/us-goods-receipts.mock';
import {
  US_PURCHASE_ORDERS,
  USPurchaseOrderRecord,
} from './data/us-purchase-orders.mock';
import {
  US_SUPPLIERS,
  USSupplierRecord,
} from './data/us-suppliers.mock';

/**
 * Marker error thrown when an instance is "down" in the simulated topology.
 * The integrations layer translates this into a sub-job FAILED status.
 */
export const CONNECTION_REFUSED_ERROR = 'CONNECTION_REFUSED';

/** US supplier as it appears on the wire from US Epicor, with `instanceId` annotated. */
export type USSupplierWire = USSupplierRecord & { instanceId: number };
export type MexicoSupplierWire = MexicoSupplierRecord & { instanceId: number };
/** Canada Epicor ships the same English Vendor shape as the US plants. */
export type CanadaSupplierWire = CanadaSupplierRecord & { instanceId: number };
export type USPurchaseOrderWire = USPurchaseOrderRecord & {
  instanceId: number;
};
export type MexicoPurchaseOrderWire = MexicoPurchaseOrderRecord & {
  instanceId: number;
};
export type CanadaPurchaseOrderWire = CanadaPurchaseOrderRecord & {
  instanceId: number;
};
export type USGoodsReceiptWire = USGoodsReceiptRecord & { instanceId: number };
export type MexicoGoodsReceiptWire = MexicoGoodsReceiptRecord & {
  instanceId: number;
};
export type CanadaGoodsReceiptWire = CanadaGoodsReceiptRecord & {
  instanceId: number;
};

/**
 * In-memory simulator of Martinrea's 44 Epicor CMS instances.
 *
 * Why this exists: We don't have real Epicor credentials yet, but we still
 * need to demo the full AP flow end-to-end. This service holds realistic
 * supplier / PO / GR fixtures in their native US and Mexico shapes, plus
 * simulated network behaviours (per-instance latency, randomly-flaky
 * instances, instance #7 always-slow), so the integrations layer can
 * exercise its normalisation, error-isolation, and timeout paths against
 * something that *behaves* like real Epicor.
 *
 * To replace with real Epicor: swap the four `getX*` methods for ODBC /
 * SFTP clients, drop `simulateConnectionDelay`, and delete this folder.
 */
@Injectable()
export class MockEpicorService {
  private readonly logger = new Logger(MockEpicorService.name);

  // ── SUPPLIERS ───────────────────────────────────────────────────

  /**
   * Active US suppliers for a given instance, with light per-instance
   * variation to simulate "different plants have different vendor pools".
   *
   * When `since` is provided, simulates an incremental pull by returning
   * only 3–5 records (the "changed since last sync" slice). When `since`
   * is null / omitted, returns the full active set (first-run behaviour).
   * Real Epicor would translate `since` into `WHERE LastModified > :since`.
   */
  getUSSuppliers(
    instanceId: number,
    since?: Date | null,
  ): USSupplierWire[] {
    const active = US_SUPPLIERS.filter((s) => !s.InActive);
    if (since) {
      return active
        .slice(0, incrementalSliceSize(instanceId))
        .map((s) => ({ ...s, instanceId }));
    }
    const target = this.usSupplierTargetCount(instanceId);
    return active
      .slice(0, Math.min(target, active.length))
      .map((s) => ({ ...s, instanceId }));
  }

  private usSupplierTargetCount(instanceId: number): number {
    switch (instanceId % 3) {
      case 0:
        return 20;
      case 1:
        return 22;
      default:
        return 25;
    }
  }

  /** Active Mexico suppliers for a given instance. */
  getMexicoSuppliers(
    instanceId: number,
    since?: Date | null,
  ): MexicoSupplierWire[] {
    const active = MEXICO_SUPPLIERS.filter((s) => s.Activo);
    if (since) {
      return active
        .slice(0, incrementalSliceSize(instanceId))
        .map((s) => ({ ...s, instanceId }));
    }
    return active.map((s) => ({ ...s, instanceId }));
  }

  /**
   * Active Canada suppliers for a given instance.
   *
   * Canada Epicor uses the US English `Vendor` localisation, so the filter
   * key is `InActive === false` (same as `getUSSuppliers`), not the Spanish
   * `Activo` flag used for Mexico.
   */
  getCanadaSuppliers(
    instanceId: number,
    since?: Date | null,
  ): CanadaSupplierWire[] {
    const active = CANADA_SUPPLIERS.filter((s) => !s.InActive);
    if (since) {
      return active
        .slice(0, incrementalSliceSize(instanceId))
        .map((s) => ({ ...s, instanceId }));
    }
    return active.map((s) => ({ ...s, instanceId }));
  }

  // ── PURCHASE ORDERS ─────────────────────────────────────────────

  /**
   * Open US POs for a given instance.
   *
   * The PONum is rewritten with an instance prefix (`PO-2024-{instanceId}-XXXXX`)
   * so a single fixture can play the role of "this PO at plant 1" vs "this PO
   * at plant 5" — useful for telling apart sync runs from different plants in
   * the demo dashboard. Goods-receipt lookups continue to use the *original*
   * PONum (the static one in `US_GOODS_RECEIPTS`).
   */
  getUSOpenPOs(
    instanceId: number,
    since?: Date | null,
  ): USPurchaseOrderWire[] {
    const open = US_PURCHASE_ORDERS.filter((p) => p.OpenOrder);
    const slice = since
      ? open.slice(0, incrementalSliceSize(instanceId))
      : open.filter((_p, idx) => idx % 4 === instanceId % 4);
    return slice.map((p) => ({
      ...p,
      PONum: this.rewritePONum(p.PONum, instanceId),
      instanceId,
    }));
  }

  private rewritePONum(original: string, instanceId: number): string {
    // Original looks like `PO-2024-00142` — slot the instanceId in the middle.
    const parts = original.split('-');
    if (parts.length === 3) {
      return `${parts[0]}-${parts[1]}-${instanceId}-${parts[2]}`;
    }
    return `${original}-INST${instanceId}`;
  }

  /** Open Mexico POs for a given instance. */
  getMexicoOpenPOs(
    instanceId: number,
    since?: Date | null,
  ): MexicoPurchaseOrderWire[] {
    const open = MEXICO_PURCHASE_ORDERS.filter((p) => p.OrdenAbierta);
    const slice = since ? open.slice(0, incrementalSliceSize(instanceId)) : open;
    return slice.map((p) => ({ ...p, instanceId }));
  }

  /**
   * Open Canada POs for a given instance.
   *
   * Unlike `getUSOpenPOs`, the PONum is left intact (no instance prefix
   * rewrite) so the `PO-CA-` numbers line up directly with
   * `getCanadaGoodsReceipts` for end-to-end demos of the matching workbench.
   */
  getCanadaOpenPOs(
    instanceId: number,
    since?: Date | null,
  ): CanadaPurchaseOrderWire[] {
    const open = CANADA_PURCHASE_ORDERS.filter((p) => p.OpenOrder);
    const slice = since ? open.slice(0, incrementalSliceSize(instanceId)) : open;
    return slice.map((p) => ({ ...p, instanceId }));
  }

  // ── GOODS RECEIPTS ──────────────────────────────────────────────

  /**
   * US goods receipts for a given PO + instance.
   *
   * Special demo behaviour:
   *   - Instance 7 sleeps for 2.8 seconds before responding. The integrations
   *     layer wraps this in a 3-second `Promise.race` — the request *just*
   *     squeaks under the SLA in normal conditions, and reliably trips it
   *     when combined with anything else that takes >200ms upstream.
   */
  async getUSGoodsReceipts(
    poNumber: string,
    instanceId: number,
  ): Promise<USGoodsReceiptWire[]> {
    if (instanceId === 7) {
      await sleep(2800);
    }
    return US_GOODS_RECEIPTS.filter((r) => r.PONum === poNumber).map((r) => ({
      ...r,
      instanceId,
    }));
  }

  /** Mexico goods receipts for a given PO + instance. */
  async getMexicoGoodsReceipts(
    poNumber: string,
    instanceId: number,
  ): Promise<MexicoGoodsReceiptWire[]> {
    if (instanceId === 7) {
      await sleep(2800);
    }
    return MEXICO_GOODS_RECEIPTS.filter((r) => r.OrdenCompra === poNumber).map(
      (r) => ({
        ...r,
        instanceId,
      }),
    );
  }

  /** Canada goods receipts for a given PO + instance (US English shape). */
  async getCanadaGoodsReceipts(
    poNumber: string,
    instanceId: number,
  ): Promise<CanadaGoodsReceiptWire[]> {
    return CANADA_GOODS_RECEIPTS.filter((r) => r.PONum === poNumber).map(
      (r) => ({
        ...r,
        instanceId,
      }),
    );
  }

  // ── Network simulation ──────────────────────────────────────────

  /**
   * Simulate per-instance connection latency + occasional outright failure.
   *
   *   1..15  — fast    (200–400 ms)
   *   16..30 — medium  (500–900 ms)
   *   31..38 — slow    (1000–1500 ms)
   *   39..44 — flaky   (~30% chance of `CONNECTION_REFUSED`, else ~800 ms)
   *
   * The flaky tier exists specifically to prove that
   * `EpicorSyncService.runFullSync` isolates per-instance failures via
   * `Promise.allSettled` — when a few instances reject, the rest still
   * complete and the orchestrator records a meaningful summary.
   */
  async simulateConnectionDelay(instanceId: number): Promise<void> {
    if (instanceId >= 39 && instanceId <= 44) {
      if (Math.random() < 0.3) {
        this.logger.warn(
          `Simulated CONNECTION_REFUSED for instance=${instanceId}`,
        );
        throw new Error(CONNECTION_REFUSED_ERROR);
      }
      await sleep(800);
      return;
    }
    if (instanceId >= 31) {
      await sleep(randomBetween(1000, 1500));
      return;
    }
    if (instanceId >= 16) {
      await sleep(randomBetween(500, 900));
      return;
    }
    await sleep(randomBetween(200, 400));
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}

/**
 * Deterministic slice size in the 3..5 range for incremental ("since"-filtered)
 * fetches. Deterministic-per-instance so test assertions are stable, but varied
 * across instances so different plants exercise different counts.
 */
function incrementalSliceSize(instanceId: number): number {
  return 3 + (instanceId % 3);
}
