-- crm_leads was missing the anon role's table-level GRANT entirely (unlike
-- clients/suppliers, which already had it) — RLS policies never even get
-- evaluated without the underlying GRANT, which is why anon inserts failed
-- with "permission denied for table crm_leads" instead of an RLS violation.
-- Matches the narrow INSERT-only RLS policy already in place for anon
-- (see 018_anon_insert_public_inquiry.sql).
GRANT INSERT ON TABLE crm_leads TO anon;
