/**
 * ⚠️  DEV / TESTING ONLY — refuses to run when NODE_ENV=production. ⚠️
 *
 * Owner: Manav (Integration Engineer)
 *
 * Loads a small, realistic dataset into V1–V6 tables so a developer can clone
 * the repo, run migrations, run this seed, and immediately have something to
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
 * Instance IDs used (must match `src/integrations/config/epicor-instances.config.ts`):
 *   1   = US plant (Detroit)
 *   3   = US plant (Chicago)
 *   21  = Mexico plant (Saltillo)
 */

import 'reflect-metadata';

import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { AuditLogEntity } from '../entities/audit-log.entity';
import { GoodsReceiptLineEntity } from '../entities/goods-receipt-line.entity';
import { GoodsReceiptEntity } from '../entities/goods-receipt.entity';
import { PurchaseOrderLineEntity } from '../entities/purchase-order-line.entity';
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
//   1111… = suppliers, 2222… = POs, 3333… = PO lines,
//   4444… = goods receipts, 5555… = GR lines, 6666… = sync run logs.
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

const PO_LINE_IDS = {
  glsteelL1: '33333333-3333-3333-3333-333333333001',
  glsteelL2: '33333333-3333-3333-3333-333333333002',
  dmwL1: '33333333-3333-3333-3333-333333333003',
  acerosL1: '33333333-3333-3333-3333-333333333004',
  acerosL2: '33333333-3333-3333-3333-333333333005',
} as const;

const GR_IDS = {
  glsteelGr: '44444444-4444-4444-4444-444444444001',
  acerosGr: '44444444-4444-4444-4444-444444444002',
} as const;

const GR_LINE_IDS = {
  glsteelGrL1: '55555555-5555-5555-5555-555555555001',
  acerosGrL1: '55555555-5555-5555-5555-555555555002',
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
      PurchaseOrderLineEntity,
      GoodsReceiptEntity,
      GoodsReceiptLineEntity,
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
  const now = new Date();
  await ds
    .createQueryBuilder()
    .insert()
    .into(SupplierEntity)
    .values([
      {
        id: SUPPLIER_IDS.greatLakes,
        instanceId: 1,
        supplierCode: 'SUP-US-001',
        supplierName: 'Great Lakes Steel Co.',
        taxId: '38-1234567',
        country: 'US',
        currencyCode: 'USD',
        payTerms: 'NET30',
        addressLine1: '1500 Industrial Pkwy',
        city: 'Detroit',
        stateProvince: 'MI',
        status: 'ACTIVE',
        lastSyncedAt: now,
      },
      {
        id: SUPPLIER_IDS.detroitMetal,
        instanceId: 3,
        supplierCode: 'SUP-US-002',
        supplierName: 'Detroit Metal Works LLC',
        taxId: '38-7654321',
        country: 'US',
        currencyCode: 'USD',
        payTerms: 'NET45',
        addressLine1: '4200 Cass Ave',
        city: 'Chicago',
        stateProvince: 'IL',
        status: 'ACTIVE',
        lastSyncedAt: now,
      },
      {
        id: SUPPLIER_IDS.acerosDelNorte,
        instanceId: 21,
        supplierCode: 'SUP-MX-001',
        supplierName: 'Aceros del Norte SA de CV',
        taxId: 'AND950101ABC',
        country: 'MX',
        currencyCode: 'MXN',
        payTerms: 'NET60',
        addressLine1: 'Av. Industrial 250',
        city: 'Saltillo',
        stateProvince: 'COA',
        status: 'ACTIVE',
        lastSyncedAt: now,
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
        supplierId: SUPPLIER_IDS.greatLakes,
        supplierCode: 'SUP-US-001',
        instanceId: 1,
        status: 'OPEN',
        totalAmount: '12500.00',
        currency: 'USD',
        plantId: 'DET01',
        needByDate: inDays(14),
        lastSyncedAt: now,
      },
      {
        id: PO_IDS.dmwPo,
        poNumber: 'PO-100002',
        supplierId: SUPPLIER_IDS.detroitMetal,
        supplierCode: 'SUP-US-002',
        instanceId: 3,
        status: 'OPEN',
        totalAmount: '8400.50',
        currency: 'USD',
        plantId: 'CHI01',
        needByDate: inDays(7),
        lastSyncedAt: now,
      },
      {
        id: PO_IDS.acerosPo,
        poNumber: 'PO-200001',
        supplierId: SUPPLIER_IDS.acerosDelNorte,
        supplierCode: 'SUP-MX-001',
        instanceId: 21,
        status: 'OPEN',
        totalAmount: '175000.00',
        currency: 'MXN',
        plantId: 'SAL01',
        needByDate: inDays(21),
        lastSyncedAt: now,
      },
    ])
    .orIgnore()
    .execute();
}

async function seedPurchaseOrderLines(ds: DataSource): Promise<void> {
  await ds
    .createQueryBuilder()
    .insert()
    .into(PurchaseOrderLineEntity)
    .values([
      // PO-100001 — Great Lakes Steel (2 lines)
      {
        id: PO_LINE_IDS.glsteelL1,
        poId: PO_IDS.glsteelPo,
        lineNumber: 1,
        partNumber: 'STL-A36-PLT-1IN',
        description: 'A36 Steel Plate, 1in thick',
        orderedQty: '50.0000',
        unitPrice: '150.00',
        lineTotal: '7500.00',
        unitOfMeasure: 'EA',
        openLine: true,
      },
      {
        id: PO_LINE_IDS.glsteelL2,
        poId: PO_IDS.glsteelPo,
        lineNumber: 2,
        partNumber: 'STL-A36-BAR-2IN',
        description: 'A36 Steel Bar, 2in diameter',
        orderedQty: '100.0000',
        unitPrice: '50.00',
        lineTotal: '5000.00',
        unitOfMeasure: 'EA',
        openLine: true,
      },
      // PO-100002 — Detroit Metal Works (1 line)
      {
        id: PO_LINE_IDS.dmwL1,
        poId: PO_IDS.dmwPo,
        lineNumber: 1,
        partNumber: 'ALU-6061-SHT',
        description: 'Aluminum 6061 Sheet, 0.125in',
        orderedQty: '30.0000',
        unitPrice: '280.02',
        lineTotal: '8400.50',
        unitOfMeasure: 'EA',
        openLine: true,
      },
      // PO-200001 — Aceros del Norte (2 lines, MX fractional kg quantities)
      {
        id: PO_LINE_IDS.acerosL1,
        poId: PO_IDS.acerosPo,
        lineNumber: 1,
        partNumber: 'STL-ASTM-A572',
        description: 'ASTM A572 Grade 50 Plate',
        orderedQty: '500.0000',
        unitPrice: '250.00',
        lineTotal: '125000.00',
        unitOfMeasure: 'KG',
        openLine: true,
      },
      {
        id: PO_LINE_IDS.acerosL2,
        poId: PO_IDS.acerosPo,
        lineNumber: 2,
        partNumber: 'STL-ASTM-A36',
        description: 'ASTM A36 Hot Rolled Coil',
        orderedQty: '200.0000',
        unitPrice: '250.00',
        lineTotal: '50000.00',
        unitOfMeasure: 'KG',
        openLine: true,
      },
    ])
    .orIgnore()
    .execute();
}

async function seedGoodsReceipts(ds: DataSource): Promise<void> {
  await ds
    .createQueryBuilder()
    .insert()
    .into(GoodsReceiptEntity)
    .values([
      // Partial receipt against PO-100001 from a US plant (ODBC source)
      {
        id: GR_IDS.glsteelGr,
        grNumber: 'GR-2025-00001',
        poId: PO_IDS.glsteelPo,
        poNumber: 'PO-100001',
        instanceId: 1,
        rawSource: 'US',
      },
      // Full receipt against PO-200001 from MX plant (CSV/XML over SFTP)
      {
        id: GR_IDS.acerosGr,
        grNumber: 'GR-2025-00050',
        poId: PO_IDS.acerosPo,
        poNumber: 'PO-200001',
        instanceId: 21,
        rawSource: 'MEXICO',
      },
    ])
    .orIgnore()
    .execute();
}

async function seedGoodsReceiptLines(ds: DataSource): Promise<void> {
  await ds
    .createQueryBuilder()
    .insert()
    .into(GoodsReceiptLineEntity)
    .values([
      // GR-2025-00001 line 1 — partial receipt of PO-100001 line 1 (25 of 50)
      {
        id: GR_LINE_IDS.glsteelGrL1,
        grId: GR_IDS.glsteelGr,
        lineNumber: 1,
        partNumber: 'STL-A36-PLT-1IN',
        description: 'A36 Steel Plate, 1in thick',
        poLineNumber: 1,
        orderedQty: '50.0000',
        receivedQty: '25.0000',
        unitPrice: '150.00',
        lineTotal: '3750.00',
        lotNumber: 'LOT-A36-2025-Q1',
        receivedComplete: false,
      },
      // GR-2025-00050 line 1 — full receipt of PO-200001 line 1 (500 of 500)
      {
        id: GR_LINE_IDS.acerosGrL1,
        grId: GR_IDS.acerosGr,
        lineNumber: 1,
        partNumber: 'STL-ASTM-A572',
        description: 'ASTM A572 Grade 50 Plate',
        poLineNumber: 1,
        orderedQty: '500.0000',
        receivedQty: '500.0000',
        unitPrice: '250.00',
        lineTotal: '125000.00',
        lotNumber: 'LOT-MX-2025-00050',
        receivedComplete: true,
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
    // Insert order matters: child tables reference parents via FK, so even
    // with `.orIgnore()` the parents must land first.
    await seedSuppliers(ds);
    console.log('[seed] suppliers           ✓');
    await seedPurchaseOrders(ds);
    console.log('[seed] purchase_orders     ✓');
    await seedPurchaseOrderLines(ds);
    console.log('[seed] purchase_order_lines ✓');
    await seedGoodsReceipts(ds);
    console.log('[seed] goods_receipts      ✓');
    await seedGoodsReceiptLines(ds);
    console.log('[seed] goods_receipt_lines ✓');
    await seedSyncRunLogs(ds);
    console.log('[seed] sync_run_logs       ✓');

    // Lightweight verification — surfaces row counts so the dev can confirm
    // at a glance that the seed actually wrote what it claimed to.
    const counts = await Promise.all([
      ds.getRepository(SupplierEntity).count(),
      ds.getRepository(PurchaseOrderEntity).count(),
      ds.getRepository(PurchaseOrderLineEntity).count(),
      ds.getRepository(GoodsReceiptEntity).count(),
      ds.getRepository(GoodsReceiptLineEntity).count(),
      ds.getRepository(SyncRunLogEntity).count(),
    ]);
    console.log('[seed] Row counts after seed:');
    console.log(`         suppliers            = ${counts[0]}`);
    console.log(`         purchase_orders      = ${counts[1]}`);
    console.log(`         purchase_order_lines = ${counts[2]}`);
    console.log(`         goods_receipts       = ${counts[3]}`);
    console.log(`         goods_receipt_lines  = ${counts[4]}`);
    console.log(`         sync_run_logs        = ${counts[5]}`);
    console.log('[seed] Done.');
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('[seed] FAILED:', err);
  process.exit(1);
});
