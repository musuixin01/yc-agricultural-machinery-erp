CREATE SEQUENCE "cash_transfer_number_seq" START 1;

CREATE TABLE "cash_transfers" (
  "id" UUID NOT NULL,
  "document_number" VARCHAR(32) NOT NULL,
  "idempotency_key" VARCHAR(100) NOT NULL,
  "business_date" DATE NOT NULL,
  "from_cash_account_id" UUID NOT NULL,
  "to_cash_account_id" UUID NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "notes" VARCHAR(500),
  "posted_by_id" UUID NOT NULL,
  "posted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cash_transfers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cash_transfer_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "cash_transfer_accounts_different" CHECK ("from_cash_account_id" <> "to_cash_account_id")
);

CREATE UNIQUE INDEX "cash_transfers_document_number_key" ON "cash_transfers"("document_number");
CREATE UNIQUE INDEX "cash_transfers_idempotency_key_key" ON "cash_transfers"("idempotency_key");
CREATE INDEX "cash_transfers_from_cash_account_id_business_date_idx" ON "cash_transfers"("from_cash_account_id", "business_date");
CREATE INDEX "cash_transfers_to_cash_account_id_business_date_idx" ON "cash_transfers"("to_cash_account_id", "business_date");

ALTER TABLE "cash_transfers" ADD CONSTRAINT "cash_transfers_from_cash_account_id_fkey" FOREIGN KEY ("from_cash_account_id") REFERENCES "cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_transfers" ADD CONSTRAINT "cash_transfers_to_cash_account_id_fkey" FOREIGN KEY ("to_cash_account_id") REFERENCES "cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_transfers" ADD CONSTRAINT "cash_transfers_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_cash_transfer_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'posted cash transfers are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cash_transfers_immutable
BEFORE UPDATE OR DELETE ON "cash_transfers"
FOR EACH ROW EXECUTE FUNCTION prevent_cash_transfer_mutation();
