-- Owner: Manav (Integration Engineer)
-- Written by: INT-01/02 nightly sync
-- Coordinate with Roshni before running
--
-- Note: Like V4, this table is provisioned ahead of the Sprint-2 caching
-- layer. Today the live `/api/integrations/goods-receipts` API streams
-- normalised lines directly from Epicor; tomorrow it will write through to
-- this table.
--
-- Writers (planned): Sprint-2 caching layer for goods receipts.
-- Readers: live REST API (joined to goods_receipts), three-way matching
--   engine (po_line_number cross-references purchase_order_lines.line_number).
--
-- Dependencies:
--   - goods_receipts (V4) — required for the gr_id FK with ON DELETE CASCADE.
--   Run this AFTER V4.

BEGIN;

CREATE TABLE IF NOT EXISTS goods_receipt_lines (
    id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    gr_id              UUID          NOT NULL,
    line_number        INTEGER       NOT NULL,
    part_number        VARCHAR(100),
    description        TEXT,
    po_line_number     INTEGER,
    ordered_qty        NUMERIC(12,4) NOT NULL,
    received_qty       NUMERIC(12,4) NOT NULL,
    unit_price         NUMERIC(14,2) NOT NULL,
    line_total         NUMERIC(14,2) NOT NULL,
    lot_number         VARCHAR(100),
    received_complete  BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_gr_line_number UNIQUE (gr_id, line_number),
    CONSTRAINT fk_gr_line_gr_id
        FOREIGN KEY (gr_id)
        REFERENCES goods_receipts (id)
        ON DELETE CASCADE
);

-- FK index for parent-join queries.
CREATE INDEX IF NOT EXISTS idx_gr_lines_gr_id
    ON goods_receipt_lines (gr_id);

-- Part-number search across receipts (lot recall, MRP cross-reference).
CREATE INDEX IF NOT EXISTS idx_gr_lines_part_number
    ON goods_receipt_lines (part_number)
    WHERE part_number IS NOT NULL;

-- Lot-number lookups (quality / recall workflows).
CREATE INDEX IF NOT EXISTS idx_gr_lines_lot_number
    ON goods_receipt_lines (lot_number)
    WHERE lot_number IS NOT NULL;

-- Cross-reference index for three-way matching: "given a PO line, find the
-- receipts that booked against it". `po_line_number` is informational, not
-- an FK (receipts can arrive before the matching PO line is synced).
CREATE INDEX IF NOT EXISTS idx_gr_lines_po_line_number
    ON goods_receipt_lines (po_line_number)
    WHERE po_line_number IS NOT NULL;

COMMENT ON TABLE  goods_receipt_lines IS
    'Goods receipt line items. Cascade-delete with parent header. po_line_number '
    'is informational only (not an FK) so receipts can arrive ahead of their '
    'matching PO line during cross-system sync ordering.';
COMMENT ON COLUMN goods_receipt_lines.gr_id           IS 'FK to goods_receipts(id). ON DELETE CASCADE.';
COMMENT ON COLUMN goods_receipt_lines.po_line_number  IS 'Informational cross-reference to purchase_order_lines.line_number — NOT an FK.';
COMMENT ON COLUMN goods_receipt_lines.ordered_qty     IS 'Snapshot of PO line ordered_qty at receipt time. NUMERIC(12,4).';
COMMENT ON COLUMN goods_receipt_lines.received_qty    IS 'Actual quantity received. NUMERIC(12,4).';
COMMENT ON COLUMN goods_receipt_lines.received_complete IS 'TRUE when this line is fully received; closed lines are kept, not deleted.';

COMMIT;
