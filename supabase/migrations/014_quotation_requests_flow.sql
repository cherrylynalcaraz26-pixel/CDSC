-- Restructure Request for Quotation into a flow: pending -> processing -> quoted -> done
-- (or declined). Accepted requests now convert into a Quotation, not a Sales Order.
-- Adds a staff-only supplier comparison step used during "processing".

ALTER TABLE quotation_requests DROP CONSTRAINT quotation_requests_status_check;

UPDATE quotation_requests SET status = 'processing' WHERE status = 'reviewing';
UPDATE quotation_requests SET status = 'done' WHERE status = 'accepted';

ALTER TABLE quotation_requests ADD CONSTRAINT quotation_requests_status_check
  CHECK (status IN ('pending', 'processing', 'quoted', 'done', 'declined'));

ALTER TABLE quotation_requests ADD COLUMN quotation_id uuid REFERENCES quotations(id);
ALTER TABLE quotation_requests ADD COLUMN quote_number text;

CREATE INDEX idx_quotation_requests_quotation_id ON quotation_requests(quotation_id);

CREATE TABLE quotation_request_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES quotation_requests(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES suppliers(id),
  supplier_name text NOT NULL,
  terms_of_payment text,
  delivery_time text,
  origin text CHECK (origin IN ('local', 'overseas')),
  response_speed text CHECK (response_speed IN ('fast', 'average', 'slow')),
  estimated_income numeric,
  notes text,
  is_selected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quotation_request_suppliers_request_id ON quotation_request_suppliers(request_id);

ALTER TABLE quotation_request_suppliers ENABLE ROW LEVEL SECURITY;

-- Internal sourcing/pricing comparison — staff only, never exposed to clients.
CREATE POLICY staff_only_quotation_request_suppliers ON quotation_request_suppliers
  FOR ALL TO authenticated
  USING (get_my_role() IS DISTINCT FROM 'client')
  WITH CHECK (get_my_role() IS DISTINCT FROM 'client');
