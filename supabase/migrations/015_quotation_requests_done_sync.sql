-- Once the Quotation created from an RFQ reaches a terminal state, mark the
-- originating request "done" — regardless of whether that happened via the
-- portal Accept/Decline buttons or the emailed confirm link.
CREATE OR REPLACE FUNCTION sync_quotation_request_status() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('accepted','declined','confirmed','expired') AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE quotation_requests SET status = 'done', updated_at = now()
    WHERE quotation_id = NEW.id AND status NOT IN ('done','declined');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_sync_quotation_request_status
  AFTER UPDATE ON quotations
  FOR EACH ROW EXECUTE FUNCTION sync_quotation_request_status();
