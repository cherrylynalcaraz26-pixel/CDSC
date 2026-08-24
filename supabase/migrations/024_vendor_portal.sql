-- Adds a "vendor" role so suppliers can be given their own portal login,
-- mirroring how clients already get portal access via clients.auth_user_id /
-- clients.portal_access. Vendors can see their own supplier record and the
-- Purchase Orders raised against them, without gaining visibility into other
-- suppliers' POs or any of the internal-staff-only tables.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'vendor';

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS portal_access BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS suppliers_auth_user_id_idx
  ON suppliers(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Vendors manage their own supplier record (suppliers already has a
-- read-all-authenticated policy from 001_initial_schema.sql; this adds the
-- ability to update their own contact details from the portal).
DROP POLICY IF EXISTS "suppliers_update_own_portal" ON suppliers;
CREATE POLICY "suppliers_update_own_portal" ON suppliers
  FOR UPDATE USING (auth_user_id = auth.uid());

-- Vendors can read the Purchase Orders (and their line items) raised against
-- their own supplier record.
DROP POLICY IF EXISTS "po_read_vendor" ON purchase_orders;
CREATE POLICY "po_read_vendor" ON purchase_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM suppliers s
      WHERE s.id = purchase_orders.supplier_id AND s.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "po_items_read_vendor" ON po_items;
CREATE POLICY "po_items_read_vendor" ON po_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      JOIN suppliers s ON s.id = po.supplier_id
      WHERE po.id = po_items.po_id AND s.auth_user_id = auth.uid()
    )
  );
