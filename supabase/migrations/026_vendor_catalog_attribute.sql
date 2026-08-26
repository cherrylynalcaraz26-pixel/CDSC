-- Lets a vendor tag a catalog item with a variant/spec value (e.g. "Red",
-- "Large", "10mm") the same way CDSC's own items table already supports.
ALTER TABLE vendor_catalog_items ADD COLUMN IF NOT EXISTS attribute TEXT;
