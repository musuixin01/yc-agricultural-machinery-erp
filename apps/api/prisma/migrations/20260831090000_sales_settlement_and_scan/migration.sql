CREATE TYPE "SalesSettlementType" AS ENUM ('IMMEDIATE', 'CREDIT');

ALTER TABLE "sales_documents"
ADD COLUMN "settlement_type" "SalesSettlementType" NOT NULL DEFAULT 'IMMEDIATE',
ADD COLUMN "sold_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "cash_account_id" UUID;

ALTER TABLE "sales_documents"
ADD CONSTRAINT "sales_documents_cash_account_id_fkey"
FOREIGN KEY ("cash_account_id") REFERENCES "cash_accounts"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "sales_documents_cash_account_id_sold_at_idx"
ON "sales_documents"("cash_account_id", "sold_at");
