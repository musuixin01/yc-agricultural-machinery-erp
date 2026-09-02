-- CreateEnum
CREATE TYPE "InventoryDocumentType" AS ENUM ('OPENING');

-- CreateEnum
CREATE TYPE "InventoryDocumentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'POSTED', 'REVERSED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_actor_user_id_fkey";

-- DropForeignKey
ALTER TABLE "auth_sessions" DROP CONSTRAINT "auth_sessions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "party_contacts" DROP CONSTRAINT "party_contacts_party_id_fkey";

-- DropForeignKey
ALTER TABLE "party_roles" DROP CONSTRAINT "party_roles_party_id_fkey";

-- DropForeignKey
ALTER TABLE "product_barcodes" DROP CONSTRAINT "product_barcodes_product_id_fkey";

-- DropForeignKey
ALTER TABLE "product_categories" DROP CONSTRAINT "product_categories_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "product_unit_conversions" DROP CONSTRAINT "product_unit_conversions_from_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "product_unit_conversions" DROP CONSTRAINT "product_unit_conversions_product_id_fkey";

-- DropForeignKey
ALTER TABLE "product_unit_conversions" DROP CONSTRAINT "product_unit_conversions_to_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_base_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_brand_id_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_category_id_fkey";

-- DropForeignKey
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_permission_id_fkey";

-- DropForeignKey
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_role_id_fkey";

-- DropForeignKey
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_role_id_fkey";

-- DropForeignKey
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_user_id_fkey";

-- DropForeignKey
ALTER TABLE "warehouse_locations" DROP CONSTRAINT "warehouse_locations_warehouse_id_fkey";

-- AlterTable
ALTER TABLE "audit_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "auth_sessions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "brands" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "parties" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "party_contacts" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "party_roles" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "permissions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "product_barcodes" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "product_categories" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "product_unit_conversions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "roles" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "units" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "warehouse_locations" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "warehouses" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "inventory_documents" (
    "id" UUID NOT NULL,
    "document_number" VARCHAR(32) NOT NULL,
    "type" "InventoryDocumentType" NOT NULL DEFAULT 'OPENING',
    "status" "InventoryDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "business_date" DATE NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "notes" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID NOT NULL,
    "submitted_by_id" UUID,
    "submitted_at" TIMESTAMPTZ(3),
    "posted_by_id" UUID,
    "posted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inventory_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_document_lines" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "location_id" UUID,
    "product_name_snapshot" VARCHAR(160) NOT NULL,
    "unit_name_snapshot" VARCHAR(40) NOT NULL,
    "quantity" DECIMAL(19,6) NOT NULL,
    "unit_cost" DECIMAL(19,4) NOT NULL,
    "line_amount" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_document_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_ledger_entries" (
    "id" UUID NOT NULL,
    "source_document_id" UUID NOT NULL,
    "source_document_line_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "location_id" UUID,
    "quantity_change" DECIMAL(19,6) NOT NULL,
    "unit_cost" DECIMAL(19,4) NOT NULL,
    "cost_amount" DECIMAL(19,4) NOT NULL,
    "business_date" DATE NOT NULL,
    "posted_by_id" UUID NOT NULL,
    "posted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_balances" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "quantity" DECIMAL(19,6) NOT NULL,
    "total_cost" DECIMAL(19,4) NOT NULL,
    "average_cost" DECIMAL(19,4) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_posting_requests" (
    "id" UUID NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "operation" VARCHAR(80) NOT NULL,
    "document_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_posting_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "event_type" VARCHAR(120) NOT NULL,
    "aggregate_type" VARCHAR(80) NOT NULL,
    "aggregate_id" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_documents_document_number_key" ON "inventory_documents"("document_number");

-- CreateIndex
CREATE INDEX "inventory_documents_warehouse_id_status_idx" ON "inventory_documents"("warehouse_id", "status");

-- CreateIndex
CREATE INDEX "inventory_documents_status_business_date_idx" ON "inventory_documents"("status", "business_date");

-- CreateIndex
CREATE INDEX "inventory_document_lines_product_id_idx" ON "inventory_document_lines"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_document_lines_document_id_product_id_key" ON "inventory_document_lines"("document_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_ledger_entries_source_document_line_id_key" ON "inventory_ledger_entries"("source_document_line_id");

-- CreateIndex
CREATE INDEX "inventory_ledger_entries_product_id_warehouse_id_posted_at_idx" ON "inventory_ledger_entries"("product_id", "warehouse_id", "posted_at");

-- CreateIndex
CREATE INDEX "inventory_ledger_entries_source_document_id_idx" ON "inventory_ledger_entries"("source_document_id");

-- CreateIndex
CREATE INDEX "inventory_balances_warehouse_id_quantity_idx" ON "inventory_balances"("warehouse_id", "quantity");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_balances_product_id_warehouse_id_key" ON "inventory_balances"("product_id", "warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_posting_requests_idempotency_key_key" ON "inventory_posting_requests"("idempotency_key");

-- CreateIndex
CREATE INDEX "inventory_posting_requests_document_id_idx" ON "inventory_posting_requests"("document_id");

-- CreateIndex
CREATE INDEX "outbox_events_processed_at_occurred_at_idx" ON "outbox_events"("processed_at", "occurred_at");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_locations" ADD CONSTRAINT "warehouse_locations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_roles" ADD CONSTRAINT "party_roles_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "party_contacts" ADD CONSTRAINT "party_contacts_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_base_unit_id_fkey" FOREIGN KEY ("base_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_documents" ADD CONSTRAINT "inventory_documents_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_documents" ADD CONSTRAINT "inventory_documents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_documents" ADD CONSTRAINT "inventory_documents_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_documents" ADD CONSTRAINT "inventory_documents_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_document_lines" ADD CONSTRAINT "inventory_document_lines_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "inventory_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_document_lines" ADD CONSTRAINT "inventory_document_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_document_lines" ADD CONSTRAINT "inventory_document_lines_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "warehouse_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger_entries" ADD CONSTRAINT "inventory_ledger_entries_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "inventory_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger_entries" ADD CONSTRAINT "inventory_ledger_entries_source_document_line_id_fkey" FOREIGN KEY ("source_document_line_id") REFERENCES "inventory_document_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger_entries" ADD CONSTRAINT "inventory_ledger_entries_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger_entries" ADD CONSTRAINT "inventory_ledger_entries_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger_entries" ADD CONSTRAINT "inventory_ledger_entries_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "warehouse_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger_entries" ADD CONSTRAINT "inventory_ledger_entries_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_posting_requests" ADD CONSTRAINT "inventory_posting_requests_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "inventory_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_barcodes" ADD CONSTRAINT "product_barcodes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_unit_conversions" ADD CONSTRAINT "product_unit_conversions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_unit_conversions" ADD CONSTRAINT "product_unit_conversions_from_unit_id_fkey" FOREIGN KEY ("from_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_unit_conversions" ADD CONSTRAINT "product_unit_conversions_to_unit_id_fkey" FOREIGN KEY ("to_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
