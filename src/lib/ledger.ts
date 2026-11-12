// Shared ledger engine + posting helpers — the single source of truth for the
// General Ledger, Trial Balance, Income Statement and Balance Sheet, and for
// every module that writes journal entries (Collections, Disbursements, the
// General Journal). Modelled on the CHEM app's ledgerEngine/postToGeneralJournal.
//
//  • Reads ALL journal lines (paged past Supabase's silent 1000-row cap).
//  • Ignores VOIDED journal entries, so voiding a source document reverses it
//    in every report.
//  • Balances follow each account's normal_balance from chart_of_accounts —
//    never Math.abs or a first-digit heuristic, which break for contra entries.
//  • Posting refuses unbalanced entries, and re-posting a source (e.g. an edited
//    collection) voids its previous entry first so the books never double-count.

import { fetchAllRows } from '@/lib/supabase/fetch-all'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any

export interface COAAccount {
  account_code: string
  account_name: string
  account_type: string // asset | liability | equity | revenue | expense
  normal_balance: string // debit | credit
  is_header: boolean
}

export interface LedgerLine {
  id: string
  entry_id: string
  account_code: string
  account_name: string | null
  memo: string | null
  debit: number
  credit: number
  journal_entries: {
    entry_date: string
    entry_number: string | null
    memo: string | null
    entry_type: string | null
    status: string | null
    source_table?: string | null
  }
}

/** Every line of every non-voided journal entry, oldest first. */
export async function fetchLedgerLines(supabase: Supabase): Promise<LedgerLine[]> {
  const rows = await fetchAllRows<LedgerLine>((from, to) =>
    supabase
      .from('journal_lines')
      .select('*, journal_entries(entry_date,entry_number,memo,entry_type,status,source_table)')
      .order('created_at')
      .order('id')
      .range(from, to),
  )
  return rows
    .filter(l => l.journal_entries && l.journal_entries.status !== 'voided')
    .map(l => ({ ...l, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 }))
}

export const lineDate = (l: LedgerLine) => l.journal_entries?.entry_date ?? ''

export interface AccountBalance {
  code: string
  name: string
  type: string
  normalBalance: 'debit' | 'credit'
  debit: number          // total debits posted
  credit: number         // total credits posted
  balance: number        // signed, on the account's own normal side
  debitBalance: number   // trial-balance Dr column
  creditBalance: number  // trial-balance Cr column
  hasActivity: boolean
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** One canonical balance computation, driven by chart_of_accounts.normal_balance. */
export function computeAccountBalances(lines: LedgerLine[], coa: COAAccount[]): AccountBalance[] {
  const raw = new Map<string, { debit: number; credit: number; name: string | null }>()
  for (const l of lines) {
    const acc = raw.get(l.account_code) ?? { debit: 0, credit: 0, name: l.account_name }
    acc.debit += l.debit
    acc.credit += l.credit
    raw.set(l.account_code, acc)
  }
  const byCode = new Map(coa.map(a => [a.account_code, a]))
  // Include accounts used in entries even if missing from the chart, so nothing silently drops out.
  const codes = new Set([...coa.filter(a => !a.is_header).map(a => a.account_code), ...raw.keys()])
  return [...codes].sort().map(code => {
    const def = byCode.get(code)
    const t = raw.get(code) ?? { debit: 0, credit: 0, name: null }
    const type = def?.account_type ?? guessType(code)
    const normal: 'debit' | 'credit' = def?.normal_balance === 'credit' || (!def && ['liability', 'equity', 'revenue'].includes(type)) ? 'credit' : 'debit'
    const net = r2(t.debit - t.credit)
    const debitBalance = net > 0 ? net : 0
    const creditBalance = net < 0 ? -net : 0
    return {
      code, name: def?.account_name ?? t.name ?? code, type, normalBalance: normal,
      debit: r2(t.debit), credit: r2(t.credit),
      balance: normal === 'debit' ? net : -net,
      debitBalance, creditBalance,
      hasActivity: t.debit !== 0 || t.credit !== 0,
    }
  })
}

// Fallback for codes not in the chart: standard PH numbering 1xxx asset … 5xxx+ expense.
function guessType(code: string): string {
  return ({ '1': 'asset', '2': 'liability', '3': 'equity', '4': 'revenue' } as Record<string, string>)[code[0]] ?? 'expense'
}

export interface IncomeStatement {
  revenues: AccountBalance[]
  expenses: AccountBalance[]
  totalRevenue: number
  totalExpense: number
  netIncome: number
}

export function buildIncomeStatement(balances: AccountBalance[]): IncomeStatement {
  const revenues = balances.filter(a => a.type === 'revenue' && a.hasActivity)
  const expenses = balances.filter(a => a.type === 'expense' && a.hasActivity)
  const totalRevenue = r2(revenues.reduce((s, a) => s + a.balance, 0))
  const totalExpense = r2(expenses.reduce((s, a) => s + a.balance, 0))
  return { revenues, expenses, totalRevenue, totalExpense, netIncome: r2(totalRevenue - totalExpense) }
}

export interface BalanceSheet {
  assets: AccountBalance[]
  liabilities: AccountBalance[]
  equity: AccountBalance[]
  totalAssets: number
  totalLiabilities: number
  totalEquity: number          // capital accounts only
  netIncome: number            // current (unclosed) earnings
  totalLiabilitiesAndEquity: number
  balanced: boolean
}

/** Pass balances computed from ALL lines up to the as-of date (a balance sheet is cumulative). */
export function buildBalanceSheet(balances: AccountBalance[]): BalanceSheet {
  const assets = balances.filter(a => a.type === 'asset' && a.hasActivity)
  const liabilities = balances.filter(a => a.type === 'liability' && a.hasActivity)
  const equity = balances.filter(a => a.type === 'equity' && a.hasActivity)
  const totalAssets = r2(assets.reduce((s, a) => s + a.balance, 0))
  const totalLiabilities = r2(liabilities.reduce((s, a) => s + a.balance, 0))
  const totalEquity = r2(equity.reduce((s, a) => s + a.balance, 0))
  const netIncome = buildIncomeStatement(balances).netIncome
  const totalLiabilitiesAndEquity = r2(totalLiabilities + totalEquity + netIncome)
  return {
    assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity, netIncome,
    totalLiabilitiesAndEquity, balanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
  }
}

// ── Posting ──────────────────────────────────────────────────────────────

export interface PostingLine {
  account_code: string
  account_name?: string | null
  memo?: string | null
  debit?: number
  credit?: number
}

export interface PostingInput {
  entry_date: string
  memo: string
  entry_type: string // sales_receipt | disbursement | general | adjusting | …
  source_table?: string | null
  source_id?: string | null
  lines: PostingLine[]
}

/** Throws unless debits = credits (to the centavo) and every line is one-sided and non-negative. */
export function assertBalanced(lines: PostingLine[]) {
  const used = lines.filter(l => (l.debit ?? 0) !== 0 || (l.credit ?? 0) !== 0)
  if (used.length < 2) throw new Error('A journal entry needs at least two lines')
  for (const l of used) {
    if ((l.debit ?? 0) < 0 || (l.credit ?? 0) < 0) throw new Error('Debit and credit amounts cannot be negative')
    if ((l.debit ?? 0) > 0 && (l.credit ?? 0) > 0) throw new Error('A line cannot have both a debit and a credit')
    if (!l.account_code) throw new Error('Every line needs an account')
  }
  const dr = r2(used.reduce((s, l) => s + (l.debit ?? 0), 0))
  const cr = r2(used.reduce((s, l) => s + (l.credit ?? 0), 0))
  if (dr !== cr) throw new Error(`Entry is out of balance: debits ₱${dr.toLocaleString('en-PH', { minimumFractionDigits: 2 })} ≠ credits ₱${cr.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`)
  return used
}

/** Creates a balanced, posted journal entry and returns its id. */
export async function postJournalEntry(supabase: Supabase, input: PostingInput): Promise<string> {
  const lines = assertBalanced(input.lines)
  const { data: je, error } = await supabase.from('journal_entries').insert({
    entry_date: input.entry_date,
    memo: input.memo,
    entry_type: input.entry_type,
    source_table: input.source_table ?? null,
    source_id: input.source_id ?? null,
    status: 'posted',
  }).select('id').single()
  if (error) throw error
  const { error: lineErr } = await supabase.from('journal_lines').insert(lines.map(l => ({
    entry_id: je.id,
    account_code: l.account_code,
    account_name: l.account_name ?? null,
    memo: l.memo ?? input.memo,
    debit: r2(l.debit ?? 0),
    credit: r2(l.credit ?? 0),
  })))
  if (lineErr) {
    // Don't leave a header with no lines in the books.
    await supabase.from('journal_entries').update({ status: 'voided' }).eq('id', je.id)
    throw lineErr
  }
  return je.id as string
}

/** Voids every posted journal entry created from a source document (e.g. a voided collection). */
export async function voidSourceEntries(supabase: Supabase, source_table: string, source_id: string) {
  const { error } = await supabase.from('journal_entries')
    .update({ status: 'voided' })
    .eq('source_table', source_table).eq('source_id', source_id).neq('status', 'voided')
  if (error) throw error
}

/** Re-posts a source document after an edit: voids its old entry, posts the new one. */
export async function repostSource(supabase: Supabase, input: PostingInput & { source_table: string; source_id: string }) {
  assertBalanced(input.lines) // validate before touching the old entry
  await voidSourceEntries(supabase, input.source_table, input.source_id)
  return postJournalEntry(supabase, input)
}
