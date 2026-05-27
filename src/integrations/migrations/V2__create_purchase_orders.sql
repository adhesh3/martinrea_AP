-- Owner: Manav (Integration Engineer)
-- Written by: INT-01/02 nightly sync
-- Coordinate with Roshni before running
--
-- Writers: `PurchaseOrdersSyncService.upsertToDatabase()` performs
--   INSERT ... ON CONFLICT (po_number, instance_id) DO UPDATE
--   inside a single transaction with the line-item replace-all in V3.
-- Readers: goods-receipts API (joined via purchase_orders), three-way
--   matching workbench (PO ↔ GR ↔ Invoice).
--
-- Dependencies:
--   - suppliers (V1) — required for the supplier_id FK.
--   Run this AFTER V1, BEFORE V3/V4/V5.

BEGIN;

CREATE TABLE IF NOT EXISTS purchase_orders (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number       VARCHAR(64)  NOT NULL,
    supplier_id     UUID,
    supplier_code   VARCHAR(64)  NOT NULL,
    instance_id     INTEGER      NOT NULL,
    status          VARCHAR(16)  NOT NULL DEFAULT 'OPEN',
    total_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
    currency        VARCHAR(3),
    plant_id        VARCHAR(16),
    need_by_date    DATE,
    last_synced_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT uq_po_number_instance UNIQUE (po_number, instance_id),
    CONSTRAINT ck_po_status          CHECK (status IN ('OPEN', 'CLOSED', 'PARTIAL')),
    CONSTRAINT fk_po_supplier_id
        FOREIGN KEY (supplier_id)
        REFERENCES suppliers (id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_po_instance_id
    ON purchase_orders (instance_id);

-- Postgres does not auto-index FK columns. Required for any
-- `JOIN suppliers ON suppliers.id = purchase_orders.supplier_id`.
CREATE INDEX IF NOT EXISTS idx_po_supplier_id
    ON purchase_orders (supplier_id)
    WHERE supplier_id IS NOT NULL;

-- Hot path on the matching workbench: "open POs for this supplier_code in
-- this plant" — predicate on the denormalised supplier_code lets us serve
-- the query even when supplier_id has been nulled by a supplier hard-delete.
CREATE INDEX IF NOT EXISTS idx_po_supplier_code_instance_status
    ON purchase_orders (supplier_code, instance_id, status)
    WHERE deleted_at IS NULL;

-- Need-by-date partial index for the "POs past due / due this week"
-- dashboards. Excludes closed POs since due dates on closed orders are
-- not meaningful.
CREATE INDEX IF NOT EXISTS idx_po_need_by_date_open
    ON purchase_orders (need_by_date)
    WHERE status = 'OPEN' AND deleted_at IS NULL;

COMMENT ON TABLE  purchase_orders IS
    'Canonical PO headers, sourced nightly from 44 Epicor plant instances. '
    'Lines live in purchase_order_lines (V3).';
COMMENT ON COLUMN purchase_orders.po_number     IS 'Epicor PONum (US) / NumOrden (MX). Unique only within instance_id.';
COMMENT ON COLUMN purchase_orders.supplier_id   IS 'FK to suppliers(id). Set NULL on supplier hard-delete; supplier_code retained as audit breadcrumb.';
COMMENT ON COLUMN purchase_orders.supplier_code IS 'Denormalised supplier code. Survives supplier hard-delete.';
COMMENT ON COLUMN purchase_orders.total_amount  IS 'PO header total, NUMERIC(14,2) for safe monetary math.';
COMMENT ON COLUMN purchase_orders.deleted_at    IS 'Soft-delete marker. PO_LINES cascade-delete on header hard-delete but survive soft-delete.';

COMMIT;
