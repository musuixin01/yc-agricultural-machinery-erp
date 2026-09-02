-- One active opening balance document per warehouse.
CREATE UNIQUE INDEX "inventory_documents_one_opening_per_warehouse"
ON "inventory_documents" ("warehouse_id")
WHERE "type" = 'OPENING' AND "status" <> 'CANCELLED';

ALTER TABLE "inventory_document_lines"
  ADD CONSTRAINT "inventory_document_lines_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "inventory_document_lines_unit_cost_nonnegative" CHECK ("unit_cost" >= 0),
  ADD CONSTRAINT "inventory_document_lines_amount_nonnegative" CHECK ("line_amount" >= 0);

-- Formal inventory history is append-only. Corrections must create a linked reversal.
CREATE OR REPLACE FUNCTION prevent_inventory_ledger_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'inventory ledger entries are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_ledger_immutable
BEFORE UPDATE OR DELETE ON "inventory_ledger_entries"
FOR EACH ROW EXECUTE FUNCTION prevent_inventory_ledger_mutation();

-- Lines can only be changed while their parent document is a draft.
CREATE OR REPLACE FUNCTION enforce_inventory_draft_lines()
RETURNS trigger AS $$
DECLARE parent_status "InventoryDocumentStatus";
BEGIN
  SELECT "status" INTO parent_status
  FROM "inventory_documents"
  WHERE "id" = COALESCE(NEW."document_id", OLD."document_id");
  IF parent_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'inventory document lines can only change in DRAFT state';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_lines_draft_only
BEFORE INSERT OR UPDATE OR DELETE ON "inventory_document_lines"
FOR EACH ROW EXECUTE FUNCTION enforce_inventory_draft_lines();

CREATE SEQUENCE "opening_inventory_number_seq" START 1;
