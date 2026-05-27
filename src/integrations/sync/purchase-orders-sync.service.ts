import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import {
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
import { PurchaseOrderLineEntity } from '../entities/purchase-order-line.entity';
import { PurchaseOrderEntity } from '../entities/purchase-order.entity';

export interface PurchaseOrderSyncCounts {
  fetched: number;
  inserted: number;
  updated: number;
  failed: number;
}

type RawPO = USPurchaseOrderWire | MexicoPurchaseOrderWire;

/**
 * Worker for INT-02 (purchase-orders nightly sync).
 *
 * Pulls open POs from a single Epicor instance, normalises them onto
 * `PurchaseOrderDto`, and upserts into `purchase_orders` +
 * `purchase_order_lines`. Headers are upserted in bulk via
 * `INSERT ... ON CONFLICT (po_number, instance_id) DO UPDATE`; line items
 * use a delete-then-insert strategy (simpler than line-level conflict
 * resolution — `purchase_order_lines.po_id` has `ON DELETE CASCADE`). The
 * entire write is wrapped in a single transaction so partial failures
 * never leave a PO without lines (or with stale lines).
 */
@Injectable()
export class PurchaseOrdersSyncService {
  private readonly logger = new Logger(PurchaseOrdersSyncService.name);

  constructor(
    private readonly mockEpicor: MockEpicorService,
    @InjectRepository(PurchaseOrderEntity)
    private readonly poRepo: Repository<PurchaseOrderEntity>,
    @InjectRepository(PurchaseOrderLineEntity)
    private readonly poLineRepo: Repository<PurchaseOrderLineEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
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
    this.logger.warn(
      `Canada region not yet wired (instance=${instance.instanceId}, plant=${instance.plantName}). Returning empty PO list.`,
    );
    return [];
  }

  /**
   * Map a raw Epicor row onto the canonical `PurchaseOrderDto`.
   *
   * US     : PONum→poNumber, VendorNum→supplierCode (and seed for
   *          deterministic supplierId), OpenOrder===true→OPEN,
   *          LineDesc→description, OrderQty→orderedQty, UnitCost→unitPrice,
   *          Plant→plantId, TotalOrderAmt→totalAmount,
   *          NeedByDate→needByDate, CurrencyCode→currency.
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
        poId: deterministicUuid(
          `mx:po:${instance.instanceId}:${r.NumOrden}`,
        ),
        poNumber: r.NumOrden,
        supplierId: deterministicUuid(
          `mx:${instance.instanceId}:${r.CodigoProveedor}`,
        ),
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

    const r = raw as USPurchaseOrderWire;
    const lineItems: PurchaseOrderLineItem[] = r.Lines.map((l) => ({
      lineNum: l.LineNum,
      description: l.LineDesc,
      orderedQty: toNumber(l.OrderQty),
      unitPrice: toNumber(l.UnitCost),
      lineTotal: round2(toNumber(l.OrderQty) * toNumber(l.UnitCost)),
      unitOfMeasure: l.UOM,
    }));
    return {
      poId: deterministicUuid(
        `${instance.region.toLowerCase()}:po:${instance.instanceId}:${r.PONum}`,
      ),
      poNumber: r.PONum,
      supplierId: deterministicUuid(
        `${instance.region.toLowerCase()}:${instance.instanceId}:${r.VendorNum}`,
      ),
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
   * Bulk-upsert PO headers + replace-all on line items, transactionally.
   *
   * Strategy:
   *   1. `INSERT ... ON CONFLICT (po_number, instance_id) DO UPDATE` over the
   *      whole header batch. `RETURNING (xmax = 0) AS created` lets us
   *      tally inserted vs updated.
   *   2. `DELETE FROM purchase_order_lines WHERE po_id IN (...)` for every
   *      PO id we just touched.
   *   3. Bulk INSERT all the new line rows.
   *
   * Steps 1–3 run inside a single transaction so a partial failure never
   * leaves a PO header without its lines.
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
      supplierId: po.supplierId,
      supplierCode: po.supplierCode,
      instanceId: po.instanceId,
      status: po.status,
      // NUMERIC columns are typed as `string` in TypeORM to preserve precision
      // (the `pg` driver returns them as strings on read). Postgres accepts a
      // JS number on insert, but `_QueryDeepPartialEntity<PurchaseOrderEntity>`
      // is strict — serialise here so the call type-checks.
      totalAmount: po.totalAmount.toFixed(2),
      currency: po.currency,
      plantId: po.plantId,
      needByDate: po.needByDate,
      lastSyncedAt: po.lastSyncedAt,
    }));

    let inserted = 0;
    let updated = 0;

    await this.dataSource.transaction(async (manager) => {
      const headerResult = await manager
        .createQueryBuilder()
        .insert()
        .into(PurchaseOrderEntity)
        .values(headerValues)
        // See note in suppliers-sync.service.ts — `.orUpdate(...)` strings
        // are emitted verbatim and must already be in snake_case to match
        // the schema produced by SnakeNamingStrategy.
        .orUpdate(
          ['status', 'total_amount', 'need_by_date', 'last_synced_at'],
          ['po_number', 'instance_id'],
        )
        .returning('"id", (xmax = 0) AS "created"')
        .execute();

      const rows = (headerResult.raw ?? []) as Array<{
        id: string;
        created: boolean | number;
      }>;
      inserted = rows.filter(
        (r) => r.created === true || r.created === 1,
      ).length;
      updated = rows.length - inserted;

      const poIds = pos.map((p) => p.poId);
      await manager.delete(PurchaseOrderLineEntity, { poId: In(poIds) });

      const allLines = pos.flatMap((po) =>
        po.lineItems.map((l) => ({
          poId: po.poId,
          lineNumber: l.lineNum,
          partNumber: null,
          description: l.description,
          // See NUMERIC-column note in the header `values` block above.
          orderedQty: l.orderedQty.toFixed(4),
          unitPrice: l.unitPrice.toFixed(2),
          lineTotal: l.lineTotal.toFixed(2),
          unitOfMeasure: l.unitOfMeasure,
          openLine: true,
        })),
      );

      if (allLines.length > 0) {
        await manager
          .createQueryBuilder()
          .insert()
          .into(PurchaseOrderLineEntity)
          .values(allLines)
          .execute();
      }
    });

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
