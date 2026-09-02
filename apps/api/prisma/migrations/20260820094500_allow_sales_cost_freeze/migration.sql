CREATE OR REPLACE FUNCTION enforce_sales_draft_lines()
RETURNS trigger AS $$
DECLARE parent_status "SalesDocumentStatus";
BEGIN
  SELECT "status" INTO parent_status
  FROM "sales_documents"
  WHERE "id" = COALESCE(NEW."document_id", OLD."document_id");

  IF parent_status = 'DRAFT' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE' AND parent_status = 'SUBMITTED'
    AND NEW."document_id" = OLD."document_id"
    AND NEW."product_id" = OLD."product_id"
    AND NEW."product_name_snapshot" = OLD."product_name_snapshot"
    AND NEW."unit_name_snapshot" = OLD."unit_name_snapshot"
    AND NEW."quantity" = OLD."quantity"
    AND NEW."unit_price" = OLD."unit_price"
    AND NEW."line_amount" = OLD."line_amount"
    AND NEW."created_at" = OLD."created_at"
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'sales lines can only change in DRAFT state except cost freeze during posting';
END;
$$ LANGUAGE plpgsql;
