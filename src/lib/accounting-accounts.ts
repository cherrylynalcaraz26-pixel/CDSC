// Account roles used by the accrual postings (migration 041):
//   ar          — Accounts Receivable - Trade (CSI billings, settled by collections)
//   input_vat   — Input VAT on supplier purchases
//   ewt_payable — Expanded Withholding Tax withheld from suppliers, due to BIR
// Until 041 is applied, `ready` is false and the app keeps the previous
// cash-basis postings so the books are never half-and-half.

import { useEffect, useState } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any

export interface AccountRoles {
  ready: boolean
  ar: { code: string; name: string }
  input_vat: { code: string; name: string }
  ewt_payable: { code: string; name: string }
}

export const DEFAULT_ROLES: AccountRoles = {
  ready: false,
  ar: { code: '1130', name: 'Accounts Receivable - Trade' },
  input_vat: { code: '1140', name: 'Input VAT' },
  ewt_payable: { code: '2120', name: 'Expanded Withholding Tax Payable' },
}

export async function loadAccountRoles(supabase: Supabase): Promise<AccountRoles> {
  const { data, error } = await supabase.from('accounting_accounts').select('role, account_code, account_name')
  if (error || !data?.length) return DEFAULT_ROLES
  const roles: AccountRoles = { ...DEFAULT_ROLES, ready: true }
  for (const r of data as { role: string; account_code: string; account_name: string }[]) {
    if (r.role === 'ar' || r.role === 'input_vat' || r.role === 'ewt_payable') roles[r.role] = { code: r.account_code, name: r.account_name }
  }
  return roles
}

export function useAccountRoles(supabase: Supabase): AccountRoles {
  const [roles, setRoles] = useState<AccountRoles>(DEFAULT_ROLES)
  useEffect(() => {
    let on = true
    loadAccountRoles(supabase).then(r => { if (on) setRoles(r) })
    return () => { on = false }
  }, [supabase])
  return roles
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * Split a supplier payment for a PO into its parts, pro-rated when only part
 * of the PO is paid: VAT-exclusive purchase + Input VAT − EWT withheld = cash paid.
 */
export function splitPoPayment(paid: number, po: { net_payable: number; vat_amount: number; ewt_amount: number }) {
  const ratio = po.net_payable > 0 ? Math.min(paid / po.net_payable, 1) : 0
  const vat = r2((po.vat_amount || 0) * ratio)
  const ewt = r2((po.ewt_amount || 0) * ratio)
  return { base: r2(paid + ewt - vat), vat, ewt }
}
