CREATE SEQUENCE "sales_return_number_seq" START 1;

CREATE TABLE "sales_returns" (
  "id" UUID NOT NULL,
  "document_number" VARCHAR(32) NOT NULL,
  "idempotency_key" VARCHAR(100) NOT NULL,
  "source_sales_document_id" UUID NOT NULL,
  "business_date" DATE NOT NULL,
  "returned_at" TIMESTAMPTZ(3) NOT NULL,
  "customer_id" UUID NOT NULL,
  "customer_name_snapshot" VARCHAR(160) NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "cash_account_id" UUID,
  "total_amount" DECIMAL(19,4) NOT NULL,
  "total_cost" DECIMAL(19,4) NOT NULL,
  "receivable_reduction" DECIMAL(19,4) NOT NULL,
  "refund_amount" DECIMAL(19,4) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "posted_by_id" UUID NOT NULL,
  "posted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sales_returns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_return_amounts_nonnegative" CHECK (
    "total_amount" > 0 AND "total_cost" >= 0
    AND "receivable_reduction" >= 0 AND "refund_amount" >= 0
    AND "receivable_reduction" + "refund_amount" = "total_amount"
  )
);

CREATE TABLE "sales_return_lines" (
  "id" UUID NOT NULL,
  "return_id" UUID NOT NULL,
  "source_sales_line_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "product_name_snapshot" VARCHAR(160) NOT NULL,
  "unit_name_snapshot" VARCHAR(40) NOT NULL,
  "quantity" DECIMAL(19,6) NOT NULL,
  "unit_price" DECIMAL(19,4) NOT NULL,
  "line_amount" DECIMAL(19,4) NOT NULL,
  "unit_cost" DECIMAL(19,4) NOT NULL,
  "cost_amount" DECIMAL(19,4) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sales_return_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_return_line_values" CHECK (
    "quantity" > 0 AND "unit_price" >= 0 AND "line_amount" >= 0
    AND "unit_cost" >= 0 AND "cost_amount" >= 0
  )
);

CREATE UNIQUE INDEX "sales_returns_document_number_key" ON "sales_returns"("document_number");
CREATE UNIQUE INDEX "sales_returns_idempotency_key_key" ON "sales_returns"("idempotency_key");
CREATE INDEX "sales_returns_source_sales_document_id_posted_at_idx" ON "sales_returns"("source_sales_document_id", "posted_at");
CREATE INDEX "sales_returns_customer_id_business_date_idx" ON "sales_returns"("customer_id", "business_date");
CREATE INDEX "sales_returns_warehouse_id_business_date_idx" ON "sales_returns"("warehouse_id", "business_date");
CREATE UNIQUE INDEX "sales_return_lines_return_id_source_sales_line_id_key" ON "sales_return_lines"("return_id", "source_sales_line_id");
CREATE INDEX "sales_return_lines_source_sales_line_id_idx" ON "sales_return_lines"("source_sales_line_id");
CREATE INDEX "sales_return_lines_product_id_idx" ON "sales_return_lines"("product_id");

ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_source_sales_document_id_fkey" FOREIGN KEY ("source_sales_document_id") REFERENCES "sales_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "sales_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_source_sales_line_id_fkey" FOREIGN KEY ("source_sales_line_id") REFERENCES "sales_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
