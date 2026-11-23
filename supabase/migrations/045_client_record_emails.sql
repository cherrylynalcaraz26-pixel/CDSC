-- 045 — Client Records email log
--
-- One row per records-confirmation letter emailed from Pull Outs → Client
-- Records (sent or failed). Keeps what was sent: recipients, subject, message,
-- the letter as sent (HTML snapshot), and the account figures at that time, so
-- the history still shows what the client received after CSIs / DRs change.
--
-- Staff only (not client / vendor portal accounts), same rule as pull_outs.
-- Rows are an audit trail: staff can insert and read, not edit or delete.

CREATE TABLE IF NOT EXISTS client_record_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_key text NOT NULL,              -- normalised client name (matches the Client Records list)
  client_name text NOT NULL,
  ref_no text,
  letter_date date,
  period_from date,
  period_to date,
  recipients text NOT NULL,
  subject text NOT NULL,
  body text,
  attachment_name text,
  letter_html text,                      -- the letter exactly as attached
  csi_count int,
  invoiced_amount numeric(14,2),
  open_count int,
  open_amount numeric(14,2),
  dr_count int,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error text,
  sent_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_by_name text,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_record_emails_client ON client_record_emails(client_key, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_record_emails_sent_at ON client_record_emails(sent_at DESC);

ALTER TABLE client_record_emails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_read_client_record_emails ON client_record_emails;
CREATE POLICY staff_read_client_record_emails ON client_record_emails FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role NOT IN ('client', 'vendor')));
DROP POLICY IF EXISTS staff_insert_client_record_emails ON client_record_emails;
CREATE POLICY staff_insert_client_record_emails ON client_record_emails FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role NOT IN ('client', 'vendor')));
GRANT SELECT, INSERT ON client_record_emails TO authenticated;
