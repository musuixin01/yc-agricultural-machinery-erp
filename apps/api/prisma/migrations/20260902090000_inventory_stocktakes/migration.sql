-- CreateEnum
CREATE TYPE "InventoryStocktakeStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'POSTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "inventory_stocktakes" (
    "id" UUID NOT NULL,
    "document_number" VARCHAR(32) NOT NULL,
    "status" "InventoryStocktakeStatus" NOT NULL DEFAULT 'DRAFT',
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
    CONSTRAINT "inventory_stocktakes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_stocktake_lines" (
    "id" UUID NOT NULL,
    "stocktake_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_name_snapshot" VARCHAR(160) NOT NULL,
    "unit_name_snapshot" VARCHAR(40) NOT NULL,
    "baseline_quantity" DECIMAL(19,6) NOT NULL,
    "baseline_total_cost" DECIMAL(19,4) NOT NULL,
    "baseline_average_cost" DECIMAL(19,4) NOT NULL,
    "baseline_balance_version" INTEGER NOT NULL,
    "counted_quantity" DECIMAL(19,6),
    "variance_quantity" DECIMAL(19,6),
    "reason" VARCHAR(240),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_stocktake_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_stocktake_lines_quantities_nonnegative" CHECK (
      "baseline_quantity" >= 0 AND ("counted_quantity" IS NULL OR "counted_quantity" >= 0)
    ),
    CONSTRAINT "inventory_stocktake_lines_costs_nonnegative" CHECK (
      "baseline_total_cost" >= 0 AND "baseline_average_cost" >= 0
    )
);

CREATE TABLE "inventory_stocktake_posting_requests" (
    "id" UUID NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "stocktake_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_stocktake_posting_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inventory_stocktakes_document_number_key" ON "inventory_stocktakes"("document_number");
CREATE INDEX "inventory_stocktakes_warehouse_id_status_idx" ON "inventory_stocktakes"("warehouse_id", "status");
CREATE INDEX "inventory_stocktakes_status_business_date_idx" ON "inventory_stocktakes"("status", "business_date");
CREATE UNIQUE INDEX "inventory_stocktakes_one_active_per_warehouse" ON "inventory_stocktakes"("warehouse_id") WHERE "status" IN ('DRAFT', 'SUBMITTED');
CREATE UNIQUE INDEX "inventory_stocktake_lines_stocktake_id_product_id_key" ON "inventory_stocktake_lines"("stocktake_id", "product_id");
CREATE INDEX "inventory_stocktake_lines_product_id_idx" ON "inventory_stocktake_lines"("product_id");
CREATE UNIQUE INDEX "inventory_stocktake_posting_requests_idempotency_key_key" ON "inventory_stocktake_posting_requests"("idempotency_key");
CREATE INDEX "inventory_stocktake_posting_requests_stocktake_id_idx" ON "inventory_stocktake_posting_requests"("stocktake_id");

ALTER TABLE "inventory_stocktakes" ADD CONSTRAINT "inventory_stocktakes_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_stocktakes" ADD CONSTRAINT "inventory_stocktakes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_stocktakes" ADD CONSTRAINT "inventory_stocktakes_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_stocktakes" ADD CONSTRAINT "inventory_stocktakes_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_stocktake_lines" ADD CONSTRAINT "inventory_stocktake_lines_stocktake_id_fkey" FOREIGN KEY ("stocktake_id") REFERENCES "inventory_stocktakes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_stocktake_lines" ADD CONSTRAINT "inventory_stocktake_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_stocktake_posting_requests" ADD CONSTRAINT "inventory_stocktake_posting_requests_stocktake_id_fkey" FOREIGN KEY ("stocktake_id") REFERENCES "inventory_stocktakes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE SEQUENCE "inventory_stocktake_number_seq" START 1;

CREATE OR REPLACE FUNCTION enforce_inventory_stocktake_lines_draft()
RETURNS trigger AS $$
DECLARE parent_status "InventoryStocktakeStatus";
BEGIN
  SELECT "status" INTO parent_status
  FROM "inventory_stocktakes"
  WHERE "id" = COALESCE(NEW."stocktake_id", OLD."stocktake_id");
  IF parent_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'inventory stocktake lines can only change in DRAFT state';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_stocktake_lines_draft_only
BEFORE INSERT OR UPDATE OR DELETE ON "inventory_stocktake_lines"
FOR EACH ROW EXECUTE FUNCTION enforce_inventory_stocktake_lines_draft();

CREATE OR REPLACE FUNCTION prevent_posted_inventory_stocktake_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD."status" = 'POSTED' THEN
    RAISE EXCEPTION 'posted inventory stocktakes are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_stocktakes_posted_immutable
BEFORE UPDATE OR DELETE ON "inventory_stocktakes"
FOR EACH ROW EXECUTE FUNCTION prevent_posted_inventory_stocktake_mutation();
