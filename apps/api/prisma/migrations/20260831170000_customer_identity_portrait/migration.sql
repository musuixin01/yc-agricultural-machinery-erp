ALTER TABLE "parties"
  ADD COLUMN "identity_number_encrypted" TEXT,
  ADD COLUMN "identity_number_hash" CHAR(64),
  ADD COLUMN "identity_number_last4" CHAR(4),
  ADD COLUMN "portrait_image" BYTEA,
  ADD COLUMN "portrait_mime_type" VARCHAR(40);

ALTER TABLE "parties"
  ADD CONSTRAINT "party_identity_pair" CHECK (
    ("identity_number_encrypted" IS NULL AND "identity_number_hash" IS NULL AND "identity_number_last4" IS NULL)
    OR
    ("identity_number_encrypted" IS NOT NULL AND "identity_number_hash" IS NOT NULL AND "identity_number_last4" IS NOT NULL)
  ),
  ADD CONSTRAINT "party_portrait_pair" CHECK (
    ("portrait_image" IS NULL AND "portrait_mime_type" IS NULL)
    OR
    ("portrait_image" IS NOT NULL AND "portrait_mime_type" IS NOT NULL)
  ),
  ADD CONSTRAINT "party_portrait_size" CHECK (
    "portrait_image" IS NULL OR octet_length("portrait_image") <= 1572864
  );

CREATE UNIQUE INDEX "parties_identity_number_hash_key" ON "parties"("identity_number_hash");
