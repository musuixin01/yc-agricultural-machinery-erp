ALTER TABLE "cash_balances"
  ADD CONSTRAINT "cash_balance_nonnegative" CHECK ("amount" >= 0);

ALTER TABLE "supplier_payments"
  ADD CONSTRAINT "supplier_payment_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocation_amount_positive" CHECK ("amount" > 0);

CREATE OR REPLACE FUNCTION prevent_cash_ledger_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'cash ledger entries are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cash_ledger_immutable
BEFORE UPDATE OR DELETE ON "cash_ledger_entries"
FOR EACH ROW EXECUTE FUNCTION prevent_cash_ledger_mutation();

CREATE OR REPLACE FUNCTION enforce_payment_draft_allocations()
RETURNS trigger AS $$
DECLARE parent_status "SupplierPaymentStatus";
BEGIN
  SELECT "status" INTO parent_status
  FROM "supplier_payments"
  WHERE "id" = COALESCE(NEW."supplier_payment_id", OLD."supplier_payment_id");
  IF parent_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'payment allocations can only change in DRAFT state';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_allocations_draft_only
BEFORE INSERT OR UPDATE OR DELETE ON "payment_allocations"
FOR EACH ROW EXECUTE FUNCTION enforce_payment_draft_allocations();

CREATE SEQUENCE "supplier_payment_number_seq" START 1;
