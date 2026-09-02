CREATE SEQUENCE "purchase_return_number_seq" START 1;

CREATE TABLE "purchase_returns" (
  "id" UUID NOT NULL,
  "document_number" VARCHAR(32) NOT NULL,
  "idempotency_key" VARCHAR(100) NOT NULL,
  "source_purchase_document_id" UUID NOT NULL,
  "payable_entry_id" UUID NOT NULL,
  "business_date" DATE NOT NULL,
  "returned_at" TIMESTAMPTZ(3) NOT NULL,
  "supplier_id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "cash_account_id" UUID,
  "total_amount" DECIMAL(19,4) NOT NULL,
  "inventory_cost" DECIMAL(19,4) NOT NULL,
  "payable_reduction" DECIMAL(19,4) NOT NULL,
  "refund_amount" DECIMAL(19,4) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "posted_by_id" UUID NOT NULL,
  "posted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_returns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_return_amount_positive" CHECK ("total_amount" > 0),
  CONSTRAINT "purchase_return_inventory_cost_positive" CHECK ("inventory_cost" > 0),
  CONSTRAINT "purchase_return_settlement_nonnegative" CHECK ("payable_reduction" >= 0 AND "refund_amount" >= 0),
  CONSTRAINT "purchase_return_settlement_balanced" CHECK ("payable_reduction" + "refund_amount" = "total_amount"),
  CONSTRAINT "purchase_return_refund_account_required" CHECK ("refund_amount" = 0 OR "cash_account_id" IS NOT NULL)
);

CREATE TABLE "purchase_return_lines" (
  "id" UUID NOT NULL,
  "return_id" UUID NOT NULL,
  "source_purchase_line_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "product_name_snapshot" VARCHAR(160) NOT NULL,
  "unit_name_snapshot" VARCHAR(40) NOT NULL,
  "quantity" DECIMAL(19,6) NOT NULL,
  "unit_price" DECIMAL(19,4) NOT NULL,
  "line_amount" DECIMAL(19,4) NOT NULL,
  "unit_cost" DECIMAL(19,4) NOT NULL,
  "cost_amount" DECIMAL(19,4) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_return_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_return_line_values_positive" CHECK ("quantity" > 0 AND "unit_price" >= 0 AND "line_amount" >= 0 AND "unit_cost" >= 0 AND "cost_amount" >= 0)
);

CREATE UNIQUE INDEX "purchase_returns_document_number_key" ON "purchase_returns"("document_number");
CREATE UNIQUE INDEX "purchase_returns_idempotency_key_key" ON "purchase_returns"("idempotency_key");
CREATE INDEX "purchase_returns_source_purchase_document_id_posted_at_idx" ON "purchase_returns"("source_purchase_document_id", "posted_at");
CREATE INDEX "purchase_returns_supplier_id_business_date_idx" ON "purchase_returns"("supplier_id", "business_date");
CREATE INDEX "purchase_returns_warehouse_id_business_date_idx" ON "purchase_returns"("warehouse_id", "business_date");
CREATE INDEX "purchase_returns_cash_account_id_business_date_idx" ON "purchase_returns"("cash_account_id", "business_date");
CREATE UNIQUE INDEX "purchase_return_lines_return_id_source_purchase_line_id_key" ON "purchase_return_lines"("return_id", "source_purchase_line_id");
CREATE INDEX "purchase_return_lines_source_purchase_line_id_idx" ON "purchase_return_lines"("source_purchase_line_id");
CREATE INDEX "purchase_return_lines_product_id_idx" ON "purchase_return_lines"("product_id");

ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_source_purchase_document_id_fkey" FOREIGN KEY ("source_purchase_document_id") REFERENCES "purchase_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_payable_entry_id_fkey" FOREIGN KEY ("payable_entry_id") REFERENCES "payable_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "purchase_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_source_purchase_line_id_fkey" FOREIGN KEY ("source_purchase_line_id") REFERENCES "purchase_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_purchase_return_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'posted purchase returns are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER purchase_returns_immutable
BEFORE UPDATE OR DELETE ON "purchase_returns"
FOR EACH ROW EXECUTE FUNCTION prevent_purchase_return_mutation();

CREATE OR REPLACE FUNCTION enforce_purchase_return_line_immutability()
RETURNS trigger AS $$
DECLARE return_line_id UUID;
BEGIN
  return_line_id := COALESCE(NEW."id", OLD."id");
  IF TG_OP IN ('UPDATE', 'DELETE') OR EXISTS (
    SELECT 1 FROM "inventory_ledger_entries"
    WHERE "source_document_line_id" = return_line_id
  ) THEN
    RAISE EXCEPTION 'posted purchase return lines are immutable';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER purchase_return_lines_immutable
BEFORE INSERT OR UPDATE OR DELETE ON "purchase_return_lines"
FOR EACH ROW EXECUTE FUNCTION enforce_purchase_return_line_immutability();
