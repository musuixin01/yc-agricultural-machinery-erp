CREATE SEQUENCE "supplier_advance_number_seq" START 1;
CREATE SEQUENCE "supplier_advance_application_number_seq" START 1;

CREATE TABLE "supplier_advance_payments" (
  "id" UUID NOT NULL,
  "document_number" VARCHAR(32) NOT NULL,
  "idempotency_key" VARCHAR(100) NOT NULL,
  "business_date" DATE NOT NULL,
  "supplier_id" UUID NOT NULL,
  "cash_account_id" UUID NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "notes" VARCHAR(500),
  "posted_by_id" UUID NOT NULL,
  "posted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_advance_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_advance_payment_amount_positive" CHECK ("amount" > 0)
);

CREATE TABLE "supplier_advance_balances" (
  "id" UUID NOT NULL,
  "advance_payment_id" UUID NOT NULL,
  "available_amount" DECIMAL(19,4) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "supplier_advance_balances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_advance_balance_nonnegative" CHECK ("available_amount" >= 0)
);

CREATE TABLE "supplier_advance_applications" (
  "id" UUID NOT NULL,
  "document_number" VARCHAR(32) NOT NULL,
  "idempotency_key" VARCHAR(100) NOT NULL,
  "advance_payment_id" UUID NOT NULL,
  "business_date" DATE NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "posted_by_id" UUID NOT NULL,
  "posted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_advance_applications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_advance_application_amount_positive" CHECK ("amount" > 0)
);

CREATE TABLE "supplier_advance_application_lines" (
  "id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "payable_entry_id" UUID NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_advance_application_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_advance_application_line_amount_positive" CHECK ("amount" > 0)
);

CREATE TABLE "supplier_advance_application_postings" (
  "id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_advance_application_postings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "supplier_advance_payments_document_number_key" ON "supplier_advance_payments"("document_number");
CREATE UNIQUE INDEX "supplier_advance_payments_idempotency_key_key" ON "supplier_advance_payments"("idempotency_key");
CREATE INDEX "supplier_advance_payments_supplier_id_business_date_idx" ON "supplier_advance_payments"("supplier_id", "business_date");
CREATE INDEX "supplier_advance_payments_cash_account_id_business_date_idx" ON "supplier_advance_payments"("cash_account_id", "business_date");
CREATE UNIQUE INDEX "supplier_advance_balances_advance_payment_id_key" ON "supplier_advance_balances"("advance_payment_id");
CREATE UNIQUE INDEX "supplier_advance_applications_document_number_key" ON "supplier_advance_applications"("document_number");
CREATE UNIQUE INDEX "supplier_advance_applications_idempotency_key_key" ON "supplier_advance_applications"("idempotency_key");
CREATE INDEX "supplier_advance_applications_advance_payment_id_business_date_idx" ON "supplier_advance_applications"("advance_payment_id", "business_date");
CREATE UNIQUE INDEX "supplier_advance_application_lines_application_id_payable_entry_id_key" ON "supplier_advance_application_lines"("application_id", "payable_entry_id");
CREATE INDEX "supplier_advance_application_lines_payable_entry_id_idx" ON "supplier_advance_application_lines"("payable_entry_id");
CREATE UNIQUE INDEX "supplier_advance_application_postings_application_id_key" ON "supplier_advance_application_postings"("application_id");

ALTER TABLE "supplier_advance_payments" ADD CONSTRAINT "supplier_advance_payments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_advance_payments" ADD CONSTRAINT "supplier_advance_payments_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_advance_payments" ADD CONSTRAINT "supplier_advance_payments_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_advance_balances" ADD CONSTRAINT "supplier_advance_balances_advance_payment_id_fkey" FOREIGN KEY ("advance_payment_id") REFERENCES "supplier_advance_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_advance_applications" ADD CONSTRAINT "supplier_advance_applications_advance_payment_id_fkey" FOREIGN KEY ("advance_payment_id") REFERENCES "supplier_advance_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_advance_applications" ADD CONSTRAINT "supplier_advance_applications_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_advance_application_lines" ADD CONSTRAINT "supplier_advance_application_lines_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "supplier_advance_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_advance_application_lines" ADD CONSTRAINT "supplier_advance_application_lines_payable_entry_id_fkey" FOREIGN KEY ("payable_entry_id") REFERENCES "payable_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_advance_application_postings" ADD CONSTRAINT "supplier_advance_application_postings_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "supplier_advance_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_supplier_advance_header_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'posted supplier advance documents are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER supplier_advance_payments_immutable
BEFORE UPDATE OR DELETE ON "supplier_advance_payments"
FOR EACH ROW EXECUTE FUNCTION prevent_supplier_advance_header_mutation();

CREATE TRIGGER supplier_advance_applications_immutable
BEFORE UPDATE OR DELETE ON "supplier_advance_applications"
FOR EACH ROW EXECUTE FUNCTION prevent_supplier_advance_header_mutation();

CREATE TRIGGER supplier_advance_application_postings_immutable
BEFORE UPDATE OR DELETE ON "supplier_advance_application_postings"
FOR EACH ROW EXECUTE FUNCTION prevent_supplier_advance_header_mutation();

CREATE OR REPLACE FUNCTION enforce_supplier_advance_balance()
RETURNS trigger AS $$
DECLARE original_amount DECIMAL(19,4);
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'supplier advance balances cannot be deleted';
  END IF;
  SELECT "amount" INTO original_amount
  FROM "supplier_advance_payments"
  WHERE "id" = NEW."advance_payment_id";
  IF NEW."available_amount" < 0 OR NEW."available_amount" > original_amount THEN
    RAISE EXCEPTION 'supplier advance available amount is outside valid range';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER supplier_advance_balance_guard
BEFORE INSERT OR UPDATE OR DELETE ON "supplier_advance_balances"
FOR EACH ROW EXECUTE FUNCTION enforce_supplier_advance_balance();

CREATE OR REPLACE FUNCTION enforce_supplier_advance_application_lines()
RETURNS trigger AS $$
DECLARE parent_id UUID;
BEGIN
  parent_id := COALESCE(NEW."application_id", OLD."application_id");
  IF TG_OP IN ('UPDATE', 'DELETE') OR EXISTS (
    SELECT 1 FROM "supplier_advance_application_postings"
    WHERE "application_id" = parent_id
  ) THEN
    RAISE EXCEPTION 'posted supplier advance application lines are immutable';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER supplier_advance_application_lines_immutable
BEFORE INSERT OR UPDATE OR DELETE ON "supplier_advance_application_lines"
FOR EACH ROW EXECUTE FUNCTION enforce_supplier_advance_application_lines();
