-- CreateEnum
CREATE TYPE "PurchaseDocumentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'POSTED', 'REVERSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayableEntryStatus" AS ENUM ('OPEN', 'PARTIALLY_SETTLED', 'SETTLED', 'REVERSED');

-- DropForeignKey
ALTER TABLE "inventory_ledger_entries" DROP CONSTRAINT "inventory_ledger_entries_source_document_id_fkey";

-- DropForeignKey
ALTER TABLE "inventory_ledger_entries" DROP CONSTRAINT "inventory_ledger_entries_source_document_line_id_fkey";

-- AlterTable
ALTER TABLE "inventory_ledger_entries" ADD COLUMN     "source_document_type" VARCHAR(40) NOT NULL DEFAULT 'OPENING';

-- CreateTable
CREATE TABLE "purchase_documents" (
    "id" UUID NOT NULL,
    "document_number" VARCHAR(32) NOT NULL,
    "status" "PurchaseDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "business_date" DATE NOT NULL,
    "supplier_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "due_date" DATE NOT NULL,
    "total_amount" DECIMAL(19,4) NOT NULL,
    "notes" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "submitted_by_id" UUID,
    "submitted_at" TIMESTAMPTZ(3),
    "posted_by_id" UUID,
    "posted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "purchase_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_lines" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_name_snapshot" VARCHAR(160) NOT NULL,
    "unit_name_snapshot" VARCHAR(40) NOT NULL,
    "quantity" DECIMAL(19,6) NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "line_amount" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_posting_requests" (
    "id" UUID NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "document_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_posting_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payable_entries" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "source_document_id" UUID NOT NULL,
    "original_amount" DECIMAL(19,4) NOT NULL,
    "outstanding_amount" DECIMAL(19,4) NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "PayableEntryStatus" NOT NULL DEFAULT 'OPEN',
    "posted_by_id" UUID NOT NULL,
    "posted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payable_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_documents_document_number_key" ON "purchase_documents"("document_number");

-- CreateIndex
CREATE INDEX "purchase_documents_status_business_date_idx" ON "purchase_documents"("status", "business_date");

-- CreateIndex
CREATE INDEX "purchase_documents_supplier_id_business_date_idx" ON "purchase_documents"("supplier_id", "business_date");

-- CreateIndex
CREATE INDEX "purchase_documents_warehouse_id_business_date_idx" ON "purchase_documents"("warehouse_id", "business_date");

-- CreateIndex
CREATE INDEX "purchase_lines_product_id_idx" ON "purchase_lines"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_lines_document_id_product_id_key" ON "purchase_lines"("document_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_posting_requests_idempotency_key_key" ON "purchase_posting_requests"("idempotency_key");

-- CreateIndex
CREATE INDEX "purchase_posting_requests_document_id_idx" ON "purchase_posting_requests"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "payable_entries_source_document_id_key" ON "payable_entries"("source_document_id");

-- CreateIndex
CREATE INDEX "payable_entries_supplier_id_status_due_date_idx" ON "payable_entries"("supplier_id", "status", "due_date");

-- AddForeignKey
ALTER TABLE "purchase_documents" ADD CONSTRAINT "purchase_documents_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_documents" ADD CONSTRAINT "purchase_documents_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_documents" ADD CONSTRAINT "purchase_documents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_documents" ADD CONSTRAINT "purchase_documents_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_documents" ADD CONSTRAINT "purchase_documents_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "purchase_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_posting_requests" ADD CONSTRAINT "purchase_posting_requests_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "purchase_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payable_entries" ADD CONSTRAINT "payable_entries_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payable_entries" ADD CONSTRAINT "payable_entries_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "purchase_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payable_entries" ADD CONSTRAINT "payable_entries_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
