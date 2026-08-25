-- Lets a vendor tag a catalog item with a brand, same as CDSC's own items
-- table already supports, shown as its own column in the vendor's catalog.
ALTER TABLE vendor_catalog_items ADD COLUMN IF NOT EXISTS brand TEXT;
