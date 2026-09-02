CREATE SEQUENCE "customer_advance_number_seq" START 1;
CREATE SEQUENCE "customer_advance_application_number_seq" START 1;

CREATE TABLE "customer_advance_receipts" (
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
  CONSTRAINT "customer_advance_receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_advance_receipt_amount_positive" CHECK ("amount" > 0)
);

CREATE TABLE "customer_advance_balances" (
  "id" UUID NOT NULL,
  "advance_receipt_id" UUID NOT NULL,
  "available_amount" DECIMAL(19,4) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "customer_advance_balances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_advance_balance_nonnegative" CHECK ("available_amount" >= 0)
);

CREATE TABLE "customer_advance_applications" (
  "id" UUID NOT NULL,
  "document_number" VARCHAR(32) NOT NULL,
  "idempotency_key" VARCHAR(100) NOT NULL,
  "advance_receipt_id" UUID NOT NULL,
  "business_date" DATE NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "posted_by_id" UUID NOT NULL,
  "posted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_advance_applications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_advance_application_amount_positive" CHECK ("amount" > 0)
);

CREATE TABLE "customer_advance_application_lines" (
  "id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "receivable_entry_id" UUID NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_advance_application_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_advance_application_line_amount_positive" CHECK ("amount" > 0)
);

CREATE TABLE "customer_advance_application_postings" (
  "id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_advance_application_postings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_advance_receipts_document_number_key" ON "customer_advance_receipts"("document_number");
CREATE UNIQUE INDEX "customer_advance_receipts_idempotency_key_key" ON "customer_advance_receipts"("idempotency_key");
CREATE INDEX "customer_advance_receipts_customer_id_business_date_idx" ON "customer_advance_receipts"("customer_id", "business_date");
CREATE INDEX "customer_advance_receipts_cash_account_id_business_date_idx" ON "customer_advance_receipts"("cash_account_id", "business_date");
CREATE UNIQUE INDEX "customer_advance_balances_advance_receipt_id_key" ON "customer_advance_balances"("advance_receipt_id");
CREATE UNIQUE INDEX "customer_advance_applications_document_number_key" ON "customer_advance_applications"("document_number");
CREATE UNIQUE INDEX "customer_advance_applications_idempotency_key_key" ON "customer_advance_applications"("idempotency_key");
CREATE INDEX "customer_advance_applications_advance_receipt_id_business_date_idx" ON "customer_advance_applications"("advance_receipt_id", "business_date");
CREATE UNIQUE INDEX "customer_advance_application_lines_application_id_receivable_entry_id_key" ON "customer_advance_application_lines"("application_id", "receivable_entry_id");
CREATE INDEX "customer_advance_application_lines_receivable_entry_id_idx" ON "customer_advance_application_lines"("receivable_entry_id");
CREATE UNIQUE INDEX "customer_advance_application_postings_application_id_key" ON "customer_advance_application_postings"("application_id");

ALTER TABLE "customer_advance_receipts" ADD CONSTRAINT "customer_advance_receipts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_advance_receipts" ADD CONSTRAINT "customer_advance_receipts_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_advance_receipts" ADD CONSTRAINT "customer_advance_receipts_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_advance_balances" ADD CONSTRAINT "customer_advance_balances_advance_receipt_id_fkey" FOREIGN KEY ("advance_receipt_id") REFERENCES "customer_advance_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_advance_applications" ADD CONSTRAINT "customer_advance_applications_advance_receipt_id_fkey" FOREIGN KEY ("advance_receipt_id") REFERENCES "customer_advance_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_advance_applications" ADD CONSTRAINT "customer_advance_applications_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_advance_application_lines" ADD CONSTRAINT "customer_advance_application_lines_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "customer_advance_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_advance_application_lines" ADD CONSTRAINT "customer_advance_application_lines_receivable_entry_id_fkey" FOREIGN KEY ("receivable_entry_id") REFERENCES "receivable_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_advance_application_postings" ADD CONSTRAINT "customer_advance_application_postings_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "customer_advance_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_customer_advance_header_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'posted customer advance documents are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customer_advance_receipts_immutable
BEFORE UPDATE OR DELETE ON "customer_advance_receipts"
FOR EACH ROW EXECUTE FUNCTION prevent_customer_advance_header_mutation();

CREATE TRIGGER customer_advance_applications_immutable
BEFORE UPDATE OR DELETE ON "customer_advance_applications"
FOR EACH ROW EXECUTE FUNCTION prevent_customer_advance_header_mutation();

CREATE TRIGGER customer_advance_application_postings_immutable
BEFORE UPDATE OR DELETE ON "customer_advance_application_postings"
FOR EACH ROW EXECUTE FUNCTION prevent_customer_advance_header_mutation();

CREATE OR REPLACE FUNCTION enforce_customer_advance_balance()
RETURNS trigger AS $$
DECLARE original_amount DECIMAL(19,4);
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'customer advance balances cannot be deleted';
  END IF;
  SELECT "amount" INTO original_amount
  FROM "customer_advance_receipts"
  WHERE "id" = NEW."advance_receipt_id";
  IF NEW."available_amount" < 0 OR NEW."available_amount" > original_amount THEN
    RAISE EXCEPTION 'customer advance available amount is outside valid range';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customer_advance_balance_guard
BEFORE INSERT OR UPDATE OR DELETE ON "customer_advance_balances"
FOR EACH ROW EXECUTE FUNCTION enforce_customer_advance_balance();

CREATE OR REPLACE FUNCTION enforce_customer_advance_application_lines()
RETURNS trigger AS $$
DECLARE parent_id UUID;
BEGIN
  parent_id := COALESCE(NEW."application_id", OLD."application_id");
  IF TG_OP IN ('UPDATE', 'DELETE') OR EXISTS (
    SELECT 1 FROM "customer_advance_application_postings"
    WHERE "application_id" = parent_id
  ) THEN
    RAISE EXCEPTION 'posted customer advance application lines are immutable';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customer_advance_application_lines_immutable
BEFORE INSERT OR UPDATE OR DELETE ON "customer_advance_application_lines"
FOR EACH ROW EXECUTE FUNCTION enforce_customer_advance_application_lines();
