-- Owner: Manav (Integration Engineer)
-- Written by: INT-01/02 nightly sync
-- Coordinate with Roshni before running
--
-- Writers: `SuppliersSyncService.upsertToDatabase()` performs
--   INSERT ... ON CONFLICT (supplier_code, instance_id) DO UPDATE
-- Readers: `PurchaseOrdersSyncService` (FK from purchase_orders.supplier_id),
--   goods-receipts API (joined via purchase_orders → suppliers).
--
-- Dependencies:
--   None. This is the root of the integrations schema chain — Roshni's tables
--   are not referenced by suppliers. Run this first inside the integrations
--   migration sequence.

BEGIN;

CREATE TABLE IF NOT EXISTS suppliers (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_code   VARCHAR(64)  NOT NULL,
    supplier_name   VARCHAR(256) NOT NULL,
    tax_id          VARCHAR(32),
    country         VARCHAR(2)   NOT NULL,
    currency_code   VARCHAR(3)   NOT NULL,
    pay_terms       VARCHAR(64),
    address_line1   VARCHAR(256),
    city            VARCHAR(128),
    state_province  VARCHAR(128),
    status          VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE',
    instance_id     INTEGER      NOT NULL,
    last_synced_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT uq_suppliers_code_instance UNIQUE (supplier_code, instance_id),
    CONSTRAINT ck_suppliers_status        CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

-- Filter-by-plant queries from the matching workbench and ad-hoc reporting.
CREATE INDEX IF NOT EXISTS idx_suppliers_instance_id
    ON suppliers (instance_id);

-- Partial index on live rows — keeps soft-deleted rows out of the hot path
-- on the workbench supplier picker (`WHERE deleted_at IS NULL`).
CREATE INDEX IF NOT EXISTS idx_suppliers_live
    ON suppliers (instance_id, status)
    WHERE deleted_at IS NULL;

-- Tax-ID lookups are rare but happen during AP exception triage.
CREATE INDEX IF NOT EXISTS idx_suppliers_tax_id
    ON suppliers (tax_id)
    WHERE tax_id IS NOT NULL;

COMMENT ON TABLE  suppliers IS
    'Canonical supplier master, sourced nightly from 44 Epicor plant instances. '
    'Normalised across US (VendorNum) and Mexico (CodigoProveedor) shapes.';
COMMENT ON COLUMN suppliers.supplier_code  IS 'Epicor VendorNum (US) / CodigoProveedor (MX). Unique only within instance_id.';
COMMENT ON COLUMN suppliers.country        IS 'ISO 3166-1 alpha-2 country code.';
COMMENT ON COLUMN suppliers.currency_code  IS 'ISO 4217 currency code.';
COMMENT ON COLUMN suppliers.instance_id    IS 'Epicor plant instance (1..44). See config/epicor-instances.config.ts.';
COMMENT ON COLUMN suppliers.deleted_at     IS 'Soft-delete marker. Hard deletes are never issued — rows persist forever for audit.';

COMMIT;
