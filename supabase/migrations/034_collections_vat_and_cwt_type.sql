-- Collections previously had no VAT breakdown at all (the OR's "amount" was a single
-- gross figure) and no record of which CWT rate (goods 1% vs services 2%) produced
-- form_2307, so BIR exports couldn't report Output VAT or the correct ATC code.
-- vat_type defaults to 'exempt' so existing non-VAT-registered entities (and all
-- historical rows) keep computing to zero VAT; a VAT-registered entity's OR entry
-- sets it to 'vatable' or 'zero_rated' per transaction.
ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS vat_type text NOT NULL DEFAULT 'exempt'
    CHECK (vat_type IN ('vatable', 'zero_rated', 'exempt')),
  ADD COLUMN IF NOT EXISTS vatable_sales numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cwt_type text
    CHECK (cwt_type IS NULL OR cwt_type IN ('none', 'goods', 'services'));
