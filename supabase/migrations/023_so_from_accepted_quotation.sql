-- When a client accepts a Quotation in the portal ("Mark as Accepted"), or an admin
-- marks one accepted, the quotation's own status flips to "Accepted" but nothing ever
-- created a Sales Order — so there was no record for the client to find under "My
-- Orders". Only the separate emailed-confirmation-link flow (status -> 'confirmed')
-- created one. Consolidate both into a single trigger so every acceptance path (admin
-- dropdown, portal button, or email link) produces one Sales Order, visible in the
-- portal, linked back to the quotation it came from.

ALTER TABLE sales_orders ADD COLUMN quotation_id uuid REFERENCES quotations(id);
CREATE INDEX idx_sales_orders_quotation_id ON sales_orders(quotation_id);

CREATE OR REPLACE FUNCTION create_so_from_accepted_quotation() RETURNS TRIGGER AS $$
DECLARE
  v_so_id uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('accepted', 'confirmed') THEN
    IF NOT EXISTS (SELECT 1 FROM sales_orders WHERE quotation_id = NEW.id) THEN
      INSERT INTO sales_orders (so_date, client_id, client_name, status, total_amount, remarks, show_in_portal, quotation_id)
      VALUES (CURRENT_DATE, NEW.client_id, NEW.client_name, 'confirmed', COALESCE(NEW.total_amount, 0),
              'Created from Quotation ' || COALESCE(NEW.quote_number, NEW.id::text), true, NEW.id)
      RETURNING id INTO v_so_id;

      INSERT INTO so_items (so_id, item_name, quantity, unit, unit_price, selling_price, total_amount)
      SELECT v_so_id, item_name, COALESCE(quantity, 1), unit, COALESCE(unit_price, 0), selling_price, COALESCE(total_amount, 0)
      FROM quotation_items WHERE quotation_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_create_so_from_accepted_quotation ON quotations;
CREATE TRIGGER trg_create_so_from_accepted_quotation
AFTER UPDATE ON quotations
FOR EACH ROW
EXECUTE FUNCTION create_so_from_accepted_quotation();
