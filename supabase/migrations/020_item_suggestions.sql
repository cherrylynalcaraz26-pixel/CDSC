-- Client-submitted "custom item" requests from the New Order form. Staff review
-- them in Configuration > Item List and, on accept, a real catalog item is
-- created and linked back here.
CREATE TABLE item_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id),
  client_name text NOT NULL,
  item_name text NOT NULL,
  description text,
  brand text,
  unit_of_measure text,
  attribute text,
  selling_price numeric,
  image_urls text[] NOT NULL DEFAULT '{}',
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  linked_item_id uuid REFERENCES items(id),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_item_suggestions_client_id ON item_suggestions(client_id);
CREATE INDEX idx_item_suggestions_status ON item_suggestions(status);

CREATE TRIGGER trg_item_suggestions_updated
  BEFORE UPDATE ON item_suggestions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE item_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_own_item_suggestions ON item_suggestions
  FOR ALL
  USING (auth.uid() = (SELECT clients.auth_user_id FROM clients WHERE clients.id = item_suggestions.client_id LIMIT 1));

CREATE POLICY staff_all_item_suggestions ON item_suggestions
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
