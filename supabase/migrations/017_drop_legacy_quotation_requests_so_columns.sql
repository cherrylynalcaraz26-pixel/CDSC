-- These columns were left over from the old RFQ->Sales Order flow (replaced by
-- RFQ->Quotation via quotation_id/quote_number). Nothing in the app reads them
-- anymore, and the FK was blocking deletes/updates on sales_orders rows that a
-- request had historically been linked to.
ALTER TABLE quotation_requests DROP COLUMN sales_order_id;
ALTER TABLE quotation_requests DROP COLUMN so_number;
