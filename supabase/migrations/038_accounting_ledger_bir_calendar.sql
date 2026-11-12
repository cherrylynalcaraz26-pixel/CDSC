-- 038 — Accounting / Bookkeeping / BIR Compliance, aligned with the CHEM app.
--
-- Apply BEFORE deploying the matching app code (Settings writes has_employees,
-- BIR Compliance reads/writes bir_applicable_forms).

-- ═══ 1. Company tax profile ════════════════════════════════════════════════
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS has_employees boolean NOT NULL DEFAULT false,
  -- NULL = use the defaults for the tax profile (see src/lib/bir/compliance-calendar.ts)
  ADD COLUMN IF NOT EXISTS bir_applicable_forms text[];

-- ═══ 2. Journal entries: status + source link (used to void/re-post) ══════
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'posted',
  ADD COLUMN IF NOT EXISTS source_table text,
  ADD COLUMN IF NOT EXISTS source_id uuid;

UPDATE journal_entries SET status = 'posted' WHERE status IS NULL;
CREATE INDEX IF NOT EXISTS idx_journal_entries_source ON journal_entries(source_table, source_id);

-- ═══ 3. Fix the existing books ═════════════════════════════════════════════
BEGIN;

-- 3a. Voiding a collection or disbursement used to leave its journal entry
--     posted, so voided receipts/payments were still in the Trial Balance and
--     financial statements. Void those entries now.
UPDATE journal_entries je SET status = 'voided'
  FROM collections c
 WHERE je.source_table = 'collections' AND je.source_id = c.id
   AND c.status = 'voided' AND je.status <> 'voided';

UPDATE journal_entries je SET status = 'voided'
  FROM disbursements d
 WHERE je.source_table = 'disbursements' AND je.source_id = d.id
   AND d.status = 'voided' AND je.status <> 'voided';

-- 3b. Editing a collection used to leave its journal entry at the OLD amount.
--     Re-post every posted collection whose entry no longer matches the receipt
--     (same lines the app posts: Dr Cash net of 2307, Dr 2307 / Cr Sales, Cr Output VAT).
DO $$
DECLARE
  c record;
  v_je uuid;
  v_memo text;
  v_2307 numeric;
  v_sales numeric;
BEGIN
  FOR c IN
    SELECT col.*
      FROM collections col
     WHERE col.status = 'posted'
       AND COALESCE(col.amount, 0) > 0
       AND COALESCE((
             SELECT SUM(jl.debit)
               FROM journal_entries je JOIN journal_lines jl ON jl.entry_id = je.id
              WHERE je.source_table = 'collections' AND je.source_id = col.id AND je.status <> 'voided'
           ), 0) <> col.amount
  LOOP
    UPDATE journal_entries SET status = 'voided'
     WHERE source_table = 'collections' AND source_id = c.id AND status <> 'voided';

    v_memo  := 'Collection: ' || COALESCE(c.or_number, '') || ' – ' || COALESCE(c.client_name, '');
    v_2307  := COALESCE(c.form_2307, 0);
    v_sales := CASE WHEN c.vat_type = 'vatable' THEN COALESCE(NULLIF(c.vatable_sales, 0), c.amount - COALESCE(c.vat_amount, 0)) ELSE c.amount END;

    INSERT INTO journal_entries (entry_date, memo, entry_type, source_table, source_id, status)
    VALUES (c.collection_date, v_memo, 'sales_receipt', 'collections', c.id, 'posted')
    RETURNING id INTO v_je;

    INSERT INTO journal_lines (entry_id, account_code, account_name, memo, debit, credit)
    VALUES (v_je, '1100', 'Cash on Hand', v_memo, c.amount - v_2307, 0),
           (v_je, '4100', 'Sales Revenue', v_memo, 0, v_sales);
    IF c.vat_type = 'vatable' AND c.amount - v_sales > 0 THEN
      INSERT INTO journal_lines (entry_id, account_code, account_name, memo, debit, credit)
      VALUES (v_je, '2200', 'Output VAT Payable', v_memo, 0, c.amount - v_sales);
    END IF;
    IF v_2307 > 0 THEN
      INSERT INTO journal_lines (entry_id, account_code, account_name, memo, debit, credit)
      VALUES (v_je, '1120', 'Withholding Tax Receivable (2307)', v_memo, v_2307, 0);
    END IF;
  END LOOP;
END $$;

COMMIT;

-- ═══ 4. Check (should return no rows): every posted entry balances ════════
-- SELECT je.id, je.entry_date, je.memo, SUM(jl.debit) dr, SUM(jl.credit) cr
--   FROM journal_entries je JOIN journal_lines jl ON jl.entry_id = je.id
--  WHERE je.status <> 'voided'
--  GROUP BY je.id HAVING round(SUM(jl.debit), 2) <> round(SUM(jl.credit), 2);
