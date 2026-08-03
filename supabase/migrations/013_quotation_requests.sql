-- Request for Quotation (RFQ): clients submit a request for pricing on a
-- list of items, staff review/edit it, then either accept it into a
-- Purchase Order (sales_orders) or decline it.

CREATE TABLE quotation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL,
  client_id uuid NOT NULL REFERENCES clients(id),
  client_name text NOT NULL,
  subject text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'accepted', 'declined')),
  sales_order_id uuid REFERENCES sales_orders(id),
  so_number text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE quotation_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES quotation_requests(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit text,
  unit_price numeric,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quotation_requests_client_id ON quotation_requests(client_id);
CREATE INDEX idx_quotation_requests_status ON quotation_requests(status);
CREATE INDEX idx_quotation_requests_sales_order_id ON quotation_requests(sales_order_id);
CREATE INDEX idx_quotation_request_items_request_id ON quotation_request_items(request_id);

CREATE TRIGGER trg_quotation_requests_updated
  BEFORE UPDATE ON quotation_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE quotation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_request_items ENABLE ROW LEVEL SECURITY;

-- Clients can manage their own RFQs; staff (any authenticated user) can manage all.
CREATE POLICY client_own_quotation_requests ON quotation_requests
  FOR ALL
  USING (auth.uid() = (SELECT clients.auth_user_id FROM clients WHERE clients.id = quotation_requests.client_id LIMIT 1));

CREATE POLICY staff_all_quotation_requests ON quotation_requests
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY authenticated_all_quotation_request_items ON quotation_request_items
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
