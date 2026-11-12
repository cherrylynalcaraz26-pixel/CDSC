'use client'

// Balance Check — "do the books balance?", modelled on the CHEM app's GL
// reconciliation. The CHEM rule is: every document that moves money posts ONE
// balanced journal entry (debits = credits), the General Ledger is just those
// entries, and the Trial Balance / Income Statement / Balance Sheet are read
// only from the ledger. So the books balance when:
//
//   1. every journal entry is balanced and has lines,
//   2. every source document (CSI, OR, disbursement) has exactly one entry
//      for the right amount — none missing, none doubled, none left behind
//      after the document was voided or deleted,
//   3. the Trial Balance totals agree and Assets = Liabilities + Equity,
//   4. the Accounts Receivable control account equals invoices billed less
//      collections received against them.
//
// Each problem found lists the record and, where it is safe, a one-click fix.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { computeAccountBalances, buildBalanceSheet, type COAAccount, type LedgerLine } from '@/lib/ledger'
import { loadAccountRoles, DEFAULT_ROLES, type AccountRoles } from '@/lib/accounting-accounts'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CheckCircle2, AlertTriangle, Loader2, RefreshCw, ArrowRight, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/error-message'
import { confirmAction } from '@/components/ui/confirm'

const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const same = (a: number, b: number) => Math.abs(a - b) < 0.01

interface Entry {
  id: string; entry_number: string | null; entry_date: string; memo: string | null
  entry_type: string | null; status: string | null
  source_table: string | null; source_id: string | null; source_ref: string | null
}
interface Line { entry_id: string; account_code: string; debit: number; credit: number }

type Kind = 'unbalanced' | 'no_lines' | 'unposted' | 'mismatch' | 'duplicate' | 'orphan' | 'voided_source'
const KIND_LABEL: Record<Kind, string> = {
  unbalanced: 'Unbalanced entry',
  no_lines: 'Entry with no lines',
  unposted: 'Not posted to the ledger',
  mismatch: 'Amount does not match',
  duplicate: 'Posted twice',
  orphan: 'Source record deleted',
  voided_source: 'Source voided, entry still posted',
}

interface Fix { label: string; run: () => Promise<void> }
interface Issue { kind: Kind; ref: string; date: string; detail: string; fix?: Fix }
interface Feed { key: string; label: string; href: string; checked: number; issues: Issue[] }

export function BalanceCheck() {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<Entry[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [coa, setCoa] = useState<COAAccount[]>([])
  const [csi, setCsi] = useState<{ si_number: string | null; amount: number | null; si_date: string | null }[]>([])
  const [cols, setCols] = useState<{ id: string; or_number: string | null; collection_date: string | null; amount: number; status: string; si_number: string | null }[]>([])
  const [links, setLinks] = useState<Set<string>>(new Set())
  const [disbs, setDisbs] = useState<{ id: string; disb_number: string | null; disb_date: string | null; amount: number; status: string }[]>([])
  const [roles, setRoles] = useState<AccountRoles>(DEFAULT_ROLES)
  const [busy, setBusy] = useState<string | null>(null)

  // Bump reloadKey to fetch again (after a fix, or Run again).
  const [reloadKey, setReloadKey] = useState(0)
  const load = useCallback(() => { setLoading(true); setReloadKey(k => k + 1) }, [])

  useEffect(() => {
    let on = true
    const page = <T,>(table: string, cols: string, order: string) =>
      fetchAllRows<T>((from, to) => supabase.from(table).select(cols).order(order).order('id').range(from, to) as unknown as PromiseLike<{ data: T[] | null }>)
    Promise.all([
      page<Entry>('journal_entries', 'id,entry_number,entry_date,memo,entry_type,status,source_table,source_id,source_ref', 'entry_date'),
      page<Line>('journal_lines', 'id,entry_id,account_code,debit,credit', 'entry_id'),
      supabase.from('chart_of_accounts').select('account_code,account_name,account_type,normal_balance,is_header').order('account_code').then((r: { data: COAAccount[] | null }) => r.data ?? []),
      page<{ si_number: string | null; amount: number | null; si_date: string | null }>('csi_records', 'id,si_number,amount,si_date', 'si_number'),
      page<{ id: string; or_number: string | null; collection_date: string | null; amount: number; status: string; si_number: string | null }>('collections', 'id,or_number,collection_date,amount,status,si_number', 'collection_date'),
      supabase.from('collection_csi_links').select('collection_id').then((r: { data: { collection_id: string }[] | null }) => r.data ?? []),
      page<{ id: string; disb_number: string | null; disb_date: string | null; amount: number; status: string }>('disbursements', 'id,disb_number,disb_date,amount,status', 'disb_date'),
      loadAccountRoles(supabase),
    ]).then(([e, l, c, s, co, lk, d, rl]) => {
    if (!on) return
    setEntries(e)
    setLines(l.map(x => ({ ...x, debit: Number(x.debit) || 0, credit: Number(x.credit) || 0 })))
    setCoa(c as COAAccount[])
    setCsi(s)
    setCols(co.map(x => ({ ...x, amount: Number(x.amount) || 0 })))
    setLinks(new Set((lk as { collection_id: string }[]).map(x => x.collection_id)))
    setDisbs(d.map(x => ({ ...x, amount: Number(x.amount) || 0 })))
    setRoles(rl)
    setLoading(false)
    })
    return () => { on = false }
  }, [supabase, reloadKey])

  async function voidEntries(ids: string[]) {
    const { error } = await supabase.from('journal_entries').update({ status: 'voided' }).in('id', ids)
    if (error) throw error
  }

  const result = useMemo(() => {
    const active = entries.filter(e => e.status !== 'voided')
    const linesBy = new Map<string, Line[]>()
    for (const l of lines) {
      const arr = linesBy.get(l.entry_id) ?? []
      arr.push(l); linesBy.set(l.entry_id, arr)
    }
    const totals = (id: string) => {
      const ls = linesBy.get(id) ?? []
      return {
        dr: r2(ls.reduce((s, l) => s + l.debit, 0)),
        cr: r2(ls.reduce((s, l) => s + l.credit, 0)),
        cashCr: r2(ls.filter(l => l.account_code === '1100').reduce((s, l) => s + l.credit, 0)),
        arDr: r2(ls.filter(l => l.account_code === roles.ar.code).reduce((s, l) => s + l.debit, 0)),
        count: ls.length,
      }
    }
    const label = (e: Entry) => e.entry_number || e.memo || e.id.slice(0, 8)
    const voidFix = (ids: string[], what: string): Fix => ({
      label: ids.length > 1 ? `Void ${ids.length} extra` : 'Void entry',
      run: async () => { await voidEntries(ids); toast.success(`${what} voided`) },
    })

    // 1. Journal integrity
    const integrity: Issue[] = []
    for (const e of active) {
      const t = totals(e.id)
      if (t.count === 0) integrity.push({ kind: 'no_lines', ref: label(e), date: e.entry_date, detail: 'Posted header with no debit/credit lines', fix: voidFix([e.id], 'Empty entry') })
      else if (!same(t.dr, t.cr)) integrity.push({ kind: 'unbalanced', ref: label(e), date: e.entry_date, detail: `Debits ${fmt(t.dr)} ≠ credits ${fmt(t.cr)}` })
    }

    // Groups active entries by their source document.
    const bySource = (table: string, key: 'source_id' | 'source_ref') => {
      const m = new Map<string, Entry[]>()
      for (const e of active) {
        if (e.source_table !== table || !e[key]) continue
        const arr = m.get(e[key] as string) ?? []
        arr.push(e); m.set(e[key] as string, arr)
      }
      return m
    }

    // 2a. Sales Journal — each SI number → one entry, Dr A/R = SI gross
    const siTotals = new Map<string, { gross: number; date: string }>()
    for (const r of csi) {
      if (!r.si_number) continue
      const cur = siTotals.get(r.si_number) ?? { gross: 0, date: r.si_date ?? '' }
      cur.gross = r2(cur.gross + (Number(r.amount) || 0))
      siTotals.set(r.si_number, cur)
    }
    const siEntries = bySource('csi_records', 'source_ref')
    const sales: Issue[] = []
    const repostSi = (si: string): Fix => ({
      label: 'Re-post',
      run: async () => {
        const { error } = await supabase.rpc('post_csi_billing', { p_si: si })
        if (error) throw error
        toast.success(`SI ${si} re-posted`)
      },
    })
    for (const [si, v] of siTotals) {
      if (v.gross <= 0) continue
      const es = siEntries.get(si) ?? []
      if (es.length === 0) { sales.push({ kind: 'unposted', ref: `SI ${si}`, date: v.date, detail: `${fmt(v.gross)} billed but no Sales Journal entry`, fix: repostSi(si) }); continue }
      if (es.length > 1) sales.push({ kind: 'duplicate', ref: `SI ${si}`, date: v.date, detail: `${es.length} entries for one invoice`, fix: voidFix(es.slice(1).map(e => e.id), 'Duplicate entry') })
      const ar = totals(es[0].id).arDr
      if (roles.ready && !same(ar, v.gross)) sales.push({ kind: 'mismatch', ref: `SI ${si}`, date: v.date, detail: `Invoice ${fmt(v.gross)} vs ledger A/R ${fmt(ar)}`, fix: repostSi(si) })
    }
    for (const [si, es] of siEntries) {
      if (!siTotals.has(si)) sales.push({ kind: 'orphan', ref: `SI ${si}`, date: es[0].entry_date, detail: 'Invoice no longer exists in CSI Monitoring', fix: voidFix(es.map(e => e.id), 'Orphan entry') })
    }

    // 2b. Collections — posted OR → one entry whose debits = OR amount
    const colEntries = bySource('collections', 'source_id')
    const colIssues: Issue[] = []
    const colIds = new Set(cols.map(c => c.id))
    for (const c of cols) {
      const es = colEntries.get(c.id) ?? []
      const ref = `OR ${c.or_number ?? '—'}`
      const date = c.collection_date ?? ''
      if (c.status === 'posted' && c.amount > 0) {
        if (es.length === 0) { colIssues.push({ kind: 'unposted', ref, date, detail: `${fmt(c.amount)} received but not in the ledger — open the OR and save it again` }); continue }
        if (es.length > 1) colIssues.push({ kind: 'duplicate', ref, date, detail: `${es.length} entries for one receipt`, fix: voidFix(es.slice(1).map(e => e.id), 'Duplicate entry') })
        const t = totals(es[0].id)
        if (!same(t.dr, c.amount)) colIssues.push({ kind: 'mismatch', ref, date, detail: `Receipt ${fmt(c.amount)} vs ledger ${fmt(t.dr)} — open the OR and save it again` })
      } else if (es.length > 0) {
        colIssues.push({ kind: 'voided_source', ref, date, detail: `Receipt is ${c.status} but its entry still counts`, fix: voidFix(es.map(e => e.id), 'Entry') })
      }
    }
    for (const [id, es] of colEntries) {
      if (!colIds.has(id)) colIssues.push({ kind: 'orphan', ref: label(es[0]), date: es[0].entry_date, detail: 'Collection was deleted', fix: voidFix(es.map(e => e.id), 'Orphan entry') })
    }

    // 2c. Cash Disbursements — posted → one entry crediting Cash for the amount
    const disbEntries = bySource('disbursements', 'source_id')
    const disbIssues: Issue[] = []
    const disbIds = new Set(disbs.map(d => d.id))
    for (const d of disbs) {
      const es = disbEntries.get(d.id) ?? []
      const ref = d.disb_number ?? d.id.slice(0, 8)
      const date = d.disb_date ?? ''
      if (d.status === 'posted' && d.amount > 0) {
        if (es.length === 0) { disbIssues.push({ kind: 'unposted', ref, date, detail: `${fmt(d.amount)} paid but not in the ledger` }); continue }
        if (es.length > 1) disbIssues.push({ kind: 'duplicate', ref, date, detail: `${es.length} entries for one payment`, fix: voidFix(es.slice(1).map(e => e.id), 'Duplicate entry') })
        const cash = totals(es[0].id).cashCr
        if (!same(cash, d.amount)) disbIssues.push({ kind: 'mismatch', ref, date, detail: `Paid ${fmt(d.amount)} vs Cash credited ${fmt(cash)}` })
      } else if (es.length > 0) {
        disbIssues.push({ kind: 'voided_source', ref, date, detail: `Payment is ${d.status} but its entry still counts`, fix: voidFix(es.map(e => e.id), 'Entry') })
      }
    }
    for (const [id, es] of disbEntries) {
      if (!disbIds.has(id)) disbIssues.push({ kind: 'orphan', ref: label(es[0]), date: es[0].entry_date, detail: 'Disbursement was deleted', fix: voidFix(es.map(e => e.id), 'Orphan entry') })
    }

    const feeds: Feed[] = [
      { key: 'gj', label: 'Journal entries (Dr = Cr)', href: '/accounting?tab=bookkeeping&sub=gj', checked: active.length, issues: integrity },
      { key: 'crj', label: 'Sales Journal (CSI)', href: '/accounting?tab=bookkeeping&sub=crj', checked: [...siTotals.values()].filter(v => v.gross > 0).length, issues: sales },
      { key: 'col', label: 'Collections (OR)', href: '/accounting?tab=collections', checked: cols.length, issues: colIssues },
      { key: 'cdj', label: 'Cash Disbursements', href: '/accounting?tab=bookkeeping&sub=cdj', checked: disbs.length, issues: disbIssues },
    ]

    // 3. Trial Balance + Balance Sheet, from the ledger only
    const activeIds = new Set(active.map(e => e.id))
    const ledger = lines.filter(l => activeIds.has(l.entry_id)).map(l => ({ ...l, id: '', account_name: null, memo: null, journal_entries: { entry_date: '', entry_number: null, memo: null, entry_type: null, status: 'posted' } })) as LedgerLine[]
    const balances = computeAccountBalances(ledger, coa)
    const tbDr = r2(balances.reduce((s, a) => s + a.debitBalance, 0))
    const tbCr = r2(balances.reduce((s, a) => s + a.creditBalance, 0))
    const bs = buildBalanceSheet(balances)

    // 4. A/R control: ledger A/R vs invoices billed − collections applied to invoices
    const billed = r2([...siTotals.values()].reduce((s, v) => s + Math.max(0, v.gross), 0))
    const applied = r2(cols.filter(c => c.status === 'posted' && (c.si_number || links.has(c.id))).reduce((s, c) => s + c.amount, 0))
    const arLedger = balances.find(a => a.code === roles.ar.code)?.balance ?? 0

    return { feeds, tbDr, tbCr, bs, billed, applied, arLedger }
  }, [entries, lines, coa, csi, cols, links, disbs, roles, supabase])

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>

  const { feeds, tbDr, tbCr, bs, billed, applied, arLedger } = result
  const tbOk = same(tbDr, tbCr)
  const arExpected = r2(billed - applied)
  const arOk = !roles.ready || same(arLedger, arExpected)
  const issueCount = feeds.reduce((s, f) => s + f.issues.length, 0)
  const allOk = tbOk && bs.balanced && arOk && issueCount === 0

  async function runFix(key: string, fix: Fix) {
    if (!(await confirmAction({ title: fix.label, description: 'This changes the journal. The original records are kept (entries are voided, never deleted).', confirmLabel: fix.label }))) return
    setBusy(key)
    try { await fix.run(); await load() } catch (err) { toast.error(getErrorMessage(err)) }
    setBusy(null)
  }

  const checks = [
    { label: 'Trial Balance: total debits = total credits', ok: tbOk, detail: tbOk ? `${fmt(tbDr)} both sides` : `Debits ${fmt(tbDr)} vs credits ${fmt(tbCr)} — off by ${fmt(Math.abs(tbDr - tbCr))}` },
    { label: 'Balance Sheet: Assets = Liabilities + Equity', ok: bs.balanced, detail: `Assets ${fmt(bs.totalAssets)} · Liabilities + Equity + current earnings ${fmt(bs.totalLiabilitiesAndEquity)}` },
    { label: 'Accounts Receivable ties to open invoices', ok: arOk, detail: roles.ready ? `Ledger A/R ${fmt(arLedger)} · Invoices billed ${fmt(billed)} − collected on invoices ${fmt(applied)} = ${fmt(arExpected)}` : 'Accrual accounts not set up yet (run migration 041)' },
    { label: 'Every document posted once, for the right amount', ok: issueCount === 0, detail: issueCount === 0 ? 'No missing, doubled or left-over entries' : `${issueCount} item${issueCount === 1 ? '' : 's'} to review below` },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${allOk ? 'bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300' : 'bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-300'}`}>
          {allOk ? <CheckCircle2 className="h-6 w-6 shrink-0" /> : <AlertTriangle className="h-6 w-6 shrink-0" />}
          <div>
            <p className="text-sm font-bold">{allOk ? 'The books balance' : 'The books need attention'}</p>
            <p className="text-xs opacity-80">All dates · checked from the General Ledger, the same way as the CHEM app</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Run again</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {checks.map(c => (
          <Card key={c.label}><CardContent className="flex items-start gap-3 pt-4 pb-3">
            {c.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />}
            <div className="min-w-0">
              <p className="text-sm font-semibold">{c.label}</p>
              <p className="text-xs text-muted-foreground">{c.detail}</p>
            </div>
          </CardContent></Card>
        ))}
      </div>

      {feeds.map(f => (
        <Card key={f.key} className="overflow-visible">
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <div className="flex items-center gap-2">
                {f.issues.length === 0 ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                <span className="text-sm font-semibold">{f.label}</span>
                <span className="text-xs text-muted-foreground">{f.checked} checked · {f.issues.length} issue{f.issues.length === 1 ? '' : 's'}</span>
              </div>
              <a href={f.href} className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline">Open <ArrowRight className="h-3 w-3" /></a>
            </div>
            {f.issues.length > 0 && (
              <Table containerClassName="overflow-x-auto">
                <TableHeader><TableRow>
                  <TableHead>Problem</TableHead><TableHead>Record</TableHead><TableHead>Date</TableHead><TableHead>Detail</TableHead><TableHead className="w-32" />
                </TableRow></TableHeader>
                <TableBody>
                  {f.issues.map((i, n) => {
                    const key = `${f.key}-${n}`
                    return (
                      <TableRow key={key}>
                        <TableCell className="whitespace-nowrap text-xs font-semibold text-amber-700">{KIND_LABEL[i.kind]}</TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs">{i.ref}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{i.date || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{i.detail}</TableCell>
                        <TableCell className="text-right">
                          {i.fix && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy === key} onClick={() => runFix(key, i.fix!)}>
                              {busy === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wrench className="mr-1 h-3 w-3" />}{i.fix.label}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ))}

      <BalanceFlow />
    </div>
  )
}

// How every document reaches the books, and the entry it makes (CHEM's flow).
function BalanceFlow() {
  const steps = ['Source document', 'Balanced journal entry (Dr = Cr)', 'General Ledger', 'Trial Balance', 'Income Statement · Balance Sheet · Cash Flow']
  const rules: [string, string, string][] = [
    ['Sales Invoice (CSI) — Sales Journal', 'Accounts Receivable', 'Sales (net of VAT), Output VAT'],
    ['Official Receipt for invoices — Collections', 'Cash, CWT Receivable (2307)', 'Accounts Receivable'],
    ['Official Receipt, cash sale (no CSI)', 'Cash, CWT Receivable (2307)', 'Sales (net of VAT), Output VAT'],
    ['Supplier payment for a PO — Cash Disbursements', 'Purchases / Expense, Input VAT', 'Cash, EWT Payable'],
    ['Other expense — Cash Disbursements', 'Expense account', 'Cash'],
    ['Adjustment — General Journal', 'Any account', 'Any account (must equal the debits)'],
  ]
  return (
    <Card><CardContent className="space-y-4 pt-5">
      <div>
        <p className="text-sm font-semibold">How the books balance</p>
        <p className="text-xs text-muted-foreground">Nothing is typed into the reports directly. Each document posts one entry whose debits equal its credits; the reports only add up the ledger — so if every entry balances, the Trial Balance and Balance Sheet must too.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            <span className="rounded-lg bg-muted px-3 py-1.5 text-xs font-medium">{s}</span>
            {i < steps.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
          </span>
        ))}
      </div>
      <Table containerClassName="overflow-x-auto">
        <TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Debit</TableHead><TableHead>Credit</TableHead></TableRow></TableHeader>
        <TableBody>
          {rules.map(([d, dr, cr]) => (
            <TableRow key={d}><TableCell className="text-xs font-medium">{d}</TableCell><TableCell className="text-xs">{dr}</TableCell><TableCell className="text-xs">{cr}</TableCell></TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent></Card>
  )
}
