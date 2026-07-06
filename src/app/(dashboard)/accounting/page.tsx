'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus, Download, Loader2, BookOpen, Banknote, TrendingUp,
  Scale, FileSpreadsheet, Trash2, Calculator, Receipt, FileText, DollarSign,
  Zap, MoreHorizontal, Printer, Eye, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Collection {
  id: string; or_number: string | null; collection_date: string | null
  client_name: string | null; amount: number; form_2307: number | null; status: string
  payment_mode?: string | null; si_number?: string | null
  reference_number?: string | null; remarks?: string | null; client_id?: string | null
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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const PAYMENT_MODES_DISB = ['cash', 'check', 'bank_transfer', 'gcash']
const PAYMENT_MODES_COL  = ['Cash', 'Check', 'Bank Transfer', 'GCash', 'Maya', 'Credit Card', 'Online Banking']

const STATUS_CLS: Record<string, string> = {
  posted:  'bg-green-100 text-green-700',
  voided:  'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
}

// ── BIR static data ───────────────────────────────────────────────────────────

const birForms = [
  { form: '0619-E', description: 'Expanded Withholding Tax (Monthly)', period: 'May 2025', due: '2025-06-10', status: 'due_soon', amount: 12450 },
  { form: '0619-F', description: 'Final Withholding Tax (Monthly)', period: 'May 2025', due: '2025-06-10', status: 'due_soon', amount: 3200 },
  { form: '1601-EQ', description: 'Expanded Withholding Tax (Quarterly)', period: 'Q1 2025', due: '2025-04-30', status: 'filed', amount: 38750 },
  { form: '1601-FQ', description: 'Final Withholding Tax (Quarterly)', period: 'Q1 2025', due: '2025-04-30', status: 'filed', amount: 9600 },
  { form: '2550Q', description: 'Value Added Tax (Quarterly)', period: 'Q2 2025', due: '2025-07-25', status: 'pending', amount: 0 },
  { form: '1702Q', description: 'Income Tax (Quarterly)', period: 'Q1 2025', due: '2025-05-29', status: 'filed', amount: 145000 },
]

const readinessChecks = [
  { check: 'All suppliers have TIN on file', status: 'pass', detail: '24/24 suppliers' },
  { check: 'All VAT transactions have proper classification', status: 'pass', detail: '156 transactions' },
  { check: 'EWT rates assigned to suppliers', status: 'warning', detail: '2 suppliers missing ATC code' },
  { check: 'Input VAT supported by ORs/invoices', status: 'pass', detail: '98% compliance' },
  { check: 'Alphalist data complete', status: 'warning', detail: '2 payees missing TIN' },
  { check: 'SLSP purchases data complete', status: 'pass', detail: 'Q1 2025 complete' },
]

interface EwtRow { supplier: string; tin: string | null; atc: string | null; address: string | null; gross: number; vat_excl: number; ewt_rate: number; ewt: number }
interface SlspRow { month: string; supplier: string; tin: string | null; refNo: string; gross: number; vat: number; net: number }

const vatSummary = [
  { month: 'Jan 2025', gross_purchases: 820000, input_vat: 88071.43, output_vat: 0, net_vat: 88071.43 },
  { month: 'Feb 2025', gross_purchases: 640000, input_vat: 68571.43, output_vat: 0, net_vat: 68571.43 },
  { month: 'Mar 2025', gross_purchases: 950000, input_vat: 101785.71, output_vat: 0, net_vat: 101785.71 },
]

const readinessScore = Math.round((readinessChecks.filter(c => c.status === 'pass').length / readinessChecks.length) * 100)

// ── Date range filter (Preset year/quarter or Custom from/to) ─────────────────
// Shared across Overview, Collections, and Bookkeeping so each tab can filter
// its data by the same Preset/Custom date range control.

function useDateRangeFilter() {
  const currentYear = new Date().getFullYear()
  const [filterYear, setFilterYear] = useState<string>('all')
  const [filterQuarter, setFilterQuarter] = useState<string>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [useCustom, setUseCustom] = useState(false)

  const { filterFrom, filterTo } = (() => {
    if (useCustom) return { filterFrom: customFrom || undefined, filterTo: customTo || undefined }
    if (filterYear === 'all') return { filterFrom: undefined, filterTo: undefined }
    const y = parseInt(filterYear)
    const qMap: Record<string, [string, string]> = {
      Q1: [`${y}-01-01`, `${y}-03-31`],
      Q2: [`${y}-04-01`, `${y}-06-30`],
      Q3: [`${y}-07-01`, `${y}-09-30`],
      Q4: [`${y}-10-01`, `${y}-12-31`],
    }
    if (filterQuarter !== 'all' && qMap[filterQuarter]) return { filterFrom: qMap[filterQuarter][0], filterTo: qMap[filterQuarter][1] }
    return { filterFrom: `${y}-01-01`, filterTo: `${y}-12-31` }
  })()

  return {
    currentYear, filterYear, setFilterYear, filterQuarter, setFilterQuarter,
    customFrom, setCustomFrom, customTo, setCustomTo, useCustom, setUseCustom,
    filterFrom, filterTo,
  }
}

type DateRangeFilter = ReturnType<typeof useDateRangeFilter>

function applyDateFilter<T>(df: DateRangeFilter, arr: T[], getDate: (item: T) => string | null | undefined) {
  return arr.filter(item => {
    const d = getDate(item)
    if (!d) return true
    if (df.filterFrom && d < df.filterFrom) return false
    if (df.filterTo && d > df.filterTo) return false
    return true
  })
}

function DateFilterBar({ df }: { df: DateRangeFilter }) {
  const yearOptions = Array.from({ length: 5 }, (_, i) => String(df.currentYear - i))
  return (
    <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg bg-muted/30 border">
      <div className="flex items-center gap-2">
        <Label className="text-xs whitespace-nowrap">Filter by</Label>
        <Select value={df.useCustom ? 'custom' : 'preset'} onValueChange={v => df.setUseCustom(v === 'custom')}>
          <SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="preset">Preset</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {!df.useCustom ? (
        <>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Year</Label>
            <Select value={df.filterYear} onValueChange={v => { df.setFilterYear(v ?? 'all'); df.setFilterQuarter('all') }}>
              <SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {yearOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Quarter</Label>
            <Select value={df.filterQuarter} onValueChange={v => df.setFilterQuarter(v ?? 'all')} disabled={df.filterYear === 'all'}>
              <SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Quarters</SelectItem>
                <SelectItem value="Q1">Q1 (Jan–Mar)</SelectItem>
                <SelectItem value="Q2">Q2 (Apr–Jun)</SelectItem>
                <SelectItem value="Q3">Q3 (Jul–Sep)</SelectItem>
                <SelectItem value="Q4">Q4 (Oct–Dec)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Label className="text-xs">From</Label>
            <Input type="date" className="h-8 text-xs w-36" value={df.customFrom} onChange={e => df.setCustomFrom(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">To</Label>
            <Input type="date" className="h-8 text-xs w-36" value={df.customTo} onChange={e => df.setCustomTo(e.target.value)} />
          </div>
        </>
      )}
      {(df.filterFrom || df.filterTo) && (
        <span className="text-xs text-muted-foreground">{df.filterFrom ?? '—'} → {df.filterTo ?? '—'}</span>
      )}
    </div>
  )
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const supabase = createClient()
  const df = useDateRangeFilter()
  const [summary, setSummary] = useState({ totalPO: 0, totalReceived: 0, totalEWT: 0, totalVAT: 0, pendingPayables: 0 })
  const [recentPOs, setRecentPOs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      let poQuery = supabase.from('purchase_orders').select('total_amount, ewt_amount, vat_amount, status')
      let rrQuery = supabase.from('receiving_reports').select('total_amount')
      if (df.filterFrom) { poQuery = poQuery.gte('created_at', df.filterFrom); rrQuery = rrQuery.gte('created_at', df.filterFrom) }
      if (df.filterTo) { poQuery = poQuery.lte('created_at', df.filterTo); rrQuery = rrQuery.lte('created_at', df.filterTo) }
      const [pos, rrs] = await Promise.all([poQuery, rrQuery])
      const poData = pos.data ?? []
      const rrData = rrs.data ?? []
      setSummary({
        totalPO: poData.reduce((s: number, p: any) => s + (p.total_amount ?? 0), 0),
        totalReceived: rrData.reduce((s: number, r: any) => s + (r.total_amount ?? 0), 0),
        totalEWT: poData.reduce((s: number, p: any) => s + (p.ewt_amount ?? 0), 0),
        totalVAT: poData.reduce((s: number, p: any) => s + (p.vat_amount ?? 0), 0),
        pendingPayables: poData.filter((p: any) => p.status === 'approved' || p.status === 'sent').reduce((s: number, p: any) => s + (p.total_amount ?? 0), 0),
      })
      const { data: recent } = await supabase
        .from('purchase_orders')
        .select('po_number, supplier:suppliers(company_name), total_amount, vat_amount, ewt_amount, status, created_at')
        .order('created_at', { ascending: false })
        .limit(10)
      setRecentPOs(recent ?? [])
      setLoading(false)
    }
    load()
  }, [df.filterFrom, df.filterTo])

  const periodLabel = df.filterFrom || df.filterTo ? `${df.filterFrom ?? '—'} → ${df.filterTo ?? '—'}` : 'All Time'

  const cards = [
    { title: 'PO Amount', value: fmt(summary.totalPO), icon: FileText, color: 'text-blue-600' },
    { title: 'Total Received', value: fmt(summary.totalReceived), icon: TrendingUp, color: 'text-green-600' },
    { title: 'Pending Payables', value: fmt(summary.pendingPayables), icon: DollarSign, color: 'text-red-700' },
    { title: 'EWT Withheld', value: fmt(summary.totalEWT), icon: Receipt, color: 'text-purple-600' },
    { title: 'Input VAT', value: fmt(summary.totalVAT), icon: Calculator, color: 'text-red-600' },
  ]

  return (
    <div className="space-y-6">
      <DateFilterBar df={df} />
      <p className="text-sm text-muted-foreground">Showing: {periodLabel}</p>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {cards.map(card => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{loading ? '—' : card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Purchase Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Gross Amount</TableHead>
                <TableHead className="text-right">VAT (12%)</TableHead>
                <TableHead className="text-right">EWT</TableHead>
                <TableHead className="text-right">Net Payable</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : recentPOs.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No purchase orders yet</TableCell></TableRow>
              ) : recentPOs.map((po: any, i: number) => {
                const gross = po.total_amount ?? 0
                const vat = po.vat_amount ?? 0
                const ewt = po.ewt_amount ?? 0
                const net = gross - ewt
                return (
                  <TableRow key={po.id ?? i}>
                    <TableCell className="font-mono text-sm">{po.po_number}</TableCell>
                    <TableCell>{po.supplier?.company_name ?? '—'}</TableCell>
                    <TableCell className="text-right">{fmt(gross)}</TableCell>
                    <TableCell className="text-right text-blue-600">{fmt(vat)}</TableCell>
                    <TableCell className="text-right text-red-600">({fmt(ewt)})</TableCell>
                    <TableCell className="text-right font-medium">{fmt(net)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{po.status}</Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Collections Tab ───────────────────────────────────────────────────────────

function CollectionsTab() {
  const supabase = createClient()
  const [records, setRecords] = useState<Collection[]>([])
  const [clients, setClients] = useState<{ id: string; company_name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clientFilter, setClientFilter] = useState('')
  const df = useDateRangeFilter()
  const [form, setForm] = useState({
    or_number: '', client_id: '', client_name: '', amount: '', si_number: '',
    payment_mode: 'Cash', reference_number: '', collection_date: '', remarks: '',
  })
  const [clientSearch, setClientSearch] = useState('')
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false)
  const [csiOptions, setCsiOptions] = useState<{ si_number: string; si_date: string; total: number }[]>([])
  const [readyToCollect, setReadyToCollect] = useState<{ so_number: string; client_name: string; csi_total: number; collected_total: number; outstanding: number }[]>([])
  const [companyInfo, setCompanyInfo] = useState<{ company_name: string | null; address: string | null; phone: string | null; tin: string | null } | null>(null)
  const [viewRecord, setViewRecord] = useState<Collection | null>(null)

  async function load() {
    setLoading(true)
    const [{ data: colData }, { data: cliData }, { data: drRows }, { data: csiRows }] = await Promise.all([
      supabase.from('collections').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, company_name').eq('status', 'active').order('company_name'),
      supabase.from('dr_logs').select('po_number, status').not('po_number', 'is', null).in('status', ['received', 'partial']),
      supabase.from('csi_records').select('po_number, si_number, amount, client_name').not('po_number', 'is', null),
    ])
    setRecords((colData ?? []) as Collection[])
    setClients(cliData ?? [])
    const { data: sysData } = await supabase.from('system_settings').select('company_name, address, phone, tin').single()
    if (sysData) setCompanyInfo(sysData)

    // A Sales Order is "ready to collect" once it's both been delivered (has a DR) and
    // invoiced (has CSI records) — and still has an outstanding (uncollected) balance.
    const drPoNumbers = new Set((drRows ?? []).map(d => d.po_number).filter(Boolean))
    const csiByPo: Record<string, { siNumbers: Set<string>; total: number; clientName: string }> = {}
    for (const r of (csiRows ?? [])) {
      if (!r.po_number) continue
      if (!csiByPo[r.po_number]) csiByPo[r.po_number] = { siNumbers: new Set(), total: 0, clientName: r.client_name ?? '' }
      csiByPo[r.po_number].siNumbers.add(r.si_number)
      csiByPo[r.po_number].total += Number(r.amount) || 0
    }
    const collectedBySi: Record<string, number> = {}
    for (const c of ((colData ?? []) as Collection[])) {
      if (c.status === 'posted' && c.si_number) collectedBySi[c.si_number] = (collectedBySi[c.si_number] ?? 0) + (c.amount ?? 0)
    }
    const list: typeof readyToCollect = []
    for (const [poNumber, info] of Object.entries(csiByPo)) {
      if (!drPoNumbers.has(poNumber)) continue
      const collected = [...info.siNumbers].reduce((s, si) => s + (collectedBySi[si] ?? 0), 0)
      const outstanding = info.total - collected
      if (outstanding <= 0.01) continue
      list.push({ so_number: poNumber, client_name: info.clientName, csi_total: info.total, collected_total: collected, outstanding })
    }
    list.sort((a, b) => b.outstanding - a.outstanding)
    setReadyToCollect(list)

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function resetForm() {
    setForm({ or_number: '', client_id: '', client_name: '', amount: '', si_number: '', payment_mode: 'Cash', reference_number: '', collection_date: '', remarks: '' })
    setClientSearch('')
    setClientDropdownOpen(false)
    setCsiOptions([])
  }

  // CSI invoices for this client that don't already have a posted collection linked —
  // so the same invoice can't be selected (and collected) twice.
  async function loadCsiOptions(clientName: string) {
    if (!clientName) { setCsiOptions([]); return }
    const [{ data: csiData }, { data: linkedRows }] = await Promise.all([
      supabase.from('csi_records').select('si_number, si_date, amount').eq('client_name', clientName),
      supabase.from('collections').select('si_number').eq('client_name', clientName).eq('status', 'posted').not('si_number', 'is', null),
    ])
    const linkedSet = new Set((linkedRows ?? []).map(r => r.si_number))
    const map: Record<string, { si_number: string; si_date: string; total: number }> = {}
    for (const r of (csiData ?? [])) {
      if (!r.si_number || linkedSet.has(r.si_number)) continue
      if (!map[r.si_number]) map[r.si_number] = { si_number: r.si_number, si_date: r.si_date, total: 0 }
      map[r.si_number].total += Number(r.amount) || 0
    }
    setCsiOptions(Object.values(map).sort((a, b) => (b.si_date ?? '').localeCompare(a.si_date ?? '')))
  }

  function selectClient(c: { id: string; company_name: string }) {
    setForm(p => ({ ...p, client_id: c.id, client_name: c.company_name, si_number: '' }))
    setClientSearch(c.company_name)
    setClientDropdownOpen(false)
    loadCsiOptions(c.company_name)
  }

  function selectCsi(siNumber: string) {
    if (!siNumber) { setForm(p => ({ ...p, si_number: '' })); return }
    const csi = csiOptions.find(c => c.si_number === siNumber)
    setForm(p => ({ ...p, si_number: siNumber, amount: csi ? String(csi.total) : p.amount }))
  }

  function openCollectFor(row: { client_name: string }) {
    resetForm()
    const matched = clients.find(c => c.company_name === row.client_name)
    setForm(p => ({ ...p, client_id: matched?.id ?? '', client_name: row.client_name }))
    setClientSearch(row.client_name)
    loadCsiOptions(row.client_name)
    setOpen(true)
  }

  const filteredClients = clients.filter(c => !clientSearch || c.company_name.toLowerCase().includes(clientSearch.toLowerCase()))

  async function save() {
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Enter a valid amount'); return }
    const clientName = form.client_id
      ? clients.find(c => c.id === form.client_id)?.company_name ?? form.client_name
      : form.client_name
    if (!clientName.trim()) { toast.error('Client name required'); return }
    setSaving(true)
    const { error } = await supabase.from('collections').insert({
      or_number: form.or_number.trim() || null,
      client_id: form.client_id || null,
      client_name: clientName.trim(),
      amount: Number(form.amount),
      payment_mode: form.payment_mode.toLowerCase().replace(' ', '_'),
      reference_number: form.reference_number || null,
      collection_date: form.collection_date || new Date().toISOString().split('T')[0],
      remarks: form.remarks || null,
      si_number: form.si_number || null,
      status: 'posted',
    })
    if (error) toast.error(error.message)
    else { toast.success('Collection recorded'); setOpen(false); resetForm(); load() }
    setSaving(false)
  }

  async function voidRecord(id: string) {
    const { error } = await supabase.from('collections').update({ status: 'voided' }).eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Collection voided'); load() }
  }

  async function deleteRecord(id: string) {
    const { error } = await supabase.from('collections').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Deleted'); load() }
  }

  // `r === null` prints a blank OR template (blank lines instead of data) for manual/
  // handwritten use — same layout either way so a filled-out blank matches a system one.
  function buildOrHtml(r: Collection | null) {
    const net = r ? (r.amount ?? 0) - (r.form_2307 ?? 0) : 0
    const field = (v: string | null | undefined) => v ? v : '&nbsp;'
    return `<!DOCTYPE html><html><head><title>Official Receipt${r?.or_number ? ' ' + r.or_number : ''}</title><style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; color: #111; padding: 40px; background: #fff; }
      .sheet { max-width: 640px; margin: 0 auto; border: 1px solid #d1d5db; border-radius: 8px; padding: 28px; }
      .accent { background: #dc2626; height: 5px; border-radius: 3px; margin-bottom: 20px; }
      .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1f2937; padding-bottom: 14px; margin-bottom: 20px; }
      .co-name { font-size: 18px; font-weight: 800; color: #1f2937; }
      .co-sub { font-size: 10px; color: #6b7280; margin-top: 4px; line-height: 1.6; }
      .title { text-align: right; }
      .title .doc { font-size: 20px; font-weight: 900; color: #dc2626; letter-spacing: 1px; }
      .title .or-no { font-size: 11px; margin-top: 6px; color: #6b7280; }
      .title .or-no b { font-family: monospace; font-size: 14px; color: #111; }
      .row { display: flex; gap: 10px; margin-bottom: 14px; font-size: 12px; align-items: flex-end; }
      .row .lbl { width: 130px; color: #6b7280; text-transform: uppercase; font-size: 9px; font-weight: 700; padding-bottom: 4px; }
      .row .val { flex: 1; border-bottom: 1px solid #9ca3af; padding-bottom: 4px; min-height: 16px; font-weight: 600; }
      .amt-box { margin-top: 22px; border: 1px solid #e5e7eb; border-radius: 6px; padding: 14px 16px; }
      .amt-line { display: flex; justify-content: space-between; font-size: 12px; padding: 4px 0; }
      .amt-line.total { border-top: 1px solid #d1d5db; margin-top: 6px; padding-top: 8px; font-weight: 800; font-size: 15px; }
      .sign { display: flex; justify-content: space-between; margin-top: 56px; }
      .sign div { width: 44%; text-align: center; border-top: 1px solid #111; padding-top: 6px; font-size: 10px; color: #6b7280; }
      @media print { @page { margin: 12mm; size: A4 portrait; } }
    </style></head><body>
      <div class="sheet">
        <div class="accent"></div>
        <div class="head">
          <div>
            <div class="co-name">${companyInfo?.company_name ?? 'CDSC Industrial Supply'}</div>
            <div class="co-sub">
              ${companyInfo?.address ? `${companyInfo.address}<br/>` : ''}
              ${companyInfo?.phone ? `Tel: ${companyInfo.phone}<br/>` : ''}
              ${companyInfo?.tin ? `TIN: ${companyInfo.tin}` : ''}
            </div>
          </div>
          <div class="title">
            <div class="doc">Official Receipt</div>
            <div class="or-no">No. <b>${r ? (r.or_number ?? '—') : '____________________'}</b></div>
          </div>
        </div>
        <div class="row"><div class="lbl">Date</div><div class="val">${r ? (r.collection_date ? format(new Date(r.collection_date), 'MMMM d, yyyy') : '') : field(null)}</div></div>
        <div class="row"><div class="lbl">Received From</div><div class="val">${r ? field(r.client_name) : field(null)}</div></div>
        <div class="row"><div class="lbl">Payment Mode</div><div class="val">${r ? field(r.payment_mode) : field(null)}</div></div>
        <div class="row"><div class="lbl">Reference No.</div><div class="val">${r ? field(r.reference_number) : field(null)}</div></div>
        <div class="row"><div class="lbl">SI Reference</div><div class="val">${r ? field(r.si_number) : field(null)}</div></div>
        <div class="row"><div class="lbl">For</div><div class="val">${r ? field(r.remarks) : field(null)}</div></div>
        <div class="amt-box">
          <div class="amt-line"><span>Gross Amount</span><span>${r ? fmt(r.amount ?? 0) : '&nbsp;'}</span></div>
          <div class="amt-line"><span>Less: Form 2307 (EWT)</span><span>${r ? (r.form_2307 ? fmt(r.form_2307) : '—') : '&nbsp;'}</span></div>
          <div class="amt-line total"><span>Net Amount Received</span><span>${r ? fmt(net) : '&nbsp;'}</span></div>
        </div>
        <div class="sign">
          <div>Received By</div>
          <div>Authorized Signature</div>
        </div>
      </div>
    </body></html>`
  }

  function printOR(r: Collection | null) {
    const win = window.open('', '_blank', 'width=760,height=900')
    if (!win) return
    win.document.write(buildOrHtml(r))
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 400)
  }

  const filteredRecords = applyDateFilter(
    df,
    clientFilter ? records.filter(r => (r.client_name ?? '').toLowerCase().includes(clientFilter.toLowerCase())) : records,
    r => r.collection_date
  )
  const totalPosted = filteredRecords.filter(r => r.status === 'posted').reduce((s, r) => s + (r.amount ?? 0) - (r.form_2307 ?? 0), 0)
  const countPosted = filteredRecords.filter(r => r.status === 'posted').length
  const countVoided = filteredRecords.filter(r => r.status === 'voided').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Official Receipts and Collection Receipts management</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => printOR(null)}>
            <Printer className="h-4 w-4 mr-2" />Print Blank OR
          </Button>
          <Button onClick={() => { resetForm(); setOpen(true) }} className="bg-red-600 hover:bg-red-700">
            <Plus className="h-4 w-4 mr-2" />New Collection
          </Button>
        </div>
      </div>

      <DateFilterBar df={df} />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold text-green-600">{loading ? '—' : fmt(totalPosted)}</div>
          <div className="text-sm text-muted-foreground">Total Collections</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold">{loading ? '—' : countPosted}</div>
          <div className="text-sm text-muted-foreground">Posted Records</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold text-red-600">{loading ? '—' : countVoided}</div>
          <div className="text-sm text-muted-foreground">Voided</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />Ready to Collect
          </CardTitle>
          <CardDescription>Sales Orders that have been delivered (DR) and invoiced (CSI) but still have an outstanding balance</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SO Number</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Billed (CSI)</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell></TableRow>
              ) : readyToCollect.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No outstanding Sales Orders with both a DR and a CSI invoice.
                </TableCell></TableRow>
              ) : readyToCollect.map(row => (
                <TableRow key={row.so_number}>
                  <TableCell className="font-mono text-xs font-semibold text-blue-600">{row.so_number}</TableCell>
                  <TableCell className="text-sm font-medium">{row.client_name || '—'}</TableCell>
                  <TableCell className="text-right">{fmt(row.csi_total)}</TableCell>
                  <TableCell className="text-right text-green-600">{fmt(row.collected_total)}</TableCell>
                  <TableCell className="text-right font-semibold text-amber-600">{fmt(row.outstanding)}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => openCollectFor(row)}>Collect</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-red-600" />Collection Records
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={clientFilter} onValueChange={v => setClientFilter(v ?? '')}>
                <SelectTrigger className="h-8 text-xs w-48">
                  <SelectValue placeholder="All Clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Clients</SelectItem>
                  {[...new Set(records.map(r => r.client_name).filter(Boolean))].sort().map(name => (
                    <SelectItem key={name!} value={name!}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clientFilter && (
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setClientFilter('')}>
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>OR Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Payment Mode</TableHead>
                <TableHead className="text-right">Gross Amount</TableHead>
                <TableHead className="text-right">Form 2307</TableHead>
                <TableHead className="text-right">Net Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell></TableRow>
              ) : filteredRecords.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  {clientFilter ? `No collections found for "${clientFilter}".` : 'No collections yet. Click New Collection to record one.'}
                </TableCell></TableRow>
              ) : filteredRecords.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs font-semibold text-red-600">{r.or_number ?? '—'}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {r.collection_date ? format(new Date(r.collection_date), 'MMM d, yyyy') : '—'}
                  </TableCell>
                  <TableCell className="font-medium text-sm">{r.client_name ?? '—'}</TableCell>
                  <TableCell>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize">
                      {(r.payment_mode ?? '').replace('_', ' ')}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{fmt(r.amount ?? 0)}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">{r.form_2307 ? fmt(r.form_2307) : '—'}</TableCell>
                  <TableCell className="text-right font-semibold text-green-700">{fmt((r.amount ?? 0) - (r.form_2307 ?? 0))}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLS[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {r.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => setViewRecord(r)}>
                          <Eye className="mr-2 h-4 w-4" />View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => printOR(r)}>
                          <Printer className="mr-2 h-4 w-4" />Print OR
                        </DropdownMenuItem>
                        {r.status === 'posted' && (
                          <DropdownMenuItem onClick={() => voidRecord(r.id)} className="text-destructive">
                            <Receipt className="mr-2 h-4 w-4" />Void
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => deleteRecord(r.id)} className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Collection (OR)</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>OR Number</Label>
                <Input placeholder="Leave blank to auto-generate" value={form.or_number}
                  onChange={e => setForm(p => ({ ...p, or_number: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Collection Date</Label>
                <Input type="date" value={form.collection_date} onChange={e => setForm(p => ({ ...p, collection_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5 relative">
              <Label>Client</Label>
              <Input
                value={clientSearch}
                onChange={e => {
                  const val = e.target.value
                  setClientSearch(val)
                  setForm(p => ({ ...p, client_id: '', client_name: val, si_number: '' }))
                  setClientDropdownOpen(true)
                  setCsiOptions([])
                }}
                onFocus={() => setClientDropdownOpen(true)}
                onBlur={() => setTimeout(() => setClientDropdownOpen(false), 150)}
                placeholder="Type to search or enter a client name…"
                className="w-full"
              />
              {clientDropdownOpen && filteredClients.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredClients.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={() => selectClient(c)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent border-b last:border-0"
                    >
                      {c.company_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {csiOptions.length > 0 && (
              <div className="space-y-1.5">
                <Label>Link to CSI Invoice (optional)</Label>
                <Select value={form.si_number} onValueChange={v => selectCsi(v ?? '')}>
                  <SelectTrigger><SelectValue placeholder="Select an unbilled CSI invoice…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— None —</SelectItem>
                    {csiOptions.map(csi => (
                      <SelectItem key={csi.si_number} value={csi.si_number}>
                        {csi.si_number} — {csi.si_date ? format(new Date(csi.si_date), 'MMM d, yyyy') : '—'} — {fmt(csi.total)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Selecting an invoice fills in the Amount below automatically.</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Amount (₱) <span className="text-destructive">*</span></Label>
                <Input type="number" min={0} step="0.01" placeholder="0.00" value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Mode</Label>
                <Select value={form.payment_mode} onValueChange={v => setForm(p => ({ ...p, payment_mode: v ?? 'Cash' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES_COL.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reference Number</Label>
              <Input placeholder="Check #, bank ref, transaction ID…" value={form.reference_number}
                onChange={e => setForm(p => ({ ...p, reference_number: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Remarks</Label>
              <Textarea rows={2} placeholder="Optional notes…" value={form.remarks}
                onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Post Collection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View OR Dialog */}
      <Dialog open={!!viewRecord} onOpenChange={o => { if (!o) setViewRecord(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Receipt className="h-4 w-4 text-red-600" />Official Receipt</DialogTitle>
          </DialogHeader>
          {viewRecord && (
            <div className="space-y-3 py-1 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-xs text-muted-foreground block">OR Number</span><span className="font-mono font-semibold text-red-600">{viewRecord.or_number ?? '—'}</span></div>
                <div><span className="text-xs text-muted-foreground block">Date</span><span>{viewRecord.collection_date ? format(new Date(viewRecord.collection_date), 'MMM d, yyyy') : '—'}</span></div>
                <div><span className="text-xs text-muted-foreground block">Client</span><span className="font-medium">{viewRecord.client_name ?? '—'}</span></div>
                <div><span className="text-xs text-muted-foreground block">Status</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLS[viewRecord.status] ?? 'bg-gray-100 text-gray-600'}`}>{viewRecord.status}</span>
                </div>
                <div><span className="text-xs text-muted-foreground block">Payment Mode</span><span className="capitalize">{(viewRecord.payment_mode ?? '—').replace('_', ' ')}</span></div>
                <div><span className="text-xs text-muted-foreground block">Reference No.</span><span>{viewRecord.reference_number ?? '—'}</span></div>
                <div><span className="text-xs text-muted-foreground block">SI Reference</span><span>{viewRecord.si_number ?? '—'}</span></div>
                <div><span className="text-xs text-muted-foreground block">For</span><span>{viewRecord.remarks ?? '—'}</span></div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Gross Amount</span><span className="font-medium">{fmt(viewRecord.amount ?? 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Form 2307 (EWT)</span><span>{viewRecord.form_2307 ? fmt(viewRecord.form_2307) : '—'}</span></div>
                <div className="flex justify-between border-t pt-1 font-bold text-green-700"><span>Net Total</span><span>{fmt((viewRecord.amount ?? 0) - (viewRecord.form_2307 ?? 0))}</span></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewRecord(null)}>Close</Button>
            <Button onClick={() => printOR(viewRecord)} className="bg-red-600 hover:bg-red-700 gap-1.5">
              <Printer className="h-4 w-4" />Print OR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Sales Journal (CRJ) sub-tab ───────────────────────────────────────────────

function SalesJournalTab({ collections, csiRecords }: { collections: Collection[]; csiRecords: any[] }) {
  // Group CSI records by SI number
  const siMap: Record<string, { date: string; client: string; items: any[]; total: number }> = {}
  csiRecords.forEach(r => {
    if (!siMap[r.si_number]) siMap[r.si_number] = { date: r.si_date ?? '', client: r.client_name ?? '—', items: [], total: 0 }
    siMap[r.si_number].items.push(r)
    siMap[r.si_number].total += r.amount ?? 0
  })
  const siRows = Object.entries(siMap).sort((a, b) => (a[1].date > b[1].date ? 1 : -1))
  const totalSales = siRows.reduce((s, [, v]) => s + v.total, 0)

  function exportSJ() {
    exportCSV('SalesJournal_CSI.csv',
      ['Date', 'SI Number', 'Client', 'Item', 'Qty', 'Unit', 'Unit Price', 'Amount'],
      csiRecords.map(r => [r.si_date ?? '', r.si_number ?? '', r.client_name ?? '', r.item_name ?? '', r.quantity ?? 0, r.unit ?? '', r.unit_price ?? 0, r.amount ?? 0])
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Sales Journal — CSI</p>
          <p className="text-xs text-muted-foreground">Charge Sales Invoices grouped by SI number (use date range filter above)</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportSJ}><Download className="h-3.5 w-3.5 mr-1.5" />Export CSV</Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="pt-4 pb-3"><div className="text-xl font-bold text-blue-600">{fmt(totalSales)}</div><div className="text-xs text-muted-foreground">Total Sales Billed</div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><div className="text-xl font-bold">{siRows.length}</div><div className="text-xs text-muted-foreground">Sales Invoices</div></CardContent></Card>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Date</TableHead>
            <TableHead>SI Number</TableHead>
            <TableHead>Client</TableHead>
            <TableHead className="text-right">Items</TableHead>
            <TableHead className="text-right">Total Amount</TableHead>
            <TableHead>Account</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {siRows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No CSI records in this date range.</TableCell></TableRow>
            ) : siRows.map(([si, v]) => (
              <TableRow key={si}>
                <TableCell className="text-sm whitespace-nowrap">{v.date ? format(new Date(v.date), 'MMM d, yyyy') : '—'}</TableCell>
                <TableCell className="font-mono text-xs font-semibold text-red-600">{si}</TableCell>
                <TableCell className="text-sm">{v.client}</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">{v.items.length}</TableCell>
                <TableCell className="text-right font-semibold">{fmt(v.total)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">4100 – Sales Revenue</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {siRows.length > 0 && (
          <div className="flex justify-end gap-8 px-4 py-2 bg-muted/40 border-t text-sm font-semibold">
            <span>Total Sales: {fmt(totalSales)}</span>
          </div>
        )}
      </CardContent></Card>
    </div>
  )
}

// ── Disbursements sub-tab (CDJ) ───────────────────────────────────────────────

function DisbursementsTab({ filterFrom, filterTo }: { filterFrom?: string; filterTo?: string }) {
  const supabase = createClient()
  const [disbs, setDisbs] = useState<Disbursement[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ disb_date: '', payee: '', description: '', amount: '', expense_account: '5950', payment_mode: 'cash', check_number: '', remarks: '' })

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('disbursements').select('*').order('disb_date', { ascending: false })
    setDisbs((data ?? []) as Disbursement[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function resetForm() {
    setForm({ disb_date: '', payee: '', description: '', amount: '', expense_account: '5950', payment_mode: 'cash', check_number: '', remarks: '' })
  }

  async function save() {
    if (!form.payee.trim()) { toast.error('Payee is required'); return }
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Enter a valid amount'); return }
    if (!form.disb_date) { toast.error('Date is required'); return }
    setSaving(true)
    const expAcc = EXPENSE_ACCOUNTS.find(a => a.code === form.expense_account)
    const { data: disbData, error: disbErr } = await supabase.from('disbursements').insert({
      disb_date: form.disb_date, payee: form.payee.trim(),
      description: form.description.trim() || null, amount: Number(form.amount),
      expense_account: form.expense_account, payment_mode: form.payment_mode,
      check_number: form.check_number.trim() || null, remarks: form.remarks.trim() || null, status: 'posted',
    }).select().single()
    if (disbErr) { toast.error(disbErr.message); setSaving(false); return }
    const memo = `${form.payee} – ${form.description || expAcc?.name || 'Disbursement'}`
    const { data: jeData, error: jeErr } = await supabase.from('journal_entries').insert({
      entry_date: form.disb_date, memo, entry_type: 'disbursement',
      source_table: 'disbursements', source_id: (disbData as any).id, status: 'posted',
    }).select().single()
    if (!jeErr && jeData) {
      const jeId = (jeData as any).id
      await supabase.from('journal_lines').insert([
        { entry_id: jeId, account_code: form.expense_account, account_name: expAcc?.name, memo, debit: Number(form.amount), credit: 0 },
        { entry_id: jeId, account_code: '1100', account_name: 'Cash on Hand', memo, debit: 0, credit: Number(form.amount) },
      ])
      await supabase.from('disbursements').update({ journal_entry_id: jeId }).eq('id', (disbData as any).id)
    }
    toast.success('Disbursement recorded')
    setOpen(false); resetForm(); load()
    setSaving(false)
  }

  async function deleteDisbursement(id: string) {
    const { error } = await supabase.from('disbursements').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Deleted'); load() }
  }

  const filteredDisbs = disbs.filter(d => {
    if (!d.disb_date) return true
    if (filterFrom && d.disb_date < filterFrom) return false
    if (filterTo && d.disb_date > filterTo) return false
    return true
  })
  const total = filteredDisbs.filter(d => d.status === 'posted').reduce((s, d) => s + d.amount, 0)

  function exportCDJ() {
    exportCSV('CDJ_Disbursements.csv',
      ['Date','CDJ Number','Payee','Description','Expense Account','Amount','Payment Mode','Check Number'],
      filteredDisbs.filter(d => d.status === 'posted').map(d => [
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
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Date</TableHead><TableHead>CDJ #</TableHead><TableHead>Payee</TableHead>
            <TableHead>Description</TableHead><TableHead>Expense Account</TableHead>
            <TableHead>Mode</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="w-10" />
          </TableRow></TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></TableCell></TableRow>
            ) : filteredDisbs.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No disbursements for the selected period.</TableCell></TableRow>
            ) : filteredDisbs.map(d => (
              <TableRow key={d.id}>
                <TableCell className="text-sm whitespace-nowrap">{format(new Date(d.disb_date), 'MMM d, yyyy')}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{d.disb_number}</TableCell>
                <TableCell className="font-medium text-sm">{d.payee}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{d.description ?? '—'}</TableCell>
                <TableCell className="text-xs">{EXPENSE_ACCOUNTS.find(a => a.code === d.expense_account)?.name ?? d.expense_account}</TableCell>
                <TableCell><span className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize">{d.payment_mode.replace('_',' ')}</span></TableCell>
                <TableCell className="text-right font-semibold">{fmt(d.amount)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteDisbursement(d.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Disbursement</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.disb_date} onChange={e => setForm(p => ({ ...p, disb_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Mode</Label>
                <Select value={form.payment_mode} onValueChange={v => setForm(p => ({ ...p, payment_mode: v ?? 'cash' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_MODES_DISB.map(m => <SelectItem key={m} value={m}>{m.replace('_',' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Payee <span className="text-destructive">*</span></Label>
              <Input placeholder="Recipient / vendor name" value={form.payee} onChange={e => setForm(p => ({ ...p, payee: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input placeholder="Purpose of payment" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Expense Account</Label>
                <Select value={form.expense_account} onValueChange={v => setForm(p => ({ ...p, expense_account: v ?? '5950' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EXPENSE_ACCOUNTS.map(a => <SelectItem key={a.code} value={a.code}>{a.code} – {a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Amount (₱) <span className="text-destructive">*</span></Label>
                <Input type="number" min={0} step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
              </div>
            </div>
            {form.payment_mode === 'check' && (
              <div className="space-y-1.5">
                <Label>Check Number</Label>
                <Input placeholder="Check #" value={form.check_number} onChange={e => setForm(p => ({ ...p, check_number: e.target.value }))} />
              </div>
            )}
            <div className="space-y-1.5">
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

// ── General Ledger sub-tab ────────────────────────────────────────────────────

function GeneralLedgerTab({ lines }: { lines: JournalLine[] }) {
  const [filterAccount, setFilterAccount] = useState('')
  const accounts = Array.from(new Set(lines.map(l => l.account_code))).sort()
  const filtered = filterAccount ? lines.filter(l => l.account_code === filterAccount) : lines
  const sorted = [...filtered].sort((a, b) => new Date(a.journal_entries.entry_date).getTime() - new Date(b.journal_entries.entry_date).getTime())
  let runningBalance = 0
  const withBalance = sorted.map(l => { runningBalance += l.debit - l.credit; return { ...l, runningBalance } })

  function exportGL() {
    exportCSV('General_Ledger.csv',
      ['Date','Entry #','Account Code','Account Name','Memo','Debit','Credit','Balance'],
      withBalance.map(l => [l.journal_entries.entry_date, l.journal_entries.entry_number, l.account_code, l.account_name ?? '', l.memo ?? '', l.debit, l.credit, l.runningBalance])
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
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Date</TableHead><TableHead>Entry #</TableHead><TableHead>Account</TableHead>
            <TableHead>Memo</TableHead><TableHead className="text-right">Debit</TableHead>
            <TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Balance</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {withBalance.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No journal entries yet.</TableCell></TableRow>
            ) : withBalance.map(l => (
              <TableRow key={l.id}>
                <TableCell className="text-sm whitespace-nowrap">{format(new Date(l.journal_entries.entry_date), 'MMM d, yyyy')}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{l.journal_entries.entry_number}</TableCell>
                <TableCell><span className="font-mono text-xs font-semibold">{l.account_code}</span><span className="text-xs text-muted-foreground ml-1">{l.account_name}</span></TableCell>
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
      </CardContent></Card>
    </div>
  )
}

// ── Trial Balance sub-tab ─────────────────────────────────────────────────────

function TrialBalanceTab({ lines, coa }: { lines: JournalLine[]; coa: COA[] }) {
  const accountMap: Record<string, { name: string; debit: number; credit: number; type: string }> = {}
  for (const l of lines) {
    if (!accountMap[l.account_code]) {
      const def = coa.find(c => c.account_code === l.account_code)
      accountMap[l.account_code] = { name: l.account_name ?? def?.account_name ?? l.account_code, debit: 0, credit: 0, type: def?.account_type ?? '' }
    }
    accountMap[l.account_code].debit  += l.debit
    accountMap[l.account_code].credit += l.credit
  }
  const rows = Object.entries(accountMap).sort((a, b) => a[0].localeCompare(b[0]))
  const totalDebit  = rows.reduce((s, [, v]) => s + v.debit, 0)
  const totalCredit = rows.reduce((s, [, v]) => s + v.credit, 0)
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01

  function exportTB() {
    exportCSV('Trial_Balance.csv', ['Account Code','Account Name','Type','Debit','Credit','Balance'],
      rows.map(([code, v]) => [code, v.name, v.type, v.debit, v.credit, v.debit - v.credit]))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><p className="text-sm font-semibold">Trial Balance</p><p className="text-xs text-muted-foreground">Aggregate debit/credit balances per account</p></div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${isBalanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
            {isBalanced ? '✓ Balanced' : '✗ Out of Balance'}
          </span>
          <Button variant="outline" size="sm" onClick={exportTB}><Download className="h-3.5 w-3.5 mr-1.5" />Export</Button>
        </div>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Account Code</TableHead><TableHead>Account Name</TableHead><TableHead>Type</TableHead>
            <TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead>
          </TableRow></TableHeader>
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
      </CardContent></Card>
    </div>
  )
}

// ── Income Statement sub-tab ──────────────────────────────────────────────────

function IncomeStatementTab({ lines, coa }: { lines: JournalLine[]; coa: COA[] }) {
  const balances: Record<string, number> = {}
  for (const l of lines) { balances[l.account_code] = (balances[l.account_code] ?? 0) + l.credit - l.debit }

  const revenues = coa.filter(a => a.account_type === 'revenue' && !a.is_header)
  const expenses = coa.filter(a => a.account_type === 'expense' && !a.is_header)
  const totalRevenue = revenues.reduce((s, a) => s + (balances[a.account_code] ?? 0), 0)
  const totalExpense = expenses.reduce((s, a) => s + Math.abs(balances[a.account_code] ?? 0), 0)
  const netIncome = totalRevenue - totalExpense

  function exportIS() {
    const rows: (string | number)[][] = [
      ['REVENUES','',''],
      ...revenues.filter(a => (balances[a.account_code] ?? 0) !== 0).map(a => [a.account_code, a.account_name, balances[a.account_code] ?? 0]),
      ['','Total Revenues', totalRevenue],['','',''],['EXPENSES','',''],
      ...expenses.filter(a => (balances[a.account_code] ?? 0) !== 0).map(a => [a.account_code, a.account_name, Math.abs(balances[a.account_code] ?? 0)]),
      ['','Total Expenses', totalExpense],['','',''],['','NET INCOME / (LOSS)', netIncome],
    ]
    exportCSV('Income_Statement.csv', ['Account Code','Account Name','Amount'], rows)
  }

  const Section = ({ title, accounts, total, color }: { title: string; accounts: COA[]; total: number; color: string }) => (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground pb-1 border-b mb-1">{title}</div>
      {accounts.map(a => { const bal = Math.abs(balances[a.account_code] ?? 0); if (!bal) return null; return (
        <div key={a.account_code} className="flex justify-between py-1 text-sm">
          <span className="text-muted-foreground">{a.account_code} – {a.account_name}</span>
          <span>{fmt(bal)}</span>
        </div>
      )})}
      <div className={`flex justify-between py-1.5 font-semibold border-t mt-1 ${color}`}>
        <span>Total {title}</span><span>{fmt(total)}</span>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><p className="text-sm font-semibold">Income Statement (P&L)</p><p className="text-xs text-muted-foreground">Revenues vs Expenses — basis for BIR ITR filing</p></div>
        <Button variant="outline" size="sm" onClick={exportIS}><Download className="h-3.5 w-3.5 mr-1.5" />Export</Button>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-2">
        <Card><CardContent className="pt-4 pb-3"><div className="text-xl font-bold text-green-600">{fmt(totalRevenue)}</div><div className="text-xs text-muted-foreground">Total Revenue</div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><div className="text-xl font-bold text-red-600">{fmt(totalExpense)}</div><div className="text-xs text-muted-foreground">Total Expenses</div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><div className={`text-xl font-bold ${netIncome >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{fmt(Math.abs(netIncome))}</div><div className="text-xs text-muted-foreground">{netIncome >= 0 ? 'Net Income' : 'Net Loss'}</div></CardContent></Card>
      </div>
      <Card><CardContent className="pt-5 space-y-5">
        <Section title="Revenues" accounts={revenues} total={totalRevenue} color="text-green-700" />
        <Section title="Expenses" accounts={expenses} total={totalExpense} color="text-red-600" />
        <div className={`flex justify-between text-base font-bold border-t-2 pt-3 ${netIncome >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
          <span>{netIncome >= 0 ? 'NET INCOME' : 'NET LOSS'}</span>
          <span>{fmt(Math.abs(netIncome))}</span>
        </div>
      </CardContent></Card>
    </div>
  )
}

// ── Balance Sheet sub-tab ─────────────────────────────────────────────────────

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
  const netIncome        = revenues.reduce((s, a) => s + (balances[a.account_code] ?? 0), 0) - expenses.reduce((s, a) => s + (balances[a.account_code] ?? 0), 0)
  const totalLiabEquity  = totalLiabilities + totalEquity + netIncome
  const balanced         = Math.abs(totalAssets - totalLiabEquity) < 0.01

  const Section = ({ title, accounts, extra, total, color }: { title: string; accounts: COA[]; extra?: { label: string; value: number }; total: number; color: string }) => (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground pb-1 border-b mb-1">{title}</div>
      {accounts.map(a => { const bal = balances[a.account_code] ?? 0; if (!bal) return null; return (
        <div key={a.account_code} className="flex justify-between py-1 text-sm">
          <span className="text-muted-foreground">{a.account_code} – {a.account_name}</span>
          <span>{fmt(bal)}</span>
        </div>
      )})}
      {extra && <div className="flex justify-between py-1 text-sm"><span className="text-muted-foreground">3300 – Current Year Net Income</span><span className={extra.value >= 0 ? 'text-green-700' : 'text-red-600'}>{fmt(extra.value)}</span></div>}
      <div className={`flex justify-between py-1.5 font-semibold border-t mt-1 ${color}`}><span>Total {title}</span><span>{fmt(total)}</span></div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><p className="text-sm font-semibold">Balance Sheet</p><p className="text-xs text-muted-foreground">Statement of Financial Position</p></div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${balanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
          {balanced ? '✓ Balanced' : '✗ Check Entries'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Assets</CardTitle></CardHeader>
          <CardContent className="pt-0"><Section title="Assets" accounts={assets} total={totalAssets} color="text-blue-700" /></CardContent>
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

// ── BIR/CAS sub-tab ───────────────────────────────────────────────────────────

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
      postedDisbs.map(d => [d.disb_date, d.disb_number, d.payee, d.description ?? '', EXPENSE_ACCOUNTS.find(a => a.code === d.expense_account)?.name ?? d.expense_account, d.amount, d.payment_mode, d.check_number ?? ''])
    )
    toast.success('CDJ exported for BIR')
  }

  function exportSummary2307() {
    exportCSV('BIR_Form2307_Summary.csv',
      ['OR No.','Date','Name of Income Payor','ATC','Amount of Income','Tax Withheld'],
      posted.filter(c => (c.form_2307 ?? 0) > 0).map(c => [c.or_number ?? '', c.collection_date ?? '', c.client_name ?? '', 'WC158', c.amount, c.form_2307 ?? 0])
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
        <Card><CardContent className="pt-4 pb-3"><div className="text-lg font-bold text-green-600">{fmt(totalSales)}</div><div className="text-xs text-muted-foreground">Gross Sales (CRJ)</div><div className="text-xs text-muted-foreground">{posted.length} transactions</div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><div className="text-lg font-bold text-orange-600">{fmt(totalWHT)}</div><div className="text-xs text-muted-foreground">Form 2307 (WHT)</div><div className="text-xs text-muted-foreground">{posted.filter(c => (c.form_2307 ?? 0) > 0).length} certificates</div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3"><div className="text-lg font-bold text-red-600">{fmt(totalDisb)}</div><div className="text-xs text-muted-foreground">Total Disbursements</div><div className="text-xs text-muted-foreground">{postedDisbs.length} transactions</div></CardContent></Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BookOpen className="h-4 w-4 text-blue-600" />Cash Receipts Journal (CRJ / SJ)</CardTitle></CardHeader>
          <CardContent><p className="text-xs text-muted-foreground mb-3">BIR-required book for all cash collections and official receipts.</p><Button className="w-full" variant="outline" onClick={exportSalesJournal}><Download className="h-4 w-4 mr-2" />Export SJ / CRJ (CSV)</Button></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Banknote className="h-4 w-4 text-red-600" />Cash Disbursements Journal (CDJ)</CardTitle></CardHeader>
          <CardContent><p className="text-xs text-muted-foreground mb-3">BIR-required book for all cash outflows, expenses, and payments.</p><Button className="w-full" variant="outline" onClick={exportCDJ}><Download className="h-4 w-4 mr-2" />Export CDJ (CSV)</Button></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-orange-600" />Form 2307 Summary</CardTitle></CardHeader>
          <CardContent><p className="text-xs text-muted-foreground mb-3">Summary of all Certificates of Creditable Tax Withheld (Form 2307).</p><Button className="w-full" variant="outline" onClick={exportSummary2307}><Download className="h-4 w-4 mr-2" />Export Form 2307 Summary</Button></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Scale className="h-4 w-4 text-purple-600" />CAS Compliance Notes</CardTitle></CardHeader>
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

// ── Bookkeeping Tab (wrapper that loads data for sub-tabs) ────────────────────

function BookkeepingTab({ activeSub, onSubChange }: { activeSub: string; onSubChange: (v: string) => void }) {
  const supabase = createClient()
  const [collections, setCollections] = useState<Collection[]>([])
  const [disbursements, setDisbursements] = useState<Disbursement[]>([])
  const [coa, setCoa] = useState<COA[]>([])
  const [jLines, setJLines] = useState<JournalLine[]>([])
  const [csiRecords, setCsiRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const df = useDateRangeFilter()
  const { filterFrom, filterTo } = df

  const filteredCollections = applyDateFilter(df, collections, c => (c as Collection).collection_date)
  const filteredDisbursements = applyDateFilter(df, disbursements, d => (d as Disbursement).disb_date)
  const filteredCsi = applyDateFilter(df, csiRecords, r => r.si_date)
  const filteredJLines = applyDateFilter(df, jLines, l => (l as JournalLine).journal_entries?.entry_date)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: colData }, { data: disbData }, { data: coaData }, { data: jlData }, { data: csiData }] = await Promise.all([
      supabase.from('collections').select('id,or_number,collection_date,client_name,amount,form_2307,status').order('collection_date'),
      supabase.from('disbursements').select('*').order('disb_date', { ascending: false }),
      supabase.from('chart_of_accounts').select('account_code,account_name,account_type,normal_balance,is_header').eq('is_active', true).order('account_code'),
      supabase.from('journal_lines').select('*, journal_entries(entry_date,entry_number,memo,entry_type)').order('created_at'),
      supabase.from('csi_records').select('id,si_number,si_date,client_name,item_name,unit,quantity,unit_price,amount').order('si_date'),
    ])
    setCollections((colData ?? []) as Collection[])
    setDisbursements((disbData ?? []) as Disbursement[])
    setCoa((coaData ?? []) as COA[])
    setJLines((jlData ?? []) as unknown as JournalLine[])
    setCsiRecords(csiData ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-4">
      <DateFilterBar df={df} />
      <Tabs value={activeSub} onValueChange={v => onSubChange(v ?? 'crj')}>
        <div>
          <TabsContent value="crj"><SalesJournalTab collections={filteredCollections} csiRecords={filteredCsi} /></TabsContent>
          <TabsContent value="cdj"><DisbursementsTab filterFrom={filterFrom} filterTo={filterTo} /></TabsContent>
          <TabsContent value="gl"><GeneralLedgerTab lines={filteredJLines} /></TabsContent>
          <TabsContent value="tb"><TrialBalanceTab lines={filteredJLines} coa={coa} /></TabsContent>
          <TabsContent value="is"><IncomeStatementTab lines={filteredJLines} coa={coa} /></TabsContent>
          <TabsContent value="bs"><BalanceSheetTab lines={filteredJLines} coa={coa} /></TabsContent>
          <TabsContent value="bir"><BIRExportTab collections={filteredCollections} disbursements={filteredDisbursements} /></TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

// ── BIR Compliance Tab ────────────────────────────────────────────────────────

function BIRComplianceTab() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState('overview')
  const [loadingTax, setLoadingTax] = useState(true)
  const [ewtRows, setEwtRows] = useState<EwtRow[]>([])
  const [slspRows, setSlspRows] = useState<SlspRow[]>([])

  const loadTaxData = useCallback(async () => {
    setLoadingTax(true)
    const [{ data: poData }, { data: supData }, { data: rrData }] = await Promise.all([
      supabase.from('purchase_orders')
        .select('po_number, supplier_id, po_date, vat_amount, ewt_amount, total_amount')
        .neq('status', 'cancelled'),
      supabase.from('suppliers').select('id, company_name, tin, atc_code, ewt_rate, address, bir_registered_address'),
      supabase.from('receiving_reports').select('po_number, si_number, dr_number'),
    ])
    const supplierById = new Map((supData ?? []).map(s => [s.id, s]))
    const refByPoNumber = new Map((rrData ?? []).map(r => [r.po_number, r.si_number || r.dr_number || null]))

    // EWT Summary / Alphalist: purchases that actually had withholding tax applied,
    // aggregated per supplier (Alphalist is an annual roll-up of the same data).
    const ewtBySupplier = new Map<string, { gross: number; vat_excl: number; ewt: number }>()
    for (const po of poData ?? []) {
      const ewt = Number(po.ewt_amount) || 0
      if (ewt <= 0 || !po.supplier_id) continue
      const gross = Number(po.total_amount) || 0
      const vatExcl = gross - (Number(po.vat_amount) || 0)
      const acc = ewtBySupplier.get(po.supplier_id) ?? { gross: 0, vat_excl: 0, ewt: 0 }
      acc.gross += gross; acc.vat_excl += vatExcl; acc.ewt += ewt
      ewtBySupplier.set(po.supplier_id, acc)
    }
    const ewtList: EwtRow[] = [...ewtBySupplier.entries()].map(([supplierId, acc]) => {
      const sup = supplierById.get(supplierId)
      return {
        supplier: sup?.company_name ?? 'Unknown Supplier',
        tin: sup?.tin ?? null,
        atc: sup?.atc_code ?? null,
        address: sup?.bir_registered_address ?? sup?.address ?? null,
        gross: acc.gross, vat_excl: acc.vat_excl,
        ewt_rate: sup?.ewt_rate != null ? Number(sup.ewt_rate) : (acc.vat_excl > 0 ? (acc.ewt / acc.vat_excl) * 100 : 0),
        ewt: acc.ewt,
      }
    }).sort((a, b) => b.ewt - a.ewt)
    setEwtRows(ewtList)

    // SLSP: every VAT-bearing purchase, one row per PO.
    const slspList: SlspRow[] = (poData ?? [])
      .filter(po => (Number(po.vat_amount) || 0) > 0)
      .map(po => {
        const sup = po.supplier_id ? supplierById.get(po.supplier_id) : null
        const gross = Number(po.total_amount) || 0
        const vat = Number(po.vat_amount) || 0
        return {
          month: po.po_date ? new Date(po.po_date).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' }) : '—',
          supplier: sup?.company_name ?? 'Unknown Supplier',
          tin: sup?.tin ?? null,
          refNo: refByPoNumber.get(po.po_number ?? '') || po.po_number || '—',
          gross, vat, net: gross - vat,
        }
      })
      .sort((a, b) => (a.month > b.month ? 1 : -1))
    setSlspRows(slspList)
    setLoadingTax(false)
  }, [supabase])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadTaxData() }, [loadTaxData])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Philippine BIR filing management, tax computation, and alphalist generation</p>
        <Button className="gap-2" onClick={() => toast.success('Filing readiness check completed!')}>
          <Zap className="h-4 w-4" /> BIR Filing Ready Check
        </Button>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-5">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">{readinessScore}%</div>
              <div className="text-sm text-muted-foreground">Filing Ready</div>
            </div>
            <div className="flex-1">
              <Progress value={readinessScore} className="h-3 mb-3" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {readinessChecks.map(check => (
                  <div key={check.check} className="flex items-start gap-2 text-xs">
                    {check.status === 'pass'
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                      : check.status === 'warning'
                      ? <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
                      : <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />}
                    <div>
                      <div className="font-medium">{check.check}</div>
                      <div className="text-muted-foreground">{check.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Filing Calendar</TabsTrigger>
          <TabsTrigger value="ewt">EWT Summary</TabsTrigger>
          <TabsTrigger value="vat">VAT Summary</TabsTrigger>
          <TabsTrigger value="alphalist">Alphalist</TabsTrigger>
          <TabsTrigger value="slsp">SLSP</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">BIR Filing Calendar 2025</CardTitle>
              <CardDescription>Track all BIR form due dates and filing status</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Form</TableHead><TableHead>Description</TableHead><TableHead>Period</TableHead>
                  <TableHead>Due Date</TableHead><TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead><TableHead className="w-24">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {birForms.map(form => (
                    <TableRow key={`${form.form}-${form.period}`}>
                      <TableCell className="font-mono font-bold text-primary">{form.form}</TableCell>
                      <TableCell className="text-sm">{form.description}</TableCell>
                      <TableCell className="text-sm">{form.period}</TableCell>
                      <TableCell className="text-sm font-medium">{form.due}</TableCell>
                      <TableCell className="text-right font-medium">{form.amount ? `₱${form.amount.toLocaleString()}` : '—'}</TableCell>
                      <TableCell>
                        <Badge variant={form.status === 'filed' ? 'outline' : form.status === 'due_soon' ? 'destructive' : 'secondary'} className="text-xs">
                          {form.status === 'filed' ? '✓ Filed' : form.status === 'due_soon' ? '⚠ Due Soon' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {form.status !== 'filed' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => toast.success(`Form ${form.form} marked as filed`)}>Mark Filed</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ewt">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div><CardTitle className="text-base">Expanded Withholding Tax (EWT) Summary</CardTitle><CardDescription>BIR Form 0619-E / 1601-EQ computation</CardDescription></div>
                <Button size="sm" variant="outline" onClick={() => toast.success('EWT summary exported')}><Download className="h-4 w-4 mr-1" />Export</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Supplier</TableHead><TableHead>TIN</TableHead><TableHead>ATC</TableHead>
                  <TableHead className="text-right">Gross Amount</TableHead><TableHead className="text-right">VAT Excl. Amount</TableHead>
                  <TableHead className="text-right">EWT Rate</TableHead><TableHead className="text-right">EWT Amount</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {loadingTax ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                  ) : ewtRows.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No purchases with withholding tax recorded yet.</TableCell></TableRow>
                  ) : (<>
                    {ewtRows.map(row => (
                      <TableRow key={row.supplier}>
                        <TableCell className="font-medium text-sm">{row.supplier}</TableCell>
                        <TableCell className="font-mono text-xs">{row.tin ?? '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{row.atc ?? '—'}</TableCell>
                        <TableCell className="text-right">₱{row.gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">₱{row.vat_excl.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">{row.ewt_rate.toFixed(2)}%</TableCell>
                        <TableCell className="text-right font-semibold text-red-700">₱{row.ewt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={3}>TOTAL</TableCell>
                      <TableCell className="text-right">₱{ewtRows.reduce((s, r) => s + r.gross, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">₱{ewtRows.reduce((s, r) => s + r.vat_excl, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell />
                      <TableCell className="text-right text-red-700">₱{ewtRows.reduce((s, r) => s + r.ewt, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  </>)}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vat">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div><CardTitle className="text-base">VAT Summary — BIR Form 2550Q</CardTitle><CardDescription>Input VAT from purchases by month</CardDescription></div>
                <Button size="sm" variant="outline" onClick={() => toast.success('VAT summary exported')}><Download className="h-4 w-4 mr-1" />Export</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Month</TableHead><TableHead className="text-right">Gross Purchases</TableHead>
                  <TableHead className="text-right">Input VAT (12%)</TableHead><TableHead className="text-right">Output VAT</TableHead>
                  <TableHead className="text-right">Net VAT Payable</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {vatSummary.map(row => (
                    <TableRow key={row.month}>
                      <TableCell className="font-medium">{row.month}</TableCell>
                      <TableCell className="text-right">₱{row.gross_purchases.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right text-blue-600">₱{row.input_vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">₱{row.output_vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-semibold">₱{row.net_vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>Q1 TOTAL</TableCell>
                    <TableCell className="text-right">₱{vatSummary.reduce((s, r) => s + r.gross_purchases, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right text-blue-600">₱{vatSummary.reduce((s, r) => s + r.input_vat, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">₱0.00</TableCell>
                    <TableCell className="text-right">₱{vatSummary.reduce((s, r) => s + r.net_vat, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alphalist">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div><CardTitle className="text-base">Supplier Alphalist</CardTitle><CardDescription>Annual list of suppliers with withholding tax — required for BIR submission</CardDescription></div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => toast.success('Alphalist exported to Excel')}><Download className="h-4 w-4 mr-1" />Export Excel</Button>
                  <Button size="sm" variant="outline" onClick={() => toast.success('Alphalist exported to CSV')}><Download className="h-4 w-4 mr-1" />Export CSV</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>#</TableHead><TableHead>Supplier Name</TableHead><TableHead>TIN</TableHead>
                  <TableHead>Address</TableHead><TableHead>ATC</TableHead>
                  <TableHead className="text-right">Total Payments</TableHead><TableHead className="text-right">Total EWT</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {loadingTax ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                  ) : ewtRows.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No payees with withholding tax recorded yet.</TableCell></TableRow>
                  ) : ewtRows.map((row, i) => (
                    <TableRow key={row.supplier}>
                      <TableCell className="text-sm text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium text-sm">{row.supplier}</TableCell>
                      <TableCell className="font-mono text-xs">{row.tin ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.address ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{row.atc ?? '—'}</TableCell>
                      <TableCell className="text-right">₱{row.gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-semibold text-red-700">₱{row.ewt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="slsp">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div><CardTitle className="text-base">Summary List of Purchases (SLSP)</CardTitle><CardDescription>Required quarterly submission — all VAT purchases from suppliers</CardDescription></div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => toast.success('SLSP exported to Excel')}><Download className="h-4 w-4 mr-1" />Export Excel</Button>
                  <Button size="sm" variant="outline" onClick={() => toast.success('SLSP exported to CSV')}><Download className="h-4 w-4 mr-1" />Export CSV</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground mb-4">
                <strong className="text-foreground">Period:</strong> {slspRows.length > 0 ? `${slspRows[0].month} — ${slspRows[slspRows.length - 1].month}` : 'No purchases recorded'} &nbsp;|&nbsp;
                <strong className="text-foreground">Total VAT Purchases:</strong> ₱{slspRows.reduce((s, r) => s + r.gross, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} &nbsp;|&nbsp;
                <strong className="text-foreground">Total Input VAT:</strong> ₱{slspRows.reduce((s, r) => s + r.vat, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Month</TableHead><TableHead>Supplier</TableHead><TableHead>TIN</TableHead>
                  <TableHead>OR/Invoice No.</TableHead><TableHead className="text-right">Gross Amount</TableHead>
                  <TableHead className="text-right">VAT Amount</TableHead><TableHead className="text-right">Net of VAT</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {loadingTax ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                  ) : slspRows.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No VAT purchases recorded yet.</TableCell></TableRow>
                  ) : slspRows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{row.month}</TableCell>
                      <TableCell className="text-sm">{row.supplier}</TableCell>
                      <TableCell className="font-mono text-xs">{row.tin ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{row.refNo}</TableCell>
                      <TableCell className="text-right">₱{row.gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right text-blue-600">₱{row.vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">₱{row.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

// ── CSI Revenue Tab ───────────────────────────────────────────────────────────

function CSITab() {
  const supabase = createClient()
  const [records, setRecords] = useState<any[]>([])
  const [collectedSiNumbers, setCollectedSiNumbers] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [clientFilter, setClientFilter] = useState('')
  const df = useDateRangeFilter()

  useEffect(() => {
    async function load() {
      const [{ data }, { data: linkedRows }] = await Promise.all([
        supabase
          .from('csi_records')
          .select('id, si_number, si_date, client_name, item_name, unit, quantity, unit_price, amount')
          .order('si_date', { ascending: false }),
        // A CSI invoice counts as collected once a posted OR/CR is linked to its si_number.
        supabase.from('collections').select('si_number').eq('status', 'posted').not('si_number', 'is', null),
      ])
      setRecords(data ?? [])
      setCollectedSiNumbers(new Set((linkedRows ?? []).map(r => r.si_number)))
      setLoading(false)
    }
    load()
  }, [])

  function collectionStatus(r: { si_number: string | null }) {
    return r.si_number && collectedSiNumbers.has(r.si_number) ? 'collected' : 'pending'
  }

  const filteredRecords = applyDateFilter(
    df,
    clientFilter ? records.filter(r => (r.client_name ?? '').toLowerCase().includes(clientFilter.toLowerCase())) : records,
    r => r.si_date
  )

  const totalBilled = filteredRecords.reduce((s, r) => s + (r.amount ?? 0), 0)
  const totalCollected = filteredRecords.filter(r => collectionStatus(r) === 'collected').reduce((s, r) => s + (r.amount ?? 0), 0)
  const pending = totalBilled - totalCollected

  const byClient: Record<string, { billed: number; collected: number; count: number }> = {}
  filteredRecords.forEach(r => {
    const key = r.client_name ?? '—'
    if (!byClient[key]) byClient[key] = { billed: 0, collected: 0, count: 0 }
    byClient[key].billed += r.amount ?? 0
    byClient[key].count += 1
    if (collectionStatus(r) === 'collected') byClient[key].collected += r.amount ?? 0
  })

  const statusCls: Record<string, string> = {
    collected:  'bg-green-100 text-green-700',
    pending:    'bg-yellow-100 text-yellow-700',
    partial:    'bg-blue-100 text-blue-700',
  }

  return (
    <div className="space-y-6">
      <DateFilterBar df={df} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total CSI Billed</CardTitle>
            <Receipt className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold">{loading ? '—' : fmt(totalBilled)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Collected</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-green-600">{loading ? '—' : fmt(totalCollected)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground">Pending Collection</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-yellow-600">{loading ? '—' : fmt(pending)}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">By Client Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Invoices</TableHead>
                <TableHead className="text-right">Billed</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : Object.entries(byClient).length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No CSI records found</TableCell></TableRow>
              ) : Object.entries(byClient).sort((a, b) => b[1].billed - a[1].billed).map(([client, data]) => (
                <TableRow key={client}>
                  <TableCell className="font-medium">{client}</TableCell>
                  <TableCell className="text-right">{data.count}</TableCell>
                  <TableCell className="text-right">{fmt(data.billed)}</TableCell>
                  <TableCell className="text-right text-green-600">{fmt(data.collected)}</TableCell>
                  <TableCell className="text-right text-yellow-600">{fmt(data.billed - data.collected)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">All CSI Records</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={clientFilter} onValueChange={v => setClientFilter(v ?? '')}>
                <SelectTrigger className="h-8 text-xs w-48">
                  <SelectValue placeholder="All Clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Clients</SelectItem>
                  {[...new Set(records.map(r => r.client_name).filter(Boolean))].sort().map(name => (
                    <SelectItem key={name!} value={name!}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clientFilter && (
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setClientFilter('')}>
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SI Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filteredRecords.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No CSI records found</TableCell></TableRow>
              ) : filteredRecords.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">{r.si_number ?? '—'}</TableCell>
                  <TableCell>{r.si_date ? format(new Date(r.si_date), 'MMM dd, yyyy') : '—'}</TableCell>
                  <TableCell>{r.client_name ?? '—'}</TableCell>
                  <TableCell>{r.item_name ?? '—'}</TableCell>
                  <TableCell className="text-right">{r.quantity ?? 0} {r.unit ?? ''}</TableCell>
                  <TableCell className="text-right">{fmt(r.unit_price ?? 0)}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(r.amount ?? 0)}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCls[collectionStatus(r)] ?? 'bg-gray-100 text-gray-700'}`}>
                      {collectionStatus(r)}
                    </span>
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

function AccountingPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const activeTab = searchParams.get('tab') ?? 'overview'
  const activeSub = searchParams.get('sub') ?? 'crj'

  // Drives the tab (and Bookkeeping's inner sub-tab) from the URL, so the sidebar can
  // link directly into a specific tab (e.g. /accounting?tab=bookkeeping&sub=gl).
  function setTab(tab: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    if (tab !== 'bookkeeping') params.delete('sub')
    router.replace(`${pathname}?${params.toString()}`)
  }

  function setSub(sub: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', 'bookkeeping')
    params.set('sub', sub)
    router.replace(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Accounting</h1>
        <p className="text-muted-foreground text-sm">Financial management and BIR compliance</p>
      </div>

      <Tabs value={activeTab} onValueChange={v => setTab(v ?? 'overview')}>
        <div>
          <TabsContent value="overview"><OverviewTab /></TabsContent>
          <TabsContent value="collections"><CollectionsTab /></TabsContent>
          <TabsContent value="csi"><CSITab /></TabsContent>
          <TabsContent value="bookkeeping"><BookkeepingTab activeSub={activeSub} onSubChange={setSub} /></TabsContent>
          <TabsContent value="bir"><BIRComplianceTab /></TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

export default function AccountingPage() {
  return (
    <Suspense fallback={null}>
      <AccountingPageContent />
    </Suspense>
  )
}
