-- 037 — Standard name/address fields, Pull Outs, and the website Cart.
--
-- MUST be applied before deploying the app code that ships with it: the
-- Clients, Suppliers, CRM, Users and website Inquiry forms now write the split
-- name/address columns, and /pull-outs and the website /products cart use the
-- new tables/functions.

-- ═══ 1. Standard name & address columns ═══════════════════════════════════
-- Name    → First Name, Middle Name, Last Name
-- Address → Address No., Street, Barangay, Municipality, City
-- The old single columns (contact_person, full_name, address) are kept and
-- still written by the app with the joined value, so existing reports, PDFs,
-- BIR exports and search keep working. Existing rows are untouched; the forms
-- pre-fill the new fields from the old value the first time a record is edited.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS contact_first_name  text,
  ADD COLUMN IF NOT EXISTS contact_middle_name text,
  ADD COLUMN IF NOT EXISTS contact_last_name   text,
  ADD COLUMN IF NOT EXISTS address_no   text,
  ADD COLUMN IF NOT EXISTS street       text,
  ADD COLUMN IF NOT EXISTS barangay     text,
  ADD COLUMN IF NOT EXISTS municipality text,
  ADD COLUMN IF NOT EXISTS city         text;

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS contact_first_name  text,
  ADD COLUMN IF NOT EXISTS contact_middle_name text,
  ADD COLUMN IF NOT EXISTS contact_last_name   text,
  ADD COLUMN IF NOT EXISTS address_no   text,
  ADD COLUMN IF NOT EXISTS street       text,
  ADD COLUMN IF NOT EXISTS barangay     text,
  ADD COLUMN IF NOT EXISTS municipality text,
  ADD COLUMN IF NOT EXISTS city         text;

ALTER TABLE crm_leads
  ADD COLUMN IF NOT EXISTS contact_first_name  text,
  ADD COLUMN IF NOT EXISTS contact_middle_name text,
  ADD COLUMN IF NOT EXISTS contact_last_name   text;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_name  text,
  ADD COLUMN IF NOT EXISTS middle_name text,
  ADD COLUMN IF NOT EXISTS last_name   text;

-- ═══ 2. Pull Outs ══════════════════════════════════════════════════════════
-- Items CDSC needs to go and pick up from a client or supplier site
-- (e.g. an item waiting at KEPI), tracked from request to arrival.

CREATE TABLE IF NOT EXISTS pull_outs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pull_out_number text UNIQUE,
  source_type text NOT NULL DEFAULT 'client' CHECK (source_type IN ('client', 'supplier', 'other')),
  client_id uuid REFERENCES clients(id),
  supplier_id uuid REFERENCES suppliers(id),
  location_name text NOT NULL,              -- e.g. "KEPI"
  address_no text, street text, barangay text, municipality text, city text,
  pickup_address text,                      -- joined address, for display/print
  contact_first_name text, contact_middle_name text, contact_last_name text,
  contact_person text,                      -- joined name, for display/print
  contact_number text,
  reason text NOT NULL DEFAULT 'return'
    CHECK (reason IN ('return', 'replacement', 'repair', 'consignment', 'purchase', 'other')),
  reference_no text,                        -- related PO / SO / DR / RMA number
  scheduled_date date,
  picked_up_date date,
  assigned_to text,                         -- driver / staff
  vehicle text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'scheduled', 'picked_up', 'received', 'cancelled')),
  remarks text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pull_out_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pull_out_id uuid NOT NULL REFERENCES pull_outs(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  quantity numeric(15,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit text,
  condition text,                            -- e.g. "Defective", "Good"
  quantity_received numeric(15,3) NOT NULL DEFAULT 0,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pull_outs_status ON pull_outs(status);
CREATE INDEX IF NOT EXISTS idx_pull_out_items_pull_out ON pull_out_items(pull_out_id);

-- PU-YYYY-00001 numbering
CREATE OR REPLACE FUNCTION generate_pull_out_number() RETURNS trigger AS $$
DECLARE
  v_prefix text := 'PU-' || to_char(CURRENT_DATE, 'YYYY') || '-';
  v_next int;
BEGIN
  IF NEW.pull_out_number IS NULL OR NEW.pull_out_number = '' THEN
    SELECT COALESCE(MAX(substring(pull_out_number FROM length(v_prefix) + 1)::int), 0) + 1
      INTO v_next
      FROM pull_outs
     WHERE pull_out_number LIKE v_prefix || '%'
       AND substring(pull_out_number FROM length(v_prefix) + 1) ~ '^\d+$';
    NEW.pull_out_number := v_prefix || lpad(v_next::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pull_out_number ON pull_outs;
CREATE TRIGGER trg_pull_out_number BEFORE INSERT ON pull_outs
  FOR EACH ROW EXECUTE FUNCTION generate_pull_out_number();

DROP TRIGGER IF EXISTS trg_pull_outs_updated ON pull_outs;
CREATE TRIGGER trg_pull_outs_updated BEFORE UPDATE ON pull_outs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Staff only (not client/vendor portal accounts).
ALTER TABLE pull_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pull_out_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_all_pull_outs ON pull_outs;
CREATE POLICY staff_all_pull_outs ON pull_outs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role NOT IN ('client', 'vendor')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role NOT IN ('client', 'vendor')));

DROP POLICY IF EXISTS staff_all_pull_out_items ON pull_out_items;
CREATE POLICY staff_all_pull_out_items ON pull_out_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role NOT IN ('client', 'vendor')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role NOT IN ('client', 'vendor')));

GRANT SELECT, INSERT, UPDATE, DELETE ON pull_outs, pull_out_items TO authenticated;

-- ═══ 3. Website Cart → draft Sales Order ═══════════════════════════════════
-- Public visitors can browse ACTIVE items (no cost or selling price exposed)
-- and submit a cart. Checkout runs through one SECURITY DEFINER function that
-- validates the cart and creates a DRAFT Sales Order for staff to price and
-- confirm. Visitors get no direct table access to items or sales orders.

CREATE OR REPLACE FUNCTION public_catalog()
RETURNS TABLE (
  id uuid, item_name text, description text, brand text,
  unit_of_measure text, category text, image_url text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.item_name, i.description, i.brand, i.unit_of_measure,
         c.category_name AS category,
         COALESCE(NULLIF(i.image_urls[1], ''), i.image_url) AS image_url
    FROM items i
    LEFT JOIN categories c ON c.id = i.category_id
   WHERE i.status::text IN ('active', 'low_stock')
   ORDER BY c.category_name NULLS LAST, i.item_name;
$$;

REVOKE ALL ON FUNCTION public_catalog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_catalog() TO anon, authenticated;

CREATE OR REPLACE FUNCTION submit_web_order(p_customer jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company   text := btrim(coalesce(p_customer->>'company_name', ''));
  v_first     text := btrim(coalesce(p_customer->>'first_name', ''));
  v_middle    text := btrim(coalesce(p_customer->>'middle_name', ''));
  v_last      text := btrim(coalesce(p_customer->>'last_name', ''));
  v_email     text := lower(btrim(coalesce(p_customer->>'email', '')));
  v_phone     text := btrim(coalesce(p_customer->>'phone', ''));
  v_notes     text := left(btrim(coalesce(p_customer->>'notes', '')), 2000);
  v_addr_no   text := btrim(coalesce(p_customer->>'address_no', ''));
  v_street    text := btrim(coalesce(p_customer->>'street', ''));
  v_brgy      text := btrim(coalesce(p_customer->>'barangay', ''));
  v_muni      text := btrim(coalesce(p_customer->>'municipality', ''));
  v_city      text := btrim(coalesce(p_customer->>'city', ''));
  v_contact   text;
  v_address   text;
  v_client_id uuid;
  v_so_id     uuid;
  v_so_number text;
  v_total     numeric := 0;
  v_lines     int;
BEGIN
  -- ── validate customer ──
  IF v_company = '' OR v_first = '' OR v_last = '' THEN
    RAISE EXCEPTION 'Company name, first name and last name are required';
  END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'A valid email address is required';
  END IF;
  IF v_phone = '' THEN
    RAISE EXCEPTION 'A contact number is required';
  END IF;

  -- ── validate cart ──
  IF jsonb_typeof(p_items) <> 'array' THEN RAISE EXCEPTION 'Invalid cart'; END IF;
  v_lines := jsonb_array_length(p_items);
  IF v_lines = 0 THEN RAISE EXCEPTION 'Your cart is empty'; END IF;
  IF v_lines > 100 THEN RAISE EXCEPTION 'Too many items in one order (max 100)'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) e
     WHERE NOT ((e->>'quantity') ~ '^\d+(\.\d+)?$')
        OR (e->>'quantity')::numeric <= 0 OR (e->>'quantity')::numeric > 100000
        OR NOT EXISTS (SELECT 1 FROM items i WHERE i.id::text = e->>'item_id' AND i.status::text IN ('active', 'low_stock'))
  ) THEN
    RAISE EXCEPTION 'One or more items are no longer available — please refresh and try again';
  END IF;

  v_contact := btrim(concat_ws(' ', NULLIF(v_first, ''), NULLIF(v_middle, ''), NULLIF(v_last, '')));
  v_address := concat_ws(', ',
    NULLIF(btrim(concat_ws(' ', NULLIF(v_addr_no, ''), NULLIF(v_street, ''))), ''),
    CASE WHEN v_brgy = '' THEN NULL WHEN v_brgy ~* '^(brgy|barangay)' THEN v_brgy ELSE 'Brgy. ' || v_brgy END,
    NULLIF(v_muni, ''));

  -- ── find or create the client (matched by email) ──
  SELECT id INTO v_client_id FROM clients WHERE lower(email) = v_email ORDER BY created_at LIMIT 1;
  IF v_client_id IS NULL THEN
    INSERT INTO clients (company_name, contact_person, contact_first_name, contact_middle_name, contact_last_name,
                         email, mobile, address, address_no, street, barangay, municipality, city, status, notes)
    VALUES (v_company, v_contact, v_first, NULLIF(v_middle, ''), v_last,
            v_email, v_phone, NULLIF(v_address, ''), NULLIF(v_addr_no, ''), NULLIF(v_street, ''),
            NULLIF(v_brgy, ''), NULLIF(v_muni, ''), NULLIF(v_city, ''), 'active', 'Created from website order')
    RETURNING id INTO v_client_id;
  END IF;

  -- ── draft Sales Order (prices filled from the item master for staff review) ──
  SELECT COALESCE(SUM(COALESCE(i.selling_price, 0) * (e->>'quantity')::numeric), 0) INTO v_total
    FROM jsonb_array_elements(p_items) e JOIN items i ON i.id::text = e->>'item_id';

  INSERT INTO sales_orders (so_date, client_id, client_name, status, total_amount, remarks, show_in_portal)
  VALUES (CURRENT_DATE, v_client_id, v_company, 'draft', v_total,
          concat_ws(E'\n',
            'Website order — ' || v_contact || ' · ' || v_email || ' · ' || v_phone,
            CASE WHEN v_address <> '' OR v_city <> '' THEN 'Deliver to: ' || concat_ws(', ', NULLIF(v_address, ''), NULLIF(v_city, '')) END,
            NULLIF(v_notes, '')),
          false)
  RETURNING id, so_number INTO v_so_id, v_so_number;

  INSERT INTO so_items (so_id, item_name, quantity, unit, unit_price, selling_price, total_amount)
  SELECT v_so_id, i.item_name, (e->>'quantity')::numeric, i.unit_of_measure,
         COALESCE(i.selling_price, 0), i.selling_price,
         COALESCE(i.selling_price, 0) * (e->>'quantity')::numeric
    FROM jsonb_array_elements(p_items) e JOIN items i ON i.id::text = e->>'item_id';

  -- Also surface it in CRM so sales can follow up.
  INSERT INTO crm_leads (company_name, contact_person, contact_first_name, contact_middle_name, contact_last_name,
                         contact_email, contact_phone, product_interest, notes, stage, priority, source)
  VALUES (v_company, v_contact, v_first, NULLIF(v_middle, ''), v_last, v_email, v_phone,
          'Website cart — ' || v_lines || ' item(s)', 'Draft Sales Order ' || coalesce(v_so_number, v_so_id::text),
          'new_lead', 'high', 'Website Cart');

  RETURN jsonb_build_object('so_number', v_so_number, 'so_id', v_so_id);
END;
$$;

REVOKE ALL ON FUNCTION submit_web_order(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_web_order(jsonb, jsonb) TO anon, authenticated;
