ALTER TABLE "purchase_lines"
  ADD CONSTRAINT "purchase_lines_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "purchase_lines_price_nonnegative" CHECK ("unit_price" >= 0),
  ADD CONSTRAINT "purchase_lines_amount_nonnegative" CHECK ("line_amount" >= 0);

ALTER TABLE "purchase_documents"
  ADD CONSTRAINT "purchase_documents_total_nonnegative" CHECK ("total_amount" >= 0);

ALTER TABLE "payable_entries"
  ADD CONSTRAINT "payable_original_positive" CHECK ("original_amount" > 0),
  ADD CONSTRAINT "payable_outstanding_range" CHECK (
    "outstanding_amount" >= 0 AND "outstanding_amount" <= "original_amount"
  );

CREATE OR REPLACE FUNCTION enforce_purchase_draft_lines()
RETURNS trigger AS $$
DECLARE parent_status "PurchaseDocumentStatus";
BEGIN
  SELECT "status" INTO parent_status
  FROM "purchase_documents"
  WHERE "id" = COALESCE(NEW."document_id", OLD."document_id");
  IF parent_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'purchase lines can only change in DRAFT state';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER purchase_lines_draft_only
BEFORE INSERT OR UPDATE OR DELETE ON "purchase_lines"
FOR EACH ROW EXECUTE FUNCTION enforce_purchase_draft_lines();

CREATE SEQUENCE "purchase_receipt_number_seq" START 1;

CREATE INDEX "inventory_ledger_source_type_document_idx"
ON "inventory_ledger_entries" ("source_document_type", "source_document_id");
