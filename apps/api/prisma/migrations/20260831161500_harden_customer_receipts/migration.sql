CREATE OR REPLACE FUNCTION prevent_customer_receipt_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'posted customer receipts are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customer_receipts_immutable
BEFORE UPDATE OR DELETE ON "customer_receipts"
FOR EACH ROW EXECUTE FUNCTION prevent_customer_receipt_mutation();

CREATE OR REPLACE FUNCTION enforce_receipt_allocation_immutability()
RETURNS trigger AS $$
DECLARE receipt_id UUID;
BEGIN
  receipt_id := COALESCE(NEW."customer_receipt_id", OLD."customer_receipt_id");
  IF TG_OP IN ('UPDATE', 'DELETE') OR EXISTS (
    SELECT 1 FROM "cash_ledger_entries"
    WHERE "source_document_type" = 'CUSTOMER_RECEIPT'
      AND "source_document_id" = receipt_id
  ) THEN
    RAISE EXCEPTION 'posted receipt allocations are immutable';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER receipt_allocations_immutable
BEFORE INSERT OR UPDATE OR DELETE ON "receipt_allocations"
FOR EACH ROW EXECUTE FUNCTION enforce_receipt_allocation_immutability();
