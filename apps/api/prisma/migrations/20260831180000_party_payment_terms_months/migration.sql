ALTER TABLE "parties"
  ADD COLUMN "payment_terms_months" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "party_payment_terms_months_range"
    CHECK ("payment_terms_months" BETWEEN 0 AND 120);
