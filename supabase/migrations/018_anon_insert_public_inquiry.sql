-- The /inquiry page is a public, no-login contact form for prospective
-- clients/suppliers. It writes to crm_leads (always) and clients or
-- suppliers (depending on the selected type), but those tables only had
-- INSERT policies scoped to the `authenticated` role, so anonymous visitors
-- were silently blocked by RLS. Add narrow, INSERT-only policies for `anon`
-- that match exactly what the form submits — no SELECT/UPDATE/DELETE grant.

CREATE POLICY anon_insert_crm_leads ON crm_leads
  FOR INSERT TO anon
  WITH CHECK (stage = 'new_lead');

CREATE POLICY anon_insert_clients ON clients
  FOR INSERT TO anon
  WITH CHECK (
    auth_user_id IS NULL
    AND portal_access IS NOT TRUE
    AND (credit_limit IS NULL OR credit_limit = 0)
    AND (discount_rate IS NULL OR discount_rate = 0)
  );

CREATE POLICY anon_insert_suppliers ON suppliers
  FOR INSERT TO anon
  WITH CHECK (true);
