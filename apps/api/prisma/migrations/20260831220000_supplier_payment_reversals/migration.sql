CREATE SEQUENCE "supplier_payment_reversal_number_seq" START 1;

CREATE TABLE "supplier_payment_reversals" (
  "id" UUID NOT NULL,
  "document_number" VARCHAR(32) NOT NULL,
  "idempotency_key" VARCHAR(100) NOT NULL,
  "source_supplier_payment_id" UUID NOT NULL,
  "business_date" DATE NOT NULL,
  "reversed_at" TIMESTAMPTZ(3) NOT NULL,
  "supplier_id" UUID NOT NULL,
  "cash_account_id" UUID NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "posted_by_id" UUID NOT NULL,
  "posted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_payment_reversals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_payment_reversal_amount_positive" CHECK ("amount" > 0)
);

CREATE TABLE "supplier_payment_reversal_allocations" (
  "id" UUID NOT NULL,
  "reversal_id" UUID NOT NULL,
  "source_payment_allocation_id" UUID NOT NULL,
  "payable_entry_id" UUID NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_payment_reversal_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_payment_reversal_allocation_amount_positive" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "supplier_payment_reversals_document_number_key" ON "supplier_payment_reversals"("document_number");
CREATE UNIQUE INDEX "supplier_payment_reversals_idempotency_key_key" ON "supplier_payment_reversals"("idempotency_key");
CREATE UNIQUE INDEX "supplier_payment_reversals_source_supplier_payment_id_key" ON "supplier_payment_reversals"("source_supplier_payment_id");
CREATE INDEX "supplier_payment_reversals_supplier_id_business_date_idx" ON "supplier_payment_reversals"("supplier_id", "business_date");
CREATE INDEX "supplier_payment_reversals_cash_account_id_business_date_idx" ON "supplier_payment_reversals"("cash_account_id", "business_date");
CREATE UNIQUE INDEX "supplier_payment_reversal_allocations_source_payment_allocation_id_key" ON "supplier_payment_reversal_allocations"("source_payment_allocation_id");
CREATE INDEX "supplier_payment_reversal_allocations_reversal_id_idx" ON "supplier_payment_reversal_allocations"("reversal_id");
CREATE INDEX "supplier_payment_reversal_allocations_payable_entry_id_idx" ON "supplier_payment_reversal_allocations"("payable_entry_id");

ALTER TABLE "supplier_payment_reversals" ADD CONSTRAINT "supplier_payment_reversals_source_supplier_payment_id_fkey" FOREIGN KEY ("source_supplier_payment_id") REFERENCES "supplier_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payment_reversals" ADD CONSTRAINT "supplier_payment_reversals_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payment_reversals" ADD CONSTRAINT "supplier_payment_reversals_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payment_reversals" ADD CONSTRAINT "supplier_payment_reversals_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payment_reversal_allocations" ADD CONSTRAINT "supplier_payment_reversal_allocations_reversal_id_fkey" FOREIGN KEY ("reversal_id") REFERENCES "supplier_payment_reversals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_payment_reversal_allocations" ADD CONSTRAINT "supplier_payment_reversal_allocations_source_payment_allocation_id_fkey" FOREIGN KEY ("source_payment_allocation_id") REFERENCES "payment_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_payment_reversal_allocations" ADD CONSTRAINT "supplier_payment_reversal_allocations_payable_entry_id_fkey" FOREIGN KEY ("payable_entry_id") REFERENCES "payable_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_supplier_payment_reversal_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'posted supplier payment reversals are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER supplier_payment_reversals_immutable
BEFORE UPDATE OR DELETE ON "supplier_payment_reversals"
FOR EACH ROW EXECUTE FUNCTION prevent_supplier_payment_reversal_mutation();

CREATE OR REPLACE FUNCTION enforce_supplier_payment_reversal_allocation_immutability()
RETURNS trigger AS $$
DECLARE payment_reversal_id UUID;
BEGIN
  payment_reversal_id := COALESCE(NEW."reversal_id", OLD."reversal_id");
  IF TG_OP IN ('UPDATE', 'DELETE') OR EXISTS (
    SELECT 1 FROM "cash_ledger_entries"
    WHERE "source_document_type" = 'SUPPLIER_PAYMENT_REVERSAL'
      AND "source_document_id" = payment_reversal_id
  ) THEN
    RAISE EXCEPTION 'posted supplier payment reversal allocations are immutable';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER supplier_payment_reversal_allocations_immutable
BEFORE INSERT OR UPDATE OR DELETE ON "supplier_payment_reversal_allocations"
FOR EACH ROW EXECUTE FUNCTION enforce_supplier_payment_reversal_allocation_immutability();

CREATE OR REPLACE FUNCTION enforce_posted_supplier_payment_immutability()
RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'REVERSED' THEN
    RAISE EXCEPTION 'reversed supplier payments are immutable';
  END IF;
  IF OLD."status" = 'POSTED' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'posted supplier payments are immutable';
    END IF;
    IF NOT (
      NEW."status" = 'REVERSED'
      AND EXISTS (
        SELECT 1 FROM "supplier_payment_reversals"
        WHERE "source_supplier_payment_id" = OLD."id"
      )
      AND NEW."document_number" IS NOT DISTINCT FROM OLD."document_number"
      AND NEW."business_date" IS NOT DISTINCT FROM OLD."business_date"
      AND NEW."supplier_id" IS NOT DISTINCT FROM OLD."supplier_id"
      AND NEW."cash_account_id" IS NOT DISTINCT FROM OLD."cash_account_id"
      AND NEW."amount" IS NOT DISTINCT FROM OLD."amount"
      AND NEW."notes" IS NOT DISTINCT FROM OLD."notes"
      AND NEW."created_by_id" IS NOT DISTINCT FROM OLD."created_by_id"
      AND NEW."submitted_by_id" IS NOT DISTINCT FROM OLD."submitted_by_id"
      AND NEW."submitted_at" IS NOT DISTINCT FROM OLD."submitted_at"
      AND NEW."posted_by_id" IS NOT DISTINCT FROM OLD."posted_by_id"
      AND NEW."posted_at" IS NOT DISTINCT FROM OLD."posted_at"
      AND NEW."created_at" IS NOT DISTINCT FROM OLD."created_at"
    ) THEN
      RAISE EXCEPTION 'posted supplier payments are immutable except for reversal status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER supplier_payments_posted_immutable
BEFORE UPDATE OR DELETE ON "supplier_payments"
FOR EACH ROW EXECUTE FUNCTION enforce_posted_supplier_payment_immutability();
