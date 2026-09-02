CREATE SEQUENCE "customer_receipt_number_seq" START 1;

CREATE TABLE "customer_receipts" (
  "id" UUID NOT NULL,
  "document_number" VARCHAR(32) NOT NULL,
  "idempotency_key" VARCHAR(100) NOT NULL,
  "business_date" DATE NOT NULL,
  "customer_id" UUID NOT NULL,
  "cash_account_id" UUID NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "notes" VARCHAR(500),
  "posted_by_id" UUID NOT NULL,
  "posted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_receipts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "receipt_allocations" (
  "id" UUID NOT NULL,
  "customer_receipt_id" UUID NOT NULL,
  "receivable_entry_id" UUID NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "receipt_allocations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_receipts_document_number_key" ON "customer_receipts"("document_number");
CREATE UNIQUE INDEX "customer_receipts_idempotency_key_key" ON "customer_receipts"("idempotency_key");
CREATE INDEX "customer_receipts_customer_id_business_date_idx" ON "customer_receipts"("customer_id", "business_date");
CREATE INDEX "customer_receipts_cash_account_id_business_date_idx" ON "customer_receipts"("cash_account_id", "business_date");
CREATE UNIQUE INDEX "receipt_allocations_customer_receipt_id_receivable_entry_id_key" ON "receipt_allocations"("customer_receipt_id", "receivable_entry_id");
CREATE INDEX "receipt_allocations_receivable_entry_id_idx" ON "receipt_allocations"("receivable_entry_id");

ALTER TABLE "customer_receipts" ADD CONSTRAINT "customer_receipts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_receipts" ADD CONSTRAINT "customer_receipts_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_receipts" ADD CONSTRAINT "customer_receipts_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "receipt_allocations" ADD CONSTRAINT "receipt_allocations_customer_receipt_id_fkey" FOREIGN KEY ("customer_receipt_id") REFERENCES "customer_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "receipt_allocations" ADD CONSTRAINT "receipt_allocations_receivable_entry_id_fkey" FOREIGN KEY ("receivable_entry_id") REFERENCES "receivable_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "customer_receipts" ADD CONSTRAINT "customer_receipts_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "receipt_allocations" ADD CONSTRAINT "receipt_allocations_amount_positive" CHECK ("amount" > 0);
