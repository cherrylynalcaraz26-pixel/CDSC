-- 042 — Security hardening (from the security audit)
--
-- 1. CRITICAL: any signed-in user (including client / vendor portal accounts)
--    could change their OWN profile role to 'super_admin' — the
--    profiles_update_own policy had no column restriction.
--    → Only a Super-Admin (or the server) can change role, status or email.
-- 2. New sign-ups were created as 'employee' (a staff role with access to staff
--    data). If public sign-up is enabled in Supabase Auth, anyone could register
--    and read company data. → New accounts start as 'client' (no staff access);
--    staff are created through User Management, which sets the real role.
-- 3. The public website forms (and the anon insert policies on crm_leads,
--    clients, suppliers) had no limit — easy to flood with spam.
--    → Max 5 per email per hour per form, and 120 public submissions per hour.
--
-- Also do this in the Supabase dashboard (cannot be done from SQL):
--   Authentication → Sign In / Providers → turn OFF "Allow new users to sign up"
--   (accounts are created by staff in User Management).

-- ═══ 1. Profiles: no self-promotion ═════════════════════════════════════════
CREATE OR REPLACE FUNCTION protect_profile_privileges() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Server-side code (service role) and Super-Admins may change anything.
  IF auth.uid() IS NULL OR get_my_role() = 'super_admin' THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Only a Super-Admin can change a user''s role, status or login email'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON profiles;
CREATE TRIGGER trg_protect_profile_privileges
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_privileges();

-- ═══ 2. New accounts start without staff access ═════════════════════════════
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'client';

CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Invites (User Management) and portal accounts overwrite this with the
  -- intended role right after the user is created.
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'client')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ═══ 3. Rate-limit anonymous (website) submissions ═════════════════════════
CREATE TABLE IF NOT EXISTS public_submission_log (
  id bigserial PRIMARY KEY,
  kind text NOT NULL,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_public_submission_log_time ON public_submission_log(created_at);
CREATE INDEX IF NOT EXISTS idx_public_submission_log_email ON public_submission_log(email, kind, created_at);
ALTER TABLE public_submission_log ENABLE ROW LEVEL SECURITY;  -- no policies: only the trigger writes

CREATE OR REPLACE FUNCTION limit_public_submissions() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text := lower(btrim(COALESCE(to_jsonb(NEW)->>'contact_email', to_jsonb(NEW)->>'email', '')));
  v_total int;
  v_mine int;
BEGIN
  IF auth.uid() IS NOT NULL THEN RETURN NEW; END IF;  -- signed-in staff/portal users are not limited

  SELECT count(*) INTO v_total FROM public_submission_log WHERE created_at > now() - interval '1 hour';
  IF v_total >= 120 THEN
    RAISE EXCEPTION 'We are receiving a lot of requests right now — please call or email us instead.';
  END IF;
  IF v_email <> '' THEN
    SELECT count(*) INTO v_mine FROM public_submission_log
     WHERE email = v_email AND kind = TG_TABLE_NAME AND created_at > now() - interval '1 hour';
    IF v_mine >= 5 THEN
      RAISE EXCEPTION 'Too many requests from this email address — please try again later or call us.';
    END IF;
  END IF;

  INSERT INTO public_submission_log (kind, email) VALUES (TG_TABLE_NAME, NULLIF(v_email, ''));
  DELETE FROM public_submission_log WHERE created_at < now() - interval '7 days';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_limit_public_crm_leads ON crm_leads;
CREATE TRIGGER trg_limit_public_crm_leads BEFORE INSERT ON crm_leads
  FOR EACH ROW EXECUTE FUNCTION limit_public_submissions();
DROP TRIGGER IF EXISTS trg_limit_public_clients ON clients;
CREATE TRIGGER trg_limit_public_clients BEFORE INSERT ON clients
  FOR EACH ROW EXECUTE FUNCTION limit_public_submissions();
DROP TRIGGER IF EXISTS trg_limit_public_suppliers ON suppliers;
CREATE TRIGGER trg_limit_public_suppliers BEFORE INSERT ON suppliers
  FOR EACH ROW EXECUTE FUNCTION limit_public_submissions();

-- Anonymous visitors may add a supplier only as an inactive application
-- (was WITH CHECK (true): anything, including active suppliers).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'is_active') THEN
    DROP POLICY IF EXISTS anon_insert_suppliers ON suppliers;
    CREATE POLICY anon_insert_suppliers ON suppliers FOR INSERT TO anon WITH CHECK (is_active IS NOT TRUE);
  END IF;
END $$;
