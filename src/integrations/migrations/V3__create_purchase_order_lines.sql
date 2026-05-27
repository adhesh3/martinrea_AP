-- Owner: Manav (Integration Engineer)
-- Written by: INT-01/02 nightly sync
-- Coordinate with Roshni before running
--
-- Writers: `PurchaseOrdersSyncService.upsertToDatabase()` uses a
--   DELETE-then-INSERT replace-all per PO inside the same transaction as
--   the V2 header upsert. The (po_id, line_number) unique index protects
--   against concurrent writers landing two copies of the same line.
-- Readers: three-way matching workbench, AP invoice line-matching engine.
--
-- Dependencies:
--   - purchase_orders (V2) — required for the po_id FK with ON DELETE CASCADE.
--   Run this AFTER V2.

BEGIN;

CREATE TABLE IF NOT EXISTS purchase_order_lines (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id           UUID          NOT NULL,
    line_number     INTEGER       NOT NULL,
    part_number     VARCHAR(100),
    description     TEXT,
    ordered_qty     NUMERIC(12,4) NOT NULL,
    unit_price      NUMERIC(14,2) NOT NULL,
    line_total      NUMERIC(14,2) NOT NULL,
    unit_of_measure VARCHAR(20),
    open_line       BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_po_line_number UNIQUE (po_id, line_number),
    CONSTRAINT fk_po_line_po_id
        FOREIGN KEY (po_id)
        REFERENCES purchase_orders (id)
        ON DELETE CASCADE
);

-- FK index for parent-join queries (Postgres does not auto-create these).
CREATE INDEX IF NOT EXISTS idx_po_lines_po_id
    ON purchase_order_lines (po_id);

-- Hot path for "still receivable" line lookups during three-way matching.
CREATE INDEX IF NOT EXISTS idx_po_lines_open
    ON purchase_order_lines (po_id)
    WHERE open_line = TRUE;

-- Part-number search across all POs for cross-reference dashboards.
CREATE INDEX IF NOT EXISTS idx_po_lines_part_number
    ON purchase_order_lines (part_number)
    WHERE part_number IS NOT NULL;

COMMENT ON TABLE  purchase_order_lines IS
    'PO line items. Replace-all semantics: each nightly sync deletes existing '
    'lines for a PO and inserts the current set. Lines cascade-delete with parent.';
COMMENT ON COLUMN purchase_order_lines.po_id        IS 'FK to purchase_orders(id). ON DELETE CASCADE — lines never outlive their parent header.';
COMMENT ON COLUMN purchase_order_lines.ordered_qty  IS 'NUMERIC(12,4) to accommodate fractional kg / litre quantities from MX plants.';
COMMENT ON COLUMN purchase_order_lines.unit_price   IS 'Per-unit price in PO header currency. NUMERIC(14,2).';
COMMENT ON COLUMN purchase_order_lines.line_total   IS 'ordered_qty * unit_price snapshot at sync time. Recomputed each nightly run.';
COMMENT ON COLUMN purchase_order_lines.open_line    IS 'FALSE once fully received / closed at the source ERP. Closed lines are kept, not deleted.';

COMMIT;
