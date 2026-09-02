CREATE TYPE "PartyStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "PartyRoleType" AS ENUM ('CUSTOMER', 'SUPPLIER');

CREATE TABLE "parties" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "code" VARCHAR(48) NOT NULL UNIQUE,
  "name" VARCHAR(160) NOT NULL, "short_name" VARCHAR(80), "mnemonic_code" VARCHAR(80),
  "tax_id" VARCHAR(32) UNIQUE, "credit_limit" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "payment_terms_days" INTEGER NOT NULL DEFAULT 0, "province" VARCHAR(60), "city" VARCHAR(60),
  "address" VARCHAR(240), "notes" VARCHAR(1000), "status" "PartyStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "parties_credit_limit_nonnegative" CHECK ("credit_limit" >= 0),
  CONSTRAINT "parties_payment_terms_days_range" CHECK ("payment_terms_days" BETWEEN 0 AND 3650),
  CONSTRAINT "parties_version_positive" CHECK ("version" > 0)
);
CREATE TABLE "party_roles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "party_id" UUID NOT NULL, "type" "PartyRoleType" NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "party_roles_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE,
  UNIQUE ("party_id", "type")
);
CREATE TABLE "party_contacts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "party_id" UUID NOT NULL, "name" VARCHAR(80) NOT NULL,
  "phone" VARCHAR(32), "email" VARCHAR(160), "position" VARCHAR(80), "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "party_contacts_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE
);
CREATE INDEX "parties_name_idx" ON "parties"("name");
CREATE INDEX "parties_mnemonic_code_idx" ON "parties"("mnemonic_code");
CREATE INDEX "parties_status_updated_at_idx" ON "parties"("status", "updated_at");
CREATE INDEX "party_roles_type_party_id_idx" ON "party_roles"("type", "party_id");
CREATE INDEX "party_contacts_party_id_idx" ON "party_contacts"("party_id");
CREATE INDEX "party_contacts_phone_idx" ON "party_contacts"("phone");
CREATE UNIQUE INDEX "party_contacts_one_primary_idx" ON "party_contacts"("party_id") WHERE "is_primary" = true;
