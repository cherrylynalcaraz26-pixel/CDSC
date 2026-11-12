-- Purchase Order VAT / EWT fix — schema only (safe to run; changes no amounts).
--
-- Background: Net Payable was computed as Subtotal − VAT, which is wrong. VAT is
-- owed to the supplier and is never deducted; only EWT is. The computation now
-- lives in src/lib/po-tax.ts (computePO). Existing POs are recomputed separately
-- in 036_po_recompute_existing.sql after the price basis is confirmed.
--
-- MUST be applied before deploying the app code that ships with it: the PO form
-- and Settings page write these new columns.

-- ── 1. Company tax profile ───────────────────────────────────────────────
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS is_top_withholding_agent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_vat_rate numeric NOT NULL DEFAULT 12;

-- ── 2. Supplier master ───────────────────────────────────────────────────
-- VAT status reuses the existing suppliers.vat_registered (true = VAT, false =
-- NON_VAT), TIN reuses suppliers.tin, and the BIR Form 2307 registered address
-- reuses suppliers.bir_registered_address — no duplicate columns.
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS bir_registered_address text,
  ADD COLUMN IF NOT EXISTS default_ewt_type text NOT NULL DEFAULT 'NONE'
    CHECK (default_ewt_type IN ('GOODS_1', 'SERVICES_2', 'RENTAL_5', 'NONE'));

-- Seed each supplier's default EWT type from its legacy ewt_rate (%) — only
-- for suppliers still on the column default, so re-running is harmless.
UPDATE suppliers
SET default_ewt_type = CASE ewt_rate WHEN 1 THEN 'GOODS_1' WHEN 2 THEN 'SERVICES_2' WHEN 5 THEN 'RENTAL_5' ELSE 'NONE' END
WHERE default_ewt_type = 'NONE' AND ewt_rate IN (1, 2, 5);

-- ── 3. Purchase orders ───────────────────────────────────────────────────
-- Existing columns keep their meaning:
--   subtotal        = sum of line totals (before discount)
--   discount_amount = discount on subtotal
--   vat_amount      = VAT portion (info only, never deducted)
--   ewt_amount      = EWT withheld (remit to BIR)
--   total_amount    = kept equal to gross_amount for older readers
--   net_payable     = gross_amount − ewt_amount
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS price_basis text NOT NULL DEFAULT 'VAT_INCLUSIVE'
    CHECK (price_basis IN ('VAT_INCLUSIVE', 'VAT_EXCLUSIVE')),
  ADD COLUMN IF NOT EXISTS ewt_type text NOT NULL DEFAULT 'NONE'
    CHECK (ewt_type IN ('GOODS_1', 'SERVICES_2', 'RENTAL_5', 'NONE')),
  ADD COLUMN IF NOT EXISTS gross_amount numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vatable_amount numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ewt_rate numeric(6,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ewt_atc text,
  -- Set by 036 for COMPLETED POs: what was actually paid (sum of linked,
  -- non-voided disbursements) and whether it differs from the new net_payable.
  ADD COLUMN IF NOT EXISTS amount_paid numeric(15,2),
  ADD COLUMN IF NOT EXISTS payment_variance boolean NOT NULL DEFAULT false;

-- Until 036 runs, mirror the old total into gross_amount so the list and
-- dashboard don't show zeros.
UPDATE purchase_orders SET gross_amount = total_amount WHERE gross_amount = 0 AND total_amount <> 0;
