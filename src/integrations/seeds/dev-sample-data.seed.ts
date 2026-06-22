/**
 * ⚠️  DEV / TESTING ONLY — refuses to run when NODE_ENV=production. ⚠️
 *
 * Owner: Manav (Integration Engineer)
 *
 * Loads a small, realistic dataset into the canonical `suppliers`,
 * `purchase_orders`, `goods_receipts`, and operational `sync_run_logs` tables
 * so a developer can clone the repo, boot the app (TypeORM `synchronize`
 * creates the schema in dev), run this seed, and immediately have something to
 * GET / sync against — without needing to fire up the mock Epicor cron.
 *
 * Run with:
 *   npm run seed
 *
 * Idempotent: every insert uses deterministic UUIDs + `.orIgnore()` so re-runs
 * are no-ops. Safe to wire into CI bootstrap if we ever want pre-populated
 * dev databases out of the box.
 *
 * Why a standalone DataSource instead of `NestFactory.createApplicationContext()`?
 *   - Booting the Nest app would also start the cron + mock Epicor module,
 *     which is the opposite of what a seed script should do.
 *   - Keeps the seed surface narrow: DB + entities, nothing else.
 *
 * Canonical-schema notes:
 *   - There is a single global namespace (no `instance_id`): suppliers/POs/GRs
 *     are keyed by globally-unique `supplier_code` / `po_number` / `gr_number`.
 *   - Goods-receipt lines live inline in the `line_items` JSONB column — there
 *     are no PO-line or GR-line tables.
 */

import 'reflect-metadata';

import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { AuditLogEntity } from '../entities/audit-log.entity';
import { GoodsReceiptEntity } from '../entities/goods-receipt.entity';
import { PurchaseOrderEntity } from '../entities/purchase-order.entity';
import { SupplierEntity } from '../entities/supplier.entity';
import {
  SyncJobType,
  SyncRunLogEntity,
  SyncStatus,
} from '../entities/sync-run-log.entity';

// ─────────────────────────────────────────────────────────────────────
// Deterministic UUIDs — re-running the seed never produces duplicates.
// Grouped by table for readability; the prefix encodes the entity:
//   1111… = suppliers, 2222… = POs, 4444… = goods receipts,
//   6666… = sync run logs. (PO/GR lines are inline JSONB now.)
// ─────────────────────────────────────────────────────────────────────
const SUPPLIER_IDS = {
  greatLakes: '11111111-1111-1111-1111-111111111001',
  detroitMetal: '11111111-1111-1111-1111-111111111002',
  acerosDelNorte: '11111111-1111-1111-1111-111111111003',
} as const;

const PO_IDS = {
  glsteelPo: '22222222-2222-2222-2222-222222222001',
  dmwPo: '22222222-2222-2222-2222-222222222002',
  acerosPo: '22222222-2222-2222-2222-222222222003',
} as const;

const GR_IDS = {
  glsteelGr: '44444444-4444-4444-4444-444444444001',
  acerosGr: '44444444-4444-4444-4444-444444444002',
} as const;

const SYNC_LOG_IDS = {
  us1Suppliers: '66666666-6666-6666-6666-666666666001',
  us1Pos: '66666666-6666-6666-6666-666666666002',
  mx21Suppliers: '66666666-6666-6666-6666-666666666003',
  mx21Pos: '66666666-6666-6666-6666-666666666004',
} as const;

// ─────────────────────────────────────────────────────────────────────
// DataSource — mirrors AppModule's TypeOrmModule.forRootAsync config so
// the seed talks to exactly the same database the app boots against.
// ─────────────────────────────────────────────────────────────────────
function buildDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'martinrea_ap',
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASS ?? 'postgres',
    entities: [
      SupplierEntity,
      PurchaseOrderEntity,
      GoodsReceiptEntity,
      SyncRunLogEntity,
      AuditLogEntity,
    ],
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
    logging: ['error', 'warn'],
  });
}

// ─────────────────────────────────────────────────────────────────────
// Per-table seeders. Each one inserts a small set of rows and uses
// `.orIgnore()` so re-runs are no-ops on the unique-by-id constraint.
// ─────────────────────────────────────────────────────────────────────

async function seedSuppliers(ds: DataSource): Promise<void> {
  await ds
    .createQueryBuilder()
    .insert()
    .into(SupplierEntity)
    .values([
      {
        id: SUPPLIER_IDS.greatLakes,
        supplierCode: 'SUP-US-001',
        name: 'Great Lakes Steel Co.',
        taxId: '38-1234567',
        email: null,
        phone: null,
        address: '1500 Industrial Pkwy, Detroit, MI',
        currency: 'USD',
        countryCode: 'US',
        paymentTermsDays: 30,
        isActive: true,
      },
      {
        id: SUPPLIER_IDS.detroitMetal,
        supplierCode: 'SUP-US-002',
        name: 'Detroit Metal Works LLC',
        taxId: '38-7654321',
        email: null,
        phone: null,
        address: '4200 Cass Ave, Chicago, IL',
        currency: 'USD',
        countryCode: 'US',
        paymentTermsDays: 45,
        isActive: true,
      },
      {
        id: SUPPLIER_IDS.acerosDelNorte,
        supplierCode: 'SUP-MX-001',
        name: 'Aceros del Norte SA de CV',
        taxId: 'AND950101ABC',
        email: null,
        phone: null,
        address: 'Av. Industrial 250, Saltillo, COA',
        currency: 'MXN',
        countryCode: 'MX',
        paymentTermsDays: 60,
        isActive: true,
      },
    ])
    .orIgnore()
    .execute();
}

async function seedPurchaseOrders(ds: DataSource): Promise<void> {
  const now = new Date();
  const inDays = (n: number) =>
    new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

  await ds
    .createQueryBuilder()
    .insert()
    .into(PurchaseOrderEntity)
    .values([
      {
        id: PO_IDS.glsteelPo,
        poNumber: 'PO-100001',
        supplierCode: 'SUP-US-001',
        vendorCode: null,
        supplierName: 'Great Lakes Steel Co.',
        plantId: 'DET01',
        currency: 'USD',
        totalAmount: '12500.00',
        status: 'OPEN',
        issuedDate: null,
        expectedDeliveryDate: inDays(14),
        notes: null,
      },
      {
        id: PO_IDS.dmwPo,
        poNumber: 'PO-100002',
        supplierCode: 'SUP-US-002',
        vendorCode: null,
        supplierName: 'Detroit Metal Works LLC',
        plantId: 'CHI01',
        currency: 'USD',
        totalAmount: '8400.50',
        status: 'OPEN',
        issuedDate: null,
        expectedDeliveryDate: inDays(7),
        notes: null,
      },
      {
        id: PO_IDS.acerosPo,
        poNumber: 'PO-200001',
        supplierCode: 'SUP-MX-001',
        vendorCode: null,
        supplierName: 'Aceros del Norte SA de CV',
        plantId: 'SAL01',
        currency: 'MXN',
        totalAmount: '175000.00',
        status: 'OPEN',
        issuedDate: null,
        expectedDeliveryDate: inDays(21),
        notes: null,
      },
    ])
    .orIgnore()
    .execute();
}

async function seedGoodsReceipts(ds: DataSource): Promise<void> {
  const daysAgo = (n: number) =>
    new Date(Date.now() - n * 24 * 60 * 60 * 1000);

  await ds
    .createQueryBuilder()
    .insert()
    .into(GoodsReceiptEntity)
    .values([
      // Partial receipt against PO-100001 (Great Lakes Steel, US plant).
      // 25 of 50 units of line 1 received. Lines are inline JSONB now.
      {
        id: GR_IDS.glsteelGr,
        grNumber: 'GR-2025-00001',
        poNumber: 'PO-100001',
        supplierCode: 'SUP-US-001',
        vendorCode: null,
        supplierName: 'Great Lakes Steel Co.',
        plantId: 'DET01',
        receivedDate: daysAgo(2),
        status: 'OPEN',
        lineItems: [
          {
            poLineRef: '1',
            partNumber: 'STL-A36-PLT-1IN',
            quantityOrdered: 50,
            quantityReceived: 25,
            unitPrice: 150,
            currency: 'USD',
          },
        ],
        totalReceivedValue: '3750.00',
        currency: 'USD',
        notes: 'Partial receipt — balance to follow.',
      },
      // Full receipt against PO-200001 (Aceros del Norte, MX plant).
      {
        id: GR_IDS.acerosGr,
        grNumber: 'GR-2025-00050',
        poNumber: 'PO-200001',
        supplierCode: 'SUP-MX-001',
        vendorCode: null,
        supplierName: 'Aceros del Norte SA de CV',
        plantId: 'SAL01',
        receivedDate: daysAgo(1),
        status: 'FULLY_MATCHED',
        lineItems: [
          {
            poLineRef: '1',
            partNumber: 'STL-ASTM-A572',
            quantityOrdered: 500,
            quantityReceived: 500,
            unitPrice: 250,
            currency: 'MXN',
          },
        ],
        totalReceivedValue: '125000.00',
        currency: 'MXN',
        notes: null,
      },
    ])
    .orIgnore()
    .execute();
}

async function seedSyncRunLogs(ds: DataSource): Promise<void> {
  // One SUCCESS row per (instance, job_type) so the incremental-sync
  // watermark (`EpicorSyncService.getLastSuccessfulRunTime`) has data to
  // find on the very first dev run.
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const plus = (start: Date, seconds: number) =>
    new Date(start.getTime() + seconds * 1000);

  await ds
    .createQueryBuilder()
    .insert()
    .into(SyncRunLogEntity)
    .values([
      {
        id: SYNC_LOG_IDS.us1Suppliers,
        instanceId: 1,
        jobType: SyncJobType.SUPPLIERS,
        status: SyncStatus.SUCCESS,
        startedAt: yesterday,
        completedAt: plus(yesterday, 12),
        recordsFetched: 2,
        recordsInserted: 2,
        recordsUpdated: 0,
        recordsFailed: 0,
        triggeredBy: 'SEED',
      },
      {
        id: SYNC_LOG_IDS.us1Pos,
        instanceId: 1,
        jobType: SyncJobType.PURCHASE_ORDERS,
        status: SyncStatus.SUCCESS,
        startedAt: yesterday,
        completedAt: plus(yesterday, 8),
        recordsFetched: 1,
        recordsInserted: 1,
        recordsUpdated: 0,
        recordsFailed: 0,
        triggeredBy: 'SEED',
      },
      {
        id: SYNC_LOG_IDS.mx21Suppliers,
        instanceId: 21,
        jobType: SyncJobType.SUPPLIERS,
        status: SyncStatus.SUCCESS,
        startedAt: yesterday,
        completedAt: plus(yesterday, 5),
        recordsFetched: 1,
        recordsInserted: 1,
        recordsUpdated: 0,
        recordsFailed: 0,
        triggeredBy: 'SEED',
      },
      {
        id: SYNC_LOG_IDS.mx21Pos,
        instanceId: 21,
        jobType: SyncJobType.PURCHASE_ORDERS,
        status: SyncStatus.SUCCESS,
        startedAt: yesterday,
        completedAt: plus(yesterday, 6),
        recordsFetched: 1,
        recordsInserted: 1,
        recordsUpdated: 0,
        recordsFailed: 0,
        triggeredBy: 'SEED',
      },
    ])
    .orIgnore()
    .execute();
}

// ─────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    // Hard guard: this script writes synthetic data and must never touch a
    // real environment, even by accident. Fail loud rather than skip silently.
    throw new Error(
      '[seed] Refusing to run with NODE_ENV=production. ' +
        'Sample data is dev/testing only.',
    );
  }

  const ds = buildDataSource();
  await ds.initialize();
  console.log(
    `[seed] Connected to ${ds.options.database}@${(ds.options as { host?: string }).host}`,
  );

  try {
    // Insert order matters only loosely now (codes are denormalised, no FKs),
    // but we keep parents-first for readability.
    await seedSuppliers(ds);
    console.log('[seed] suppliers           ✓');
    await seedPurchaseOrders(ds);
    console.log('[seed] purchase_orders     ✓');
    await seedGoodsReceipts(ds);
    console.log('[seed] goods_receipts      ✓');
    await seedSyncRunLogs(ds);
    console.log('[seed] sync_run_logs       ✓');

    // Lightweight verification — surfaces row counts so the dev can confirm
    // at a glance that the seed actually wrote what it claimed to.
    const counts = await Promise.all([
      ds.getRepository(SupplierEntity).count(),
      ds.getRepository(PurchaseOrderEntity).count(),
      ds.getRepository(GoodsReceiptEntity).count(),
      ds.getRepository(SyncRunLogEntity).count(),
    ]);
    console.log('[seed] Row counts after seed:');
    console.log(`         suppliers       = ${counts[0]}`);
    console.log(`         purchase_orders = ${counts[1]}`);
    console.log(`         goods_receipts  = ${counts[2]}`);
    console.log(`         sync_run_logs   = ${counts[3]}`);
    console.log('[seed] Done.');
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('[seed] FAILED:', err);
  process.exit(1);
});
