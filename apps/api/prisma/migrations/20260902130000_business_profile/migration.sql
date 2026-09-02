CREATE TYPE "ReceiptPaperSize" AS ENUM ('A4', 'RECEIPT_80MM');

CREATE TABLE "business_profiles" (
  "id" VARCHAR(32) NOT NULL,
  "store_name" VARCHAR(80) NOT NULL,
  "short_name" VARCHAR(20) NOT NULL,
  "phone" VARCHAR(30),
  "address" VARCHAR(200),
  "receipt_footer" VARCHAR(300),
  "default_paper_size" "ReceiptPaperSize" NOT NULL DEFAULT 'A4',
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_by_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "business_profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "business_profiles_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "business_profiles" (
  "id", "store_name", "short_name", "default_paper_size"
) VALUES ('primary', '玉春农机', 'YC', 'A4');
