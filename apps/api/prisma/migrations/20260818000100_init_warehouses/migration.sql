CREATE TYPE "WarehouseStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "warehouses" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(32) NOT NULL UNIQUE,
  "name" VARCHAR(100) NOT NULL UNIQUE,
  "address" VARCHAR(240),
  "notes" VARCHAR(500),
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "status" "WarehouseStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "warehouses_version_positive" CHECK ("version" > 0),
  CONSTRAINT "warehouses_default_active" CHECK (NOT "is_default" OR "status" = 'ACTIVE')
);

CREATE TABLE "warehouse_locations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "warehouse_id" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "description" VARCHAR(240),
  "status" "WarehouseStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "warehouse_locations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT,
  UNIQUE ("warehouse_id", "code")
);

CREATE UNIQUE INDEX "warehouses_one_default_idx" ON "warehouses"("is_default") WHERE "is_default" = true;
CREATE INDEX "warehouses_status_name_idx" ON "warehouses"("status", "name");
CREATE INDEX "warehouse_locations_warehouse_id_status_idx" ON "warehouse_locations"("warehouse_id", "status");
