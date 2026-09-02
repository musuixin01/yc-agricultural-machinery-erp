CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "ProductType" AS ENUM ('MACHINE', 'PART', 'STANDARD_PART', 'CONSUMABLE', 'SERVICE');

CREATE TABLE "product_categories" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "code" VARCHAR(32) NOT NULL UNIQUE,
  "name" VARCHAR(80) NOT NULL, "parent_id" UUID, "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "product_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT
);
CREATE TABLE "brands" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "code" VARCHAR(32) NOT NULL UNIQUE,
  "name" VARCHAR(80) NOT NULL UNIQUE, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL
);
CREATE TABLE "units" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "code" VARCHAR(24) NOT NULL UNIQUE,
  "name" VARCHAR(40) NOT NULL UNIQUE, "decimal_scale" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "units_decimal_scale_check" CHECK ("decimal_scale" BETWEEN 0 AND 6)
);
CREATE TABLE "products" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "code" VARCHAR(48) NOT NULL UNIQUE,
  "name" VARCHAR(160) NOT NULL, "mnemonic_code" VARCHAR(80), "type" "ProductType" NOT NULL,
  "model" VARCHAR(120), "specification" VARCHAR(240), "category_id" UUID NOT NULL,
  "brand_id" UUID, "base_unit_id" UUID NOT NULL,
  "retail_price" DECIMAL(19,4) NOT NULL DEFAULT 0, "wholesale_price" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "default_purchase_price" DECIMAL(19,4) NOT NULL DEFAULT 0, "minimum_sale_price" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "safety_stock" DECIMAL(19,6) NOT NULL DEFAULT 0, "attributes" JSONB NOT NULL DEFAULT '{}',
  "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE', "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT,
  CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT,
  CONSTRAINT "products_base_unit_id_fkey" FOREIGN KEY ("base_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT,
  CONSTRAINT "products_prices_nonnegative" CHECK ("retail_price" >= 0 AND "wholesale_price" >= 0 AND "default_purchase_price" >= 0 AND "minimum_sale_price" >= 0),
  CONSTRAINT "products_safety_stock_nonnegative" CHECK ("safety_stock" >= 0),
  CONSTRAINT "products_version_positive" CHECK ("version" > 0)
);
CREATE TABLE "product_barcodes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "product_id" UUID NOT NULL,
  "barcode" VARCHAR(64) NOT NULL UNIQUE, "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_barcodes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE
);
CREATE TABLE "product_unit_conversions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "product_id" UUID NOT NULL,
  "from_unit_id" UUID NOT NULL, "to_unit_id" UUID NOT NULL, "numerator" INTEGER NOT NULL,
  "denominator" INTEGER NOT NULL, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_unit_conversions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT,
  CONSTRAINT "product_unit_conversions_from_unit_id_fkey" FOREIGN KEY ("from_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT,
  CONSTRAINT "product_unit_conversions_to_unit_id_fkey" FOREIGN KEY ("to_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT,
  CONSTRAINT "product_unit_conversions_ratio_positive" CHECK ("numerator" > 0 AND "denominator" > 0),
  CONSTRAINT "product_unit_conversions_distinct_units" CHECK ("from_unit_id" <> "to_unit_id"),
  UNIQUE ("product_id", "from_unit_id", "to_unit_id")
);
CREATE INDEX "products_name_idx" ON "products"("name");
CREATE INDEX "products_mnemonic_code_idx" ON "products"("mnemonic_code");
CREATE INDEX "products_category_id_status_idx" ON "products"("category_id", "status");
CREATE INDEX "product_barcodes_product_id_idx" ON "product_barcodes"("product_id");
