-- Per-vendor product catalog: lets a vendor (supplier with portal access) list
-- items they can supply, with a price, image, and description. Purchasing staff
-- browse a vendor's catalog from the Purchase Order form to add line items
-- straight from what that vendor actually offers, instead of typing free-form.
--
-- Read access is broad (any authenticated user) to match how suppliers/items
-- already work in this app. Write access is limited to the vendor who owns the
-- row (via suppliers.auth_user_id) or internal purchasing staff.

CREATE TABLE IF NOT EXISTS vendor_catalog_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  description TEXT,
  unit_of_measure TEXT NOT NULL DEFAULT 'piece',
  price NUMERIC,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vendor_catalog_items_supplier_id_idx ON vendor_catalog_items(supplier_id);

ALTER TABLE vendor_catalog_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_catalog_read_all" ON vendor_catalog_items;
CREATE POLICY "vendor_catalog_read_all" ON vendor_catalog_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "vendor_catalog_insert_own" ON vendor_catalog_items;
CREATE POLICY "vendor_catalog_insert_own" ON vendor_catalog_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM suppliers s WHERE s.id = vendor_catalog_items.supplier_id AND s.auth_user_id = auth.uid())
    OR get_my_role() IN ('super_admin', 'admin', 'purchasing_officer')
  );

DROP POLICY IF EXISTS "vendor_catalog_update_own" ON vendor_catalog_items;
CREATE POLICY "vendor_catalog_update_own" ON vendor_catalog_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM suppliers s WHERE s.id = vendor_catalog_items.supplier_id AND s.auth_user_id = auth.uid())
    OR get_my_role() IN ('super_admin', 'admin', 'purchasing_officer')
  );

DROP POLICY IF EXISTS "vendor_catalog_delete_own" ON vendor_catalog_items;
CREATE POLICY "vendor_catalog_delete_own" ON vendor_catalog_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM suppliers s WHERE s.id = vendor_catalog_items.supplier_id AND s.auth_user_id = auth.uid())
    OR get_my_role() IN ('super_admin', 'admin', 'purchasing_officer')
  );
