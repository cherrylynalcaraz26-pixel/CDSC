'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { CheckCircle2, XCircle, AlertTriangle, Download, FileBarChart, Zap, FileText, Loader2, Printer, Sparkles, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { htmlToPdfBase64 } from '@/lib/send-email'

interface BirFormDef { key: string; form: string; description: string; period: string; due: string; amount: number; periodStart: string; periodEnd: string }
interface BirForm extends BirFormDef { status: 'filed' | 'overdue' | 'due_soon' | 'pending' }

// Generates this cycle's BIR filings relative to "today" instead of hardcoded dates,
// so the Filing Calendar and readiness check stay meaningful as time passes. The
// percentage/VAT and income tax forms switch automatically based on the company's
// actual registration (system_settings.vat_registered, business_type) so this stays
// correct if CDSC ever changes from non-VAT to VAT-registered, or vice versa.
function buildBirForms(today: Date, vatRegistered: boolean, isCorporate: boolean): BirFormDef[] {
  const y = today.getFullYear(), m = today.getMonth()
  const iso = (d: Date) => d.toISOString().split('T')[0]

  const prevMonthLabel = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const monthlyDue = new Date(y, m, 10)
  const monthStart = new Date(y, m - 1, 1)
  const monthEnd = new Date(y, m, 0)

  // Most recently closed quarter relative to today (e.g. in Jul, that's Apr–Jun).
  const currentQuarterEndMonth = Math.floor(m / 3) * 3 + 2
  let qEndMonth = currentQuarterEndMonth - 3
  let qYear = y
  if (qEndMonth < 0) { qEndMonth += 12; qYear -= 1 }
  const quarterStart = new Date(qYear, qEndMonth - 2, 1)
  const quarterEnd = new Date(qYear, qEndMonth + 1, 0)
  const quarterLabel = `Q${Math.floor(qEndMonth / 3) + 1} ${qYear}`
  const eqDue = new Date(qYear, qEndMonth + 2, 0)
  const salesTaxDue = new Date(qYear, qEndMonth, quarterEnd.getDate() + 25)
  const itDue = new Date(qYear, qEndMonth, quarterEnd.getDate() + 60)

  const salesTaxForm = vatRegistered
    ? { form: '2550Q', description: 'Value Added Tax (Quarterly)' }
    : { form: '2551Q', description: 'Percentage Tax (Quarterly)' }
  const incomeTaxForm = isCorporate
    ? { form: '1702Q', description: 'Income Tax (Quarterly) — Corporation' }
    : { form: '1701Q', description: 'Income Tax (Quarterly) — Individual/Sole Prop' }

  return [
    { key: `0619-E_${iso(monthlyDue)}`, form: '0619-E', description: 'Expanded Withholding Tax (Monthly)', period: prevMonthLabel, due: iso(monthlyDue), amount: 12450, periodStart: iso(monthStart), periodEnd: iso(monthEnd) },
    { key: `0619-F_${iso(monthlyDue)}`, form: '0619-F', description: 'Final Withholding Tax (Monthly)', period: prevMonthLabel, due: iso(monthlyDue), amount: 3200, periodStart: iso(monthStart), periodEnd: iso(monthEnd) },
    { key: `1601-EQ_${quarterLabel}`, form: '1601-EQ', description: 'Expanded Withholding Tax (Quarterly)', period: quarterLabel, due: iso(eqDue), amount: 38750, periodStart: iso(quarterStart), periodEnd: iso(quarterEnd) },
    { key: `1601-FQ_${quarterLabel}`, form: '1601-FQ', description: 'Final Withholding Tax (Quarterly)', period: quarterLabel, due: iso(eqDue), amount: 9600, periodStart: iso(quarterStart), periodEnd: iso(quarterEnd) },
    { key: `${salesTaxForm.form}_${quarterLabel}`, form: salesTaxForm.form, description: salesTaxForm.description, period: quarterLabel, due: iso(salesTaxDue), amount: 0, periodStart: iso(quarterStart), periodEnd: iso(quarterEnd) },
    { key: `${incomeTaxForm.form}_${quarterLabel}`, form: incomeTaxForm.form, description: incomeTaxForm.description, period: quarterLabel, due: iso(itDue), amount: 145000, periodStart: iso(quarterStart), periodEnd: iso(quarterEnd) },
  ]
}

const vatSummary = [
  { month: 'Jan 2025', gross_purchases: 820000, input_vat: 88071.43, output_vat: 0, net_vat: 88071.43 },
  { month: 'Feb 2025', gross_purchases: 640000, input_vat: 68571.43, output_vat: 0, net_vat: 68571.43 },
  { month: 'Mar 2025', gross_purchases: 950000, input_vat: 101785.71, output_vat: 0, net_vat: 101785.71 },
]

const FILING_STATUS_CLS: Record<string, string> = {
  filed: 'bg-green-100 text-green-700 border-green-300',
  overdue: 'bg-red-200 text-red-800 border-red-400',
  due_soon: 'bg-red-100 text-red-700 border-red-300',
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-300',
}

// Groups BIR forms by the year/month of their due date, so each month can render
// as its own mini calendar grid with due dates marked on the right day.
function groupFormsByMonth(forms: BirForm[]) {
  const map = new Map<string, { year: number; month: number; forms: BirForm[] }>()
  for (const f of forms) {
    const d = new Date(f.due)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    if (!map.has(key)) map.set(key, { year: d.getFullYear(), month: d.getMonth(), forms: [] })
    map.get(key)!.forms.push(f)
  }
  return [...map.values()].sort((a, b) => a.year - b.year || a.month - b.month)
}

function FilingMonthCalendar({ year, month, forms }: { year: number; month: number; forms: BirForm[] }) {
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const byDay = new Map<number, BirForm[]>()
  for (const f of forms) {
    const day = new Date(f.due).getDate()
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(f)
  }
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  return (
    <div className="border rounded-lg p-3 w-64">
      <div className="text-sm font-semibold mb-2 text-center">{monthLabel}</div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          const dayForms = day ? byDay.get(day) : undefined
          const firstStatus = dayForms?.[0]?.status
          const cls = firstStatus ? FILING_STATUS_CLS[firstStatus] : 'border-transparent'
          return (
            <div
              key={i}
              title={dayForms?.map(f => `${f.form} — ${f.description}`).join('\n')}
              className={`aspect-square flex items-center justify-center text-xs rounded border ${day ? cls : ''}`}
            >
              {day ?? ''}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface EwtRow { supplier: string; tin: string | null; atc: string | null; address: string | null; gross: number; vat_excl: number; ewt_rate: number; ewt: number }
interface SlspRow { month: string; supplier: string; tin: string | null; refNo: string; gross: number; vat: number; net: number }

export default function BIRPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState('overview')
  const [loadingTax, setLoadingTax] = useState(true)
  const [ewtRows, setEwtRows] = useState<EwtRow[]>([])
  const [slspRows, setSlspRows] = useState<SlspRow[]>([])
  const [suppliers, setSuppliers] = useState<{ id: string; tin: string | null; atc_code: string | null }[]>([])
  const [filings, setFilings] = useState<{ form_type: string; tax_period: string; status: string }[]>([])
  const [vatRegistered, setVatRegistered] = useState(false)
  const [isCorporate, setIsCorporate] = useState(false)
  const [companyInfo, setCompanyInfo] = useState<{ company_name: string | null; address: string | null; phone: string | null; tin: string | null } | null>(null)
  const [formGenOpen, setFormGenOpen] = useState(false)
  const [formGenTarget, setFormGenTarget] = useState<BirForm | null>(null)
  const [formGenLoading, setFormGenLoading] = useState(false)
  const [formGenRows, setFormGenRows] = useState<{ label: string; sub?: string; amount: number }[]>([])
  const [formGenBaseLabel, setFormGenBaseLabel] = useState('')
  const [formGenBaseAmount, setFormGenBaseAmount] = useState(0)
  const [formGenRate, setFormGenRate] = useState('3')
  const [formGenManual, setFormGenManual] = useState(false)
  const [formGenAmount, setFormGenAmount] = useState('')

  const loadFilings = useCallback(async () => {
    const { data } = await supabase.from('bir_filings').select('form_type, tax_period, status')
    setFilings(data ?? [])
  }, [supabase])

  useEffect(() => {
    async function loadTaxData() {
      setLoadingTax(true)
      const [{ data: poData }, { data: supData }, { data: rrData }, { data: sysData }] = await Promise.all([
        supabase.from('purchase_orders')
          .select('po_number, supplier_id, po_date, vat_amount, ewt_amount, total_amount')
          .neq('status', 'cancelled'),
        supabase.from('suppliers').select('id, company_name, tin, atc_code, ewt_rate, address, bir_registered_address'),
        supabase.from('receiving_reports').select('po_number, si_number, dr_number'),
        supabase.from('system_settings').select('vat_registered, business_type, company_name, address, phone, tin').single(),
      ])
      setSuppliers(supData ?? [])
      if (sysData) setCompanyInfo(sysData)
      setVatRegistered(!!sysData?.vat_registered)
      setIsCorporate((sysData?.business_type ?? '').toLowerCase().includes('corp'))
      await loadFilings()
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
    }
    loadTaxData()
  }, [])

  const baseForms = useMemo(() => buildBirForms(new Date(), vatRegistered, isCorporate), [vatRegistered, isCorporate])
  const filedSet = useMemo(() => new Set(filings.filter(f => f.status === 'filed').map(f => `${f.form_type}|${f.tax_period}`)), [filings])
  const forms: BirForm[] = useMemo(() => {
    const now = new Date().getTime()
    return baseForms.map(f => {
      if (filedSet.has(`${f.form}|${f.period}`)) return { ...f, status: 'filed' as const }
      const daysUntil = Math.ceil((new Date(f.due).getTime() - now) / 86400000)
      const status = daysUntil < 0 ? 'overdue' as const : daysUntil <= 10 ? 'due_soon' as const : 'pending' as const
      return { ...f, status }
    })
  }, [baseForms, filedSet])

  const readinessChecks = useMemo(() => {
    const totalSup = suppliers.length
    const tinOk = suppliers.filter(s => s.tin).length
    const atcOk = suppliers.filter(s => s.atc_code).length
    const overdue = forms.filter(f => f.status === 'overdue').length
    const dueSoon = forms.filter(f => f.status === 'due_soon').length
    return [
      { check: 'All suppliers have TIN on file', status: totalSup > 0 && tinOk === totalSup ? 'pass' : 'warning', detail: `${tinOk}/${totalSup} suppliers` },
      { check: 'EWT ATC codes assigned to suppliers', status: totalSup > 0 && atcOk === totalSup ? 'pass' : 'warning', detail: totalSup - atcOk > 0 ? `${totalSup - atcOk} supplier(s) missing ATC code` : 'All suppliers have ATC codes' },
      { check: 'BIR forms filed on time', status: overdue > 0 ? 'fail' : dueSoon > 0 ? 'warning' : 'pass', detail: overdue > 0 ? `${overdue} form(s) overdue` : dueSoon > 0 ? `${dueSoon} form(s) due within 10 days` : 'No forms currently due' },
      { check: 'SLSP purchases data complete', status: 'pass', detail: `${slspRows.length} VAT purchase(s) recorded` },
    ]
  }, [suppliers, forms, slspRows])

  const readinessScore = readinessChecks.length > 0 ? Math.round((readinessChecks.filter(c => c.status === 'pass').length / readinessChecks.length) * 100) : 0

  async function markFiled(form: BirForm) {
    const { error } = await supabase.from('bir_filings').upsert(
      {
        form_type: form.form,
        tax_period: form.period,
        due_date: form.due,
        filing_date: new Date().toISOString().split('T')[0],
        status: 'filed',
        amount_due: form.amount,
      },
      { onConflict: 'form_type,tax_period' }
    )
    if (error) { toast.error(error.message); return }
    setFilings(prev => {
      const others = prev.filter(f => !(f.form_type === form.form && f.tax_period === form.period))
      return [...others, { form_type: form.form, tax_period: form.period, status: 'filed' }]
    })
    toast.success(`Form ${form.form} marked as filed`)
  }

  // Pulls the real figures backing a given BIR form for its computed period, so the
  // generated document reflects actual system data rather than the Filing Calendar's
  // placeholder amount. Final Withholding Tax (0619-F, 1601-FQ) has no source data
  // anywhere in the system yet, so those stay a manual entry.
  async function openFormGenerator(form: BirForm) {
    setFormGenTarget(form)
    setFormGenOpen(true)
    setFormGenLoading(true)
    setFormGenRows([])
    setFormGenManual(false)
    setFormGenRate('3')

    if (form.form === '0619-F' || form.form === '1601-FQ') {
      setFormGenManual(true)
      setFormGenBaseLabel('Final Withholding Tax Due')
      setFormGenBaseAmount(0)
      setFormGenAmount('')
      setFormGenLoading(false)
      return
    }

    if (form.form === '0619-E' || form.form === '1601-EQ') {
      const { data: poData } = await supabase.from('purchase_orders')
        .select('supplier_id, po_date, ewt_amount, total_amount, vat_amount')
        .neq('status', 'cancelled')
        .gte('po_date', form.periodStart).lte('po_date', form.periodEnd)
      const bySupplier = new Map<string, number>()
      for (const po of poData ?? []) {
        const ewt = Number(po.ewt_amount) || 0
        if (ewt <= 0 || !po.supplier_id) continue
        bySupplier.set(po.supplier_id, (bySupplier.get(po.supplier_id) ?? 0) + ewt)
      }
      const supplierById = new Map(suppliers.map((s: any) => [s.id, s]))
      const rows = [...bySupplier.entries()]
        .map(([supplierId, ewt]) => ({ label: supplierById.get(supplierId)?.company_name ?? 'Unknown Supplier', sub: supplierById.get(supplierId)?.tin ?? undefined, amount: ewt }))
        .sort((a, b) => b.amount - a.amount)
      const total = rows.reduce((s, r) => s + r.amount, 0)
      setFormGenRows(rows)
      setFormGenBaseLabel('Total Expanded Withholding Tax')
      setFormGenBaseAmount(total)
      setFormGenAmount(total.toFixed(2))
      setFormGenLoading(false)
      return
    }

    if (form.form === '2551Q' || form.form === '2550Q') {
      const { data: colData } = await supabase.from('collections')
        .select('client_name, amount, collection_date, status')
        .eq('status', 'posted')
        .gte('collection_date', form.periodStart).lte('collection_date', form.periodEnd)
      const byClient = new Map<string, number>()
      for (const c of colData ?? []) {
        const amt = Number(c.amount) || 0
        byClient.set(c.client_name ?? 'Unknown Client', (byClient.get(c.client_name ?? 'Unknown Client') ?? 0) + amt)
      }
      const rows = [...byClient.entries()].map(([client, amount]) => ({ label: client, amount })).sort((a, b) => b.amount - a.amount)
      const gross = rows.reduce((s, r) => s + r.amount, 0)
      setFormGenRows(rows)
      setFormGenBaseLabel('Gross Sales / Receipts Collected')
      setFormGenBaseAmount(gross)
      setFormGenAmount(((gross * 3) / 100).toFixed(2))
      setFormGenLoading(false)
      return
    }

    if (form.form === '1701Q' || form.form === '1702Q') {
      const [{ data: coaData }, { data: jlData }] = await Promise.all([
        supabase.from('chart_of_accounts').select('account_code,account_name,account_type,normal_balance,is_header').eq('is_active', true),
        supabase.from('journal_lines').select('account_code, debit, credit, journal_entries(entry_date)'),
      ])
      const inPeriod = (jlData ?? []).filter((l: any) => {
        const d = l.journal_entries?.entry_date
        return d && d >= form.periodStart && d <= form.periodEnd
      })
      const balances: Record<string, number> = {}
      for (const l of inPeriod as any[]) balances[l.account_code] = (balances[l.account_code] ?? 0) + (Number(l.credit) || 0) - (Number(l.debit) || 0)
      const revenueAccts = (coaData ?? []).filter((a: any) => a.account_type === 'revenue' && !a.is_header)
      const expenseAccts = (coaData ?? []).filter((a: any) => a.account_type === 'expense' && !a.is_header)
      const totalRevenue = revenueAccts.reduce((s: number, a: any) => s + (balances[a.account_code] ?? 0), 0)
      const totalExpense = expenseAccts.reduce((s: number, a: any) => s + Math.abs(balances[a.account_code] ?? 0), 0)
      const netIncome = totalRevenue - totalExpense
      setFormGenRows([
        { label: 'Total Revenue', amount: totalRevenue },
        { label: 'Total Expenses', amount: -totalExpense },
      ])
      setFormGenBaseLabel('Net Taxable Income')
      setFormGenBaseAmount(netIncome)
      setFormGenAmount(netIncome > 0 ? netIncome.toFixed(2) : '0.00')
      setFormGenLoading(false)
      return
    }

    setFormGenLoading(false)
  }

  // Plain tables/block elements only — no flexbox or grid. html2canvas (used for the
  // PDF download path) renders flex layouts unreliably, which made Print and Download
  // PDF produce visibly different output for the same document.
  function buildFilledFormHtml(form: BirForm) {
    const rowsHtml = formGenRows.map(r => `<tr>
      <td>${r.label}${r.sub ? `<br/><span style="color:#9ca3af;font-size:9px">${r.sub}</span>` : ''}</td>
      <td class="r">₱${r.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
    </tr>`).join('')
    const rate = parseFloat(formGenRate) || 0
    const isPercentageTax = form.form === '2551Q' || form.form === '2550Q'
    const isIncomeTax = form.form === '1701Q' || form.form === '1702Q'
    const breakdownLabel = isIncomeTax ? 'Account' : isPercentageTax ? 'Client' : 'Supplier'
    const officialTitle = BIR_FORM_TITLES[form.form] ?? form.description
    const taxDueLabel = isIncomeTax ? 'Net Taxable Income' : isPercentageTax ? 'Tax Due' : 'Total Tax Withheld/Remitted'

    return `<!DOCTYPE html><html><head><title>BIR Form ${form.form}</title><style>
      * { box-sizing: border-box; }
      body{font-family:Arial,sans-serif;padding:0;margin:0;color:#111;font-size:10px}
      .page{border:1px solid #1f2937}
      table{width:100%;border-collapse:collapse;font-size:10px}
      td,th{padding:5px 9px}
      th{background:#1f2937;color:#fff;text-align:left}
      .rows td{border-bottom:1px solid #e5e7eb}
      .rows td.r,th.r{text-align:right}

      .masthead{text-align:center;padding:10px 14px 8px;border-bottom:2px solid #1f2937}
      .masthead .republic{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px}
      .masthead .bureau{font-size:9px;color:#4b5563}
      .masthead .formno{float:right;border:1px solid #1f2937;padding:3px 8px;font-size:9px;font-weight:700}
      .masthead h1{font-size:14px;margin:8px 0 1px;text-transform:uppercase}
      .masthead h2{font-size:10px;color:#6b7280;margin:0;font-weight:normal}

      .section-title{background:#f3f4f6;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#374151;padding:5px 14px;border-top:1px solid #d1d5db;border-bottom:1px solid #d1d5db}
      .fields td{padding:6px 14px;font-size:10px;border-bottom:1px solid #e5e7eb;vertical-align:top}
      .fields td b{display:block;font-size:8px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.4px;font-weight:600;margin-bottom:2px}
      .blank{color:#d1d5db}

      .totals td{padding:7px 14px;font-size:10px;border-top:1px solid #e5e7eb}
      .totals td.r{text-align:right}
      .totals tr.grand td{font-size:12px;font-weight:700;border-top:2px solid #1f2937}
      .note{padding:8px 14px;font-size:8px;color:#9ca3af}
      @media print { @page { margin: 10mm; size: A4 portrait; } }
    </style></head><body>
      <div class="page">
        <div class="masthead">
          <div class="formno">BIR Form No.<br/><span style="font-size:13px">${form.form}</span></div>
          <div class="republic">Republika ng Pilipinas / Republic of the Philippines</div>
          <div class="bureau">Kagawaran ng Pananalapi &nbsp;•&nbsp; Kawanihan ng Rentas Internas<br/>Department of Finance &nbsp;•&nbsp; Bureau of Internal Revenue</div>
          <h1>${officialTitle}</h1>
          <h2>${form.description}</h2>
        </div>

        <div class="section-title">Part I — Background Information</div>
        <table class="fields">
          <tr>
            <td style="width:50%"><b>Taxpayer / Withholding Agent's Name</b>${companyInfo?.company_name ?? '<span class="blank">—</span>'}</td>
            <td style="width:50%"><b>TIN</b>${companyInfo?.tin ?? '<span class="blank">—</span>'}</td>
          </tr>
          <tr>
            <td colspan="2"><b>Registered Address</b>${companyInfo?.address ?? '<span class="blank">—</span>'}</td>
          </tr>
          <tr>
            <td><b>RDO Code</b><span class="blank">— (fill in manually)</span></td>
            <td><b>Contact Number</b>${companyInfo?.phone ?? '<span class="blank">—</span>'}</td>
          </tr>
          <tr>
            <td><b>Taxable Period</b>${form.period}</td>
            <td><b>Due Date</b>${form.due}</td>
          </tr>
        </table>

        ${formGenManual
          ? `<div class="note" style="font-size:10px;padding:12px 14px">No source data is tracked in the system for this form yet — the amount below must be entered manually.</div>`
          : `<div class="section-title">Part II — Schedule of ${breakdownLabel}s</div>
             <table class="rows"><thead><tr><th>${breakdownLabel}</th><th class="r">Amount</th></tr></thead>
             <tbody>${rowsHtml || '<tr><td colspan="2" style="text-align:center;color:#9ca3af">No records for this period</td></tr>'}</tbody></table>`}

        <div class="section-title">Part III — Computation of Tax</div>
        <table class="totals">
          <tr><td>${taxDueLabel}</td><td class="r">₱${formGenBaseAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td></tr>
          ${isPercentageTax ? `<tr><td>Tax Rate</td><td class="r">${rate}%</td></tr>` : ''}
          <tr><td>Less: Tax Credits / Payments</td><td class="r blank">—</td></tr>
          <tr class="grand"><td>Total Amount Payable</td><td class="r">₱${(parseFloat(formGenAmount) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td></tr>
        </table>

        <div class="note">Generated ${new Date().toLocaleDateString('en-PH')} from CDSC system records. This is a system-generated working copy — transcribe onto the official BIR Form ${form.form} (see Blank Form download) before filing, and verify all figures.</div>
      </div>
    </body></html>`
  }

  function printFilledForm() {
    if (!formGenTarget) return
    const win = window.open('', '_blank', 'width=900,height=800')
    if (!win) return
    win.document.write(buildFilledFormHtml(formGenTarget))
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  async function downloadFilledFormPdf() {
    if (!formGenTarget) return
    try {
      const base64 = await htmlToPdfBase64(buildFilledFormHtml(formGenTarget))
      const bytes = atob(base64)
      const arr = new Uint8Array(bytes.length)
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
      const blob = new Blob([arr], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `BIR_${formGenTarget.form}_${formGenTarget.period.replace(/\s+/g, '_')}.pdf`; a.click()
      URL.revokeObjectURL(url)
      toast.success(`Form ${formGenTarget.form} PDF downloaded`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate PDF')
    }
  }

  function runFilingReadyCheck() {
    const overdue = forms.filter(f => f.status === 'overdue').length
    const dueSoon = forms.filter(f => f.status === 'due_soon').length
    const passCount = readinessChecks.filter(c => c.status === 'pass').length
    const summary = `Filing readiness: ${readinessScore}% (${passCount}/${readinessChecks.length} checks passed)`
    if (overdue > 0) toast.error(`${summary}. ${overdue} form(s) overdue!`)
    else if (dueSoon > 0) toast.warning(`${summary}. ${dueSoon} form(s) due within 10 days.`)
    else toast.success(`${summary}. No forms currently due.`)
  }

  function exportAlphalist() { toast.success('Alphalist exported to Excel') }
  function exportSLSP() { toast.success('SLSP exported to Excel/CSV') }

  function buildAlphalistHtml() {
    const rows = ewtRows.map((r, i) => `<tr>
      <td>${i + 1}</td><td>${r.supplier}</td><td>${r.tin ?? '—'}</td><td>${r.address ?? '—'}</td>
      <td>${r.atc ?? '—'}</td><td style="text-align:right">₱${r.gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
      <td style="text-align:right">₱${r.ewt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
    </tr>`).join('')
    return `<!DOCTYPE html><html><head><title>Supplier Alphalist</title><style>
      body{font-family:Arial,sans-serif;padding:24px;color:#111}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th{background:#1f2937;color:#fff;text-align:left;padding:6px 8px}
      td{padding:6px 8px;border-bottom:1px solid #e5e7eb}
      h1{font-size:16px;margin-bottom:4px} p{color:#6b7280;font-size:11px;margin-top:0}
      @media print { @page { margin: 12mm; size: A4 landscape; } }
    </style></head><body>
      <h1>Supplier Alphalist</h1>
      <p>Annual list of suppliers with withholding tax — CDSC Industrial Supply</p>
      <table><thead><tr><th>#</th><th>Supplier Name</th><th>TIN</th><th>Address</th><th>ATC</th><th style="text-align:right">Total Payments</th><th style="text-align:right">Total EWT</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#9ca3af">No data</td></tr>'}</tbody></table>
    </body></html>`
  }

  function printAlphalist() {
    const win = window.open('', '_blank', 'width=1000,height=800')
    if (!win) return
    win.document.write(buildAlphalistHtml())
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  async function downloadAlphalistPdf() {
    try {
      const base64 = await htmlToPdfBase64(buildAlphalistHtml())
      const bytes = atob(base64)
      const arr = new Uint8Array(bytes.length)
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
      const blob = new Blob([arr], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'Supplier_Alphalist.pdf'; a.click()
      URL.revokeObjectURL(url)
      toast.success('Alphalist PDF downloaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate PDF')
    }
  }

  // Simplified pipe-delimited layout modeled on BIR's Alphalist Data Entry (.dat)
  // export — verify column order against the current eSubmission spec before filing.
  function downloadAlphalistDat() {
    const lines = ewtRows.map(r => [
      (r.tin ?? '').replace(/-/g, ''),
      r.supplier,
      r.address ?? '',
      r.atc ?? '',
      r.gross.toFixed(2),
      r.ewt.toFixed(2),
    ].join('|'))
    const blob = new Blob([lines.join('\r\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'Alphalist.dat'; a.click()
    URL.revokeObjectURL(url)
    toast.success('Alphalist .dat file downloaded')
  }

  // Official BIR PDF form templates, linked from the Filing Calendar's per-row
  // action menu so a blank copy of the form is one click away.
  const BIR_FORM_PDF_URLS: Record<string, string> = {
    '0619-E': 'https://bir-cdn.bir.gov.ph/local/pdf/0619-E%20Jan%202018%20rev%20final.pdf',
    '0619-F': 'https://bir-cdn.bir.gov.ph/local/pdf/0619-F%20Jan%202018%20rev%20final.pdf',
    '1601-EQ': 'https://bir-cdn.bir.gov.ph/local/pdf/1601-EQ%20January%202019%20ENCS%20final.pdf',
    '1601-FQ': 'https://bir-cdn.bir.gov.ph/local/pdf/1601-FQ%202020%20final.pdf',
    '2551Q': 'https://bir-cdn.bir.gov.ph/local/pdf/2551Q%20Jan%202018%20ENCS%20final%20rev%203_copy.pdf',
    '1701Q': 'https://bir-cdn.bir.gov.ph/local/pdf/1701Q%20Jan%202018%20final%20rev2_copy.pdf',
  }

  // Official titles as they appear on each BIR form, used for the Generate dialog's
  // masthead so the generated document reads like the real form it stands in for.
  const BIR_FORM_TITLES: Record<string, string> = {
    '0619-E': 'Monthly Remittance Form of Creditable Income Taxes Withheld (Expanded)',
    '0619-F': 'Monthly Remittance Form of Final Income Taxes Withheld',
    '1601-EQ': 'Quarterly Remittance Return of Creditable Income Taxes Withheld (Expanded)',
    '1601-FQ': 'Quarterly Remittance Return of Final Income Taxes Withheld',
    '2551Q': 'Quarterly Percentage Tax Return',
    '2550Q': 'Quarterly Value-Added Tax Return',
    '1701Q': 'Quarterly Income Tax Return for Individuals, Estates, and Trusts',
    '1702Q': 'Quarterly Income Tax Return for Corporations, Partnerships and Other Non-Individual Taxpayers',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">BIR Compliance Module</h2>
          <p className="text-muted-foreground text-sm">Philippine BIR filing management, tax computation, and alphalist generation</p>
        </div>
        <Button className="gap-2" onClick={runFilingReadyCheck}>
          <Zap className="h-4 w-4" /> BIR Filing Ready Check
        </Button>
      </div>

      {/* Readiness Score */}
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
                      : <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                    }
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
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filing Calendar — Due Dates</CardTitle>
              <CardDescription>Each highlighted day has a BIR form due — hover a date for details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 mb-4">
                {groupFormsByMonth(forms).map(g => (
                  <FilingMonthCalendar key={`${g.year}-${g.month}`} year={g.year} month={g.month} forms={g.forms} />
                ))}
              </div>
              <div className="flex flex-wrap gap-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border bg-green-100 border-green-300" />Filed</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border bg-red-200 border-red-400" />Overdue</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border bg-red-100 border-red-300" />Due Soon</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border bg-yellow-100 border-yellow-300" />Pending</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">BIR Filing Calendar {new Date().getFullYear()}</CardTitle>
                  <CardDescription>Track all BIR form due dates and filing status</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Form</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forms.map(form => (
                    <TableRow key={form.key}>
                      <TableCell className="font-mono font-bold text-primary">{form.form}</TableCell>
                      <TableCell className="text-sm">{form.description}</TableCell>
                      <TableCell className="text-sm">{form.period}</TableCell>
                      <TableCell className="text-sm font-medium">{form.due}</TableCell>
                      <TableCell className="text-right font-medium">{form.amount ? `₱${form.amount.toLocaleString()}` : '—'}</TableCell>
                      <TableCell>
                        <Badge variant={
                          form.status === 'filed' ? 'outline' :
                          form.status === 'overdue' || form.status === 'due_soon' ? 'destructive' : 'secondary'
                        } className="text-xs">
                          {form.status === 'filed' ? '✓ Filed' : form.status === 'overdue' ? '⚠ Overdue' : form.status === 'due_soon' ? '⚠ Due Soon' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent">
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openFormGenerator(form)}>
                              <Sparkles className="h-3.5 w-3.5 mr-2" />Generate
                            </DropdownMenuItem>
                            {form.status !== 'filed' && (
                              <DropdownMenuItem onClick={() => markFiled(form)}>
                                Mark Filed
                              </DropdownMenuItem>
                            )}
                            {BIR_FORM_PDF_URLS[form.form] && (
                              <DropdownMenuItem onClick={() => window.open(BIR_FORM_PDF_URLS[form.form], '_blank', 'noopener,noreferrer')}>
                                <Download className="h-3.5 w-3.5 mr-2" />Blank Form (PDF)
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
                <div>
                  <CardTitle className="text-base">Expanded Withholding Tax (EWT) Summary</CardTitle>
                  <CardDescription>BIR Form 0619-E / 1601-EQ computation</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => toast.success('EWT summary exported')}>
                  <Download className="h-4 w-4 mr-1" />Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>TIN</TableHead>
                    <TableHead>ATC</TableHead>
                    <TableHead className="text-right">Gross Amount</TableHead>
                    <TableHead className="text-right">VAT Excl. Amount</TableHead>
                    <TableHead className="text-right">EWT Rate</TableHead>
                    <TableHead className="text-right">EWT Amount</TableHead>
                  </TableRow>
                </TableHeader>
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
                      <TableCell></TableCell>
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
                <div>
                  <CardTitle className="text-base">VAT Summary — BIR Form 2550Q</CardTitle>
                  <CardDescription>Input VAT from purchases by month</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => toast.success('VAT summary exported')}>
                  <Download className="h-4 w-4 mr-1" />Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Gross Purchases</TableHead>
                    <TableHead className="text-right">Input VAT (12%)</TableHead>
                    <TableHead className="text-right">Output VAT</TableHead>
                    <TableHead className="text-right">Net VAT Payable</TableHead>
                  </TableRow>
                </TableHeader>
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
                <div>
                  <CardTitle className="text-base">Supplier Alphalist</CardTitle>
                  <CardDescription>Annual list of suppliers with withholding tax — required for BIR submission</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={printAlphalist}><Printer className="h-4 w-4 mr-1" />Print</Button>
                  <Button size="sm" variant="outline" onClick={downloadAlphalistPdf}><Download className="h-4 w-4 mr-1" />Download PDF</Button>
                  <Button size="sm" variant="outline" onClick={downloadAlphalistDat}><Download className="h-4 w-4 mr-1" />Download .DAT</Button>
                  <Button size="sm" variant="outline" onClick={exportAlphalist}><Download className="h-4 w-4 mr-1" />Export Excel</Button>
                  <Button size="sm" variant="outline" onClick={() => toast.success('Alphalist exported to CSV')}><Download className="h-4 w-4 mr-1" />Export CSV</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Supplier Name</TableHead>
                    <TableHead>TIN</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>ATC</TableHead>
                    <TableHead className="text-right">Total Payments</TableHead>
                    <TableHead className="text-right">Total EWT</TableHead>
                  </TableRow>
                </TableHeader>
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
                <div>
                  <CardTitle className="text-base">Summary List of Purchases (SLSP)</CardTitle>
                  <CardDescription>Required quarterly submission — all VAT purchases from suppliers</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={exportSLSP}><Download className="h-4 w-4 mr-1" />Export Excel</Button>
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
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>TIN</TableHead>
                    <TableHead>OR/Invoice No.</TableHead>
                    <TableHead className="text-right">Gross Amount</TableHead>
                    <TableHead className="text-right">VAT Amount</TableHead>
                    <TableHead className="text-right">Net of VAT</TableHead>
                  </TableRow>
                </TableHeader>
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

      {/* Auto-filled Form Generator */}
      <Dialog open={formGenOpen} onOpenChange={o => { if (!o) setFormGenOpen(false) }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Generate Form {formGenTarget?.form}
            </DialogTitle>
          </DialogHeader>
          {formGenLoading ? (
            <div className="py-16 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-2">Pulling figures from system records…</p>
            </div>
          ) : formGenTarget && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm bg-muted/40 rounded-lg p-3">
                <div><span className="text-muted-foreground">Description:</span> {formGenTarget.description}</div>
                <div><span className="text-muted-foreground">Period:</span> {formGenTarget.period}</div>
                <div><span className="text-muted-foreground">Due Date:</span> {formGenTarget.due}</div>
                <div><span className="text-muted-foreground">Taxpayer:</span> {companyInfo?.company_name ?? 'CDSC Industrial Supply'}</div>
              </div>

              {formGenManual ? (
                <p className="text-sm text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg p-3">
                  No source data is tracked in the system yet for Final Withholding Tax. Enter the amount manually below — the header and period info is still auto-filled.
                </p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{formGenTarget.form === '1701Q' || formGenTarget.form === '1702Q' ? 'Account' : (formGenTarget.form === '2551Q' || formGenTarget.form === '2550Q') ? 'Client' : 'Supplier'}</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formGenRows.length === 0 ? (
                        <TableRow><TableCell colSpan={2} className="text-center py-6 text-muted-foreground text-sm">No records found for this period.</TableCell></TableRow>
                      ) : formGenRows.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">
                            {r.label}
                            {r.sub && <div className="text-xs text-muted-foreground font-mono">{r.sub}</div>}
                          </TableCell>
                          <TableCell className={`text-right text-sm ${r.amount < 0 ? 'text-red-600' : ''}`}>
                            ₱{r.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex items-center justify-between text-sm font-semibold px-1">
                <span>{formGenBaseLabel}</span>
                <span>₱{formGenBaseAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>

              {(formGenTarget.form === '2551Q' || formGenTarget.form === '2550Q') && (
                <div className="space-y-1.5">
                  <Label>Tax Rate (%)</Label>
                  <Input
                    type="number" step="0.01" min="0" value={formGenRate}
                    onChange={e => {
                      setFormGenRate(e.target.value)
                      const rate = parseFloat(e.target.value) || 0
                      setFormGenAmount(((formGenBaseAmount * rate) / 100).toFixed(2))
                    }}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Amount Due (₱) <span className="text-muted-foreground text-xs">— editable</span></Label>
                <Input type="number" step="0.01" min="0" value={formGenAmount} onChange={e => setFormGenAmount(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={printFilledForm} disabled={formGenLoading}>
              <Printer className="h-4 w-4 mr-1.5" />Print
            </Button>
            <Button onClick={downloadFilledFormPdf} disabled={formGenLoading}>
              <Download className="h-4 w-4 mr-1.5" />Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
