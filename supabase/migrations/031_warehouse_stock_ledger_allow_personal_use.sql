-- The Inventory "Personal Use" flow (added in #68) has always inserted
-- warehouse_stock_ledger rows with source_type = 'personal_use', but the
-- check constraint never allowed that value — every such insert silently
-- failed the constraint (the app doesn't check this insert's error), so
-- Personal Use deductions updated warehouse_stock.quantity/notes but never
-- appeared in Stock History.
ALTER TABLE warehouse_stock_ledger DROP CONSTRAINT warehouse_stock_ledger_source_type_check;
ALTER TABLE warehouse_stock_ledger ADD CONSTRAINT warehouse_stock_ledger_source_type_check
  CHECK (source_type = ANY (ARRAY['po_receiving', 'manual_add', 'manual_edit', 'dr_delivery', 'return_to_warehouse', 'personal_use']));
