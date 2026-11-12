'use client'

// Ledger-driven accounting reports + the General Journal, all computed by the
// shared engine in src/lib/ledger.ts (same approach as the CHEM app).

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Download, Plus, Trash2, Loader2, BookText, Ban } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/error-message'
import {
  computeAccountBalances, buildIncomeStatement, buildBalanceSheet, assertBalanced, postJournalEntry,
  lineDate, type COAAccount, type LedgerLine, type AccountBalance,
} from '@/lib/ledger'
import { confirmAction } from '@/components/ui/confirm'

const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const signed = (n: number) => (n < 0 ? `(${fmt(-n)})` : fmt(n))

function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const blob = new Blob([[headers, ...rows].map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

const periodNote = (from?: string, to?: string) =>
  from || to ? `${from || 'beginning'} to ${to || 'today'}` : 'All dates'

// ── Trial Balance ─────────────────────────────────────────────────────────

export function TrialBalanceReport({ lines, coa, from, to }: { lines: LedgerLine[]; coa: COAAccount[]; from?: string; to?: string }) {
  const rows = useMemo(() => computeAccountBalances(lines, coa).filter(a => a.hasActivity), [lines, coa])
  const dr = rows.reduce((s, r) => s + r.debitBalance, 0)
  const cr = rows.reduce((s, r) => s + r.creditBalance, 0)
  const balanced = Math.abs(dr - cr) < 0.01
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Trial Balance</p>
          <p className="text-xs text-muted-foreground">Net balance per account · {periodNote(from, to)}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${balanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
            {balanced ? '✓ Balanced' : `✗ Out of balance by ${fmt(Math.abs(dr - cr))}`}
          </span>
          <Button variant="outline" size="sm" onClick={() => exportCSV('Trial_Balance.csv', ['Code', 'Account', 'Type', 'Debit', 'Credit'],
            rows.map(r => [r.code, r.name, r.type, r.debitBalance || '', r.creditBalance || '']))}>
            <Download className="mr-1.5 h-3.5 w-3.5" />Export
          </Button>
        </div>
      </div>
      <Card><CardContent className="p-0">
        <Table containerClassName="max-h-[560px] overflow-y-auto">
          <TableHeader className="sticky top-0 z-10 bg-background"><TableRow>
            <TableHead>Code</TableHead><TableHead>Account</TableHead><TableHead>Type</TableHead>
            <TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No posted entries in this period.</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.code}>
                <TableCell className="font-mono text-xs font-semibold">{r.code}</TableCell>
                <TableCell className="text-sm">{r.name}</TableCell>
                <TableCell><span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{r.type}</span></TableCell>
                <TableCell className="text-right text-sm">{r.debitBalance ? fmt(r.debitBalance) : ''}</TableCell>
                <TableCell className="text-right text-sm">{r.creditBalance ? fmt(r.creditBalance) : ''}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-bold">
              <TableCell colSpan={3}>TOTALS</TableCell>
              <TableCell className="text-right">{fmt(dr)}</TableCell>
              <TableCell className="text-right">{fmt(cr)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  )
}

// ── Income Statement ──────────────────────────────────────────────────────

function StatementSection({ title, accounts, total, tone }: { title: string; accounts: AccountBalance[]; total: number; tone: string }) {
  return (
    <div>
      <div className="mb-1 pb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</div>
      {accounts.length === 0 && <div className="py-1 text-sm text-muted-foreground">—</div>}
      {accounts.map(a => (
        <div key={a.code} className="flex justify-between py-1 text-sm">
          <span className="text-muted-foreground">{a.code} – {a.name}</span><span>{signed(a.balance)}</span>
        </div>
      ))}
      <div className={`mt-1 flex justify-between rounded-md bg-muted/50 px-2 py-1.5 font-semibold ${tone}`}>
        <span>Total {title}</span><span>{signed(total)}</span>
      </div>
    </div>
  )
}

export function IncomeStatementReport({ lines, coa, from, to }: { lines: LedgerLine[]; coa: COAAccount[]; from?: string; to?: string }) {
  const is = useMemo(() => buildIncomeStatement(computeAccountBalances(lines, coa)), [lines, coa])
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Income Statement</p>
          <p className="text-xs text-muted-foreground">Revenue less expenses · {periodNote(from, to)} · basis for 1701Q / 1701</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => exportCSV('Income_Statement.csv', ['Code', 'Account', 'Amount'], [
          ['REVENUE', '', ''], ...is.revenues.map(a => [a.code, a.name, a.balance]), ['', 'Total Revenue', is.totalRevenue],
          ['EXPENSES', '', ''], ...is.expenses.map(a => [a.code, a.name, a.balance]), ['', 'Total Expenses', is.totalExpense],
          ['', 'NET INCOME (LOSS)', is.netIncome],
        ])}><Download className="mr-1.5 h-3.5 w-3.5" />Export</Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[['Total Revenue', is.totalRevenue, 'text-green-600'], ['Total Expenses', is.totalExpense, 'text-red-600'], [is.netIncome >= 0 ? 'Net Income' : 'Net Loss', is.netIncome, is.netIncome >= 0 ? 'text-blue-700' : 'text-red-600']].map(([l, v, c]) => (
          <Card key={l as string}><CardContent className="pb-3 pt-4"><div className={`text-xl font-bold ${c}`}>{signed(v as number)}</div><div className="text-xs text-muted-foreground">{l}</div></CardContent></Card>
        ))}
      </div>
      <Card><CardContent className="space-y-5 pt-5">
        <StatementSection title="Revenue" accounts={is.revenues} total={is.totalRevenue} tone="text-green-700" />
        <StatementSection title="Expenses" accounts={is.expenses} total={is.totalExpense} tone="text-red-600" />
        <div className={`flex justify-between rounded-md bg-muted px-2 py-2 text-base font-bold ${is.netIncome >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
          <span>{is.netIncome >= 0 ? 'NET INCOME' : 'NET LOSS'}</span><span>{signed(is.netIncome)}</span>
        </div>
      </CardContent></Card>
    </div>
  )
}

// ── Balance Sheet (cumulative to the as-of date) ───────────────────────────

export function BalanceSheetReport({ allLines, coa, asOf }: { allLines: LedgerLine[]; coa: COAAccount[]; asOf?: string }) {
  const bs = useMemo(() => {
    const upTo = asOf ? allLines.filter(l => lineDate(l) <= asOf) : allLines
    return buildBalanceSheet(computeAccountBalances(upTo, coa))
  }, [allLines, coa, asOf])
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Balance Sheet</p>
          <p className="text-xs text-muted-foreground">Statement of Financial Position as of {asOf || 'today'} (all entries up to that date)</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${bs.balanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
          {bs.balanced ? '✓ Assets = Liabilities + Equity' : `✗ Off by ${fmt(Math.abs(bs.totalAssets - bs.totalLiabilitiesAndEquity))}`}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Assets</CardTitle></CardHeader>
          <CardContent className="pt-0"><StatementSection title="Assets" accounts={bs.assets} total={bs.totalAssets} tone="text-blue-700" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Liabilities &amp; Owner&apos;s Equity</CardTitle></CardHeader>
          <CardContent className="space-y-4 pt-0">
            <StatementSection title="Liabilities" accounts={bs.liabilities} total={bs.totalLiabilities} tone="text-amber-700" />
            <div>
              <StatementSection title="Owner's Equity" accounts={bs.equity} total={bs.totalEquity} tone="text-purple-700" />
              <div className="flex justify-between px-2 py-1.5 text-sm">
                <span className="text-muted-foreground">Current earnings (not yet closed)</span>
                <span className={bs.netIncome >= 0 ? 'text-green-700' : 'text-red-600'}>{signed(bs.netIncome)}</span>
              </div>
            </div>
            <div className="flex justify-between rounded-md bg-muted px-2 py-2 text-sm font-bold">
              <span>Total Liabilities + Equity</span>
              <span className={bs.balanced ? 'text-blue-700' : 'text-red-600'}>{signed(bs.totalLiabilitiesAndEquity)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ── Cash Flow Statement (direct method) ───────────────────────────────────

type Activity = 'Operating' | 'Investing' | 'Financing'

export function CashFlowReport({ lines, allLines, coa, from, to }: { lines: LedgerLine[]; allLines: LedgerLine[]; coa: COAAccount[]; from?: string; to?: string }) {
  const data = useMemo(() => {
    const byCode = new Map(coa.map(a => [a.account_code, a]))
    const isCash = (code: string) => {
      const a = byCode.get(code)
      return a ? a.account_type === 'asset' && /cash|bank/i.test(a.account_name) : /^11[0-1]\d$/.test(code)
    }
    // Classify each cash movement by the other side of its entry.
    const classify = (codes: string[]): { activity: Activity; label: string } => {
      const types = codes.map(c => byCode.get(c)?.account_type ?? '')
      if (types.some(t => t === 'revenue') || codes.some(c => c === '2200' || c === '1120' || c.startsWith('12'))) return { activity: 'Operating', label: 'Receipts from customers' }
      if (types.some(t => t === 'expense')) return { activity: 'Operating', label: 'Payments for expenses & suppliers' }
      if (types.some(t => t === 'equity')) return { activity: 'Financing', label: 'Owner contributions / (drawings)' }
      if (types.some(t => t === 'liability')) return { activity: codes.some(c => /loan/i.test(byCode.get(c)?.account_name ?? '')) ? 'Financing' : 'Operating', label: 'Liabilities settled / incurred' }
      if (types.some(t => t === 'asset')) return { activity: 'Investing', label: 'Purchase / sale of assets' }
      return { activity: 'Operating', label: 'Other operating cash flows' }
    }
    const byEntry = new Map<string, LedgerLine[]>()
    for (const l of lines) byEntry.set(l.entry_id, [...(byEntry.get(l.entry_id) ?? []), l])
    const buckets = new Map<string, { activity: Activity; label: string; amount: number }>()
    for (const ls of byEntry.values()) {
      const cash = ls.filter(l => isCash(l.account_code)).reduce((s, l) => s + l.debit - l.credit, 0)
      if (Math.abs(cash) < 0.005) continue
      const { activity, label } = classify(ls.filter(l => !isCash(l.account_code)).map(l => l.account_code))
      const key = `${activity}|${label}`
      const b = buckets.get(key) ?? { activity, label, amount: 0 }
      b.amount += cash
      buckets.set(key, b)
    }
    const opening = from ? allLines.filter(l => lineDate(l) < from && isCash(l.account_code)).reduce((s, l) => s + l.debit - l.credit, 0) : 0
    const items = [...buckets.values()]
    const total = (a: Activity) => items.filter(i => i.activity === a).reduce((s, i) => s + i.amount, 0)
    const net = items.reduce((s, i) => s + i.amount, 0)
    return { items, total, net, opening, closing: opening + net }
  }, [lines, allLines, coa, from])

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold">Cash Flow Statement</p>
        <p className="text-xs text-muted-foreground">Direct method, from entries that touch Cash / Bank accounts · {periodNote(from, to)}</p>
      </div>
      <Card><CardContent className="space-y-5 pt-5">
        {(['Operating', 'Investing', 'Financing'] as Activity[]).map(a => (
          <div key={a}>
            <div className="mb-1 pb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Cash flows from {a.toLowerCase()} activities</div>
            {data.items.filter(i => i.activity === a).map(i => (
              <div key={i.label} className="flex justify-between py-1 text-sm"><span className="text-muted-foreground">{i.label}</span><span>{signed(i.amount)}</span></div>
            ))}
            {data.items.every(i => i.activity !== a) && <div className="py-1 text-sm text-muted-foreground">—</div>}
            <div className="mt-1 flex justify-between rounded-md bg-muted/50 px-2 py-1.5 text-sm font-semibold">
              <span>Net cash from {a.toLowerCase()} activities</span><span>{signed(data.total(a))}</span>
            </div>
          </div>
        ))}
        <div className="space-y-1 rounded-md bg-muted px-3 py-2 text-sm">
          <div className="flex justify-between font-semibold"><span>Net increase / (decrease) in cash</span><span>{signed(data.net)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Cash at beginning of period</span><span>{signed(data.opening)}</span></div>
          <div className="flex justify-between text-base font-bold"><span>Cash at end of period</span><span>{signed(data.closing)}</span></div>
        </div>
      </CardContent></Card>
    </div>
  )
}

// ── General Journal (manual & adjusting entries) ──────────────────────────

interface GJLine { account_code: string; description: string; debit: string; credit: string }
const blankLine = (): GJLine => ({ account_code: '', description: '', debit: '', credit: '' })

export function GeneralJournalPanel({ lines, coa, onChanged }: { lines: LedgerLine[]; coa: COAAccount[]; onChanged: () => void }) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [entryType, setEntryType] = useState<'general' | 'adjusting' | 'closing'>('general')
  const [memo, setMemo] = useState('')
  const [rows, setRows] = useState<GJLine[]>([blankLine(), blankLine()])
  const accounts = coa.filter(a => !a.is_header)
  const name = (code: string) => accounts.find(a => a.account_code === code)?.account_name ?? code

  // Manual entries only — source-document postings live in their own journals.
  const entries = useMemo(() => {
    const m = new Map<string, LedgerLine[]>()
    for (const l of lines) {
      if (!['general', 'adjusting', 'closing', 'opening'].includes(l.journal_entries.entry_type ?? '')) continue
      m.set(l.entry_id, [...(m.get(l.entry_id) ?? []), l])
    }
    return [...m.entries()].sort((a, b) => lineDate(b[1][0]).localeCompare(lineDate(a[1][0])))
  }, [lines])

  const dr = rows.reduce((s, r) => s + (parseFloat(r.debit) || 0), 0)
  const cr = rows.reduce((s, r) => s + (parseFloat(r.credit) || 0), 0)
  const diff = Math.round((dr - cr) * 100) / 100

  function reset() {
    setDate(new Date().toISOString().slice(0, 10)); setEntryType('general'); setMemo(''); setRows([blankLine(), blankLine()])
  }

  async function save() {
    if (!memo.trim()) { toast.error('Enter an explanation for this entry'); return }
    const posting = rows.map(r => ({
      account_code: r.account_code, account_name: name(r.account_code), memo: r.description.trim() || memo.trim(),
      debit: parseFloat(r.debit) || 0, credit: parseFloat(r.credit) || 0,
    }))
    try { assertBalanced(posting) } catch (err) { toast.error(getErrorMessage(err)); return }
    setSaving(true)
    try {
      await postJournalEntry(supabase, { entry_date: date, memo: memo.trim(), entry_type: entryType, lines: posting })
      toast.success('Journal entry posted')
      setOpen(false); reset(); onChanged()
    } catch (err) { toast.error(getErrorMessage(err, 'Could not post the entry')) }
    setSaving(false)
  }

  async function voidEntry(entryId: string) {
    if (!(await confirmAction({ title: 'Void this journal entry?', description: 'It will be removed from every report.', confirmLabel: 'Void entry' }))) return
    const { error } = await supabase.from('journal_entries').update({ status: 'voided' }).eq('id', entryId)
    if (error) toast.error(getErrorMessage(error))
    else { toast.success('Entry voided'); onChanged() }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">General Journal</p>
          <p className="text-xs text-muted-foreground">Manual, adjusting and closing entries — must balance before posting</p>
        </div>
        <Button className="bg-red-600 hover:bg-red-700" onClick={() => { reset(); setOpen(true) }}>
          <Plus className="mr-1.5 h-4 w-4" />New Journal Entry
        </Button>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Date</TableHead><TableHead>Entry No.</TableHead><TableHead>Type</TableHead><TableHead>Explanation</TableHead>
            <TableHead>Account</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                <BookText className="mx-auto mb-2 h-6 w-6 opacity-40" />No manual entries in this period.
              </TableCell></TableRow>
            ) : entries.map(([id, ls]) => ls.map((l, i) => (
              <TableRow key={l.id} className={i === ls.length - 1 ? '' : '[&>td]:pb-0.5'}>
                <TableCell className="whitespace-nowrap text-xs">{i === 0 ? lineDate(l) : ''}</TableCell>
                <TableCell className="font-mono text-xs">{i === 0 ? l.journal_entries.entry_number ?? '—' : ''}</TableCell>
                <TableCell className="text-xs capitalize">{i === 0 ? l.journal_entries.entry_type : ''}</TableCell>
                <TableCell className="max-w-[220px] text-xs">{i === 0 ? l.journal_entries.memo : ''}</TableCell>
                <TableCell className={`text-xs ${l.credit > 0 ? 'pl-8' : ''}`}>{l.account_code} – {l.account_name ?? name(l.account_code)}</TableCell>
                <TableCell className="text-right text-xs">{l.debit ? fmt(l.debit) : ''}</TableCell>
                <TableCell className="text-right text-xs">{l.credit ? fmt(l.credit) : ''}</TableCell>
                <TableCell className="text-right">
                  {i === 0 && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Void entry" onClick={() => voidEntry(id)}>
                      <Ban className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="landscape">
          <DialogHeader><DialogTitle>New Journal Entry</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={entryType} onValueChange={v => setEntryType((v ?? 'general') as typeof entryType)}>
                <SelectTrigger className="w-full"><span className="text-sm capitalize">{entryType}</span></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="adjusting">Adjusting</SelectItem>
                  <SelectItem value="closing">Closing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Explanation <span className="text-destructive">*</span></Label>
              <Textarea rows={1} value={memo} onChange={e => setMemo(e.target.value)} placeholder="e.g. To record depreciation for November 2026" />
            </div>
          </div>

          <div className="space-y-2 rounded-xl bg-muted/40 p-3">
            <div className="grid grid-cols-12 gap-2 px-1 text-xs font-medium text-muted-foreground">
              <span className="col-span-4">Account</span><span className="col-span-4">Line description</span>
              <span className="col-span-2 text-right">Debit</span><span className="col-span-2 text-right">Credit</span>
            </div>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-4">
                  <Select value={r.account_code} onValueChange={v => setRows(p => p.map((x, j) => j === i ? { ...x, account_code: v ?? '' } : x))}>
                    <SelectTrigger className="w-full">
                      <span className="truncate text-sm">{r.account_code ? `${r.account_code} – ${name(r.account_code)}` : <span className="text-muted-foreground">Select account…</span>}</span>
                    </SelectTrigger>
                    <SelectContent>{accounts.map(a => <SelectItem key={a.account_code} value={a.account_code}>{a.account_code} – {a.account_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Input className="col-span-4" value={r.description} onChange={e => setRows(p => p.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                <Input className="col-span-2 text-right" type="number" min={0} placeholder="0.00" value={r.debit}
                  onChange={e => setRows(p => p.map((x, j) => j === i ? { ...x, debit: e.target.value, credit: e.target.value ? '' : x.credit } : x))} />
                <div className="col-span-2 flex items-center gap-1">
                  <Input className="text-right" type="number" min={0} placeholder="0.00" value={r.credit}
                    onChange={e => setRows(p => p.map((x, j) => j === i ? { ...x, credit: e.target.value, debit: e.target.value ? '' : x.debit } : x))} />
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted-foreground" disabled={rows.length <= 2}
                    onClick={() => setRows(p => p.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setRows(p => [...p, blankLine()])}>
                <Plus className="mr-1 h-3.5 w-3.5" />Add line
              </Button>
              <div className="flex items-center gap-4 text-sm">
                <span>Debits <b>{fmt(dr)}</b></span><span>Credits <b>{fmt(cr)}</b></span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${diff === 0 && dr > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                  {diff === 0 && dr > 0 ? 'Balanced' : `Difference ${fmt(Math.abs(diff))}`}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || diff !== 0 || dr === 0} className="bg-red-600 hover:bg-red-700">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Post Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
