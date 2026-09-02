CREATE SEQUENCE "customer_receipt_reversal_number_seq" START 1;

CREATE TABLE "customer_receipt_reversals" (
  "id" UUID NOT NULL,
  "document_number" VARCHAR(32) NOT NULL,
  "idempotency_key" VARCHAR(100) NOT NULL,
  "source_customer_receipt_id" UUID NOT NULL,
  "business_date" DATE NOT NULL,
  "reversed_at" TIMESTAMPTZ(3) NOT NULL,
  "customer_id" UUID NOT NULL,
  "cash_account_id" UUID NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "posted_by_id" UUID NOT NULL,
  "posted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_receipt_reversals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_receipt_reversal_amount_positive" CHECK ("amount" > 0)
);

CREATE TABLE "customer_receipt_reversal_allocations" (
  "id" UUID NOT NULL,
  "reversal_id" UUID NOT NULL,
  "source_receipt_allocation_id" UUID NOT NULL,
  "receivable_entry_id" UUID NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_receipt_reversal_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_receipt_reversal_allocation_amount_positive" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "customer_receipt_reversals_document_number_key" ON "customer_receipt_reversals"("document_number");
CREATE UNIQUE INDEX "customer_receipt_reversals_idempotency_key_key" ON "customer_receipt_reversals"("idempotency_key");
CREATE UNIQUE INDEX "customer_receipt_reversals_source_customer_receipt_id_key" ON "customer_receipt_reversals"("source_customer_receipt_id");
CREATE INDEX "customer_receipt_reversals_customer_id_business_date_idx" ON "customer_receipt_reversals"("customer_id", "business_date");
CREATE INDEX "customer_receipt_reversals_cash_account_id_business_date_idx" ON "customer_receipt_reversals"("cash_account_id", "business_date");
CREATE UNIQUE INDEX "customer_receipt_reversal_allocations_source_receipt_allocation_id_key" ON "customer_receipt_reversal_allocations"("source_receipt_allocation_id");
CREATE INDEX "customer_receipt_reversal_allocations_reversal_id_idx" ON "customer_receipt_reversal_allocations"("reversal_id");
CREATE INDEX "customer_receipt_reversal_allocations_receivable_entry_id_idx" ON "customer_receipt_reversal_allocations"("receivable_entry_id");

ALTER TABLE "customer_receipt_reversals" ADD CONSTRAINT "customer_receipt_reversals_source_customer_receipt_id_fkey" FOREIGN KEY ("source_customer_receipt_id") REFERENCES "customer_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_receipt_reversals" ADD CONSTRAINT "customer_receipt_reversals_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_receipt_reversals" ADD CONSTRAINT "customer_receipt_reversals_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_receipt_reversals" ADD CONSTRAINT "customer_receipt_reversals_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_receipt_reversal_allocations" ADD CONSTRAINT "customer_receipt_reversal_allocations_reversal_id_fkey" FOREIGN KEY ("reversal_id") REFERENCES "customer_receipt_reversals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_receipt_reversal_allocations" ADD CONSTRAINT "customer_receipt_reversal_allocations_source_receipt_allocation_id_fkey" FOREIGN KEY ("source_receipt_allocation_id") REFERENCES "receipt_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_receipt_reversal_allocations" ADD CONSTRAINT "customer_receipt_reversal_allocations_receivable_entry_id_fkey" FOREIGN KEY ("receivable_entry_id") REFERENCES "receivable_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_customer_receipt_reversal_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'posted customer receipt reversals are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customer_receipt_reversals_immutable
BEFORE UPDATE OR DELETE ON "customer_receipt_reversals"
FOR EACH ROW EXECUTE FUNCTION prevent_customer_receipt_reversal_mutation();

CREATE TRIGGER customer_receipt_reversal_allocations_immutable
BEFORE UPDATE OR DELETE ON "customer_receipt_reversal_allocations"
FOR EACH ROW EXECUTE FUNCTION prevent_customer_receipt_reversal_mutation();
