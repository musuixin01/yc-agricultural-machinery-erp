ALTER TABLE "sales_lines"
  ADD CONSTRAINT "sales_lines_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "sales_lines_price_nonnegative" CHECK ("unit_price" >= 0),
  ADD CONSTRAINT "sales_lines_amount_nonnegative" CHECK ("line_amount" >= 0),
  ADD CONSTRAINT "sales_lines_cost_nonnegative" CHECK ("unit_cost" >= 0 AND "cost_amount" >= 0);

ALTER TABLE "sales_documents"
  ADD CONSTRAINT "sales_documents_total_nonnegative" CHECK (
    "total_amount" >= 0 AND "total_cost" >= 0
  );

ALTER TABLE "receivable_entries"
  ADD CONSTRAINT "receivable_original_positive" CHECK ("original_amount" > 0),
  ADD CONSTRAINT "receivable_outstanding_range" CHECK (
    "outstanding_amount" >= 0 AND "outstanding_amount" <= "original_amount"
  );

CREATE OR REPLACE FUNCTION enforce_sales_draft_lines()
RETURNS trigger AS $$
DECLARE parent_status "SalesDocumentStatus";
BEGIN
  SELECT "status" INTO parent_status
  FROM "sales_documents"
  WHERE "id" = COALESCE(NEW."document_id", OLD."document_id");
  IF parent_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'sales lines can only change in DRAFT state';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sales_lines_draft_only
BEFORE INSERT OR UPDATE OR DELETE ON "sales_lines"
FOR EACH ROW EXECUTE FUNCTION enforce_sales_draft_lines();

CREATE SEQUENCE "sales_dispatch_number_seq" START 1;
