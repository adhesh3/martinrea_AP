-- ────────────────────────────────────────────────────────────────────
-- ⚠️  DEV / TESTING ONLY — DO NOT RUN IN PRODUCTION ⚠️
-- ────────────────────────────────────────────────────────────────────
--
-- Owner: Manav (Integration Engineer)
-- Purpose: Populate V1–V6 tables with a small, realistic, queryable
-- dataset so a developer can clone the repo, run migrations, run this
-- seed, and immediately have something to GET / sync against — without
-- needing to fire up the mock Epicor cron.
--
-- Idempotency: every INSERT uses a deterministic UUID + ON CONFLICT
-- DO NOTHING. Safe to re-run.
--
-- Prerequisites:
--   1. V1__create_suppliers.sql        has run
--   2. V2__create_purchase_orders.sql  has run
--   3. V3__create_purchase_order_lines.sql has run
--   4. V4__create_goods_receipts.sql   has run
--   5. V5__create_goods_receipt_lines.sql has run
--   6. V6__create_sync_run_logs.sql    has run
--
-- Run with:
--   psql $DATABASE_URL -f src/integrations/seeds/dev_sample_data.sql
--
-- Instance IDs used (must align with src/integrations/config/epicor-instances.config.ts):
--   1 = US plant (Detroit)
--   3 = US plant (Chicago)
--  21 = Mexico plant (Saltillo)
-- ────────────────────────────────────────────────────────────────────

BEGIN;

-- ────────────────────────────────────────────────────────────────────
-- Suppliers (3 total: 2 US, 1 MX)
-- ────────────────────────────────────────────────────────────────────
INSERT INTO suppliers (
  id, instance_id, supplier_code, supplier_name, tax_id,
  country, status, last_synced_at, created_at, updated_at
) VALUES
  ('11111111-1111-1111-1111-111111111001', 1,  'SUP-US-001',
   'Great Lakes Steel Co.',     '38-1234567', 'US', 'ACTIVE',
   NOW(), NOW(), NOW()),
  ('11111111-1111-1111-1111-111111111002', 3,  'SUP-US-002',
   'Detroit Metal Works LLC',   '38-7654321', 'US', 'ACTIVE',
   NOW(), NOW(), NOW()),
  ('11111111-1111-1111-1111-111111111003', 21, 'SUP-MX-001',
   'Aceros del Norte SA de CV', 'AND950101ABC', 'MX', 'ACTIVE',
   NOW(), NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────
-- Purchase orders (1 per supplier, 3 total)
-- ────────────────────────────────────────────────────────────────────
INSERT INTO purchase_orders (
  id, instance_id, supplier_id, po_number, status,
  total_amount, currency, need_by_date, last_synced_at,
  created_at, updated_at
) VALUES
  ('22222222-2222-2222-2222-222222222001', 1,
   '11111111-1111-1111-1111-111111111001', 'PO-100001', 'OPEN',
   12500.00, 'USD', NOW() + INTERVAL '14 days', NOW(), NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222002', 3,
   '11111111-1111-1111-1111-111111111002', 'PO-100002', 'OPEN',
   8400.50,  'USD', NOW() + INTERVAL '7 days',  NOW(), NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222003', 21,
   '11111111-1111-1111-1111-111111111003', 'PO-200001', 'OPEN',
   175000.00, 'MXN', NOW() + INTERVAL '21 days', NOW(), NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────
-- Purchase order lines (2–3 per PO)
-- ────────────────────────────────────────────────────────────────────
INSERT INTO purchase_order_lines (
  id, po_id, line_number, part_number, description,
  ordered_qty, unit_price, line_total, created_at, updated_at
) VALUES
  -- PO-100001 (Great Lakes Steel)
  ('33333333-3333-3333-3333-333333333001',
   '22222222-2222-2222-2222-222222222001', 1, 'STL-A36-PLT-1IN',
   'A36 Steel Plate, 1in thick',           50.000, 150.0000,  7500.00, NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333002',
   '22222222-2222-2222-2222-222222222001', 2, 'STL-A36-BAR-2IN',
   'A36 Steel Bar, 2in diameter',         100.000,  50.0000,  5000.00, NOW(), NOW()),
  -- PO-100002 (Detroit Metal Works)
  ('33333333-3333-3333-3333-333333333003',
   '22222222-2222-2222-2222-222222222002', 1, 'ALU-6061-SHT',
   'Aluminum 6061 Sheet, 0.125in',         30.000, 280.0167,  8400.50, NOW(), NOW()),
  -- PO-200001 (Aceros del Norte)
  ('33333333-3333-3333-3333-333333333004',
   '22222222-2222-2222-2222-222222222003', 1, 'STL-ASTM-A572',
   'ASTM A572 Grade 50 Plate',            500.000, 250.0000, 125000.00, NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333005',
   '22222222-2222-2222-2222-222222222003', 2, 'STL-ASTM-A36',
   'ASTM A36 Hot Rolled Coil',            200.000, 250.0000,  50000.00, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────
-- Goods receipts (1 per PO, partial receipt scenario)
-- ────────────────────────────────────────────────────────────────────
INSERT INTO goods_receipts (
  id, instance_id, po_id, packing_slip,
  received_at, received_by, created_at, updated_at
) VALUES
  ('44444444-4444-4444-4444-444444444001', 1,
   '22222222-2222-2222-2222-222222222001', 'PS-2025-00001',
   NOW() - INTERVAL '2 days', 'receiving.user@martinrea.com', NOW(), NOW()),
  ('44444444-4444-4444-4444-444444444002', 21,
   '22222222-2222-2222-2222-222222222003', 'PS-2025-00050',
   NOW() - INTERVAL '5 days', 'almacen.mx@martinrea.com', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────
-- Goods receipt lines
-- ────────────────────────────────────────────────────────────────────
INSERT INTO goods_receipt_lines (
  id, gr_id, po_line_id, line_number,
  received_qty, uom, created_at, updated_at
) VALUES
  -- PS-2025-00001 — partial receipt of PO-100001 line 1
  ('55555555-5555-5555-5555-555555555001',
   '44444444-4444-4444-4444-444444444001',
   '33333333-3333-3333-3333-333333333001', 1, 25.000, 'EA', NOW(), NOW()),
  -- PS-2025-00050 — full receipt of PO-200001 line 1
  ('55555555-5555-5555-5555-555555555002',
   '44444444-4444-4444-4444-444444444002',
   '33333333-3333-3333-3333-333333333004', 1, 500.000, 'EA', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────
-- Sync run logs — one SUCCESS row per (instance, job_type) so the
-- incremental-sync watermark (getLastSuccessfulRunTime) has data to
-- find on the very first dev run.
-- ────────────────────────────────────────────────────────────────────
INSERT INTO sync_run_logs (
  id, instance_id, job_type, status,
  records_fetched, records_inserted, records_updated, records_failed,
  started_at, completed_at, triggered_by, created_at
) VALUES
  ('66666666-6666-6666-6666-666666666001', 1,  'SUPPLIERS',       'SUCCESS',
   2, 2, 0, 0,
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '12 seconds',
   'SEED', NOW()),
  ('66666666-6666-6666-6666-666666666002', 1,  'PURCHASE_ORDERS', 'SUCCESS',
   1, 1, 0, 0,
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '8 seconds',
   'SEED', NOW()),
  ('66666666-6666-6666-6666-666666666003', 21, 'SUPPLIERS',       'SUCCESS',
   1, 1, 0, 0,
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '5 seconds',
   'SEED', NOW()),
  ('66666666-6666-6666-6666-666666666004', 21, 'PURCHASE_ORDERS', 'SUCCESS',
   1, 1, 0, 0,
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '6 seconds',
   'SEED', NOW())
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ────────────────────────────────────────────────────────────────────
-- Verification queries — run these after seeding to confirm
-- ────────────────────────────────────────────────────────────────────
-- SELECT instance_id, COUNT(*) FROM suppliers           GROUP BY 1 ORDER BY 1;
-- SELECT instance_id, COUNT(*) FROM purchase_orders     GROUP BY 1 ORDER BY 1;
-- SELECT po_id,       COUNT(*) FROM purchase_order_lines GROUP BY 1 ORDER BY 1;
-- SELECT instance_id, COUNT(*) FROM goods_receipts      GROUP BY 1 ORDER BY 1;
-- SELECT instance_id, job_type, status, completed_at
--   FROM sync_run_logs ORDER BY completed_at DESC;
