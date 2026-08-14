-- The RFQ was being marked "quoted" (Sending Quotation) the moment a *draft*
-- Quotation was created — before the admin had actually sent anything, which
-- made the flow stepper look complete/active prematurely. It should only
-- advance once the linked Quotation is actually sent to the client.
CREATE OR REPLACE FUNCTION sync_quotation_request_status() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'sent' THEN
      UPDATE quotation_requests SET status = 'quoted', updated_at = now()
      WHERE quotation_id = NEW.id AND status = 'processing';
    ELSIF NEW.status IN ('accepted', 'confirmed') THEN
      UPDATE quotation_requests SET status = 'done', updated_at = now()
      WHERE quotation_id = NEW.id AND status NOT IN ('done', 'declined');
    ELSIF NEW.status IN ('declined', 'expired') THEN
      UPDATE quotation_requests SET status = 'declined', updated_at = now()
      WHERE quotation_id = NEW.id AND status NOT IN ('done', 'declined');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
