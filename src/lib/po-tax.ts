// Purchase Order VAT / EWT / Net Payable computation.
//
// The single source of truth for PO tax math — used by the PO form, the PO list,
// the dashboard cards, Sales Orders' quick PO, and mirrored 1:1 by the SQL in
// supabase/migrations/035_po_vat_ewt_fix.sql that recomputes existing POs.
//
// Rules:
//  • VAT is owed to the supplier and is NEVER deducted from the payment.
//  • EWT is always computed on the amount BEFORE VAT, and is the only deduction.
//  • Net payable to supplier = gross (invoice total incl. VAT) − EWT.

export type PriceBasis = 'VAT_INCLUSIVE' | 'VAT_EXCLUSIVE'
export type SupplierVatStatus = 'VAT' | 'NON_VAT'
export type EwtType = 'GOODS_1' | 'SERVICES_2' | 'RENTAL_5' | 'NONE'

export const EWT_TYPES: Record<EwtType, { label: string; rate: number; atc: string | null; desc: string }> = {
  GOODS_1:    { label: 'Goods',    rate: 0.01, atc: 'WC158', desc: 'Purchase of goods' },
  SERVICES_2: { label: 'Services', rate: 0.02, atc: 'WC160', desc: 'Purchase of services' },
  RENTAL_5:   { label: 'Rental',   rate: 0.05, atc: 'WC100', desc: 'Rental of property' },
  NONE:       { label: 'None',     rate: 0,    atc: null,    desc: 'No withholding' },
}

export const EWT_TYPE_ORDER: EwtType[] = ['GOODS_1', 'SERVICES_2', 'RENTAL_5', 'NONE']

export function isEwtType(v: unknown): v is EwtType {
  return typeof v === 'string' && v in EWT_TYPES
}

/** Maps a supplier's legacy ewt_rate (percent) to an EWT type. */
export function ewtTypeFromRate(ratePercent: number | null | undefined): EwtType {
  switch (Number(ratePercent)) {
    case 1: return 'GOODS_1'
    case 2: return 'SERVICES_2'
    case 5: return 'RENTAL_5'
    default: return 'NONE'
  }
}

/**
 * Default EWT for a new PO: the supplier's default type when CDSC is a Top
 * Withholding Agent, otherwise NONE (the user can still override — e.g. rent
 * is withheld even by non-TWAs).
 */
export function defaultEwtType(isTopWithholdingAgent: boolean, supplierDefault: EwtType | null | undefined): EwtType {
  return isTopWithholdingAgent && supplierDefault ? supplierDefault : 'NONE'
}

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export interface POComputation {
  gross: number      // invoice total incl. VAT
  vatable: number    // amount before VAT (EWT base)
  vat: number        // VAT portion — info only, never deducted
  ewtRate: number
  ewtAtc: string | null
  ewt: number
  netPayable: number // gross − EWT
}

export function computePO({
  lineTotal, priceBasis, supplierVatStatus, ewtType, vatRate = 0.12,
}: {
  lineTotal: number
  priceBasis: PriceBasis
  supplierVatStatus: SupplierVatStatus
  ewtType: EwtType
  vatRate?: number
}): POComputation {
  let vatable: number, vat: number, gross: number

  if (supplierVatStatus === 'NON_VAT') {
    vatable = r2(lineTotal); vat = 0; gross = r2(lineTotal)
  } else if (priceBasis === 'VAT_INCLUSIVE') {
    gross = r2(lineTotal)
    vatable = r2(lineTotal / (1 + vatRate))
    vat = r2(gross - vatable)
  } else {
    vatable = r2(lineTotal)
    vat = r2(lineTotal * vatRate)
    gross = r2(vatable + vat)
  }

  const { rate: ewtRate, atc: ewtAtc } = EWT_TYPES[ewtType]
  const ewt = r2(vatable * ewtRate) // EWT is always on the amount BEFORE VAT
  const netPayable = r2(gross - ewt) // NEVER subtract VAT

  return { gross, vatable, vat, ewtRate, ewtAtc, ewt, netPayable }
}
