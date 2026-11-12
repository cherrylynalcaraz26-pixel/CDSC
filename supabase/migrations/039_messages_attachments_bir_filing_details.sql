-- 039 — Multiple photos/files per message, and BIR filing reference + attachments.
--
-- The app keeps working before this runs (single-file messages and filings
-- without a reference still save); sending 2+ files in one message, or saving a
-- BIR filing reference no. / several attachments, needs these columns.

-- Messages: every file on each side of a message (the single *_attachment_url
-- columns keep the first file, so older screens still show something).
ALTER TABLE client_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb,
  ADD COLUMN IF NOT EXISTS reply_attachments jsonb;

-- BIR filings: eBIRForms / eFPS confirmation no. and all supporting files
-- (filed return, proof of payment), as in the CHEM app's filing records.
ALTER TABLE bir_filings
  ADD COLUMN IF NOT EXISTS reference_no text,
  ADD COLUMN IF NOT EXISTS attachments jsonb;
