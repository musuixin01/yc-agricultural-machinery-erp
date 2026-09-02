CREATE TYPE "InventoryDamageStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'POSTED', 'CANCELLED');
CREATE TYPE "InventoryDamageReason" AS ENUM ('DAMAGED', 'RUSTED', 'OBSOLETE', 'OTHER');

CREATE TABLE "inventory_damage_documents" (
    "id" UUID NOT NULL,
    "document_number" VARCHAR(32) NOT NULL,
    "status" "InventoryDamageStatus" NOT NULL DEFAULT 'DRAFT',
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
    CONSTRAINT "inventory_damage_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_damage_lines" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_name_snapshot" VARCHAR(160) NOT NULL,
    "unit_name_snapshot" VARCHAR(40) NOT NULL,
    "quantity" DECIMAL(19,6) NOT NULL,
    "reason" "InventoryDamageReason" NOT NULL,
    "reason_detail" VARCHAR(240),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_damage_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_damage_lines_quantity_positive" CHECK ("quantity" > 0)
);

CREATE TABLE "inventory_damage_posting_requests" (
    "id" UUID NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "document_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_damage_posting_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inventory_damage_documents_document_number_key" ON "inventory_damage_documents"("document_number");
CREATE INDEX "inventory_damage_documents_warehouse_id_status_idx" ON "inventory_damage_documents"("warehouse_id", "status");
CREATE INDEX "inventory_damage_documents_status_business_date_idx" ON "inventory_damage_documents"("status", "business_date");
CREATE UNIQUE INDEX "inventory_damage_lines_document_id_product_id_key" ON "inventory_damage_lines"("document_id", "product_id");
CREATE INDEX "inventory_damage_lines_product_id_idx" ON "inventory_damage_lines"("product_id");
CREATE UNIQUE INDEX "inventory_damage_posting_requests_idempotency_key_key" ON "inventory_damage_posting_requests"("idempotency_key");
CREATE INDEX "inventory_damage_posting_requests_document_id_idx" ON "inventory_damage_posting_requests"("document_id");

ALTER TABLE "inventory_damage_documents" ADD CONSTRAINT "inventory_damage_documents_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_damage_documents" ADD CONSTRAINT "inventory_damage_documents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_damage_documents" ADD CONSTRAINT "inventory_damage_documents_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_damage_documents" ADD CONSTRAINT "inventory_damage_documents_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_damage_lines" ADD CONSTRAINT "inventory_damage_lines_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "inventory_damage_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_damage_lines" ADD CONSTRAINT "inventory_damage_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_damage_posting_requests" ADD CONSTRAINT "inventory_damage_posting_requests_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "inventory_damage_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE SEQUENCE "inventory_damage_number_seq" START 1;

CREATE OR REPLACE FUNCTION enforce_inventory_damage_lines_draft()
RETURNS trigger AS $$
DECLARE parent_status "InventoryDamageStatus";
BEGIN
  SELECT "status" INTO parent_status
  FROM "inventory_damage_documents"
  WHERE "id" = COALESCE(NEW."document_id", OLD."document_id");
  IF parent_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'inventory damage lines can only change in DRAFT state';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_damage_lines_draft_only
BEFORE INSERT OR UPDATE OR DELETE ON "inventory_damage_lines"
FOR EACH ROW EXECUTE FUNCTION enforce_inventory_damage_lines_draft();

CREATE OR REPLACE FUNCTION prevent_posted_inventory_damage_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD."status" = 'POSTED' THEN
    RAISE EXCEPTION 'posted inventory damage documents are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_damage_documents_posted_immutable
BEFORE UPDATE OR DELETE ON "inventory_damage_documents"
FOR EACH ROW EXECUTE FUNCTION prevent_posted_inventory_damage_mutation();
