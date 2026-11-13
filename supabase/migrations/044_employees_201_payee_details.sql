-- 044 — 201 File employees + payee details
--
-- 1. employees      CDSC's own staff records for the 201 File page (separate
--                   from login accounts: not every employee uses the system).
-- 2. payees         address, TIN, VAT status, cash-disbursement type and
--                   services, used when recording Cash Disbursements.
--
-- Staff only (not client / vendor portal accounts), same rule as pull_outs.

-- ═══ 1. Employees ════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_no text UNIQUE,
  first_name text NOT NULL,
  middle_name text,
  last_name text NOT NULL,
  full_name text,
  position text,
  department text,
  employment_type text NOT NULL DEFAULT 'regular',   -- regular | probationary | contractual | project | part_time
  status text NOT NULL DEFAULT 'active',             -- active | on_leave | resigned | terminated
  date_hired date,
  date_separated date,
  birth_date date,
  gender text,
  civil_status text,
  mobile text,
  email text,
  address_no text, street text, barangay text, municipality text, city text,
  address text,
  tin text, sss_no text, philhealth_no text, pagibig_no text,
  emergency_name text, emergency_relationship text, emergency_phone text,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(last_name, first_name);

-- EMP-00001, EMP-00002 … when left blank
CREATE OR REPLACE FUNCTION generate_employee_no() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_next int;
BEGIN
  IF NEW.employee_no IS NULL OR btrim(NEW.employee_no) = '' THEN
    SELECT COALESCE(MAX(substring(employee_no FROM 5)::int), 0) + 1 INTO v_next
      FROM employees WHERE employee_no ~ '^EMP-\d+$';
    NEW.employee_no := 'EMP-' || lpad(v_next::text, 5, '0');
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_employee_no ON employees;
CREATE TRIGGER trg_employee_no BEFORE INSERT OR UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION generate_employee_no();

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_all_employees ON employees;
CREATE POLICY staff_all_employees ON employees FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role NOT IN ('client', 'vendor')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role NOT IN ('client', 'vendor')));
GRANT SELECT, INSERT, UPDATE, DELETE ON employees TO authenticated;

-- ═══ 2. Payee details ════════════════════════════════════════════════════
ALTER TABLE payees
  ADD COLUMN IF NOT EXISTS address_no text,
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS barangay text,
  ADD COLUMN IF NOT EXISTS municipality text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS tin text,
  ADD COLUMN IF NOT EXISTS vat_status text NOT NULL DEFAULT 'vatable',      -- vatable | non_vat | vat_exempt | zero_rated
  ADD COLUMN IF NOT EXISTS disbursement_type text,                          -- see app: Purchases, Services, Rent, Utilities…
  ADD COLUMN IF NOT EXISTS services text,
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS contact_number text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS remarks text;
