import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  CanadaPurchaseOrderWire,
  MexicoPurchaseOrderWire,
  MockEpicorService,
  USPurchaseOrderWire,
} from '../../mock-epicor/mock-epicor.service';
import { EpicorInstance } from '../config/epicor-instances.config';
import {
  PurchaseOrderDto,
  PurchaseOrderLineItem,
  PurchaseOrderStatus,
} from '../dto/purchase-order.dto';
import {
  PurchaseOrderEntity,
  PurchaseOrderStatus as CanonicalPoStatus,
} from '../entities/purchase-order.entity';

export interface PurchaseOrderSyncCounts {
  fetched: number;
  inserted: number;
  updated: number;
  failed: number;
}

type RawPO =
  | USPurchaseOrderWire
  | MexicoPurchaseOrderWire
  | CanadaPurchaseOrderWire;

/** US and Canada Epicor ship the same English PO header + line shape. */
type EnglishPOWire = USPurchaseOrderWire | CanadaPurchaseOrderWire;

/**
 * Worker for INT-02 (purchase-orders nightly sync).
 *
 * Pulls open POs from a single Epicor instance, normalises them onto
 * `PurchaseOrderDto`, and upserts the header into the canonical
 * `purchase_orders` table via `INSERT ... ON CONFLICT (po_number) DO UPDATE`.
 * `po_number` is a single global namespace (no per-instance dimension).
 *
 * Line items are NOT persisted to a child table in the canonical model — the
 * shared schema keeps PO headers only (line-level detail lives on the goods
 * receipt's `line_items` JSONB). The sync still normalises lines so it can
 * derive `total_amount` when the source header omits it. Stateless — driven by
 * the orchestrator (`EpicorSyncService`).
 */
@Injectable()
export class PurchaseOrdersSyncService {
  private readonly logger = new Logger(PurchaseOrdersSyncService.name);

  constructor(
    private readonly mockEpicor: MockEpicorService,
    @InjectRepository(PurchaseOrderEntity)
    private readonly poRepo: Repository<PurchaseOrderEntity>,
  ) {}

  /**
   * Sync open POs for a single Epicor instance.
   *
   * Returns per-job counters that the orchestrator persists to
   * `sync_run_logs`.
   *
   * @param since  Watermark from the most recent SUCCESS run of this sub-job
   *               for this instance. `null` triggers a full pull (first run
   *               or post-failure recovery). A `Date` filters to PO headers
   *               modified after that timestamp at the source ERP.
   */
  async syncForInstance(
    instance: EpicorInstance,
    since: Date | null = null,
  ): Promise<PurchaseOrderSyncCounts> {
    await this.mockEpicor.simulateConnectionDelay(instance.instanceId);
    const raw = await this.fetchPOsFromEpicor(instance, since);

    let failed = 0;
    const normalised: PurchaseOrderDto[] = [];
    for (const row of raw) {
      try {
        normalised.push(this.normalizePurchaseOrder(row, instance));
      } catch (err) {
        failed += 1;
        this.logger.warn(
          `Failed to normalise PO from instance ${instance.instanceId}: ${(err as Error).message}`,
        );
      }
    }

    const upsertResult = await this.upsertToDatabase(
      normalised,
      instance.instanceId,
    );

    this.logger.log(
      `[POs] instance=${instance.instanceId} ` +
        `mode=${since ? `incremental(since=${since.toISOString()})` : 'full'} ` +
        `fetched=${raw.length} ` +
        `inserted=${upsertResult.inserted} updated=${upsertResult.updated} ` +
        `failed=${failed}`,
    );

    return {
      fetched: raw.length,
      inserted: upsertResult.inserted,
      updated: upsertResult.updated,
      failed,
    };
  }

  /**
   * Pull PO rows from Epicor.
   *
   * When `since` is provided, the real Epicor queries will add a
   * `WHERE POHeader.ChangeDate > :since` predicate. The mock simulates
   * this by returning a smaller "changed since last sync" slice.
   *
   * TODO: replace with real Epicor connection.
   *   - US: ODBC query on `POHeader` joined with `PODetail`.
   *   - Mexico SFTP / ODBC: same data shape with Spanish column names.
   *   - Canada: SFTP CSV export joined back to header rows in code.
   */
  private async fetchPOsFromEpicor(
    instance: EpicorInstance,
    since: Date | null,
  ): Promise<RawPO[]> {
    if (instance.region === 'US') {
      return this.mockEpicor.getUSOpenPOs(instance.instanceId, since);
    }
    if (instance.region === 'MEXICO') {
      return this.mockEpicor.getMexicoOpenPOs(instance.instanceId, since);
    }
    if (instance.region === 'CANADA') {
      return this.mockEpicor.getCanadaOpenPOs(instance.instanceId, since);
    }
    // Defensive fallback for any future region not yet wired.
    this.logger.warn(
      `Region '${instance.region}' not yet wired (instance=${instance.instanceId}, plant=${instance.plantName}). Returning empty PO list.`,
    );
    return [];
  }

  /**
   * Map a raw Epicor row onto the canonical `PurchaseOrderDto`.
   *
   * US/CA  : PONum→poNumber, VendorNum→supplierCode (and seed for
   *          deterministic supplierId), OpenOrder===true→OPEN,
   *          LineDesc→description, OrderQty→orderedQty, UnitCost→unitPrice,
   *          Plant→plantId, TotalOrderAmt→totalAmount,
   *          NeedByDate→needByDate, CurrencyCode→currency. (Canada Epicor
   *          uses the same English POHeader/PODetail shape as the US plants.)
   * Mexico : NumOrden→poNumber, CodigoProveedor→supplierCode,
   *          OrdenAbierta===true→OPEN, Descripcion→description,
   *          CantidadPedida→orderedQty, CostoUnitario→unitPrice,
   *          Planta→plantId, TotalOrden→totalAmount,
   *          FechaRequerida→needByDate, Moneda→currency.
   */
  private normalizePurchaseOrder(
    raw: RawPO,
    instance: EpicorInstance,
  ): PurchaseOrderDto {
    if (instance.region === 'MEXICO') {
      const r = raw as MexicoPurchaseOrderWire;
      const lineItems: PurchaseOrderLineItem[] = r.Lineas.map((l) => ({
        lineNum: l.NumLinea,
        description: l.Descripcion,
        orderedQty: toNumber(l.CantidadPedida),
        unitPrice: toNumber(l.CostoUnitario),
        lineTotal: round2(toNumber(l.CantidadPedida) * toNumber(l.CostoUnitario)),
        unitOfMeasure: l.UnidadMedida,
      }));
      return {
        // Deterministic ids are seeded from the globally-unique business keys
        // (po_number / supplier_code) only — no instance dimension.
        poId: deterministicUuid(r.NumOrden),
        poNumber: r.NumOrden,
        supplierId: deterministicUuid(r.CodigoProveedor),
        supplierCode: r.CodigoProveedor,
        supplierName: r.CodigoProveedor,
        lineItems,
        totalAmount: toNumber(r.TotalOrden) || round2(
          lineItems.reduce((acc, l) => acc + l.lineTotal, 0),
        ),
        currency: r.Moneda,
        status: mexicanStatus(r.OrdenAbierta),
        plantId: r.Planta,
        instanceId: instance.instanceId,
        needByDate: parseDateOrNull(r.FechaRequerida),
        lastSyncedAt: new Date(),
      };
    }

    const r = raw as EnglishPOWire;
    const lineItems: PurchaseOrderLineItem[] = r.Lines.map((l) => ({
      lineNum: l.LineNum,
      description: l.LineDesc,
      orderedQty: toNumber(l.OrderQty),
      unitPrice: toNumber(l.UnitCost),
      lineTotal: round2(toNumber(l.OrderQty) * toNumber(l.UnitCost)),
      unitOfMeasure: l.UOM,
    }));
    return {
      // See note above: ids seeded from globally-unique business keys.
      poId: deterministicUuid(r.PONum),
      poNumber: r.PONum,
      supplierId: deterministicUuid(r.VendorNum),
      supplierCode: r.VendorNum,
      supplierName: r.VendorNum,
      lineItems,
      totalAmount: toNumber(r.TotalOrderAmt) || round2(
        lineItems.reduce((acc, l) => acc + l.lineTotal, 0),
      ),
      currency: r.CurrencyCode,
      status: r.OpenOrder ? 'OPEN' : 'CLOSED',
      plantId: r.Plant,
      instanceId: instance.instanceId,
      needByDate: parseDateOrNull(r.NeedByDate),
      lastSyncedAt: new Date(),
    };
  }

  /**
   * Bulk-upsert PO headers onto the canonical `purchase_orders` table via
   * `INSERT ... ON CONFLICT (po_number) DO UPDATE`.
   *
   * The canonical schema stores headers only — there is no PO line table — so
   * this is a single, transaction-free upsert. The internal `PurchaseOrderDto`
   * is mapped onto the canonical columns here:
   *   needByDate → expected_delivery_date, status → canonical status text,
   *   supplierName/plantId/currency/totalAmount carried through. `vendor_code`,
   *   `issued_date` and `notes` aren't sourced from Epicor yet (NULL).
   *
   * `RETURNING (xmax = 0) AS created` lets us tally inserted vs updated.
   */
  async upsertToDatabase(
    pos: PurchaseOrderDto[],
    instanceId: number,
  ): Promise<PurchaseOrderSyncCounts> {
    if (pos.length === 0) {
      return { fetched: 0, inserted: 0, updated: 0, failed: 0 };
    }

    const headerValues = pos.map((po) => ({
      id: po.poId,
      poNumber: po.poNumber,
      supplierCode: po.supplierCode,
      vendorCode: null,
      supplierName: po.supplierName,
      plantId: po.plantId,
      currency: po.currency,
      // NUMERIC columns are typed as `string` in TypeORM to preserve precision
      // (the `pg` driver returns them as strings on read). Postgres accepts a
      // JS number on insert, but `_QueryDeepPartialEntity<PurchaseOrderEntity>`
      // is strict — serialise here so the call type-checks.
      totalAmount: po.totalAmount.toFixed(2),
      status: toCanonicalPoStatus(po.status),
      issuedDate: null,
      expectedDeliveryDate: po.needByDate,
      notes: null,
    }));

    const result = await this.poRepo
      .createQueryBuilder()
      .insert()
      .into(PurchaseOrderEntity)
      .values(headerValues)
      // See note in suppliers-sync.service.ts — `.orUpdate(...)` strings are
      // emitted verbatim and must already be in snake_case to match the schema
      // produced by SnakeNamingStrategy.
      .orUpdate(
        [
          'supplier_code',
          'vendor_code',
          'supplier_name',
          'plant_id',
          'currency',
          'total_amount',
          'status',
          'issued_date',
          'expected_delivery_date',
          'notes',
        ],
        ['po_number'],
      )
      .returning('"id", (xmax = 0) AS "created"')
      .execute();

    const rows = (result.raw ?? []) as Array<{
      id: string;
      created: boolean | number;
    }>;
    const inserted = rows.filter(
      (r) => r.created === true || r.created === 1,
    ).length;
    const updated = rows.length - inserted;

    this.logger.debug(
      `[POs] instance=${instanceId} upserted ${pos.length} header(s) (inserted=${inserted}, updated=${updated}).`,
    );

    return {
      fetched: pos.length,
      inserted,
      updated,
      failed: 0,
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
function mexicanStatus(open: boolean): PurchaseOrderStatus {
  return open ? 'OPEN' : 'CLOSED';
}
function parseDateOrNull(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Map the internal DTO status onto the canonical `purchase_orders.status`
 * vocabulary. The DTO carries the coarse ERP states (OPEN/CLOSED/PARTIAL);
 * the canonical schema spells partial receipts out as PARTIALLY_RECEIVED.
 */
function toCanonicalPoStatus(status: PurchaseOrderStatus): CanonicalPoStatus {
  switch (status) {
    case 'PARTIAL':
      return 'PARTIALLY_RECEIVED';
    case 'OPEN':
      return 'OPEN';
    case 'CLOSED':
      return 'CLOSED';
    default:
      return 'OPEN';
  }
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
