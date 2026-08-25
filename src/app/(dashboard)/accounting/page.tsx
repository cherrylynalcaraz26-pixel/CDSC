'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PaginationBar } from '@/components/ui/pagination-bar'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus, Download, Loader2, BookOpen, Banknote, TrendingUp,
  Scale, FileSpreadsheet, Trash2, Calculator, Receipt, FileText, DollarSign,
  MoreHorizontal, Printer, Eye, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronRight, SlidersHorizontal, Pencil, Link2, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import BIRPage from '../bir/page'

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
  po_number?: string | null
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
const fmtNoPeso = (n: number) => n.toLocaleString('en-PH', { minimumFractionDigits: 2 })
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Keeps the OR's "In Payment For" line readable when many invoices are selected —
// e.g. "SI No. 1111, 2222, 3333, 4444, 5555, and etc." instead of a huge list.
function formatSiList(siNumbers: string[]): string {
  return siNumbers.length > 5 ? `${siNumbers.slice(0, 5).join(', ')}, and etc.` : siNumbers.join(', ')
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function integerToWords(n: number): string {
  if (n === 0) return ''
  if (n < 20) return ONES[n]
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' + integerToWords(n % 100) : ''}`
  if (n < 1_000_000) return `${integerToWords(Math.floor(n / 1000))} Thousand${n % 1000 ? ' ' + integerToWords(n % 1000) : ''}`
  if (n < 1_000_000_000) return `${integerToWords(Math.floor(n / 1_000_000))} Million${n % 1_000_000 ? ' ' + integerToWords(n % 1_000_000) : ''}`
  return `${integerToWords(Math.floor(n / 1_000_000_000))} Billion${n % 1_000_000_000 ? ' ' + integerToWords(n % 1_000_000_000) : ''}`
}

// Spells out a peso amount the way it's written on a PH Official Receipt, e.g.
// 1500.50 → "One Thousand Five Hundred Pesos and 50/100 Only".
function amountToWords(amount: number): string {
  const pesos = Math.floor(Math.abs(amount))
  const centavos = Math.round((Math.abs(amount) - pesos) * 100)
  const pesosWords = pesos === 0 ? 'Zero' : integerToWords(pesos)
  const centavosPart = centavos > 0 ? ` and ${String(centavos).padStart(2, '0')}/100` : ''
  return `${pesosWords} Pesos${centavosPart} Only`
}

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

type CWTType = 'none' | 'goods' | 'services'
const CWT_CFG: Record<CWTType, { label: string; rate: number; atc: string }> = {
  none:     { label: 'None',          rate: 0,    atc: '' },
  goods:    { label: 'Goods (1%)',    rate: 0.01, atc: 'WC158' },
  services: { label: 'Services (2%)', rate: 0.02, atc: 'WC157' },
}

// Strips a leading "OR-" (any case) so OR numbers stay in the plain numeric
// format used on the physical Collection Receipt (e.g. "00031", not "OR-00031").
function normalizeOrNumber(v: string): string {
  return v.trim().replace(/^OR-\s*/i, '')
}

const STATUS_CLS: Record<string, string> = {
  posted:    'bg-green-100 text-green-700',
  voided:    'bg-red-100 text-red-700',
  pending:   'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-gray-100 text-gray-600',
  missing:   'bg-orange-100 text-orange-700',
}

// Suggests the next OR number by incrementing the highest existing numeric OR
// number, zero-padded to match its width (defaults to 5 digits, e.g. "00001").
function computeNextOrNumber(records: { or_number: string | null }[]): string {
  let maxNum = 0
  let width = 5
  for (const r of records) {
    const n = r.or_number
    if (!n || !/^\d+$/.test(n)) continue
    const val = parseInt(n, 10)
    if (val > maxNum) { maxNum = val; width = n.length }
  }
  return String(maxNum + 1).padStart(width, '0')
}

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
        .select('po_number, supplier:suppliers(company_name), total_amount, vat_amount, ewt_amount, net_payable, status, created_at')
        .order('created_at', { ascending: false })
        .limit(10)
      setRecentPOs(recent ?? [])
      setLoading(false)
    }
    load()
  }, [df.filterFrom, df.filterTo])

  const cards = [
    { title: 'PO Amount', value: fmt(summary.totalPO), icon: FileText, grad: 'from-blue-500 to-blue-600', tint: 'from-blue-50', shadow: 'shadow-blue-500/30' },
    { title: 'Total Received', value: fmt(summary.totalReceived), icon: TrendingUp, grad: 'from-green-500 to-green-600', tint: 'from-green-50', shadow: 'shadow-green-500/30' },
    { title: 'Pending Payables', value: fmt(summary.pendingPayables), icon: DollarSign, grad: 'from-red-500 to-red-600', tint: 'from-red-50', shadow: 'shadow-red-500/30' },
    { title: 'EWT Withheld', value: fmt(summary.totalEWT), icon: Receipt, grad: 'from-purple-500 to-purple-600', tint: 'from-purple-50', shadow: 'shadow-purple-500/30' },
    { title: 'Input VAT', value: fmt(summary.totalVAT), icon: Calculator, grad: 'from-amber-500 to-amber-600', tint: 'from-amber-50', shadow: 'shadow-amber-500/30' },
  ]

  return (
    <div className="space-y-6">
      <DateFilterBar df={df} />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {cards.map(card => (
          <Card key={card.title} className="relative overflow-hidden border-none">
            <div className={`absolute inset-0 bg-gradient-to-br ${card.tint} to-transparent`} />
            <CardContent className="relative pt-4 pb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-xl font-bold">{loading ? '—' : card.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{card.title}</div>
              </div>
              <div className={`h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br ${card.grad} flex items-center justify-center shadow-sm ${card.shadow}`}>
                <card.icon className="h-5 w-5 text-white" />
              </div>
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
                <TableHead className="w-10">No.</TableHead>
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
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : recentPOs.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No purchase orders yet</TableCell></TableRow>
              ) : recentPOs.map((po: any, i: number) => {
                const gross = po.total_amount ?? 0
                const vat = po.vat_amount ?? 0
                const ewt = po.ewt_amount ?? 0
                const net = po.net_payable ?? 0
                return (
                  <TableRow key={po.id ?? i} className="hover:bg-red-50/40 transition-colors">
                    <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                    <TableCell className="font-mono text-sm">{po.po_number}</TableCell>
                    <TableCell>{po.supplier?.company_name ?? '—'}</TableCell>
                    <TableCell className="text-right">{fmt(gross)}</TableCell>
                    <TableCell className="text-right text-blue-600">{fmt(vat)}</TableCell>
                    <TableCell className="text-right text-red-600">({fmt(ewt)})</TableCell>
                    <TableCell className="text-right font-medium">{fmt(net)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs capitalize">{po.status}</Badge>
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

// Official Receipts are pre-printed, BIR-registered booklets — printing has to overlay
// data at exact coordinates on the physical form rather than render a whole new design,
// same as DR Logs' "Print (Blank Form)" feature.
interface OrBlankCalib {
  pageWidthMm: number
  pageHeightMm: number
  fontSizePt: number
  dateTop: number; dateLeft: number
  receivedFromTop: number; receivedFromLeft: number
  tinTop: number; tinLeft: number
  addressTop: number; addressLeft: number
  businessStyleTop: number; businessStyleLeft: number
  amountWordsTop: number; amountWordsLeft: number
  amountTop: number; amountLeft: number
  paymentForTop: number; paymentForLeft: number
  // "In settlement of the following" invoice table, top-left of the form
  invoiceTableTop: number
  invoiceRowHeight: number
  invoiceNoLeft: number
  invoiceAmountLeft: number
  invoiceMaxRows: number
  totalSalesTop: number; totalSalesLeft: number
}

const DEFAULT_OR_BLANK_CALIB: OrBlankCalib = {
  pageWidthMm: 210,
  pageHeightMm: 99,
  fontSizePt: 9,
  invoiceTableTop: 12,
  invoiceRowHeight: 5,
  invoiceNoLeft: 8,
  invoiceAmountLeft: 30,
  invoiceMaxRows: 10,
  totalSalesTop: 62, totalSalesLeft: 30,
  dateTop: 12, dateLeft: 160,
  receivedFromTop: 20, receivedFromLeft: 65,
  tinTop: 26, tinLeft: 60,
  addressTop: 26, addressLeft: 100,
  businessStyleTop: 32, businessStyleLeft: 75,
  amountWordsTop: 38, amountWordsLeft: 55,
  amountTop: 44, amountLeft: 160,
  paymentForTop: 50, paymentForLeft: 65,
}

const OR_BLANK_CALIB_KEY = 'cdsc_or_blank_form_calib'

function loadOrBlankCalib(): OrBlankCalib {
  if (typeof window === 'undefined') return DEFAULT_OR_BLANK_CALIB
  try {
    const raw = window.localStorage.getItem(OR_BLANK_CALIB_KEY)
    if (!raw) return DEFAULT_OR_BLANK_CALIB
    return { ...DEFAULT_OR_BLANK_CALIB, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_OR_BLANK_CALIB
  }
}

function OrCalibField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" step="0.5" value={value} onChange={e => onChange(Number(e.target.value) || 0)} className="h-8 text-sm" />
    </div>
  )
}

function OrCalibPair({ label, top, left, onChange }: { label: string; top: number; left: number; onChange: (top: number, left: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" step="0.5" value={top} placeholder="Top" onChange={e => onChange(Number(e.target.value) || 0, left)} className="h-8 text-sm" />
        <Input type="number" step="0.5" value={left} placeholder="Left" onChange={e => onChange(top, Number(e.target.value) || 0)} className="h-8 text-sm" />
      </div>
    </div>
  )
}

interface OrBlankPreviewData {
  date: string
  receivedFrom: string
  tin: string | null
  address: string | null
  businessStyle: string | null
  paymentFor: string | null
  invoices: { si_number: string; amount: number }[]
}

// Scaled-down mirror of the calibrated print layout, so miscalibrated fields are obvious
// before committing ink to a physical pre-printed form.
function OrBlankPreviewField({ calib, top, left, value }: { calib: OrBlankCalib; top: number; left: number; value: string }) {
  if (!value) return null
  const pctW = (mm: number) => `${(mm / calib.pageWidthMm) * 100}%`
  const pctH = (mm: number) => `${(mm / calib.pageHeightMm) * 100}%`
  return (
    <div className="absolute whitespace-nowrap text-[7px] leading-none text-black" style={{ top: pctH(top), left: pctW(left) }}>
      {value}
    </div>
  )
}

function OrBlankPreview({ calib, data }: { calib: OrBlankCalib; data: OrBlankPreviewData }) {
  const total = data.invoices.reduce((s, i) => s + i.amount, 0)
  return (
    <div
      className="relative w-full border rounded bg-white shadow-sm overflow-hidden"
      style={{ aspectRatio: `${calib.pageWidthMm} / ${calib.pageHeightMm}` }}
    >
      {data.invoices.slice(0, calib.invoiceMaxRows).map((inv, i) => (
        <OrBlankPreviewField key={`no-${inv.si_number}`} calib={calib} top={calib.invoiceTableTop + i * calib.invoiceRowHeight} left={calib.invoiceNoLeft} value={inv.si_number} />
      ))}
      {data.invoices.slice(0, calib.invoiceMaxRows).map((inv, i) => (
        <OrBlankPreviewField key={`amt-${inv.si_number}`} calib={calib} top={calib.invoiceTableTop + i * calib.invoiceRowHeight} left={calib.invoiceAmountLeft} value={fmtNoPeso(inv.amount)} />
      ))}
      <OrBlankPreviewField calib={calib} top={calib.totalSalesTop} left={calib.totalSalesLeft} value={total > 0 ? fmtNoPeso(total) : ''} />
      <OrBlankPreviewField calib={calib} top={calib.dateTop} left={calib.dateLeft} value={data.date ? format(new Date(data.date), 'MM/dd/yyyy') : ''} />
      <OrBlankPreviewField calib={calib} top={calib.receivedFromTop} left={calib.receivedFromLeft} value={data.receivedFrom} />
      <OrBlankPreviewField calib={calib} top={calib.tinTop} left={calib.tinLeft} value={data.tin ?? ''} />
      <OrBlankPreviewField calib={calib} top={calib.addressTop} left={calib.addressLeft} value={data.address ?? ''} />
      <OrBlankPreviewField calib={calib} top={calib.businessStyleTop} left={calib.businessStyleLeft} value={data.businessStyle ?? ''} />
      <OrBlankPreviewField calib={calib} top={calib.amountWordsTop} left={calib.amountWordsLeft} value={total > 0 ? amountToWords(total) : ''} />
      <OrBlankPreviewField calib={calib} top={calib.amountTop} left={calib.amountLeft} value={total > 0 ? fmtNoPeso(total) : ''} />
      <OrBlankPreviewField calib={calib} top={calib.paymentForTop} left={calib.paymentForLeft} value={data.paymentFor ?? ''} />
    </div>
  )
}

function CollectionsTab() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [records, setRecords] = useState<Collection[]>([])
  const [clients, setClients] = useState<{ id: string; company_name: string; tin: string | null; address: string | null; city: string | null; province: string | null; industry: string | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [clientFilter, setClientFilter] = useState(() => searchParams.get('client') ?? '')
  const [page, setPage] = useState(1)
  const df = useDateRangeFilter()
  const [orBlankCalib, setOrBlankCalib] = useState<OrBlankCalib>(() => loadOrBlankCalib())
  const [orCalibOpen, setOrCalibOpen] = useState(false)
  const [orCalibDraft, setOrCalibDraft] = useState<OrBlankCalib>(DEFAULT_OR_BLANK_CALIB)
  const [form, setForm] = useState({
    or_number: '', client_id: '', client_name: '', amount: '', si_number: '',
    payment_mode: 'Cash', reference_number: '', collection_date: '', remarks: '',
    cwt_type: 'none' as CWTType,
  })
  const [clientSearch, setClientSearch] = useState('')
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false)
  const [csiOptions, setCsiOptions] = useState<{ si_number: string; si_date: string; total: number }[]>([])
  const [selectedCsis, setSelectedCsis] = useState<Set<string>>(new Set())
  const [orStatus, setOrStatus] = useState<'normal' | 'cancelled' | 'missing'>('normal')
  const [csiLinksByCollection, setCsiLinksByCollection] = useState<Record<string, string[]>>({})
  const [linkCsiFor, setLinkCsiFor] = useState<Collection | null>(null)
  const [linkCsiOptions, setLinkCsiOptions] = useState<{ si_number: string; si_date: string; total: number }[]>([])
  const [linkCsiSelected, setLinkCsiSelected] = useState<Set<string>>(new Set())
  const [linkingCsi, setLinkingCsi] = useState(false)
  const [readyToCollect, setReadyToCollect] = useState<{ so_number: string; client_name: string; csi_total: number; collected_total: number; outstanding: number; si_numbers: string[] }[]>([])
  const [expandedRTC, setExpandedRTC] = useState<string | null>(null)
  const [companyInfo, setCompanyInfo] = useState<{ company_name: string | null; address: string | null; phone: string | null; tin: string | null } | null>(null)
  const [viewRecord, setViewRecord] = useState<Collection | null>(null)
  const [blankFormOpen, setBlankFormOpen] = useState(false)
  const [blankFormClientId, setBlankFormClientId] = useState('')
  const [blankFormInvoices, setBlankFormInvoices] = useState<{ si_number: string; si_date: string; total: number }[]>([])
  const [blankFormSelectedSis, setBlankFormSelectedSis] = useState<Set<string>>(new Set())
  const [blankFormDate, setBlankFormDate] = useState('')

  async function load() {
    setLoading(true)
    const [{ data: colData }, { data: cliData }, { data: drRows }, { data: csiRows }] = await Promise.all([
      supabase.from('collections').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, company_name, tin, address, city, province, industry').eq('status', 'active').order('company_name'),
      supabase.from('dr_logs').select('po_number, status').not('po_number', 'is', null).in('status', ['received', 'partial']),
      fetchAllRows((from, to) => supabase.from('csi_records').select('po_number, si_number, amount, client_name').not('po_number', 'is', null).order('id').range(from, to)).then(data => ({ data })),
    ])
    setRecords((colData ?? []) as Collection[])
    setClients(cliData ?? [])
    const { data: sysData } = await supabase.from('system_settings').select('company_name, address, phone, tin').single()
    if (sysData) setCompanyInfo(sysData)

    const { data: linkRows } = await supabase.from('collection_csi_links').select('collection_id, si_number')
    const linksMap: Record<string, string[]> = {}
    for (const l of (linkRows ?? []) as { collection_id: string; si_number: string }[]) {
      if (!linksMap[l.collection_id]) linksMap[l.collection_id] = []
      linksMap[l.collection_id].push(l.si_number)
    }
    setCsiLinksByCollection(linksMap)

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
    // A collection can now be linked to several CSI invoices at once (collection_csi_links)
    // while only carrying a single total `amount` — split that amount across its linked SIs
    // in proportion to each SI's own invoiced total so per-SI "collected" figures still sum
    // correctly instead of double-counting the same payment against every linked SI.
    const csiTotalBySi: Record<string, number> = {}
    for (const r of (csiRows ?? [])) {
      csiTotalBySi[r.si_number] = (csiTotalBySi[r.si_number] ?? 0) + (Number(r.amount) || 0)
    }
    const collectedBySi: Record<string, number> = {}
    for (const c of ((colData ?? []) as Collection[])) {
      if (c.status !== 'posted') continue
      const linked = linksMap[c.id] ?? (c.si_number ? [c.si_number] : [])
      if (linked.length === 0) continue
      const weights = linked.map(si => csiTotalBySi[si] ?? 0)
      const weightSum = weights.reduce((s, w) => s + w, 0)
      linked.forEach((si, i) => {
        const share = weightSum > 0 ? (c.amount ?? 0) * (weights[i] / weightSum) : (c.amount ?? 0) / linked.length
        collectedBySi[si] = (collectedBySi[si] ?? 0) + share
      })
    }
    const list: typeof readyToCollect = []
    for (const [poNumber, info] of Object.entries(csiByPo)) {
      if (!drPoNumbers.has(poNumber)) continue
      const collected = [...info.siNumbers].reduce((s, si) => s + (collectedBySi[si] ?? 0), 0)
      const outstanding = info.total - collected
      if (outstanding <= 0.01) continue
      list.push({ so_number: poNumber, client_name: info.clientName, csi_total: info.total, collected_total: collected, outstanding, si_numbers: [...info.siNumbers] })
    }
    list.sort((a, b) => b.outstanding - a.outstanding)
    setReadyToCollect(list)

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function resetForm() {
    setForm({ or_number: computeNextOrNumber(records), client_id: '', client_name: '', amount: '', si_number: '', payment_mode: 'Cash', reference_number: '', collection_date: '', remarks: '', cwt_type: 'none' })
    setEditingId(null)
    setClientSearch('')
    setClientDropdownOpen(false)
    setCsiOptions([])
    setSelectedCsis(new Set())
    setOrStatus('normal')
  }

  // True when this OR number is already used by another posted/voided record —
  // physical OR slips can't be reused, so this blocks saving a duplicate.
  const isDuplicateOr = !!normalizeOrNumber(form.or_number) && records.some(
    r => r.or_number === normalizeOrNumber(form.or_number) && r.id !== editingId
  )

  // CSI numbers already linked (via collection_csi_links, or the legacy single
  // si_number column) to one of this client's posted collections — excludes
  // `excludeCollectionId`'s own links so re-editing that collection still shows
  // its already-selected invoices as available/checked.
  function linkedSiNumbersFor(clientName: string, excludeCollectionId?: string): Set<string> {
    const set = new Set<string>()
    for (const r of records) {
      if (r.client_name !== clientName || r.status !== 'posted' || r.id === excludeCollectionId) continue
      for (const si of (csiLinksByCollection[r.id] ?? (r.si_number ? [r.si_number] : []))) set.add(si)
    }
    return set
  }

  // CSI invoices for this client that aren't already spoken for — excludes any SI
  // already linked to a posted collection, and any SI whose CSI record(s) are already
  // marked collected, so the same invoice can't be selected (and collected) twice.
  async function loadCsiOptions(clientName: string, excludeCollectionId?: string) {
    if (!clientName) { setCsiOptions([]); return }
    const { data: csiData } = await fetchAllRows((from, to) =>
      supabase.from('csi_records').select('si_number, si_date, amount, collection_status').eq('client_name', clientName).order('id').range(from, to)
    ).then(data => ({ data }))
    const linkedSet = linkedSiNumbersFor(clientName, excludeCollectionId)
    const ownLinks = new Set(excludeCollectionId ? (csiLinksByCollection[excludeCollectionId] ?? []) : [])
    for (const r of (csiData ?? [])) {
      if (r.si_number && r.collection_status === 'collected' && !ownLinks.has(r.si_number)) linkedSet.add(r.si_number)
    }
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
    setSelectedCsis(new Set())
    loadCsiOptions(c.company_name)
  }

  // Toggles a CSI invoice in/out of the multi-select set for this collection and
  // keeps Amount in sync with the sum of everything currently selected.
  function toggleCsi(siNumber: string) {
    setSelectedCsis(prev => {
      const next = new Set(prev)
      if (next.has(siNumber)) next.delete(siNumber)
      else next.add(siNumber)
      const total = csiOptions.filter(c => next.has(c.si_number)).reduce((s, c) => s + c.total, 0)
      setForm(p => ({ ...p, si_number: [...next][0] ?? '', amount: next.size > 0 ? String(total) : p.amount }))
      return next
    })
  }

  // Unpaid CSI invoices for a client, same "not already linked to a posted collection,
  // and not already marked collected" rule as loadCsiOptions — kept separate so the
  // Print Blank Form dialog doesn't interfere with the New Collection form's own
  // selection state.
  async function loadBlankFormInvoices(clientName: string) {
    if (!clientName) { setBlankFormInvoices([]); return }
    const [{ data: csiData }, { data: linkedRows }] = await Promise.all([
      fetchAllRows((from, to) => supabase.from('csi_records').select('si_number, si_date, amount, collection_status').eq('client_name', clientName).order('id').range(from, to)).then(data => ({ data })),
      supabase.from('collections').select('si_number').eq('client_name', clientName).eq('status', 'posted').not('si_number', 'is', null),
    ])
    const linkedSet = new Set((linkedRows ?? []).map(r => r.si_number))
    for (const r of (csiData ?? [])) {
      if (r.si_number && r.collection_status === 'collected') linkedSet.add(r.si_number)
    }
    const map: Record<string, { si_number: string; si_date: string; total: number }> = {}
    for (const r of (csiData ?? [])) {
      if (!r.si_number || linkedSet.has(r.si_number)) continue
      if (!map[r.si_number]) map[r.si_number] = { si_number: r.si_number, si_date: r.si_date, total: 0 }
      map[r.si_number].total += Number(r.amount) || 0
    }
    setBlankFormInvoices(Object.values(map).sort((a, b) => (b.si_date ?? '').localeCompare(a.si_date ?? '')))
  }

  function openBlankFormDialog() {
    setBlankFormClientId('')
    setBlankFormInvoices([])
    setBlankFormSelectedSis(new Set())
    setBlankFormDate(new Date().toISOString().split('T')[0])
    setBlankFormOpen(true)
  }

  function selectBlankFormClient(clientId: string) {
    setBlankFormClientId(clientId)
    setBlankFormSelectedSis(new Set())
    const client = clients.find(c => c.id === clientId)
    loadBlankFormInvoices(client?.company_name ?? '')
  }

  function toggleBlankFormSi(siNumber: string) {
    setBlankFormSelectedSis(prev => {
      const next = new Set(prev)
      if (next.has(siNumber)) next.delete(siNumber)
      else next.add(siNumber)
      return next
    })
  }

  function submitBlankForm() {
    const client = clients.find(c => c.id === blankFormClientId)
    if (!client) { toast.error('Select a client'); return }
    if (blankFormSelectedSis.size === 0) { toast.error('Select at least one invoice'); return }
    const selected = blankFormInvoices.filter(i => blankFormSelectedSis.has(i.si_number))
    const addressLine = [client.address, client.city, client.province].filter(Boolean).join(', ')
    printOrBlankForm({
      date: blankFormDate,
      receivedFrom: client.company_name,
      tin: client.tin,
      address: addressLine || null,
      businessStyle: client.industry,
      paymentFor: `SI No. ${formatSiList(selected.map(i => i.si_number))}`,
      invoices: selected.map(i => ({ si_number: i.si_number, amount: i.total })),
    })
    setBlankFormOpen(false)
  }

  function openCollectFor(row: { client_name: string }) {
    resetForm()
    const matched = clients.find(c => c.company_name === row.client_name)
    setForm(p => ({ ...p, client_id: matched?.id ?? '', client_name: row.client_name }))
    setClientSearch(row.client_name)
    loadCsiOptions(row.client_name)
    setOpen(true)
  }

  // Infers the CWT selector's value back from a stored form_2307 amount, since the
  // rate itself isn't persisted — only the computed withheld amount is.
  function cwtTypeFromAmount(amount: number, form2307: number | null): CWTType {
    if (!form2307 || amount <= 0) return 'none'
    const rate = form2307 / amount
    if (Math.abs(rate - CWT_CFG.goods.rate) < 0.001) return 'goods'
    if (Math.abs(rate - CWT_CFG.services.rate) < 0.001) return 'services'
    return 'none'
  }

  function startEdit(r: Collection) {
    resetForm()
    setEditingId(r.id)
    const matched = r.client_id ? clients.find(c => c.id === r.client_id) : clients.find(c => c.company_name === r.client_name)
    const amount = r.amount ?? 0
    setForm({
      or_number: r.or_number ?? '',
      client_id: matched?.id ?? r.client_id ?? '',
      client_name: r.client_name ?? '',
      amount: String(amount),
      si_number: r.si_number ?? '',
      payment_mode: PAYMENT_MODES_COL.find(m => m.toLowerCase().replace(' ', '_') === r.payment_mode) ?? 'Cash',
      reference_number: r.reference_number ?? '',
      collection_date: r.collection_date ?? '',
      remarks: r.remarks ?? '',
      cwt_type: cwtTypeFromAmount(amount, r.form_2307),
    })
    setClientSearch(r.client_name ?? '')
    setSelectedCsis(new Set(csiLinksByCollection[r.id] ?? (r.si_number ? [r.si_number] : [])))
    setOrStatus(r.status === 'cancelled' || r.status === 'missing' ? r.status : 'normal')
    if (r.client_name) loadCsiOptions(r.client_name, r.id)
    setOpen(true)
  }

  const filteredClients = clients.filter(c => !clientSearch || c.company_name.toLowerCase().includes(clientSearch.toLowerCase()))

  async function save() {
    const orNumber = normalizeOrNumber(form.or_number)
    if (!orNumber) { toast.error('OR Number is required'); return }
    if (records.some(r => r.or_number === orNumber && r.id !== editingId)) {
      toast.error(`OR Number ${orNumber} is already used by another record`)
      return
    }

    // Cancelled/Missing just records that this physical OR slip was voided or
    // lost — no client, amount, or journal entry involved.
    if (orStatus !== 'normal') {
      setSaving(true)
      const payload = {
        or_number: orNumber,
        collection_date: form.collection_date || new Date().toISOString().split('T')[0],
        remarks: form.remarks || null,
        status: orStatus,
      }
      const { error } = editingId
        ? await supabase.from('collections').update(payload).eq('id', editingId)
        : await supabase.from('collections').insert(payload)
      if (error) toast.error(error.message)
      else { toast.success(`OR ${orNumber} marked ${orStatus}`); setOpen(false); resetForm(); load() }
      setSaving(false)
      return
    }

    if (!form.amount || Number(form.amount) <= 0) { toast.error('Enter a valid amount'); return }
    const clientName = form.client_id
      ? clients.find(c => c.id === form.client_id)?.company_name ?? form.client_name
      : form.client_name
    if (!clientName.trim()) { toast.error('Client name required'); return }
    setSaving(true)
    const form2307 = Number(form.amount) * CWT_CFG[form.cwt_type].rate
    const payload = {
      or_number: orNumber,
      client_id: form.client_id || null,
      client_name: clientName.trim(),
      amount: Number(form.amount),
      form_2307: form2307 > 0 ? form2307 : null,
      payment_mode: form.payment_mode.toLowerCase().replace(' ', '_'),
      reference_number: form.reference_number || null,
      collection_date: form.collection_date || new Date().toISOString().split('T')[0],
      remarks: form.remarks || null,
      si_number: [...selectedCsis][0] ?? null,
    }
    if (editingId) {
      const { error } = await supabase.from('collections').update(payload).eq('id', editingId)
      if (error) { toast.error(error.message); setSaving(false); return }
      await supabase.from('collection_csi_links').delete().eq('collection_id', editingId)
      if (selectedCsis.size > 0) {
        await supabase.from('collection_csi_links').insert([...selectedCsis].map(si_number => ({ collection_id: editingId, si_number })))
      }
      toast.success('Collection updated'); setOpen(false); resetForm(); load()
      setSaving(false)
      return
    }
    const { data: colData, error } = await supabase.from('collections').insert({ ...payload, status: 'posted' }).select().single()
    if (error) { toast.error(error.message); setSaving(false); return }
    if (selectedCsis.size > 0) {
      await supabase.from('collection_csi_links').insert([...selectedCsis].map(si_number => ({ collection_id: (colData as any).id, si_number })))
    }
    const memo = `Collection: ${payload.or_number ?? ''} – ${clientName.trim()}`
    const { data: jeData, error: jeErr } = await supabase.from('journal_entries').insert({
      entry_date: payload.collection_date, memo, entry_type: 'sales_receipt',
      source_table: 'collections', source_id: (colData as any).id, status: 'posted',
    }).select().single()
    if (!jeErr && jeData) {
      const jeId = (jeData as any).id
      const net = Number(form.amount) - (payload.form_2307 ?? 0)
      const lines = [
        { entry_id: jeId, account_code: '1100', account_name: 'Cash on Hand', memo, debit: net, credit: 0 },
        { entry_id: jeId, account_code: '4100', account_name: 'Sales Revenue', memo, debit: 0, credit: Number(form.amount) },
      ]
      if (payload.form_2307) lines.push({ entry_id: jeId, account_code: '1120', account_name: 'Withholding Tax Receivable (2307)', memo, debit: payload.form_2307, credit: 0 })
      await supabase.from('journal_lines').insert(lines)
    }
    toast.success('Collection recorded'); setOpen(false); resetForm(); load()
    setSaving(false)
  }

  // Row-action: link one or more additional CSI invoices to an existing collection
  // without editing its amount/payment details.
  function openLinkCsi(r: Collection) {
    setLinkCsiFor(r)
    setLinkCsiSelected(new Set())
    setLinkCsiOptions([])
    if (r.client_name) {
      (async () => {
        if (!r.client_name) return
        const { data: csiData } = await fetchAllRows((from, to) =>
          supabase.from('csi_records').select('si_number, si_date, amount, collection_status').eq('client_name', r.client_name!).order('id').range(from, to)
        ).then(data => ({ data }))
        const linkedSet = linkedSiNumbersFor(r.client_name, r.id)
        const map: Record<string, { si_number: string; si_date: string; total: number }> = {}
        for (const row of (csiData ?? [])) {
          if (!row.si_number || linkedSet.has(row.si_number) || row.collection_status === 'collected') continue
          if (!map[row.si_number]) map[row.si_number] = { si_number: row.si_number, si_date: row.si_date, total: 0 }
          map[row.si_number].total += Number(row.amount) || 0
        }
        setLinkCsiOptions(Object.values(map).sort((a, b) => (b.si_date ?? '').localeCompare(a.si_date ?? '')))
      })()
    }
  }

  function toggleLinkCsi(siNumber: string) {
    setLinkCsiSelected(prev => {
      const next = new Set(prev)
      if (next.has(siNumber)) next.delete(siNumber)
      else next.add(siNumber)
      return next
    })
  }

  async function saveLinkCsi() {
    if (!linkCsiFor || linkCsiSelected.size === 0) return
    setLinkingCsi(true)
    const { error } = await supabase.from('collection_csi_links').insert(
      [...linkCsiSelected].map(si_number => ({ collection_id: linkCsiFor.id, si_number }))
    )
    if (error) toast.error(error.message)
    else { toast.success(`${linkCsiSelected.size} CSI invoice${linkCsiSelected.size !== 1 ? 's' : ''} linked`); setLinkCsiFor(null); load() }
    setLinkingCsi(false)
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
        <div class="row"><div class="lbl">SI Reference</div><div class="val">${r ? field((csiLinksByCollection[r.id] ?? (r.si_number ? [r.si_number] : [])).join(', ') || null) : field(null)}</div></div>
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

  function saveOrCalib(next: OrBlankCalib) {
    setOrBlankCalib(next)
    window.localStorage.setItem(OR_BLANK_CALIB_KEY, JSON.stringify(next))
  }

  function openOrCalib() {
    setOrCalibDraft(orBlankCalib)
    setOrCalibOpen(true)
  }

  // Overlays real field values on a blank page at the calibrated coordinates, for
  // printing directly onto a pre-printed OR booklet page loaded into the printer —
  // same approach as DR Logs' "Print (Blank Form)".

  function orBlankFormHtml(data: OrBlankPreviewData, c: OrBlankCalib) {
    const total = data.invoices.reduce((s, i) => s + i.amount, 0)
    const dateStr = data.date ? format(new Date(data.date), 'MM/dd/yyyy') : ''
    const field = (top: number, left: number, value: string) =>
      value ? `<div style="position:absolute;top:${top}mm;left:${left}mm;">${value}</div>` : ''
    const rows = data.invoices.slice(0, c.invoiceMaxRows).map((inv, i) => {
      const top = c.invoiceTableTop + i * c.invoiceRowHeight
      return field(top, c.invoiceNoLeft, inv.si_number) + field(top, c.invoiceAmountLeft, fmtNoPeso(inv.amount))
    }).join('')
    return `<!DOCTYPE html><html><head><title>Official Receipt (Blank Form)</title>
    <style>
      @page { size: portrait; margin: 0; }
      html, body { margin: 0; padding: 0; }
      body { position: relative; width: ${c.pageWidthMm}mm; height: ${c.pageHeightMm}mm; font-family: Arial, sans-serif; font-size: ${c.fontSizePt}pt; color: #000; }
      div { white-space: nowrap; }
    </style>
    </head><body>
    ${rows}
    ${field(c.totalSalesTop, c.totalSalesLeft, fmtNoPeso(total))}
    ${field(c.dateTop, c.dateLeft, dateStr)}
    ${field(c.receivedFromTop, c.receivedFromLeft, data.receivedFrom)}
    ${field(c.tinTop, c.tinLeft, data.tin ?? '')}
    ${field(c.addressTop, c.addressLeft, data.address ?? '')}
    ${field(c.businessStyleTop, c.businessStyleLeft, data.businessStyle ?? '')}
    ${field(c.amountWordsTop, c.amountWordsLeft, amountToWords(total))}
    ${field(c.amountTop, c.amountLeft, fmtNoPeso(total))}
    ${field(c.paymentForTop, c.paymentForLeft, data.paymentFor ?? '')}
    </body></html>`
  }

  function printOrBlankForm(data: OrBlankPreviewData) {
    const html = orBlankFormHtml(data, orBlankCalib)
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(html)
    win.document.close()
    setTimeout(() => { win.focus(); win.print(); win.close() }, 500)
  }

  function printORBlank(r: Collection) {
    const client = clients.find(c => c.id === r.client_id) ?? clients.find(c => c.company_name === r.client_name)
    const addressLine = client ? [client.address, client.city, client.province].filter(Boolean).join(', ') : ''
    const linkedSis = csiLinksByCollection[r.id] ?? (r.si_number ? [r.si_number] : [])
    printOrBlankForm({
      date: r.collection_date ?? '',
      receivedFrom: r.client_name ?? '',
      tin: client?.tin ?? null,
      address: addressLine || null,
      businessStyle: client?.industry ?? null,
      paymentFor: r.remarks ?? (linkedSis.length > 0 ? `SI No. ${formatSiList(linkedSis)}` : null),
      invoices: linkedSis.length > 0 ? [{ si_number: linkedSis.join(', '), amount: r.amount ?? 0 }] : [{ si_number: '—', amount: r.amount ?? 0 }],
    })
  }

  // Prints a 5mm-spaced ruler grid on the current calibration's page size, so you can
  // hold it up against the physical OR booklet page and read off Top/Left offsets.
  function printOrCalibGrid() {
    const c = orBlankCalib
    const vLines: string[] = []
    for (let x = 0; x <= c.pageWidthMm; x += 5) {
      vLines.push(`<div style="position:absolute;top:0;left:${x}mm;width:0;border-left:${x % 20 === 0 ? '0.5pt solid #000' : '0.25pt solid #999'};height:${c.pageHeightMm}mm;"></div>`)
      if (x % 20 === 0) vLines.push(`<div style="position:absolute;top:0;left:${x + 0.5}mm;font-size:6pt;">${x}</div>`)
    }
    const hLines: string[] = []
    for (let y = 0; y <= c.pageHeightMm; y += 5) {
      hLines.push(`<div style="position:absolute;top:${y}mm;left:0;height:0;border-top:${y % 20 === 0 ? '0.5pt solid #000' : '0.25pt solid #999'};width:${c.pageWidthMm}mm;"></div>`)
      if (y % 20 === 0) hLines.push(`<div style="position:absolute;top:${y}mm;left:0;font-size:6pt;">${y}</div>`)
    }
    const html = `<!DOCTYPE html><html><head><title>Calibration Grid</title>
    <style>
      @page { size: portrait; margin: 0; }
      html, body { margin: 0; padding: 0; }
      body { position: relative; width: ${c.pageWidthMm}mm; height: ${c.pageHeightMm}mm; font-family: Arial, sans-serif; color: #000; }
    </style>
    </head><body>${vLines.join('')}${hLines.join('')}</body></html>`
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(html)
    win.document.close()
    setTimeout(() => { win.focus(); win.print(); win.close() }, 500)
  }

  const filteredRecords = applyDateFilter(
    df,
    clientFilter ? records.filter(r => (r.client_name ?? '').toLowerCase().includes(clientFilter.toLowerCase())) : records,
    r => r.collection_date
  )
  const totalPosted = filteredRecords.filter(r => r.status === 'posted').reduce((s, r) => s + (r.amount ?? 0) - (r.form_2307 ?? 0), 0)
  const countPosted = filteredRecords.filter(r => r.status === 'posted').length
  const countVoided = filteredRecords.filter(r => r.status === 'voided').length

  const PAGE_SIZE = 30
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE))
  const pagedRecords = filteredRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [clientFilter, df.filterFrom, df.filterTo])

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Official Receipts and Collection Receipts management</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="relative overflow-hidden border-none">
          <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-transparent" />
          <CardContent className="relative pt-4 pb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-2xl font-bold text-green-600">{loading ? '—' : fmt(totalPosted)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Total Collections</div>
            </div>
            <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-sm shadow-green-500/30">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-none">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-transparent" />
          <CardContent className="relative pt-4 pb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-2xl font-bold">{loading ? '—' : countPosted}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Posted Records</div>
            </div>
            <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm shadow-blue-500/30">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-none">
          <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-transparent" />
          <CardContent className="relative pt-4 pb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-2xl font-bold text-red-600">{loading ? '—' : countVoided}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Voided</div>
            </div>
            <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-sm shadow-red-500/30">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
          </CardContent>
        </Card>
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
              ) : readyToCollect.map(row => {
                const isExpanded = expandedRTC === row.so_number
                const appliedCollections = records.filter(r => r.status === 'posted' &&
                  (csiLinksByCollection[r.id] ?? (r.si_number ? [r.si_number] : [])).some(si => row.si_numbers.includes(si)))
                return (
                  <>
                    <TableRow
                      key={row.so_number}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedRTC(prev => (prev === row.so_number ? null : row.so_number))}
                    >
                      <TableCell className="font-mono text-xs font-semibold text-blue-600">{row.so_number}</TableCell>
                      <TableCell className="text-sm font-medium">{row.client_name || '—'}</TableCell>
                      <TableCell className="text-right">{fmt(row.csi_total)}</TableCell>
                      <TableCell className="text-right text-green-600">{fmt(row.collected_total)}</TableCell>
                      <TableCell className="text-right font-semibold text-amber-600">{fmt(row.outstanding)}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="outline" onClick={() => openCollectFor(row)}>Collect</Button>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${row.so_number}-expanded`} className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={6} className="py-3 px-6">
                          <div className="space-y-3 text-xs">
                            <div>
                              <p className="font-semibold text-muted-foreground uppercase tracking-wide mb-1">CSI Invoices Billed</p>
                              <div className="flex flex-wrap gap-1.5">
                                {row.si_numbers.map(si => (
                                  <span key={si} className="font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{si}</span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="font-semibold text-muted-foreground uppercase tracking-wide mb-1">Collections Applied</p>
                              {appliedCollections.length === 0 ? (
                                <p className="text-muted-foreground italic">No collections posted yet.</p>
                              ) : (
                                <div className="border rounded-md overflow-hidden">
                                  <table className="w-full">
                                    <thead className="bg-muted/60">
                                      <tr>
                                        <th className="text-left px-3 py-1.5 font-medium">OR Number</th>
                                        <th className="text-left px-3 py-1.5 font-medium">Date</th>
                                        <th className="text-left px-3 py-1.5 font-medium">SI Number</th>
                                        <th className="text-right px-3 py-1.5 font-medium">Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {appliedCollections.map(c => (
                                        <tr key={c.id} className="border-t">
                                          <td className="px-3 py-1.5 font-mono">{c.or_number ?? '—'}</td>
                                          <td className="px-3 py-1.5">{c.collection_date ? format(new Date(c.collection_date), 'MMM d, yyyy') : '—'}</td>
                                          <td className="px-3 py-1.5 font-mono">{c.si_number ?? '—'}</td>
                                          <td className="px-3 py-1.5 text-right font-medium">{fmt(c.amount ?? 0)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-end gap-3 flex-wrap justify-between">
        <div className="flex items-end gap-3 flex-wrap">
          <DateFilterBar df={df} />
          <div className="flex items-center gap-2">
            <Select value={clientFilter} onValueChange={v => setClientFilter(v ?? '')}>
              <SelectTrigger className="h-8 text-xs w-64">
                <SelectValue>{() => clientFilter || 'All Clients'}</SelectValue>
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" title="Calibrate Blank Form Print" onClick={openOrCalib}>
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={openBlankFormDialog}>
            <Printer className="h-4 w-4 mr-2" />Print Blank Form
          </Button>
          <Button onClick={() => { resetForm(); setOpen(true) }} className="bg-red-600 hover:bg-red-700">
            <Plus className="h-4 w-4 mr-2" />New Collection
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-md shadow-black/5 ring-1 ring-black/5 rounded-2xl overflow-hidden py-0 gap-0">
        <CardHeader className="pb-2 pt-5 px-5 bg-gradient-to-r from-muted/50 to-transparent">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-red-600" />Collection Records
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto max-h-[620px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-12">No.</TableHead>
                <TableHead>OR Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>CSI</TableHead>
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
                <TableRow><TableCell colSpan={11} className="text-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell></TableRow>
              ) : filteredRecords.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                  {clientFilter ? `No collections found for "${clientFilter}".` : 'No collections yet. Click New Collection to record one.'}
                </TableCell></TableRow>
              ) : pagedRecords.map((r, i) => {
                const linkedSis = csiLinksByCollection[r.id] ?? (r.si_number ? [r.si_number] : [])
                return (
                <TableRow key={r.id} className="cursor-pointer hover:bg-red-50/40 transition-colors" onClick={() => setViewRecord(r)}>
                  <TableCell className="text-sm text-muted-foreground">{(page - 1) * PAGE_SIZE + i + 1}</TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-red-600">{r.or_number ?? '—'}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {r.collection_date ? format(new Date(r.collection_date), 'MMM d, yyyy') : '—'}
                  </TableCell>
                  <TableCell className="font-medium text-sm">{r.client_name ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {linkedSis.length === 0 ? '—' : linkedSis.length === 1 ? linkedSis[0] : (
                      <div className="flex flex-wrap gap-1">
                        {linkedSis.map(si => <span key={si} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{si}</span>)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize">
                      {(r.payment_mode ?? '').replace('_', ' ')}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{fmt(r.amount ?? 0)}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">{r.form_2307 ? fmt(r.form_2307) : '—'}</TableCell>
                  <TableCell className="text-right font-semibold text-green-700">{fmt((r.amount ?? 0) - (r.form_2307 ?? 0))}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_CLS[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {r.status}
                    </span>
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => setViewRecord(r)}>
                          <Eye className="mr-2 h-4 w-4" />View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => startEdit(r)}>
                          <Pencil className="mr-2 h-4 w-4" />Edit
                        </DropdownMenuItem>
                        {r.status === 'posted' && r.client_name && (
                          <DropdownMenuItem onClick={() => openLinkCsi(r)}>
                            <Link2 className="mr-2 h-4 w-4" />Link CSI
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => printOR(r)}>
                          <Printer className="mr-2 h-4 w-4" />Print OR
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => printORBlank(r)}>
                          <FileText className="mr-2 h-4 w-4" />Print (Blank Form)
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
                )
              })}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm px-4 py-3 border-t">
              <span className="text-muted-foreground">
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filteredRecords.length)} of {filteredRecords.length}
              </span>
              <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <div className="relative bg-gradient-to-r from-red-700 to-red-900 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-white text-lg font-semibold">{editingId ? 'Edit Collection (OR)' : 'New Collection (OR)'}</DialogTitle>
            </DialogHeader>
            <p className="text-red-100 text-xs mt-1">Official Receipt for a client collection.</p>
            <DialogClose className="absolute top-4 right-4 text-red-100 hover:text-white transition-colors">
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6">
            <div className="space-y-1.5">
              <Label>OR Number</Label>
              <Input placeholder="e.g. 00031 (no OR- prefix)" value={form.or_number}
                onChange={e => setForm(p => ({ ...p, or_number: normalizeOrNumber(e.target.value) }))} />
              {isDuplicateOr && (
                <p className="text-xs text-destructive">OR Number {normalizeOrNumber(form.or_number)} is already used by another record.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Collection Date</Label>
              <Input type="date" value={form.collection_date} onChange={e => setForm(p => ({ ...p, collection_date: e.target.value }))} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>This OR Number is</Label>
              <div className="flex gap-2">
                {([['normal', 'Normal'], ['cancelled', 'Cancelled'], ['missing', 'Missing']] as const).map(([val, label]) => (
                  <Button key={val} type="button" size="sm" variant={orStatus === val ? 'default' : 'outline'}
                    className={orStatus === val ? 'bg-red-600 hover:bg-red-700' : ''}
                    onClick={() => setOrStatus(val)}>
                    {label}
                  </Button>
                ))}
              </div>
              {orStatus !== 'normal' && (
                <p className="text-xs text-muted-foreground">
                  Records that this OR slip was {orStatus} — no client, amount, or accounting entry is recorded.
                </p>
              )}
            </div>
            {orStatus === 'normal' && <>
            <div className="sm:col-span-2 space-y-1.5 relative">
              <Label>Client</Label>
              <Input
                value={clientSearch}
                onChange={e => {
                  const val = e.target.value
                  setClientSearch(val)
                  setForm(p => ({ ...p, client_id: '', client_name: val, si_number: '' }))
                  setClientDropdownOpen(true)
                  setCsiOptions([])
                  setSelectedCsis(new Set())
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
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Link to CSI Invoice(s) <span className="text-muted-foreground text-xs">(optional, select multiple)</span></Label>
                <div className="border rounded-lg max-h-48 overflow-y-auto divide-y">
                  {csiOptions.map(csi => (
                    <label key={csi.si_number} className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/50 cursor-pointer">
                      <input type="checkbox" checked={selectedCsis.has(csi.si_number)} onChange={() => toggleCsi(csi.si_number)} className="h-4 w-4" />
                      <span className="font-mono text-xs">{csi.si_number}</span>
                      <span className="text-xs text-muted-foreground">{csi.si_date ? format(new Date(csi.si_date), 'MMM d, yyyy') : '—'}</span>
                      <span className="ml-auto text-xs font-semibold">{fmt(csi.total)}</span>
                    </label>
                  ))}
                </div>
                {selectedCsis.size > 0 && (
                  <p className="text-xs text-muted-foreground">{selectedCsis.size} invoice{selectedCsis.size !== 1 ? 's' : ''} selected — Amount below is their combined total.</p>
                )}
              </div>
            )}
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
            <div className="space-y-1.5">
              <Label>Form 2307 (CWT)</Label>
              <Select value={form.cwt_type} onValueChange={v => setForm(p => ({ ...p, cwt_type: (v ?? 'none') as CWTType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(CWT_CFG) as CWTType[]).map(k => (
                    <SelectItem key={k} value={k}>{CWT_CFG[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Withheld Amount</Label>
              <div className="h-9 flex items-center px-3 rounded-md border bg-muted text-sm text-muted-foreground">
                {form.cwt_type === 'none' || !form.amount
                  ? '—'
                  : fmt(Number(form.amount) * CWT_CFG[form.cwt_type].rate)}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reference Number</Label>
              <Input placeholder="Check #, bank ref, transaction ID…" value={form.reference_number}
                onChange={e => setForm(p => ({ ...p, reference_number: e.target.value }))} />
            </div>
            </>}
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Remarks</Label>
              <Textarea rows={2} placeholder="Optional notes…" value={form.remarks}
                onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} />
            </div>
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-b-2xl">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || isDuplicateOr} className="bg-red-600 hover:bg-red-700">
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : editingId ? 'Save Changes' : orStatus === 'normal' ? 'Post Collection' : `Mark ${orStatus === 'cancelled' ? 'Cancelled' : 'Missing'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link CSI Dialog — row action to attach additional CSI invoices to an existing collection */}
      <Dialog open={!!linkCsiFor} onOpenChange={o => { if (!o) setLinkCsiFor(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Link2 className="h-4 w-4 text-red-600" />Link CSI to OR {linkCsiFor?.or_number ?? ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">Unbilled CSI invoices for {linkCsiFor?.client_name}.</p>
            {linkCsiOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No unlinked CSI invoices available for this client.</p>
            ) : (
              <div className="border rounded-lg max-h-64 overflow-y-auto divide-y">
                {linkCsiOptions.map(csi => (
                  <label key={csi.si_number} className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/50 cursor-pointer">
                    <input type="checkbox" checked={linkCsiSelected.has(csi.si_number)} onChange={() => toggleLinkCsi(csi.si_number)} className="h-4 w-4" />
                    <span className="font-mono text-xs">{csi.si_number}</span>
                    <span className="text-xs text-muted-foreground">{csi.si_date ? format(new Date(csi.si_date), 'MMM d, yyyy') : '—'}</span>
                    <span className="ml-auto text-xs font-semibold">{fmt(csi.total)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkCsiFor(null)}>Cancel</Button>
            <Button onClick={saveLinkCsi} disabled={linkingCsi || linkCsiSelected.size === 0} className="bg-red-600 hover:bg-red-700">
              {linkingCsi ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Linking…</> : `Link ${linkCsiSelected.size || ''} CSI`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View OR Dialog */}
      <Dialog open={!!viewRecord} onOpenChange={o => { if (!o) setViewRecord(null) }}>
        <DialogContent className="max-w-xl">
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
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_CLS[viewRecord.status] ?? 'bg-gray-100 text-gray-600'}`}>{viewRecord.status}</span>
                </div>
                <div><span className="text-xs text-muted-foreground block">Payment Mode</span><span className="capitalize">{(viewRecord.payment_mode ?? '—').replace('_', ' ')}</span></div>
                <div><span className="text-xs text-muted-foreground block">Reference No.</span><span>{viewRecord.reference_number ?? '—'}</span></div>
                <div><span className="text-xs text-muted-foreground block">SI Reference</span><span className="font-mono">{(csiLinksByCollection[viewRecord.id] ?? (viewRecord.si_number ? [viewRecord.si_number] : [])).join(', ') || '—'}</span></div>
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
            {viewRecord && (
              <Button variant="outline" onClick={() => printORBlank(viewRecord)} className="gap-1.5">
                <FileText className="h-4 w-4" />Print (Blank Form)
              </Button>
            )}
            <Button onClick={() => printOR(viewRecord)} className="bg-red-600 hover:bg-red-700 gap-1.5">
              <Printer className="h-4 w-4" />Print OR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={blankFormOpen} onOpenChange={setBlankFormOpen}>
        <DialogContent className="w-[95vw] max-w-5xl sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Printer className="h-4 w-4 text-red-600" />Print Blank Form</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            Pick a client and the invoice(s) this OR covers — a client with multiple unpaid invoices can have more
            than one included in a single receipt, listed on the left with their combined total at the bottom.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3 py-1">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={blankFormDate} onChange={e => setBlankFormDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Client</Label>
                <Select value={blankFormClientId} onValueChange={v => selectBlankFormClient(v ?? '')}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{() => clients.find(c => c.id === blankFormClientId)?.company_name ?? 'Select client…'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {blankFormClientId && (
                <div className="space-y-1.5">
                  <Label>Invoice(s) to include</Label>
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    {blankFormInvoices.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-muted-foreground">No unpaid invoices for this client.</div>
                    ) : blankFormInvoices.map(inv => (
                      <button
                        key={inv.si_number} type="button"
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-0 flex items-center justify-between gap-2 ${blankFormSelectedSis.has(inv.si_number) ? 'bg-red-50' : ''}`}
                        onClick={() => toggleBlankFormSi(inv.si_number)}
                      >
                        <span className="flex items-center gap-2">
                          {blankFormSelectedSis.has(inv.si_number) && <CheckCircle2 className="h-3.5 w-3.5 text-red-600 shrink-0" />}
                          <span className="font-mono">{inv.si_number}</span>
                          <span className="text-xs text-muted-foreground">{inv.si_date ? format(new Date(inv.si_date), 'MMM d, yyyy') : ''}</span>
                        </span>
                        <span className="font-medium shrink-0">{fmt(inv.total)}</span>
                      </button>
                    ))}
                  </div>
                  {blankFormSelectedSis.size > 0 && (
                    <p className="text-sm font-semibold text-right">
                      Total: {fmt(blankFormInvoices.filter(i => blankFormSelectedSis.has(i.si_number)).reduce((s, i) => s + i.total, 0))}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Live preview — mirrors the calibrated print layout at scale */}
            <div className="space-y-1.5">
              <Label>Preview</Label>
              <OrBlankPreview
                calib={orBlankCalib}
                data={{
                  date: blankFormDate,
                  receivedFrom: clients.find(c => c.id === blankFormClientId)?.company_name ?? '',
                  tin: clients.find(c => c.id === blankFormClientId)?.tin ?? null,
                  address: (() => {
                    const c = clients.find(cl => cl.id === blankFormClientId)
                    return c ? [c.address, c.city, c.province].filter(Boolean).join(', ') : null
                  })(),
                  businessStyle: clients.find(c => c.id === blankFormClientId)?.industry ?? null,
                  paymentFor: blankFormSelectedSis.size > 0 ? `SI No. ${formatSiList([...blankFormSelectedSis])}` : null,
                  invoices: blankFormInvoices.filter(i => blankFormSelectedSis.has(i.si_number)).map(i => ({ si_number: i.si_number, amount: i.total })),
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlankFormOpen(false)}>Cancel</Button>
            <Button onClick={submitBlankForm} className="bg-red-600 hover:bg-red-700 gap-1.5">
              <Printer className="h-4 w-4" />Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={orCalibOpen} onOpenChange={setOrCalibOpen}>
        <DialogContent className="w-[95vw] max-w-5xl sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Calibrate Blank Form Print</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            All values are in millimeters, measured from the top-left corner of the page. Load your blank OR
            booklet page into the printer, click <strong>Print Test Grid</strong>, hold it up to the form to read
            off where the blank line for each field falls, then enter those numbers below. Make sure your print
            dialog uses 100% scale with no margins.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={printOrCalibGrid} className="w-fit gap-1.5">
            <Printer className="h-3.5 w-3.5" /> Print Test Grid
          </Button>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 content-start">
              <div className="col-span-2 grid grid-cols-3 gap-3">
                <OrCalibField label="Page Width" value={orCalibDraft.pageWidthMm} onChange={v => setOrCalibDraft(d => ({ ...d, pageWidthMm: v }))} />
                <OrCalibField label="Page Height" value={orCalibDraft.pageHeightMm} onChange={v => setOrCalibDraft(d => ({ ...d, pageHeightMm: v }))} />
                <OrCalibField label="Font Size (pt)" value={orCalibDraft.fontSizePt} onChange={v => setOrCalibDraft(d => ({ ...d, fontSizePt: v }))} />
              </div>
              <div className="col-span-2 border-t pt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">In Settlement of the Following (Invoice Table)</p>
              </div>
              <OrCalibField label="Table Top" value={orCalibDraft.invoiceTableTop} onChange={v => setOrCalibDraft(d => ({ ...d, invoiceTableTop: v }))} />
              <OrCalibField label="Row Height" value={orCalibDraft.invoiceRowHeight} onChange={v => setOrCalibDraft(d => ({ ...d, invoiceRowHeight: v }))} />
              <OrCalibField label="Invoice No. Left" value={orCalibDraft.invoiceNoLeft} onChange={v => setOrCalibDraft(d => ({ ...d, invoiceNoLeft: v }))} />
              <OrCalibField label="Amount Left" value={orCalibDraft.invoiceAmountLeft} onChange={v => setOrCalibDraft(d => ({ ...d, invoiceAmountLeft: v }))} />
              <OrCalibField label="Max Rows" value={orCalibDraft.invoiceMaxRows} onChange={v => setOrCalibDraft(d => ({ ...d, invoiceMaxRows: v }))} />
              <OrCalibPair label="Total Sales" top={orCalibDraft.totalSalesTop} left={orCalibDraft.totalSalesLeft}
                onChange={(top, left) => setOrCalibDraft(d => ({ ...d, totalSalesTop: top, totalSalesLeft: left }))} />
              <div className="col-span-2 border-t pt-3" />
              <OrCalibPair label="Date" top={orCalibDraft.dateTop} left={orCalibDraft.dateLeft}
                onChange={(top, left) => setOrCalibDraft(d => ({ ...d, dateTop: top, dateLeft: left }))} />
              <OrCalibPair label="Received From" top={orCalibDraft.receivedFromTop} left={orCalibDraft.receivedFromLeft}
                onChange={(top, left) => setOrCalibDraft(d => ({ ...d, receivedFromTop: top, receivedFromLeft: left }))} />
              <OrCalibPair label="TIN" top={orCalibDraft.tinTop} left={orCalibDraft.tinLeft}
                onChange={(top, left) => setOrCalibDraft(d => ({ ...d, tinTop: top, tinLeft: left }))} />
              <OrCalibPair label="Address" top={orCalibDraft.addressTop} left={orCalibDraft.addressLeft}
                onChange={(top, left) => setOrCalibDraft(d => ({ ...d, addressTop: top, addressLeft: left }))} />
              <OrCalibPair label="Business Style" top={orCalibDraft.businessStyleTop} left={orCalibDraft.businessStyleLeft}
                onChange={(top, left) => setOrCalibDraft(d => ({ ...d, businessStyleTop: top, businessStyleLeft: left }))} />
              <OrCalibPair label="Amount in Words" top={orCalibDraft.amountWordsTop} left={orCalibDraft.amountWordsLeft}
                onChange={(top, left) => setOrCalibDraft(d => ({ ...d, amountWordsTop: top, amountWordsLeft: left }))} />
              <OrCalibPair label="Amount" top={orCalibDraft.amountTop} left={orCalibDraft.amountLeft}
                onChange={(top, left) => setOrCalibDraft(d => ({ ...d, amountTop: top, amountLeft: left }))} />
              <OrCalibPair label="In Payment For" top={orCalibDraft.paymentForTop} left={orCalibDraft.paymentForLeft}
                onChange={(top, left) => setOrCalibDraft(d => ({ ...d, paymentForTop: top, paymentForLeft: left }))} />
            </div>

            <div className="space-y-1.5">
              <Label>Preview (sample data)</Label>
              <OrBlankPreview
                calib={orCalibDraft}
                data={{
                  date: new Date().toISOString().split('T')[0],
                  receivedFrom: 'Sample Client Corp.',
                  tin: '000-000-000-000',
                  address: 'Sample City, Sample Province',
                  businessStyle: 'Trading',
                  paymentFor: 'SI No. 00001, 00002',
                  invoices: [{ si_number: '00001', amount: 5000 }, { si_number: '00002', amount: 2500 }],
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOrCalibDraft(DEFAULT_OR_BLANK_CALIB)}>Reset to Defaults</Button>
            <Button type="button" variant="outline" onClick={() => setOrCalibOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => { saveOrCalib(orCalibDraft); setOrCalibOpen(false); toast.success('Calibration saved') }} className="bg-red-600 hover:bg-red-700">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Sales Journal (CRJ) sub-tab ───────────────────────────────────────────────

// Windowed page list — always shows first/last, current ±1, with '…' gaps —
// so pagination stays compact even with dozens of pages.
function paginationRange(current: number, total: number): (number | '…')[] {
  const pages = new Set([1, total, current, current - 1, current + 1])
  const sorted = [...pages].filter(p => p >= 1 && p <= total).sort((a, b) => a - b)
  const result: (number | '…')[] = []
  let prev = 0
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push('…')
    result.push(p)
    prev = p
  }
  return result
}

const SALES_JOURNAL_PAGE_SIZE = 20

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

  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [csiRecords])
  const totalPages = Math.max(1, Math.ceil(siRows.length / SALES_JOURNAL_PAGE_SIZE))
  const pagedRows = siRows.slice((page - 1) * SALES_JOURNAL_PAGE_SIZE, page * SALES_JOURNAL_PAGE_SIZE)

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
            ) : pagedRows.map(([si, v]) => (
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Showing {((page - 1) * SALES_JOURNAL_PAGE_SIZE) + 1}–{Math.min(page * SALES_JOURNAL_PAGE_SIZE, siRows.length)} of {siRows.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-md border text-sm font-medium disabled:opacity-40 hover:bg-muted transition-colors"
            >← Prev</button>
            {paginationRange(page, totalPages).map((p, i) => p === '…' ? (
              <span key={`gap-${i}`} className="w-8 h-8 flex items-center justify-center text-sm text-muted-foreground">…</span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${p === page ? 'bg-red-600 text-white' : 'border hover:bg-muted'}`}
              >{p}</button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-md border text-sm font-medium disabled:opacity-40 hover:bg-muted transition-colors"
            >Next →</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Disbursements sub-tab (CDJ) ───────────────────────────────────────────────

function DisbursementsTab({ filterFrom, filterTo }: { filterFrom?: string; filterTo?: string }) {
  const supabase = createClient()
  const [disbs, setDisbs] = useState<Disbursement[]>([])
  const [payees, setPayees] = useState<{ id: string; name: string }[]>([])
  const [pendingPOs, setPendingPOs] = useState<{ po_number: string; po_date: string; supplier: string; net_payable: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ disb_date: '', payee: '', description: '', amount: '', expense_account: '5950', payment_mode: 'cash', check_number: '', remarks: '', po_number: '' })
  const [payeeDropdownOpen, setPayeeDropdownOpen] = useState(false)

  async function load() {
    setLoading(true)
    const [{ data }, { data: payeeData }, { data: poData }] = await Promise.all([
      supabase.from('disbursements').select('*').order('disb_date', { ascending: false }),
      supabase.from('payees').select('id, name').order('name'),
      supabase.from('purchase_orders').select('po_number, po_date, net_payable, status, supplier:suppliers(company_name)').neq('status', 'cancelled'),
    ])
    setDisbs((data ?? []) as Disbursement[])
    setPayees(payeeData ?? [])
    const linkedPOs = new Set(((data ?? []) as Disbursement[]).map(d => d.po_number).filter(Boolean))
    const poRows = (poData ?? []) as unknown as { po_number: string | null; po_date: string; net_payable: number | null; supplier: { company_name: string | null } | null }[]
    setPendingPOs(
      poRows
        .filter(po => po.po_number && !linkedPOs.has(po.po_number))
        .map(po => ({
          po_number: po.po_number as string,
          po_date: po.po_date,
          supplier: po.supplier?.company_name ?? 'Unknown Supplier',
          net_payable: Number(po.net_payable) || 0,
        }))
    )
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function resetForm() {
    setForm({ disb_date: '', payee: '', description: '', amount: '', expense_account: '5950', payment_mode: 'cash', check_number: '', remarks: '', po_number: '' })
    setPayeeDropdownOpen(false)
  }

  function acceptPO(po: { po_number: string; po_date: string; supplier: string; net_payable: number }) {
    resetForm()
    setForm(p => ({
      ...p,
      disb_date: new Date().toISOString().split('T')[0],
      payee: po.supplier,
      description: `Payment for PO ${po.po_number}`,
      amount: String(po.net_payable),
      po_number: po.po_number,
    }))
    setOpen(true)
  }

  const filteredPayees = payees.filter(p => !form.payee || p.name.toLowerCase().includes(form.payee.toLowerCase()))

  async function addPayeeName(name: string) {
    const { data, error } = await supabase.from('payees').insert({ name }).select('id, name').single()
    if (error) { toast.error(error.message); return }
    setPayees(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setForm(f => ({ ...f, payee: name }))
    setPayeeDropdownOpen(false)
    toast.success('Payee added')
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
      po_number: form.po_number || null,
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
    const payeeName = form.payee.trim()
    if (!payees.some(p => p.name.toLowerCase() === payeeName.toLowerCase())) {
      await supabase.from('payees').insert({ name: payeeName })
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
      {pendingPOs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" />Pending Disbursements ({pendingPOs.length})</CardTitle>
            <CardDescription>Purchase Orders not yet paid — accept one to prefill a Disbursement</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>PO Number</TableHead><TableHead>Date</TableHead><TableHead>Supplier</TableHead>
                <TableHead className="text-right">Net Payable</TableHead><TableHead className="w-24" />
              </TableRow></TableHeader>
              <TableBody>
                {pendingPOs.map(po => (
                  <TableRow key={po.po_number}>
                    <TableCell className="font-mono text-xs font-semibold text-red-600">{po.po_number}</TableCell>
                    <TableCell className="text-sm">{po.po_date ? format(new Date(po.po_date), 'MMM d, yyyy') : '—'}</TableCell>
                    <TableCell className="text-sm">{po.supplier}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(po.net_payable)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => acceptPO(po)}>Accept</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
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
                <TableCell><span className="text-xs bg-muted px-2 py-0.5 rounded-full">{cap(d.payment_mode.replace('_',' '))}</span></TableCell>
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
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Disbursement</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Date <span className="text-destructive">*</span></Label>
              <Input type="date" value={form.disb_date} onChange={e => setForm(p => ({ ...p, disb_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Mode</Label>
              <Select value={form.payment_mode} onValueChange={v => setForm(p => ({ ...p, payment_mode: v ?? 'cash' }))}>
                <SelectTrigger><SelectValue>{(v: string) => cap((v ?? 'cash').replace('_', ' '))}</SelectValue></SelectTrigger>
                <SelectContent>{PAYMENT_MODES_DISB.map(m => <SelectItem key={m} value={m}>{cap(m.replace('_',' '))}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-1.5 relative">
              <Label>Payee <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Type to search or enter a payee name…"
                value={form.payee}
                onChange={e => { setForm(p => ({ ...p, payee: e.target.value })); setPayeeDropdownOpen(true) }}
                onFocus={() => setPayeeDropdownOpen(true)}
                onBlur={() => setTimeout(() => setPayeeDropdownOpen(false), 150)}
              />
              {payeeDropdownOpen && (filteredPayees.length > 0 || form.payee.trim()) && (
                <div className="absolute z-20 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredPayees.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={() => { setForm(f => ({ ...f, payee: p.name })); setPayeeDropdownOpen(false) }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent border-b last:border-0"
                    >
                      {p.name}
                    </button>
                  ))}
                  {form.payee.trim() && !payees.some(p => p.name.toLowerCase() === form.payee.trim().toLowerCase()) && (
                    <button
                      type="button"
                      onMouseDown={() => addPayeeName(form.payee.trim())}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-1.5 text-red-600 font-medium"
                    >
                      <Plus className="h-3.5 w-3.5" />Add &ldquo;{form.payee.trim()}&rdquo; as new payee
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input placeholder="Purpose of payment" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Expense Account</Label>
              <Select value={form.expense_account} onValueChange={v => setForm(p => ({ ...p, expense_account: v ?? '5950' }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{EXPENSE_ACCOUNTS.map(a => <SelectItem key={a.code} value={a.code}>{a.code} – {a.name}</SelectItem>)}</SelectContent>
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

// ── Chart of Accounts sub-tab ─────────────────────────────────────────────────

const ACCOUNT_TYPE_CLS: Record<string, string> = {
  asset: 'bg-blue-100 text-blue-700',
  liability: 'bg-orange-100 text-orange-700',
  equity: 'bg-purple-100 text-purple-700',
  revenue: 'bg-green-100 text-green-700',
  expense: 'bg-red-100 text-red-700',
}

function ChartOfAccountsTab({ coa }: { coa: COA[] }) {
  const [search, setSearch] = useState('')
  const filtered = coa.filter(a =>
    !search ||
    a.account_code.toLowerCase().includes(search.toLowerCase()) ||
    a.account_name.toLowerCase().includes(search.toLowerCase())
  )
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Chart of Accounts</p>
          <p className="text-xs text-muted-foreground">Full list of accounts used across the General Ledger and financial statements</p>
        </div>
        <Input placeholder="Search accounts…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Account Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Normal Balance</TableHead>
            <TableHead>Header</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No accounts found.</TableCell></TableRow>
            ) : filtered.map(a => (
              <TableRow key={a.account_code} className={a.is_header ? 'bg-muted/40 font-semibold' : ''}>
                <TableCell className="font-mono text-xs">{a.account_code}</TableCell>
                <TableCell className="text-sm">{a.account_name}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${ACCOUNT_TYPE_CLS[a.account_type] ?? 'bg-gray-100 text-gray-600'}`}>
                    {a.account_type}
                  </span>
                </TableCell>
                <TableCell className="text-sm capitalize">{a.normal_balance}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{a.is_header ? 'Yes' : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
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
      fetchAllRows((from, to) => supabase.from('csi_records').select('id,si_number,si_date,client_name,item_name,unit,quantity,unit_price,amount').order('si_date').order('id').range(from, to)).then(data => ({ data })),
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
          <TabsContent value="coa"><ChartOfAccountsTab coa={coa} /></TabsContent>
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
// Reuses the standalone BIR Compliance page component so this tab and the
// dedicated /bir route share one implementation instead of drifting apart.
function BIRComplianceTab() {
  return <BIRPage />
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
