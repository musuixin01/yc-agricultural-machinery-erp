DROP TRIGGER "customer_receipt_reversal_allocations_immutable"
ON "customer_receipt_reversal_allocations";

CREATE OR REPLACE FUNCTION enforce_customer_receipt_reversal_allocation_immutability()
RETURNS trigger AS $$
DECLARE receipt_reversal_id UUID;
BEGIN
  receipt_reversal_id := COALESCE(NEW."reversal_id", OLD."reversal_id");
  IF TG_OP IN ('UPDATE', 'DELETE') OR EXISTS (
    SELECT 1 FROM "cash_ledger_entries"
    WHERE "source_document_type" = 'CUSTOMER_RECEIPT_REVERSAL'
      AND "source_document_id" = receipt_reversal_id
  ) THEN
    RAISE EXCEPTION 'posted customer receipt reversal allocations are immutable';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customer_receipt_reversal_allocations_immutable
BEFORE INSERT OR UPDATE OR DELETE ON "customer_receipt_reversal_allocations"
FOR EACH ROW EXECUTE FUNCTION enforce_customer_receipt_reversal_allocation_immutability();
