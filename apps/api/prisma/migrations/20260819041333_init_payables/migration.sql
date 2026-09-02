-- CreateEnum
CREATE TYPE "CashAccountType" AS ENUM ('CASH', 'BANK', 'WECHAT', 'ALIPAY', 'OTHER');

-- CreateEnum
CREATE TYPE "CashAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SupplierPaymentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'POSTED', 'REVERSED', 'CANCELLED');

-- DropIndex
DROP INDEX "inventory_ledger_source_type_document_idx";

-- CreateTable
CREATE TABLE "cash_accounts" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" "CashAccountType" NOT NULL,
    "status" "CashAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cash_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_balances" (
    "id" UUID NOT NULL,
    "cash_account_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cash_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_ledger_entries" (
    "id" UUID NOT NULL,
    "cash_account_id" UUID NOT NULL,
    "source_document_type" VARCHAR(40) NOT NULL,
    "source_document_id" UUID NOT NULL,
    "amount_change" DECIMAL(19,4) NOT NULL,
    "business_date" DATE NOT NULL,
    "posted_by_id" UUID NOT NULL,
    "posted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payments" (
    "id" UUID NOT NULL,
    "document_number" VARCHAR(32) NOT NULL,
    "status" "SupplierPaymentStatus" NOT NULL DEFAULT 'DRAFT',
    "business_date" DATE NOT NULL,
    "supplier_id" UUID NOT NULL,
    "cash_account_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "notes" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "submitted_by_id" UUID,
    "submitted_at" TIMESTAMPTZ(3),
    "posted_by_id" UUID,
    "posted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL,
    "supplier_payment_id" UUID NOT NULL,
    "payable_entry_id" UUID NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_posting_requests" (
    "id" UUID NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "supplier_payment_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_posting_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cash_accounts_code_key" ON "cash_accounts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "cash_accounts_name_key" ON "cash_accounts"("name");

-- CreateIndex
CREATE INDEX "cash_accounts_status_name_idx" ON "cash_accounts"("status", "name");

-- CreateIndex
CREATE UNIQUE INDEX "cash_balances_cash_account_id_key" ON "cash_balances"("cash_account_id");

-- CreateIndex
CREATE INDEX "cash_ledger_entries_cash_account_id_posted_at_idx" ON "cash_ledger_entries"("cash_account_id", "posted_at");

-- CreateIndex
CREATE UNIQUE INDEX "cash_ledger_entries_source_document_type_source_document_id_key" ON "cash_ledger_entries"("source_document_type", "source_document_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payments_document_number_key" ON "supplier_payments"("document_number");

-- CreateIndex
CREATE INDEX "supplier_payments_supplier_id_status_business_date_idx" ON "supplier_payments"("supplier_id", "status", "business_date");

-- CreateIndex
CREATE INDEX "supplier_payments_cash_account_id_business_date_idx" ON "supplier_payments"("cash_account_id", "business_date");

-- CreateIndex
CREATE INDEX "payment_allocations_payable_entry_id_idx" ON "payment_allocations"("payable_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_supplier_payment_id_payable_entry_id_key" ON "payment_allocations"("supplier_payment_id", "payable_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_posting_requests_idempotency_key_key" ON "payment_posting_requests"("idempotency_key");

-- CreateIndex
CREATE INDEX "payment_posting_requests_supplier_payment_id_idx" ON "payment_posting_requests"("supplier_payment_id");

-- AddForeignKey
ALTER TABLE "cash_accounts" ADD CONSTRAINT "cash_accounts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_balances" ADD CONSTRAINT "cash_balances_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_ledger_entries" ADD CONSTRAINT "cash_ledger_entries_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_ledger_entries" ADD CONSTRAINT "cash_ledger_entries_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_supplier_payment_id_fkey" FOREIGN KEY ("supplier_payment_id") REFERENCES "supplier_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payable_entry_id_fkey" FOREIGN KEY ("payable_entry_id") REFERENCES "payable_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_posting_requests" ADD CONSTRAINT "payment_posting_requests_supplier_payment_id_fkey" FOREIGN KEY ("supplier_payment_id") REFERENCES "supplier_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
