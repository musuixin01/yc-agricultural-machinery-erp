-- CreateEnum
CREATE TYPE "SalesDocumentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'POSTED', 'REVERSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReceivableEntryStatus" AS ENUM ('OPEN', 'PARTIALLY_SETTLED', 'SETTLED', 'REVERSED');

-- CreateTable
CREATE TABLE "sales_documents" (
    "id" UUID NOT NULL,
    "document_number" VARCHAR(32) NOT NULL,
    "status" "SalesDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "business_date" DATE NOT NULL,
    "customer_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "due_date" DATE NOT NULL,
    "total_amount" DECIMAL(19,4) NOT NULL,
    "total_cost" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "gross_profit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "notes" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "submitted_by_id" UUID,
    "submitted_at" TIMESTAMPTZ(3),
    "posted_by_id" UUID,
    "posted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_lines" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_name_snapshot" VARCHAR(160) NOT NULL,
    "unit_name_snapshot" VARCHAR(40) NOT NULL,
    "quantity" DECIMAL(19,6) NOT NULL,
    "unit_price" DECIMAL(19,4) NOT NULL,
    "line_amount" DECIMAL(19,4) NOT NULL,
    "unit_cost" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "cost_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "gross_profit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_posting_requests" (
    "id" UUID NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "document_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_posting_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receivable_entries" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "source_document_id" UUID NOT NULL,
    "original_amount" DECIMAL(19,4) NOT NULL,
    "outstanding_amount" DECIMAL(19,4) NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "ReceivableEntryStatus" NOT NULL DEFAULT 'OPEN',
    "posted_by_id" UUID NOT NULL,
    "posted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receivable_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_documents_document_number_key" ON "sales_documents"("document_number");

-- CreateIndex
CREATE INDEX "sales_documents_status_business_date_idx" ON "sales_documents"("status", "business_date");

-- CreateIndex
CREATE INDEX "sales_documents_customer_id_business_date_idx" ON "sales_documents"("customer_id", "business_date");

-- CreateIndex
CREATE INDEX "sales_documents_warehouse_id_business_date_idx" ON "sales_documents"("warehouse_id", "business_date");

-- CreateIndex
CREATE INDEX "sales_lines_product_id_idx" ON "sales_lines"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_lines_document_id_product_id_key" ON "sales_lines"("document_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_posting_requests_idempotency_key_key" ON "sales_posting_requests"("idempotency_key");

-- CreateIndex
CREATE INDEX "sales_posting_requests_document_id_idx" ON "sales_posting_requests"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "receivable_entries_source_document_id_key" ON "receivable_entries"("source_document_id");

-- CreateIndex
CREATE INDEX "receivable_entries_customer_id_status_due_date_idx" ON "receivable_entries"("customer_id", "status", "due_date");

-- AddForeignKey
ALTER TABLE "sales_documents" ADD CONSTRAINT "sales_documents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_documents" ADD CONSTRAINT "sales_documents_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_documents" ADD CONSTRAINT "sales_documents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_documents" ADD CONSTRAINT "sales_documents_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_documents" ADD CONSTRAINT "sales_documents_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_lines" ADD CONSTRAINT "sales_lines_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "sales_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_lines" ADD CONSTRAINT "sales_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_posting_requests" ADD CONSTRAINT "sales_posting_requests_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "sales_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivable_entries" ADD CONSTRAINT "receivable_entries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivable_entries" ADD CONSTRAINT "receivable_entries_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "sales_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivable_entries" ADD CONSTRAINT "receivable_entries_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
