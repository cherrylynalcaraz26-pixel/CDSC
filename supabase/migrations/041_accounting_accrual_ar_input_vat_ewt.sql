-- 041 — Accounting audit fixes
--
-- Problems found
--   1. Sales were only booked when COLLECTED (Dr Cash / Cr Sales / Cr Output VAT).
--      Charge Sales Invoices (CSI) never reached the ledger, so there was no
--      Accounts Receivable and revenue + Output VAT were understated for every
--      unpaid invoice.
--   2. Supplier payments for POs were posted Dr Expense / Cr Cash for the net
--      amount: Input VAT was never recorded and the EWT withheld (a liability to
--      BIR) was missing, understating the expense by the EWT.
--
-- Fixes (accrual basis, standard for a VAT-registered business)
--   • Sales Journal  — each CSI (by SI number):  Dr Accounts Receivable
--                                                 Cr Sales (VAT-exclusive)
--                                                 Cr Output VAT
--     Kept in sync automatically by a trigger whenever a CSI is added/edited/deleted.
--   • Collections    — receipt for invoiced sales: Dr Cash (net of 2307)
--                                                  Dr CWT Receivable (2307)
--                                                  Cr Accounts Receivable
--     (a receipt with no linked CSI stays a cash sale, as before)
--   • PO payments    — Dr Purchases/Expense (VAT-exclusive)
--                      Dr Input VAT
--                      Cr EWT Payable
--                      Cr Cash (net payable)
--
-- Run AFTER 035–040. Existing entries are corrected in place below (section 5).

-- ═══ 1. Journal entries can point at a text reference (SI number) ══════════
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS source_ref text;
CREATE INDEX IF NOT EXISTS idx_journal_entries_source_ref ON journal_entries(source_table, source_ref);

-- ═══ 2. Account roles → account codes ═══════════════════════════════════════
-- Uses an existing account when one with a matching name is already in the
-- chart; otherwise adds it under the first free code. The app reads this table.
CREATE TABLE IF NOT EXISTS accounting_accounts (
  role text PRIMARY KEY,           -- ar | input_vat | ewt_payable
  account_code text NOT NULL,
  account_name text NOT NULL
);
ALTER TABLE accounting_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS read_accounting_accounts ON accounting_accounts;
CREATE POLICY read_accounting_accounts ON accounting_accounts FOR SELECT TO authenticated USING (true);
GRANT SELECT ON accounting_accounts TO authenticated;

DO $$
DECLARE
  spec record;
  v_code text;
BEGIN
  FOR spec IN SELECT * FROM (VALUES
    ('ar',          'Accounts Receivable - Trade',      'asset',     'debit',  '(accounts? receivable|trade receivable)', ARRAY['1130','1131','1135','1210','1215']),
    ('input_vat',   'Input VAT',                        'asset',     'debit',  '(input vat|input tax)',                    ARRAY['1140','1141','1145','1250','1255']),
    ('ewt_payable', 'Expanded Withholding Tax Payable', 'liability', 'credit', '(expanded withholding|ewt payable|withholding tax payable)', ARRAY['2120','2121','2125','2310','2315'])
  ) AS t(role, name, type, nb, pattern, candidates)
  LOOP
    IF EXISTS (SELECT 1 FROM accounting_accounts WHERE role = spec.role) THEN CONTINUE; END IF;

    SELECT account_code INTO v_code FROM chart_of_accounts
     WHERE account_name ~* spec.pattern AND COALESCE(is_header, false) = false
     ORDER BY account_code LIMIT 1;

    IF v_code IS NULL THEN
      SELECT c INTO v_code FROM unnest(spec.candidates) c
       WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts a WHERE a.account_code = c) LIMIT 1;
      BEGIN
        INSERT INTO chart_of_accounts (account_code, account_name, account_type, normal_balance, is_header, is_active)
        VALUES (v_code, spec.name, spec.type, spec.nb, false, true);
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Could not add % (%) to chart_of_accounts — add it manually: %', spec.name, v_code, SQLERRM;
      END;
    END IF;

    INSERT INTO accounting_accounts (role, account_code, account_name) VALUES (spec.role, v_code, spec.name);
  END LOOP;
END $$;

-- ═══ 3. Sales Journal: post each CSI to the ledger ══════════════════════════
CREATE OR REPLACE FUNCTION post_csi_billing(p_si text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_gross  numeric;
  v_date   date;
  v_client text;
  v_vat    boolean;
  v_sales  numeric;
  v_vatamt numeric;
  v_je     uuid;
  v_ar     text := (SELECT account_code FROM accounting_accounts WHERE role = 'ar');
  v_memo   text;
BEGIN
  IF p_si IS NULL OR btrim(p_si) = '' THEN RETURN; END IF;

  SELECT round(COALESCE(SUM(amount), 0), 2), MIN(si_date), MAX(client_name)
    INTO v_gross, v_date, v_client
    FROM csi_records WHERE si_number = p_si;

  SELECT id INTO v_je FROM journal_entries
   WHERE source_table = 'csi_records' AND source_ref = p_si AND status <> 'voided' LIMIT 1;

  IF COALESCE(v_gross, 0) <= 0 THEN
    IF v_je IS NOT NULL THEN
      DELETE FROM journal_lines WHERE entry_id = v_je;
      DELETE FROM journal_entries WHERE id = v_je;
    END IF;
    RETURN;
  END IF;

  SELECT vat_registered INTO v_vat FROM system_settings LIMIT 1;
  IF COALESCE(v_vat, true) THEN
    v_sales  := round(v_gross / 1.12, 2);
    v_vatamt := v_gross - v_sales;
  ELSE
    v_sales  := v_gross;
    v_vatamt := 0;
  END IF;
  v_memo := 'Sales Invoice ' || p_si || COALESCE(' – ' || v_client, '');

  IF v_je IS NULL THEN
    INSERT INTO journal_entries (entry_date, memo, entry_type, source_table, source_ref, status)
    VALUES (COALESCE(v_date, CURRENT_DATE), v_memo, 'sales_invoice', 'csi_records', p_si, 'posted')
    RETURNING id INTO v_je;
  ELSE
    UPDATE journal_entries SET entry_date = COALESCE(v_date, entry_date), memo = v_memo WHERE id = v_je;
    DELETE FROM journal_lines WHERE entry_id = v_je;
  END IF;

  INSERT INTO journal_lines (entry_id, account_code, account_name, memo, debit, credit)
  VALUES (v_je, v_ar, 'Accounts Receivable - Trade', v_memo, v_gross, 0),
         (v_je, '4100', 'Sales Revenue', v_memo, 0, v_sales);
  IF v_vatamt > 0 THEN
    INSERT INTO journal_lines (entry_id, account_code, account_name, memo, debit, credit)
    VALUES (v_je, '2200', 'Output VAT Payable', v_memo, 0, v_vatamt);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION trg_csi_post() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    FOR r IN SELECT DISTINCT si_number FROM new_rows LOOP PERFORM post_csi_billing(r.si_number); END LOOP;
  END IF;
  IF TG_OP IN ('DELETE', 'UPDATE') THEN
    FOR r IN SELECT DISTINCT si_number FROM old_rows LOOP PERFORM post_csi_billing(r.si_number); END LOOP;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_csi_post_ins ON csi_records;
DROP TRIGGER IF EXISTS trg_csi_post_upd ON csi_records;
DROP TRIGGER IF EXISTS trg_csi_post_del ON csi_records;
CREATE TRIGGER trg_csi_post_ins AFTER INSERT ON csi_records
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION trg_csi_post();
CREATE TRIGGER trg_csi_post_upd AFTER UPDATE ON csi_records
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION trg_csi_post();
CREATE TRIGGER trg_csi_post_del AFTER DELETE ON csi_records
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION trg_csi_post();

-- ═══ 4. Backfill: every existing CSI into the Sales Journal ═════════════════
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT si_number FROM csi_records WHERE si_number IS NOT NULL LOOP
    PERFORM post_csi_billing(r.si_number);
  END LOOP;
END $$;

-- ═══ 5. Correct existing entries in place ═══════════════════════════════════
-- 5a. Collections for invoiced sales now settle Accounts Receivable instead of
--     booking the sale a second time.
DO $$
DECLARE
  c record;
  v_je uuid;
  v_2307 numeric;
  v_ar text := (SELECT account_code FROM accounting_accounts WHERE role = 'ar');
  v_memo text;
BEGIN
  FOR c IN
    SELECT col.* FROM collections col
     WHERE col.status = 'posted' AND COALESCE(col.amount, 0) > 0
       AND (col.si_number IS NOT NULL
            OR EXISTS (SELECT 1 FROM collection_csi_links l WHERE l.collection_id = col.id))
  LOOP
    SELECT id INTO v_je FROM journal_entries
     WHERE source_table = 'collections' AND source_id = c.id AND status <> 'voided' LIMIT 1;
    IF v_je IS NULL THEN CONTINUE; END IF;
    v_2307 := LEAST(COALESCE(c.form_2307, 0), c.amount);
    v_memo := 'Collection: ' || COALESCE(c.or_number, '') || ' – ' || COALESCE(c.client_name, '');
    DELETE FROM journal_lines WHERE entry_id = v_je;
    INSERT INTO journal_lines (entry_id, account_code, account_name, memo, debit, credit)
    VALUES (v_je, '1100', 'Cash on Hand', v_memo, c.amount - v_2307, 0),
           (v_je, v_ar, 'Accounts Receivable - Trade', v_memo, 0, c.amount);
    IF v_2307 > 0 THEN
      INSERT INTO journal_lines (entry_id, account_code, account_name, memo, debit, credit)
      VALUES (v_je, '1120', 'Withholding Tax Receivable (2307)', v_memo, v_2307, 0);
    END IF;
  END LOOP;
END $$;

-- 5b. PO payments: split out Input VAT and EWT Payable (pro-rated for partial payments).
DO $$
DECLARE
  d record;
  v_je uuid;
  v_ratio numeric;
  v_vat numeric;
  v_ewt numeric;
  v_base numeric;
  v_iv text := (SELECT account_code FROM accounting_accounts WHERE role = 'input_vat');
  v_ewtacc text := (SELECT account_code FROM accounting_accounts WHERE role = 'ewt_payable');
  v_memo text;
BEGIN
  FOR d IN
    SELECT ds.*, po.net_payable AS po_net, po.vat_amount AS po_vat, po.ewt_amount AS po_ewt
      FROM disbursements ds
      JOIN purchase_orders po ON po.po_number = ds.po_number
     WHERE ds.status = 'posted' AND COALESCE(ds.amount, 0) > 0 AND COALESCE(po.net_payable, 0) > 0
       AND (COALESCE(po.vat_amount, 0) > 0 OR COALESCE(po.ewt_amount, 0) > 0)
  LOOP
    SELECT id INTO v_je FROM journal_entries
     WHERE source_table = 'disbursements' AND source_id = d.id AND status <> 'voided' LIMIT 1;
    IF v_je IS NULL THEN CONTINUE; END IF;
    v_ratio := LEAST(d.amount / d.po_net, 1);
    v_vat   := round(COALESCE(d.po_vat, 0) * v_ratio, 2);
    v_ewt   := round(COALESCE(d.po_ewt, 0) * v_ratio, 2);
    v_base  := d.amount + v_ewt - v_vat;
    SELECT memo INTO v_memo FROM journal_entries WHERE id = v_je;
    DELETE FROM journal_lines WHERE entry_id = v_je;
    INSERT INTO journal_lines (entry_id, account_code, account_name, memo, debit, credit)
    VALUES (v_je, COALESCE(d.expense_account, '5100'), NULL, v_memo, v_base, 0),
           (v_je, '1100', 'Cash on Hand', v_memo, 0, d.amount);
    IF v_vat > 0 THEN
      INSERT INTO journal_lines (entry_id, account_code, account_name, memo, debit, credit)
      VALUES (v_je, v_iv, 'Input VAT', v_memo, v_vat, 0);
    END IF;
    IF v_ewt > 0 THEN
      INSERT INTO journal_lines (entry_id, account_code, account_name, memo, debit, credit)
      VALUES (v_je, v_ewtacc, 'Expanded Withholding Tax Payable', v_memo, 0, v_ewt);
    END IF;
  END LOOP;
END $$;

-- ═══ 6. Check (should return no rows): every posted entry balances ════════
-- SELECT je.id, je.entry_date, je.memo, SUM(jl.debit) dr, SUM(jl.credit) cr
--   FROM journal_entries je JOIN journal_lines jl ON jl.entry_id = je.id
--  WHERE je.status <> 'voided'
--  GROUP BY je.id HAVING round(SUM(jl.debit), 2) <> round(SUM(jl.credit), 2);
