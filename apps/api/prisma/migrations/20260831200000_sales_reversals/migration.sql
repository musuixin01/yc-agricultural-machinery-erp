CREATE SEQUENCE "sales_reversal_number_seq" START 1;

CREATE TABLE "sales_reversals" (
  "id" UUID NOT NULL,
  "document_number" VARCHAR(32) NOT NULL,
  "idempotency_key" VARCHAR(100) NOT NULL,
  "source_sales_document_id" UUID NOT NULL,
  "business_date" DATE NOT NULL,
  "reversed_at" TIMESTAMPTZ(3) NOT NULL,
  "total_amount" DECIMAL(19,4) NOT NULL,
  "total_cost" DECIMAL(19,4) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "posted_by_id" UUID NOT NULL,
  "posted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sales_reversals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_reversal_amounts_nonnegative" CHECK ("total_amount" >= 0 AND "total_cost" >= 0)
);

CREATE TABLE "sales_reversal_lines" (
  "id" UUID NOT NULL,
  "reversal_id" UUID NOT NULL,
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
  CONSTRAINT "sales_reversal_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_reversal_line_values" CHECK (
    "quantity" > 0 AND "unit_price" >= 0 AND "line_amount" >= 0
    AND "unit_cost" >= 0 AND "cost_amount" >= 0
  )
);

CREATE UNIQUE INDEX "sales_reversals_document_number_key" ON "sales_reversals"("document_number");
CREATE UNIQUE INDEX "sales_reversals_idempotency_key_key" ON "sales_reversals"("idempotency_key");
CREATE UNIQUE INDEX "sales_reversals_source_sales_document_id_key" ON "sales_reversals"("source_sales_document_id");
CREATE INDEX "sales_reversals_business_date_posted_at_idx" ON "sales_reversals"("business_date", "posted_at");
CREATE UNIQUE INDEX "sales_reversal_lines_reversal_id_source_sales_line_id_key" ON "sales_reversal_lines"("reversal_id", "source_sales_line_id");
CREATE INDEX "sales_reversal_lines_source_sales_line_id_idx" ON "sales_reversal_lines"("source_sales_line_id");
CREATE INDEX "sales_reversal_lines_product_id_idx" ON "sales_reversal_lines"("product_id");

ALTER TABLE "sales_reversals" ADD CONSTRAINT "sales_reversals_source_sales_document_id_fkey" FOREIGN KEY ("source_sales_document_id") REFERENCES "sales_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_reversals" ADD CONSTRAINT "sales_reversals_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_reversal_lines" ADD CONSTRAINT "sales_reversal_lines_reversal_id_fkey" FOREIGN KEY ("reversal_id") REFERENCES "sales_reversals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_reversal_lines" ADD CONSTRAINT "sales_reversal_lines_source_sales_line_id_fkey" FOREIGN KEY ("source_sales_line_id") REFERENCES "sales_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_reversal_lines" ADD CONSTRAINT "sales_reversal_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
