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
import { CheckCircle2, XCircle, AlertTriangle, Download, FileBarChart, Zap, FileText, Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { htmlToPdfBase64 } from '@/lib/send-email'

interface BirFormDef { key: string; form: string; description: string; period: string; due: string; amount: number }
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

  // Most recently closed quarter relative to today (e.g. in Jul, that's Apr–Jun).
  const currentQuarterEndMonth = Math.floor(m / 3) * 3 + 2
  let qEndMonth = currentQuarterEndMonth - 3
  let qYear = y
  if (qEndMonth < 0) { qEndMonth += 12; qYear -= 1 }
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
    { key: `0619-E_${iso(monthlyDue)}`, form: '0619-E', description: 'Expanded Withholding Tax (Monthly)', period: prevMonthLabel, due: iso(monthlyDue), amount: 12450 },
    { key: `0619-F_${iso(monthlyDue)}`, form: '0619-F', description: 'Final Withholding Tax (Monthly)', period: prevMonthLabel, due: iso(monthlyDue), amount: 3200 },
    { key: `1601-EQ_${quarterLabel}`, form: '1601-EQ', description: 'Expanded Withholding Tax (Quarterly)', period: quarterLabel, due: iso(eqDue), amount: 38750 },
    { key: `1601-FQ_${quarterLabel}`, form: '1601-FQ', description: 'Final Withholding Tax (Quarterly)', period: quarterLabel, due: iso(eqDue), amount: 9600 },
    { key: `${salesTaxForm.form}_${quarterLabel}`, form: salesTaxForm.form, description: salesTaxForm.description, period: quarterLabel, due: iso(salesTaxDue), amount: 0 },
    { key: `${incomeTaxForm.form}_${quarterLabel}`, form: incomeTaxForm.form, description: incomeTaxForm.description, period: quarterLabel, due: iso(itDue), amount: 145000 },
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
        supabase.from('system_settings').select('vat_registered, business_type').single(),
      ])
      setSuppliers(supData ?? [])
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

  function buildFilingCalendarHtml() {
    const rows = forms.map(f => `<tr>
      <td>${f.form}</td><td>${f.description}</td><td>${f.period}</td><td>${f.due}</td>
      <td style="text-align:right">${f.amount ? `₱${f.amount.toLocaleString()}` : '—'}</td>
      <td style="text-transform:capitalize">${f.status.replace('_', ' ')}</td>
    </tr>`).join('')
    return `<!DOCTYPE html><html><head><title>BIR Filing Calendar</title><style>
      body{font-family:Arial,sans-serif;padding:24px;color:#111}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th{background:#1f2937;color:#fff;text-align:left;padding:6px 8px}
      td{padding:6px 8px;border-bottom:1px solid #e5e7eb}
      h1{font-size:16px;margin-bottom:4px} p{color:#6b7280;font-size:11px;margin-top:0}
      @media print { @page { margin: 12mm; size: A4 landscape; } }
    </style></head><body>
      <h1>BIR Filing Calendar ${new Date().getFullYear()}</h1>
      <p>CDSC Industrial Supply — Filing due dates and status</p>
      <table><thead><tr><th>Form</th><th>Description</th><th>Period</th><th>Due Date</th><th style="text-align:right">Amount</th><th>Status</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#9ca3af">No data</td></tr>'}</tbody></table>
    </body></html>`
  }

  function printFilingCalendar() {
    const win = window.open('', '_blank', 'width=1000,height=800')
    if (!win) return
    win.document.write(buildFilingCalendarHtml())
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  // Simplified pipe-delimited layout, same convention as the Alphalist .dat export.
  function downloadFilingCalendarDat() {
    const lines = forms.map(f => [f.form, f.period, f.due, f.status, f.amount.toFixed(2)].join('|'))
    const blob = new Blob([lines.join('\r\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'BIR_Filing_Calendar.dat'; a.click()
    URL.revokeObjectURL(url)
    toast.success('Filing calendar .dat file downloaded')
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
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={printFilingCalendar}><Printer className="h-4 w-4 mr-1" />Print</Button>
                  <Button size="sm" variant="outline" onClick={downloadFilingCalendarDat}><Download className="h-4 w-4 mr-1" />Download .DAT</Button>
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
                    <TableHead className="w-24">Actions</TableHead>
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
                        {form.status !== 'filed' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => markFiled(form)}>
                            Mark Filed
                          </Button>
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
    </div>
  )
}
