-- Owner: Manav (Integration Engineer)
-- Written by: INT-01/02 nightly sync
-- Coordinate with Roshni before running
--
-- Note: Goods receipts are currently READ live from Epicor (INT-03), not
-- written by the nightly sync. This table is provisioned now so Sprint-2's
-- caching layer (which will buffer receipts to absorb Epicor SLA blips) has
-- a destination ready, and so the canonical FK chain
--   suppliers → purchase_orders → goods_receipts → goods_receipt_lines
-- can be enforced end-to-end.
--
-- Writers (planned): Sprint-2 caching layer for goods receipts.
-- Readers: live REST API `/api/integrations/goods-receipts` (joined back
--   to purchase_orders for the three-way matching workbench).
--
-- Dependencies:
--   - purchase_orders (V2) — required for the po_id FK.
--   Run this AFTER V2.

BEGIN;

CREATE TABLE IF NOT EXISTS goods_receipts (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    gr_number    VARCHAR(64)  NOT NULL,
    po_id        UUID,
    po_number    VARCHAR(64)  NOT NULL,
    instance_id  INTEGER      NOT NULL,
    raw_source   VARCHAR(8)   NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_gr_number_instance UNIQUE (gr_number, instance_id),
    CONSTRAINT ck_gr_raw_source      CHECK (raw_source IN ('US', 'MEXICO')),
    CONSTRAINT fk_gr_po_id
        FOREIGN KEY (po_id)
        REFERENCES purchase_orders (id)
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_gr_instance_id
    ON goods_receipts (instance_id);

-- FK index — required for any `JOIN purchase_orders ON ... = po_id`.
CREATE INDEX IF NOT EXISTS idx_gr_po_id
    ON goods_receipts (po_id)
    WHERE po_id IS NOT NULL;

-- Hot path of the live API: `WHERE po_number = $1 AND instance_id = $2`.
-- Falls back to the denormalised po_number when po_id is NULL (orphaned
-- after a PO hard-delete).
CREATE INDEX IF NOT EXISTS idx_gr_po_number_instance
    ON goods_receipts (po_number, instance_id);

COMMENT ON TABLE  goods_receipts IS
    'Goods receipt headers. Immutable once written (no updated_at, no '
    'deleted_at). Incorrect receipts are reversed by a compensating receipt, '
    'never patched. Currently sourced live from Epicor via INT-03; Sprint-2 '
    'will start caching here.';
COMMENT ON COLUMN goods_receipts.po_id      IS 'FK to purchase_orders(id). Nullable + ON DELETE SET NULL.';
COMMENT ON COLUMN goods_receipts.po_number  IS 'Denormalised PO number. Survives PO hard-delete; primary lookup key for the live API.';
COMMENT ON COLUMN goods_receipts.raw_source IS 'Which regional adapter produced this row: US (ODBC) or MEXICO (SFTP CSV/XML).';

COMMIT;
