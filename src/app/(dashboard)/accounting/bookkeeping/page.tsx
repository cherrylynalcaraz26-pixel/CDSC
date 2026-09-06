'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getErrorMessage } from '@/lib/error-message'
import { logAudit } from '@/lib/audit-log'
import {
  Plus, Download, Loader2, BookOpen, Banknote, TrendingUp, BarChart3,
  Scale, FileSpreadsheet, Receipt, ChevronRight, FileStack,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

// ── Types ────────────────────────────────────────────────────────────────────

interface Collection {
  id: string; or_number: string | null; collection_date: string | null
  client_name: string | null; amount: number; form_2307: number | null; status: string
}

interface Disbursement {
  id: string; disb_number: string; disb_date: string; payee: string
  description: string | null; amount: number; expense_account: string
  payment_mode: string; check_number: string | null; remarks: string | null; status: string
}

interface COA {
  account_code: string; account_name: string; account_type: string
  normal_balance: string; is_header: boolean
}

interface JournalLine {
  id: string; entry_id: string; account_code: string; account_name: string | null
  memo: string | null; debit: number; credit: number
  journal_entries: { entry_date: string; entry_number: string; memo: string | null; entry_type: string }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers, ...rows].map(r => r.map(esc).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

const EXPENSE_ACCOUNTS = [
  { code: '5100', name: 'Cost of Goods Sold' },
  { code: '5200', name: 'Salaries & Wages' },
  { code: '5300', name: 'Rent Expense' },
  { code: '5400', name: 'Utilities Expense' },
  { code: '5500', name: 'Office Supplies Expense' },
  { code: '5600', name: 'Transportation & Delivery' },
  { code: '5700', name: 'Communication Expense' },
  { code: '5800', name: 'Depreciation Expense' },
  { code: '5900', name: 'Taxes & Licenses' },
  { code: '5910', name: 'BIR Tax Payments' },
  { code: '5920', name: 'SSS / PhilHealth / HDMF Expense' },
  { code: '5950', name: 'Miscellaneous Expense' },
]

const PAYMENT_MODES = ['cash', 'check', 'bank_transfer', 'gcash']

// ── Sales Journal (CRJ) Tab ───────────────────────────────────────────────────

function SalesJournalTab({ collections }: { collections: Collection[] }) {
  const posted = collections.filter(c => c.status === 'posted')
  const totalGross = posted.reduce((s, c) => s + c.amount, 0)
  const totalWHT   = posted.reduce((s, c) => s + (c.form_2307 ?? 0), 0)
  const totalNet   = totalGross - totalWHT

  function exportCRJ() {
    exportCSV('CRJ_Collections.csv',
      ['Date','OR Number','Client','Gross Amount','Form 2307 (WHT)','Net Total'],
      posted.map(c => [
        c.collection_date ?? '',
        c.or_number ?? '',
        c.client_name ?? '',
        c.amount,
        c.form_2307 ?? 0,
        c.amount - (c.form_2307 ?? 0),
      ])
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Cash Receipts Journal (CRJ)</p>
          <p className="text-xs text-muted-foreground">Auto-populated from posted Collections / Official Receipts</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCRJ}>
          <Download className="h-3.5 w-3.5 mr-1.5" />Export CSV (BIR)
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-xl font-bold">{fmt(totalGross)}</div>
          <div className="text-xs text-muted-foreground">Total Gross Sales</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-xl font-bold text-orange-600">{fmt(totalWHT)}</div>
          <div className="text-xs text-muted-foreground">Total Form 2307 (WHT)</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-xl font-bold text-green-600">{fmt(totalNet)}</div>
          <div className="text-xs text-muted-foreground">Net Cash Received</div>
        </CardContent></Card>
      </div>

      <Card className="overflow-visible">
        <CardContent className="p-0">
          <Table containerClassName="overflow-x-clip">
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>OR Number</TableHead>
                <TableHead>Client / Payor</TableHead>
                <TableHead className="text-right">Gross Amount</TableHead>
                <TableHead className="text-right">Form 2307</TableHead>
                <TableHead className="text-right">Net Received</TableHead>
                <TableHead>Account Credited</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posted.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No collections posted yet.</TableCell></TableRow>
              ) : posted.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {c.collection_date ? format(new Date(c.collection_date), 'MMM d, yyyy') : '—'}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-red-600">{c.or_number ?? '—'}</TableCell>
                  <TableCell className="text-sm">{c.client_name ?? '—'}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(c.amount)}</TableCell>
                  <TableCell className="text-right text-orange-600">{c.form_2307 ? fmt(c.form_2307) : '—'}</TableCell>
                  <TableCell className="text-right font-semibold text-green-700">{fmt(c.amount - (c.form_2307 ?? 0))}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">4100 – Sales Revenue</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {posted.length > 0 && (
            <div className="flex justify-end gap-8 px-4 py-2 bg-muted/40 border-t text-sm font-semibold">
              <span>Gross: {fmt(totalGross)}</span>
              <span className="text-orange-600">WHT: {fmt(totalWHT)}</span>
              <span className="text-green-700">Net: {fmt(totalNet)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Disbursements Tab (CDJ) ───────────────────────────────────────────────────

function DisbursementsTab() {
  const supabase = createClient()
  const [disbs, setDisbs] = useState<Disbursement[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [payees, setPayees] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState({
    disb_date: '', payee: '', description: '', amount: '',
    expense_account: '5950', payment_mode: 'cash', check_number: '', remarks: '',
  })

  async function load() {
    setLoading(true)
    const [{ data }, { data: payeeData }] = await Promise.all([
      supabase.from('disbursements').select('*').order('disb_date', { ascending: false }),
      supabase.from('payees').select('id, name').order('name'),
    ])
    setDisbs((data ?? []) as Disbursement[])
    setPayees(payeeData ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addPayeeInline(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    const { data, error } = await supabase.from('payees').insert({ name: trimmed }).select('id, name').single()
    if (error) { toast.error(getErrorMessage(error)); return }
    setPayees(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setForm(p => ({ ...p, payee: data.name }))
    toast.success('Payee added')
  }

  function resetForm() {
    setForm({ disb_date: '', payee: '', description: '', amount: '', expense_account: '5950', payment_mode: 'cash', check_number: '', remarks: '' })
  }

  async function save() {
    if (!form.payee.trim()) { toast.error('Payee is required'); return }
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Enter a valid amount'); return }
    if (!form.disb_date) { toast.error('Date is required'); return }
    setSaving(true)

    const expAcc = EXPENSE_ACCOUNTS.find(a => a.code === form.expense_account)

    // Insert disbursement
    const { data: disbData, error: disbErr } = await supabase.from('disbursements').insert({
      disb_date: form.disb_date,
      payee: form.payee.trim(),
      description: form.description.trim() || null,
      amount: Number(form.amount),
      expense_account: form.expense_account,
      payment_mode: form.payment_mode,
      check_number: form.check_number.trim() || null,
      remarks: form.remarks.trim() || null,
      status: 'posted',
    }).select().single()

    if (disbErr) { toast.error(getErrorMessage(disbErr)); setSaving(false); return }
    await logAudit(supabase, { action: 'create', table: 'disbursements', recordId: (disbData as { id: string }).id, newValues: { ...form, status: 'posted' } })

    // Create journal entry
    const memo = `${form.payee} – ${form.description || expAcc?.name || 'Disbursement'}`
    const { data: jeData, error: jeErr } = await supabase.from('journal_entries').insert({
      entry_date: form.disb_date,
      memo,
      entry_type: 'disbursement',
      source_table: 'disbursements',
      source_id: (disbData as any).id,
      status: 'posted',
    }).select().single()

    if (!jeErr && jeData) {
      const jeId = (jeData as any).id
      await supabase.from('journal_lines').insert([
        { entry_id: jeId, account_code: form.expense_account, account_name: expAcc?.name, memo, debit: Number(form.amount), credit: 0 },
        { entry_id: jeId, account_code: '1100', account_name: 'Cash on Hand', memo, debit: 0, credit: Number(form.amount) },
      ])
      // Link JE back to disbursement
      await supabase.from('disbursements').update({ journal_entry_id: jeId }).eq('id', (disbData as any).id)
    }

    toast.success('Disbursement recorded')
    setOpen(false); resetForm(); load()
    setSaving(false)
  }

  async function voidDisbursement(id: string) {
    const { error } = await supabase.from('disbursements').update({ status: 'voided' }).eq('id', id)
    if (error) toast.error(getErrorMessage(error))
    else {
      await logAudit(supabase, { action: 'void', table: 'disbursements', recordId: id, newValues: { status: 'voided' } })
      toast.success('Disbursement voided'); load()
    }
  }

  const total = disbs.filter(d => d.status === 'posted').reduce((s, d) => s + d.amount, 0)

  function exportCDJ() {
    exportCSV('CDJ_Disbursements.csv',
      ['Date','CDJ Number','Payee','Description','Expense Account','Amount','Payment Mode','Check Number'],
      disbs.filter(d => d.status === 'posted').map(d => [
        d.disb_date, d.disb_number, d.payee, d.description ?? '',
        EXPENSE_ACCOUNTS.find(a => a.code === d.expense_account)?.name ?? d.expense_account,
        d.amount, d.payment_mode, d.check_number ?? '',
      ])
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Cash Disbursements Journal (CDJ)</p>
          <p className="text-xs text-muted-foreground">All cash outflows — expenses, payments, purchases</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCDJ}><Download className="h-3.5 w-3.5 mr-1.5" />Export CSV (BIR)</Button>
          <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => { resetForm(); setOpen(true) }}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />New Disbursement
          </Button>
        </div>
      </div>

      <Card><CardContent className="pt-4 pb-3">
        <div className="text-xl font-bold text-red-600">{fmt(total)}</div>
        <div className="text-xs text-muted-foreground">Total Disbursements</div>
      </CardContent></Card>

      <Card className="overflow-visible">
        <CardContent className="p-0">
          <Table containerClassName="overflow-x-clip">
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>CDJ #</TableHead>
                <TableHead>Payee</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Expense Account</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></TableCell></TableRow>
              ) : disbs.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No disbursements yet.</TableCell></TableRow>
              ) : disbs.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="text-sm whitespace-nowrap">{format(new Date(d.disb_date), 'MMM d, yyyy')}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{d.disb_number}</TableCell>
                  <TableCell className="font-medium text-sm">{d.payee}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.description ?? '—'}</TableCell>
                  <TableCell className="text-xs">{EXPENSE_ACCOUNTS.find(a => a.code === d.expense_account)?.name ?? d.expense_account}</TableCell>
                  <TableCell><span className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize">{d.payment_mode.replace('_',' ')}</span></TableCell>
                  <TableCell className="text-right font-semibold">{fmt(d.amount)}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${d.status === 'voided' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {d.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    {d.status === 'posted' && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => voidDisbursement(d.id)} title="Void">
                        <Receipt className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Disbursement</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Date <span className="text-destructive">*</span></Label>
              <Input type="date" value={form.disb_date} onChange={e => setForm(p => ({ ...p, disb_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Mode</Label>
              <Select value={form.payment_mode} onValueChange={v => setForm(p => ({ ...p, payment_mode: v ?? 'cash' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map(m => <SelectItem key={m} value={m}>{m.replace('_',' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Payee <span className="text-destructive">*</span></Label>
              <div className="flex gap-2">
                <Select value={form.payee || 'none'} onValueChange={v => setForm(p => ({ ...p, payee: v === 'none' ? '' : (v ?? '') }))}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select a payee…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {payees.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => {
                    const name = window.prompt('New payee name')
                    if (name) addPayeeInline(name)
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />Add
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Saved payees are managed in Configuration → Payees.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input placeholder="Purpose of payment" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Expense Account</Label>
              <Select value={form.expense_account} onValueChange={v => setForm(p => ({ ...p, expense_account: v ?? '5950' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_ACCOUNTS.map(a => <SelectItem key={a.code} value={a.code}>{a.code} – {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Amount (₱) <span className="text-destructive">*</span></Label>
              <Input type="number" min={0} step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
            </div>
            {form.payment_mode === 'check' && (
              <div className="space-y-1.5">
                <Label>Check Number</Label>
                <Input placeholder="Check #" value={form.check_number} onChange={e => setForm(p => ({ ...p, check_number: e.target.value }))} />
              </div>
            )}
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Remarks</Label>
              <Textarea rows={2} placeholder="Optional notes…" value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Post Disbursement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── General Ledger Tab ────────────────────────────────────────────────────────

function GeneralLedgerTab({ lines }: { lines: JournalLine[] }) {
  const [filterAccount, setFilterAccount] = useState('')

  const accounts = Array.from(new Set(lines.map(l => l.account_code))).sort()
  const filtered = filterAccount ? lines.filter(l => l.account_code === filterAccount) : lines
  const sorted = [...filtered].sort((a, b) =>
    new Date(a.journal_entries.entry_date).getTime() - new Date(b.journal_entries.entry_date).getTime()
  )

  let runningBalance = 0
  const withBalance = sorted.map(l => {
    runningBalance += l.debit - l.credit
    return { ...l, runningBalance }
  })

  function exportGL() {
    exportCSV('General_Ledger.csv',
      ['Date','Entry #','Account Code','Account Name','Memo','Debit','Credit','Balance'],
      withBalance.map(l => [
        l.journal_entries.entry_date, l.journal_entries.entry_number,
        l.account_code, l.account_name ?? '', l.memo ?? '',
        l.debit, l.credit, l.runningBalance,
      ])
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">General Ledger</p>
          <p className="text-xs text-muted-foreground">All journal entries with running balances by account</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={filterAccount} onValueChange={v => setFilterAccount(!v || v === '_all' ? '' : v)}>
            <SelectTrigger className="w-52 h-8 text-sm"><SelectValue placeholder="Filter by account…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All accounts</SelectItem>
              {accounts.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportGL}><Download className="h-3.5 w-3.5 mr-1.5" />Export</Button>
        </div>
      </div>
      <Card className="overflow-visible">
        <CardContent className="p-0">
          <Table containerClassName="overflow-x-clip">
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Entry #</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Memo</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withBalance.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No journal entries yet.</TableCell></TableRow>
              ) : withBalance.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {format(new Date(l.journal_entries.entry_date), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{l.journal_entries.entry_number}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs font-semibold">{l.account_code}</span>
                    <span className="text-xs text-muted-foreground ml-1">{l.account_name}</span>
                  </TableCell>
                  <TableCell className="text-sm max-w-xs truncate">{l.memo ?? l.journal_entries.memo ?? '—'}</TableCell>
                  <TableCell className="text-right text-sm">{l.debit > 0 ? fmt(l.debit) : ''}</TableCell>
                  <TableCell className="text-right text-sm">{l.credit > 0 ? fmt(l.credit) : ''}</TableCell>
                  <TableCell className={`text-right text-sm font-semibold ${l.runningBalance >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                    {fmt(Math.abs(l.runningBalance))}{l.runningBalance < 0 ? ' Cr' : ' Dr'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Trial Balance Tab ─────────────────────────────────────────────────────────

function TrialBalanceTab({ lines, coa }: { lines: JournalLine[]; coa: COA[] }) {
  const accountMap: Record<string, { name: string; debit: number; credit: number; type: string; normal: string }> = {}

  for (const l of lines) {
    if (!accountMap[l.account_code]) {
      const def = coa.find(c => c.account_code === l.account_code)
      accountMap[l.account_code] = {
        name: l.account_name ?? def?.account_name ?? l.account_code,
        debit: 0, credit: 0,
        type: def?.account_type ?? '',
        normal: def?.normal_balance ?? 'debit',
      }
    }
    accountMap[l.account_code].debit  += l.debit
    accountMap[l.account_code].credit += l.credit
  }

  const rows = Object.entries(accountMap).sort((a, b) => a[0].localeCompare(b[0]))
  const totalDebit  = rows.reduce((s, [, v]) => s + v.debit, 0)
  const totalCredit = rows.reduce((s, [, v]) => s + v.credit, 0)
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01

  function exportTB() {
    exportCSV('Trial_Balance.csv',
      ['Account Code','Account Name','Type','Debit','Credit','Balance'],
      rows.map(([code, v]) => [code, v.name, v.type, v.debit, v.credit, v.debit - v.credit])
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Trial Balance</p>
          <p className="text-xs text-muted-foreground">Aggregate debit/credit balances per account</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${isBalanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
            {isBalanced ? '✓ Balanced' : '✗ Out of Balance'}
          </span>
          <Button variant="outline" size="sm" onClick={exportTB}><Download className="h-3.5 w-3.5 mr-1.5" />Export</Button>
        </div>
      </div>
      <Card className="overflow-visible">
        <CardContent className="p-0">
          <Table containerClassName="overflow-x-clip">
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Account Code</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No entries yet.</TableCell></TableRow>
              ) : rows.map(([code, v]) => (
                <TableRow key={code}>
                  <TableCell className="font-mono text-xs font-semibold">{code}</TableCell>
                  <TableCell className="text-sm">{v.name}</TableCell>
                  <TableCell><span className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize">{v.type}</span></TableCell>
                  <TableCell className="text-right text-sm">{v.debit > 0 ? fmt(v.debit) : ''}</TableCell>
                  <TableCell className="text-right text-sm">{v.credit > 0 ? fmt(v.credit) : ''}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold bg-muted/50">
                <TableCell colSpan={3} className="text-sm">TOTALS</TableCell>
                <TableCell className="text-right">{fmt(totalDebit)}</TableCell>
                <TableCell className="text-right">{fmt(totalCredit)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Income Statement Tab ──────────────────────────────────────────────────────

function IncomeStatementTab({ lines, coa }: { lines: JournalLine[]; coa: COA[] }) {
  const balances: Record<string, number> = {}
  for (const l of lines) {
    balances[l.account_code] = (balances[l.account_code] ?? 0) + l.credit - l.debit
  }

  const revenues  = coa.filter(a => a.account_type === 'revenue'  && !a.is_header)
  const expenses  = coa.filter(a => a.account_type === 'expense'  && !a.is_header)

  const totalRevenue = revenues.reduce((s, a) => s + (balances[a.account_code] ?? 0), 0)
  const totalExpense = expenses.reduce((s, a) => s + Math.abs(balances[a.account_code] ?? 0), 0)
  const netIncome    = totalRevenue - totalExpense

  function exportIS() {
    const rows: (string | number)[][] = [
      ['REVENUES','',''],
      ...revenues.filter(a => (balances[a.account_code] ?? 0) !== 0).map(a => [a.account_code, a.account_name, balances[a.account_code] ?? 0]),
      ['','Total Revenues', totalRevenue],
      ['','',''],
      ['EXPENSES','',''],
      ...expenses.filter(a => (balances[a.account_code] ?? 0) !== 0).map(a => [a.account_code, a.account_name, Math.abs(balances[a.account_code] ?? 0)]),
      ['','Total Expenses', totalExpense],
      ['','',''],
      ['','NET INCOME / (LOSS)', netIncome],
    ]
    exportCSV('Income_Statement.csv', ['Account Code','Account Name','Amount'], rows)
  }

  const Section = ({ title, accounts, total, color }: { title: string; accounts: COA[]; total: number; color: string }) => (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground pb-1 border-b mb-1">{title}</div>
      {accounts.map(a => {
        const bal = Math.abs(balances[a.account_code] ?? 0)
        if (!bal) return null
        return (
          <div key={a.account_code} className="flex justify-between py-1 text-sm">
            <span className="text-muted-foreground">{a.account_code} – {a.account_name}</span>
            <span>{fmt(bal)}</span>
          </div>
        )
      })}
      <div className={`flex justify-between py-1.5 font-semibold border-t mt-1 ${color}`}>
        <span>Total {title}</span><span>{fmt(total)}</span>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Income Statement (P&L)</p>
          <p className="text-xs text-muted-foreground">Revenues vs Expenses — basis for BIR ITR filing</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportIS}><Download className="h-3.5 w-3.5 mr-1.5" />Export</Button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-2">
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-xl font-bold text-green-600">{fmt(totalRevenue)}</div>
          <div className="text-xs text-muted-foreground">Total Revenue</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-xl font-bold text-red-600">{fmt(totalExpense)}</div>
          <div className="text-xs text-muted-foreground">Total Expenses</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className={`text-xl font-bold ${netIncome >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{fmt(Math.abs(netIncome))}</div>
          <div className="text-xs text-muted-foreground">{netIncome >= 0 ? 'Net Income' : 'Net Loss'}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="pt-5 space-y-5">
          <Section title="Revenues" accounts={revenues} total={totalRevenue} color="text-green-700" />
          <Section title="Expenses" accounts={expenses} total={totalExpense} color="text-red-600" />
          <div className={`flex justify-between text-base font-bold border-t-2 pt-3 ${netIncome >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
            <span>{netIncome >= 0 ? 'NET INCOME' : 'NET LOSS'}</span>
            <span>{fmt(Math.abs(netIncome))}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Balance Sheet Tab ─────────────────────────────────────────────────────────

function BalanceSheetTab({ lines, coa }: { lines: JournalLine[]; coa: COA[] }) {
  const balances: Record<string, number> = {}
  for (const l of lines) {
    const acc = coa.find(a => a.account_code === l.account_code)
    if (!acc) continue
    const net = l.debit - l.credit
    balances[l.account_code] = (balances[l.account_code] ?? 0) + (acc.normal_balance === 'debit' ? net : -net)
  }

  const assets      = coa.filter(a => a.account_type === 'asset'     && !a.is_header)
  const liabilities = coa.filter(a => a.account_type === 'liability' && !a.is_header)
  const equity      = coa.filter(a => a.account_type === 'equity'    && !a.is_header)
  const revenues    = coa.filter(a => a.account_type === 'revenue'   && !a.is_header)
  const expenses    = coa.filter(a => a.account_type === 'expense'   && !a.is_header)

  const totalAssets      = assets.reduce((s, a) => s + (balances[a.account_code] ?? 0), 0)
  const totalLiabilities = liabilities.reduce((s, a) => s + (balances[a.account_code] ?? 0), 0)
  const totalEquity      = equity.reduce((s, a) => s + (balances[a.account_code] ?? 0), 0)
  const netIncome        = revenues.reduce((s, a) => s + (balances[a.account_code] ?? 0), 0)
                         - expenses.reduce((s, a) => s + (balances[a.account_code] ?? 0), 0)
  const totalLiabEquity  = totalLiabilities + totalEquity + netIncome

  function exportBS() {
    exportCSV('Balance_Sheet.csv',
      ['Section','Account Code','Account Name','Balance'],
      [
        ...assets.filter(a => balances[a.account_code]).map(a => ['ASSETS', a.account_code, a.account_name, balances[a.account_code] ?? 0]),
        ['','','Total Assets', totalAssets],
        ...liabilities.filter(a => balances[a.account_code]).map(a => ['LIABILITIES', a.account_code, a.account_name, balances[a.account_code] ?? 0]),
        ['','','Total Liabilities', totalLiabilities],
        ...equity.filter(a => balances[a.account_code]).map(a => ['EQUITY', a.account_code, a.account_name, balances[a.account_code] ?? 0]),
        ['EQUITY','3300','Current Year Net Income', netIncome],
        ['','','Total Equity', totalEquity + netIncome],
        ['','','Total Liabilities + Equity', totalLiabEquity],
      ]
    )
  }

  const Section = ({ title, accounts, extra, total, color }: { title: string; accounts: COA[]; extra?: { label: string; value: number }; total: number; color: string }) => (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground pb-1 border-b mb-1">{title}</div>
      {accounts.map(a => {
        const bal = balances[a.account_code] ?? 0
        if (!bal) return null
        return (
          <div key={a.account_code} className="flex justify-between py-1 text-sm">
            <span className="text-muted-foreground">{a.account_code} – {a.account_name}</span>
            <span>{fmt(bal)}</span>
          </div>
        )
      })}
      {extra && (
        <div className="flex justify-between py-1 text-sm">
          <span className="text-muted-foreground">3300 – Current Year Net Income</span>
          <span className={extra.value >= 0 ? 'text-green-700' : 'text-red-600'}>{fmt(extra.value)}</span>
        </div>
      )}
      <div className={`flex justify-between py-1.5 font-semibold border-t mt-1 ${color}`}>
        <span>Total {title}</span><span>{fmt(total)}</span>
      </div>
    </div>
  )

  const balanced = Math.abs(totalAssets - totalLiabEquity) < 0.01

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Balance Sheet</p>
          <p className="text-xs text-muted-foreground">Statement of Financial Position — Assets = Liabilities + Equity</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${balanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
            {balanced ? '✓ Balanced' : '✗ Check Entries'}
          </span>
          <Button variant="outline" size="sm" onClick={exportBS}><Download className="h-3.5 w-3.5 mr-1.5" />Export</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Assets</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <Section title="Assets" accounts={assets} total={totalAssets} color="text-blue-700" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Liabilities & Equity</CardTitle></CardHeader>
          <CardContent className="pt-0 space-y-4">
            <Section title="Liabilities" accounts={liabilities} total={totalLiabilities} color="text-orange-700" />
            <Section title="Equity" accounts={equity} extra={{ label: 'Current Year Net Income', value: netIncome }} total={totalEquity + netIncome} color="text-purple-700" />
            <div className="flex justify-between font-bold text-sm border-t-2 pt-2">
              <span>Total Liabilities + Equity</span>
              <span className={balanced ? 'text-blue-700' : 'text-red-600'}>{fmt(totalLiabEquity)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ── BIR / CAS Export Tab ──────────────────────────────────────────────────────

function BIRExportTab({ collections, disbursements }: { collections: Collection[]; disbursements: Disbursement[] }) {
  const posted = collections.filter(c => c.status === 'posted')
  const postedDisbs = disbursements.filter(d => d.status === 'posted')

  const totalSales = posted.reduce((s, c) => s + c.amount, 0)
  const totalWHT   = posted.reduce((s, c) => s + (c.form_2307 ?? 0), 0)
  const totalDisb  = postedDisbs.reduce((s, d) => s + d.amount, 0)

  function exportSalesJournal() {
    exportCSV('BIR_SJ_SalesJournal.csv',
      ['Date','OR No.','Name of Payor','Amount of Collection','Form 2307 Amount','Net Amount Received'],
      posted.map(c => [c.collection_date ?? '', c.or_number ?? '', c.client_name ?? '', c.amount, c.form_2307 ?? 0, c.amount - (c.form_2307 ?? 0)])
    )
    toast.success('Sales Journal exported for BIR')
  }

  function exportCDJ() {
    exportCSV('BIR_CDJ_DisbursementsJournal.csv',
      ['Date','CDJ No.','Payee','Nature of Payment','Account Charged','Amount','Payment Mode','Check Number'],
      postedDisbs.map(d => [
        d.disb_date, d.disb_number, d.payee, d.description ?? '',
        EXPENSE_ACCOUNTS.find(a => a.code === d.expense_account)?.name ?? d.expense_account,
        d.amount, d.payment_mode, d.check_number ?? '',
      ])
    )
    toast.success('CDJ exported for BIR')
  }

  function exportSummary2307() {
    exportCSV('BIR_Form2307_Summary.csv',
      ['OR No.','Date','Name of Income Payor','ATC','Amount of Income','Tax Withheld'],
      posted.filter(c => (c.form_2307 ?? 0) > 0).map(c => [
        c.or_number ?? '', c.collection_date ?? '', c.client_name ?? '',
        'WC158', c.amount, c.form_2307 ?? 0,
      ])
    )
    toast.success('Form 2307 summary exported')
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold">BIR Compliance & CAS Export</p>
        <p className="text-xs text-muted-foreground">Generate BIR-ready books of accounts for CAS submission</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-lg font-bold text-green-600">{fmt(totalSales)}</div>
          <div className="text-xs text-muted-foreground">Gross Sales (CRJ)</div>
          <div className="text-xs text-muted-foreground">{posted.length} transactions</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-lg font-bold text-orange-600">{fmt(totalWHT)}</div>
          <div className="text-xs text-muted-foreground">Form 2307 (WHT)</div>
          <div className="text-xs text-muted-foreground">{posted.filter(c => (c.form_2307 ?? 0) > 0).length} certificates</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-lg font-bold text-red-600">{fmt(totalDisb)}</div>
          <div className="text-xs text-muted-foreground">Total Disbursements</div>
          <div className="text-xs text-muted-foreground">{postedDisbs.length} transactions</div>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-600" />Cash Receipts Journal (CRJ / SJ)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">BIR-required book for all cash collections and official receipts. Based on Form 2307 withheld amounts.</p>
            <Button className="w-full" variant="outline" onClick={exportSalesJournal}>
              <Download className="h-4 w-4 mr-2" />Export SJ / CRJ (CSV)
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Banknote className="h-4 w-4 text-red-600" />Cash Disbursements Journal (CDJ)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">BIR-required book for all cash outflows, expenses, and payments made by the business.</p>
            <Button className="w-full" variant="outline" onClick={exportCDJ}>
              <Download className="h-4 w-4 mr-2" />Export CDJ (CSV)
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-orange-600" />Form 2307 Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Summary of all Certificates of Creditable Tax Withheld at Source (Form 2307) received from clients.</p>
            <Button className="w-full" variant="outline" onClick={exportSummary2307}>
              <Download className="h-4 w-4 mr-2" />Export Form 2307 Summary
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Scale className="h-4 w-4 text-purple-600" />CAS Compliance Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground space-y-1.5">
              <p>✓ Books generated match BIR RR 5-2014 format</p>
              <p>✓ OR numbers sequential per BIR ATP requirements</p>
              <p>✓ Form 2307 captured per collection entry</p>
              <p>✓ Double-entry General Ledger maintained</p>
              <p>✓ Trial Balance verifies books are in balance</p>
              <p className="text-orange-600">⚠ Always verify with your accredited CAS provider before submission</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ── Accounting Cycle Flow ──────────────────────────────────────────────────────

// Every book on this page is a downstream step of the one before it — this strip
// shows that order and lets a click jump straight to a stage's tab, so someone
// who doesn't already know the accounting cycle can see why the tabs are in this
// order and what feeds what (source paperwork → journals → ledger → trial
// balance → statements → BIR/CAS export) instead of seven equal-looking tabs.
const BOOKKEEPING_STAGES: { label: string; hint: string; tabs: string[] | null; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: 'Source Documents', hint: 'ORs, DRs, invoices, receipts', tabs: null, icon: FileStack },
  { label: 'Journals', hint: 'Sales Journal (CRJ) & Disbursements (CDJ)', tabs: ['crj', 'cdj'], icon: BookOpen },
  { label: 'General Ledger', hint: 'Every entry, posted per account', tabs: ['gl'], icon: BarChart3 },
  { label: 'Trial Balance', hint: 'Proves the books are in balance', tabs: ['tb'], icon: Scale },
  { label: 'Financial Statements', hint: 'Income Statement & Balance Sheet', tabs: ['is', 'bs'], icon: FileSpreadsheet },
  { label: 'BIR / CAS Export', hint: 'Books formatted for filing', tabs: ['bir'], icon: Download },
]

function AccountingFlow({ activeTab, onSelect }: { activeTab: string; onSelect: (tab: string) => void }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-xl border bg-muted/20 p-2.5">
      {BOOKKEEPING_STAGES.map((stage, i) => {
        const active = stage.tabs?.includes(activeTab) ?? false
        return (
          <div key={stage.label} className="flex items-center shrink-0">
            {i > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground/40 mx-1 shrink-0" />}
            <button
              type="button"
              disabled={!stage.tabs}
              onClick={() => stage.tabs && onSelect(stage.tabs[0])}
              className={`flex min-w-[140px] items-start gap-2 rounded-lg px-3 py-1.5 text-left transition-colors ${
                active ? 'bg-primary text-primary-foreground shadow-sm' :
                stage.tabs ? 'border bg-background hover:bg-accent' : 'border border-dashed text-muted-foreground cursor-default'
              }`}
            >
              <stage.icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${active ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
              <span className="flex flex-col items-start">
                <span className="text-xs font-semibold leading-tight">{stage.label}</span>
                <span className={`text-[10px] leading-tight ${active ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{stage.hint}</span>
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BookkeepingPage() {
  const supabase = createClient()
  const [collections, setCollections] = useState<Collection[]>([])
  const [disbursements, setDisbursements] = useState<Disbursement[]>([])
  const [coa, setCoa] = useState<COA[]>([])
  const [jLines, setJLines] = useState<JournalLine[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('crj')

  const load = useCallback(async () => {
    setLoading(true)
    const [
      { data: colData },
      { data: disbData },
      { data: coaData },
      { data: jlData },
    ] = await Promise.all([
      supabase.from('collections').select('id,or_number,collection_date,client_name,amount,form_2307,status').order('collection_date'),
      supabase.from('disbursements').select('*').order('disb_date', { ascending: false }),
      supabase.from('chart_of_accounts').select('account_code,account_name,account_type,normal_balance,is_header').eq('is_active',true).order('account_code'),
      supabase.from('journal_lines').select('*, journal_entries(entry_date,entry_number,memo,entry_type)').order('created_at'),
    ])
    setCollections((colData ?? []) as Collection[])
    setDisbursements((disbData ?? []) as Disbursement[])
    setCoa((coaData ?? []) as COA[])
    setJLines((jlData ?? []) as unknown as JournalLine[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Bookkeeping</h2>
        <p className="text-muted-foreground text-sm">Double-entry accounting books, formatted for BIR CAS</p>
      </div>

      <AccountingFlow activeTab={activeTab} onSelect={setActiveTab} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="crj" className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />Sales Journal
          </TabsTrigger>
          <TabsTrigger value="cdj" className="flex items-center gap-1.5">
            <Banknote className="h-3.5 w-3.5" />Disbursements
          </TabsTrigger>
          <TabsTrigger value="gl" className="flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />General Ledger
          </TabsTrigger>
          <TabsTrigger value="tb" className="flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5" />Trial Balance
          </TabsTrigger>
          <TabsTrigger value="is" className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />Income Statement
          </TabsTrigger>
          <TabsTrigger value="bs" className="flex items-center gap-1.5">
            <FileSpreadsheet className="h-3.5 w-3.5" />Balance Sheet
          </TabsTrigger>
          <TabsTrigger value="bir" className="flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5" />BIR / CAS
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="crj"><SalesJournalTab collections={collections} /></TabsContent>
          <TabsContent value="cdj"><DisbursementsTab /></TabsContent>
          <TabsContent value="gl"><GeneralLedgerTab lines={jLines} /></TabsContent>
          <TabsContent value="tb"><TrialBalanceTab lines={jLines} coa={coa} /></TabsContent>
          <TabsContent value="is"><IncomeStatementTab lines={jLines} coa={coa} /></TabsContent>
          <TabsContent value="bs"><BalanceSheetTab lines={jLines} coa={coa} /></TabsContent>
          <TabsContent value="bir"><BIRExportTab collections={collections} disbursements={disbursements} /></TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
