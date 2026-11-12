-- Purchase Order VAT / EWT fix — recompute existing POs.
--
-- Run AFTER 035_po_vat_ewt_schema.sql, and only once you have confirmed against
-- the actual supplier invoices (e.g. Times Trading) that the existing PO unit
-- prices were VAT-INCLUSIVE. Preview first with the SELECT at the bottom
-- (section 0) — it changes nothing.
--
-- Mirrors computePO() in src/lib/po-tax.ts exactly (round half away from zero
-- to centavos; EWT on the amount before VAT; net payable = gross − EWT).
-- Does NOT touch disbursements/payment records.

BEGIN;

-- ── 1–3. price_basis = VAT_INCLUSIVE, ewt_type = NONE (CDSC is not confirmed as
--        a Top Withholding Agent), and recompute every stored amount.
WITH calc AS (
  SELECT
    po.id,
    round(coalesce(po.subtotal, 0) - coalesce(po.discount_amount, 0), 2) AS line_total,
    coalesce(s.vat_registered, true)                                      AS supplier_is_vat
  FROM purchase_orders po
  LEFT JOIN suppliers s ON s.id = po.supplier_id
), v AS (
  SELECT
    id,
    line_total,
    CASE WHEN supplier_is_vat THEN round(line_total / 1.12, 2) ELSE line_total END AS vatable
  FROM calc
)
UPDATE purchase_orders po
SET price_basis    = 'VAT_INCLUSIVE',
    ewt_type       = 'NONE',
    ewt_rate       = 0,
    ewt_atc        = NULL,
    gross_amount   = v.line_total,
    total_amount   = v.line_total,
    vatable_amount = v.vatable,
    vat_amount     = v.line_total - v.vatable,
    ewt_amount     = 0,
    net_payable    = v.line_total,
    updated_at     = now()
FROM v
WHERE v.id = po.id;

-- ── 4. COMPLETED POs: flag a payment variance when what was actually paid
--      (linked, non-voided disbursements) differs from the new net payable.
--      Payment records themselves are left untouched for accounting to settle.
UPDATE purchase_orders po
SET amount_paid      = p.paid,
    payment_variance = (p.paid <> po.net_payable)
FROM (
  SELECT po_number, sum(amount) AS paid
  FROM disbursements
  WHERE po_number IS NOT NULL AND coalesce(status, '') <> 'voided'
  GROUP BY po_number
) p
WHERE po.status = 'completed' AND po.po_number = p.po_number;

COMMIT;

-- ── Acceptance check (expected for the current 6 POs: both = 137,320.00) ──
-- SELECT sum(gross_amount) AS total_po_value, sum(net_payable) AS total_net_payable
-- FROM purchase_orders WHERE status <> 'cancelled';

-- ── 0. Preview (run on its own BEFORE this file; read-only) ──────────────
-- SELECT po.po_number, s.company_name, s.vat_registered,
--        po.subtotal, po.discount_amount, po.vat_amount AS old_vat,
--        po.ewt_amount AS old_ewt, po.net_payable AS old_net,
--        round(po.subtotal - coalesce(po.discount_amount,0), 2) AS new_gross_and_net
-- FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id
-- ORDER BY po.po_number;
