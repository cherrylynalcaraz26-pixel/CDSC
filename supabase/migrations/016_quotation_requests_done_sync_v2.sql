-- Keep "Declined" and "Done" as distinct terminal outcomes on the request,
-- instead of collapsing both into "done".
CREATE OR REPLACE FUNCTION sync_quotation_request_status() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('accepted', 'confirmed') THEN
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
