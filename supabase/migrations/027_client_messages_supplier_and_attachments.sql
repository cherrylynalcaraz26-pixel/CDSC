-- Lets the internal Messages page hold conversations with suppliers, not just
-- clients (mirrors the existing client_id/client_name pair), and lets either
-- side of a message thread carry a file attachment.
ALTER TABLE client_messages ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);
ALTER TABLE client_messages ADD COLUMN IF NOT EXISTS supplier_name TEXT;
ALTER TABLE client_messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE client_messages ADD COLUMN IF NOT EXISTS attachment_name TEXT;
ALTER TABLE client_messages ADD COLUMN IF NOT EXISTS reply_attachment_url TEXT;
ALTER TABLE client_messages ADD COLUMN IF NOT EXISTS reply_attachment_name TEXT;
