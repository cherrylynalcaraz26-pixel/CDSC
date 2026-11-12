'use client'

// BIR Compliance Calendar & Filing Tracker — modelled on the CHEM app's
// ComplianceCalendar: KPI cards (overdue / due soon / next 30 days), a month grid
// with PH holidays and colour-coded deadlines, the month's agenda, and a detail
// dialog to mark a return filed with its reference no., amount and attachments.
// Deadlines come from src/lib/bir/compliance-calendar.ts; filings from bir_filings.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import {
  AlertTriangle, Clock, CalendarCheck, ChevronLeft, ChevronRight, Loader2, Paperclip, X, CheckCircle2, ListChecks,
} from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/error-message'
import { uploadFileToDrive } from '@/lib/upload-image'
import { holidaysBetween, holidayYearInfo, type PhHoliday } from '@/lib/ph-holidays'
import {
  obligationsForTaxYear, toISODate, DUE_SOON_DAYS, type BirDeadline, type DeadlineCategory, type TaxProfile,
} from '@/lib/bir/compliance-calendar'

type State = 'done' | 'overdue' | 'due-soon' | 'upcoming'
const STATE: Record<State, { chip: string; label: string; dot: string }> = {
  done:       { chip: 'bg-green-100 text-green-800',  label: 'Filed',    dot: 'bg-green-500' },
  overdue:    { chip: 'bg-red-100 text-red-800',      label: 'Overdue',  dot: 'bg-red-500' },
  'due-soon': { chip: 'bg-amber-100 text-amber-800',  label: 'Due soon', dot: 'bg-amber-500' },
  upcoming:   { chip: 'bg-orange-50 text-orange-800', label: 'Upcoming', dot: 'bg-orange-300' },
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const CATEGORIES: DeadlineCategory[] = ['VAT', 'Percentage Tax', 'Withholding', 'Income Tax', 'Annual Info', 'Books']

interface Attachment { url: string; name: string }
interface Filing {
  form_type: string; tax_period: string; status: string; is_amendment: boolean
  filing_date: string | null; amount_due: number | null; reference_no?: string | null
  attachment_url: string | null; attachments?: Attachment[] | null
}
interface Resolved extends BirDeadline { state: State; filing?: Filing; amount: number | null }

const fmtDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
const peso = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
const filesOf = (f?: Filing): Attachment[] => (f?.attachments?.length ? f.attachments : f?.attachment_url ? [{ url: f.attachment_url, name: 'Filed return' }] : [])

export function ComplianceCalendarView({
  applicable, profile, amountFor, onOpenApplicable, onChanged,
}: {
  applicable: string[]
  profile: TaxProfile
  amountFor: (form: string, start: string, end: string) => number | null
  onOpenApplicable: () => void
  onChanged?: () => void
}) {
  const supabase = createClient()
  const today = new Date()
  const todayISO = toISODate(today)
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [category, setCategory] = useState<'All' | DeadlineCategory>('All')
  const [filings, setFilings] = useState<Filing[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Resolved | null>(null)

  const loadFilings = useCallback(() => supabase.from('bir_filings').select('*').then(({ data, error }) => {
    if (error) toast.error(getErrorMessage(error))
    setFilings((data ?? []) as Filing[])
    setLoading(false)
  }), [supabase])
  useEffect(() => { loadFilings() }, [loadFilings])

  // All applicable deadlines from last year's returns through next year.
  const all: Resolved[] = useMemo(() => {
    const filed = new Map(filings.filter(f => !f.is_amendment).map(f => [`${f.form_type}|${f.tax_period}`, f]))
    const out: Resolved[] = []
    for (let y = today.getFullYear() - 2; y <= today.getFullYear() + 1; y++) {
      for (const d of obligationsForTaxYear(y, applicable, profile)) {
        if (!d.applicable) continue
        const filing = filed.get(d.key)
        const days = Math.ceil((new Date(d.due + 'T00:00:00').getTime() - new Date(todayISO + 'T00:00:00').getTime()) / 86400000)
        const state: State = filing?.status === 'filed' ? 'done' : days < 0 ? 'overdue' : days <= DUE_SOON_DAYS ? 'due-soon' : 'upcoming'
        out.push({ ...d, state, filing, amount: amountFor(d.form, d.periodStart, d.periodEnd) })
      }
    }
    return out.sort((a, b) => a.due.localeCompare(b.due) || a.form.localeCompare(b.form))
  }, [applicable, profile, filings, amountFor, todayISO]) // eslint-disable-line react-hooks/exhaustive-deps

  const visible = all.filter(d => category === 'All' || d.category === category)

  const summary = useMemo(() => {
    const in30 = toISODate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30))
    const lookback = toISODate(new Date(today.getFullYear(), today.getMonth() - 6, today.getDate()))
    return {
      overdue: visible.filter(d => d.state === 'overdue' && d.due >= lookback),
      dueSoon: visible.filter(d => d.state === 'due-soon'),
      next30: visible.filter(d => d.state !== 'done' && d.due >= todayISO && d.due <= in30),
    }
  }, [visible, todayISO]) // eslint-disable-line react-hooks/exhaustive-deps

  const monthStart = toISODate(new Date(year, month, 1))
  const monthEnd = toISODate(new Date(year, month + 1, 0))
  const monthItems = visible.filter(d => d.due >= monthStart && d.due <= monthEnd)
  const byDay = useMemo(() => {
    const m: Record<string, Resolved[]> = {}
    for (const d of monthItems) (m[d.due] ??= []).push(d)
    return m
  }, [monthItems])
  const holidays = useMemo(() => {
    const m: Record<string, PhHoliday[]> = {}
    for (const h of holidaysBetween(monthStart, monthEnd)) (m[h.date] ??= []).push(h)
    return m
  }, [monthStart, monthEnd])
  const yearInfo = holidayYearInfo(year)

  const firstDow = new Date(year, month, 1).getDay()
  const cells: (string | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => toISODate(new Date(year, month, i + 1))),
  ]
  while (cells.length % 7) cells.push(null)

  const nav = (delta: number) => {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear()); setMonth(d.getMonth())
  }
  const jumpTo = (d: Resolved) => {
    const dt = new Date(d.due + 'T00:00:00')
    setYear(dt.getFullYear()); setMonth(dt.getMonth()); setSelected(d)
  }

  if (loading) return <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Kpi icon={<AlertTriangle className="h-4 w-4" />} label="Overdue (last 6 months)" items={summary.overdue} tone="overdue" onPick={jumpTo} />
        <Kpi icon={<Clock className="h-4 w-4" />} label={`Due in the next ${DUE_SOON_DAYS} days`} items={summary.dueSoon} tone="due-soon" onPick={jumpTo} />
        <Kpi icon={<CalendarCheck className="h-4 w-4" />} label="Open in the next 30 days" items={summary.next30} tone="upcoming" onPick={jumpTo} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => nav(-1)} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
          <div className="min-w-[160px] text-center text-base font-bold">{MONTHS[month]} {year}</div>
          <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => nav(1)} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="h-9" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()) }}>Today</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={onOpenApplicable}>
            <ListChecks className="h-4 w-4" />Applicable Forms ({applicable.length})
          </Button>
          <Select value={category} onValueChange={v => setCategory((v ?? 'All') as typeof category)}>
            <SelectTrigger className="h-9 w-[170px]"><span className="text-sm">{category === 'All' ? 'All categories' : category}</span></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All categories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {(!yearInfo.proclaimed || !yearInfo.eidDeclared) && (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          {!yearInfo.proclaimed
            ? <>No holiday proclamation for {year} yet — holidays shown are <strong>estimated</strong>.</>
            : <>Eid&apos;l Fitr and Eid&apos;l Adha for {year} haven&apos;t been proclaimed yet.</>}
        </p>
      )}

      {/* Month grid */}
      <div className="overflow-x-auto">
        <div className="grid min-w-[680px] grid-cols-7 overflow-hidden rounded-xl bg-card shadow-md shadow-black/5">
          {DAYS.map(d => <div key={d} className="bg-foreground py-1.5 text-center text-[11px] font-bold text-background">{d}</div>)}
          {cells.map((iso, i) => {
            const items = iso ? byDay[iso] ?? [] : []
            const hols = iso ? holidays[iso] ?? [] : []
            const off = hols.find(h => h.type === 'regular' || h.type === 'special')
            const weekend = i % 7 === 0 || i % 7 === 6
            return (
              <div key={i} className={`min-h-[96px] p-1.5 ${!iso ? 'bg-muted/30' : off ? 'bg-red-50/60' : weekend ? 'bg-muted/20' : ''} ${i % 7 ? 'shadow-[inset_1px_0_0_rgba(0,0,0,0.04)]' : ''} shadow-[inset_0_1px_0_rgba(0,0,0,0.04)]`}>
                {iso && (
                  <>
                    <div className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${iso === todayISO ? 'bg-[#F84400] text-white' : off ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {Number(iso.slice(8))}
                    </div>
                    {hols.map(h => (
                      <div key={h.name} title={`${h.name}${h.estimated ? ' (estimated)' : ''}`}
                        className={`mb-0.5 text-[10px] font-semibold leading-tight ${h.type === 'regular' ? 'text-red-600' : h.type === 'special' ? 'text-purple-700' : 'text-muted-foreground'} ${h.estimated || h.type === 'local' ? 'italic' : ''}`}>
                        {h.name}{h.scope ? ` (${h.scope})` : ''}
                      </div>
                    ))}
                    <div className="flex flex-col gap-0.5">
                      {items.map(d => (
                        <button key={d.key} type="button" onClick={() => setSelected(d)} title={`${d.form} — ${d.title} (${d.period})`}
                          className={`truncate rounded px-1.5 py-0.5 text-left text-[10.5px] font-bold ${STATE[d.state].chip} hover:brightness-95`}>
                          {d.state === 'done' && '✓ '}{d.form} · {d.short}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {(Object.keys(STATE) as State[]).map(k => (
          <span key={k} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${STATE[k].dot}`} />{STATE[k].label}</span>
        ))}
        <span className="inline-flex items-center gap-1.5 font-medium text-red-600"><span className="h-2.5 w-2.5 rounded-sm bg-red-200" />Regular holiday</span>
        <span className="inline-flex items-center gap-1.5 font-medium text-purple-700"><span className="h-2.5 w-2.5 rounded-sm bg-purple-200" />Special non-working day</span>
      </div>

      {/* Agenda */}
      <div>
        <h3 className="mb-2 text-sm font-bold">Deadlines in {MONTHS[month]} {year}</h3>
        <Card><CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/60 text-left text-xs">
                <tr>{['Due Date', 'Form', 'Obligation', 'Period', 'Tax (computed)', 'Status', 'Reference', 'Files'].map(h => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {monthItems.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No deadlines this month for the selected category.</td></tr>
                ) : monthItems.map(d => (
                  <tr key={d.key} onClick={() => setSelected(d)} className="cursor-pointer hover:bg-muted/40">
                    <td className="px-3 py-2">
                      <div className="font-semibold">{fmtDate(d.due)}</div>
                      {d.due !== d.statutoryDate && <div className="text-[10px] text-muted-foreground">moved from {fmtDate(d.statutoryDate)} · {d.movedBecause.join(', ')}</div>}
                    </td>
                    <td className="px-3 py-2 font-mono font-bold">{d.form}</td>
                    <td className="px-3 py-2">{d.title}</td>
                    <td className="px-3 py-2">{d.period}</td>
                    <td className="px-3 py-2 tabular-nums">{d.amount != null ? peso(d.amount) : '—'}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATE[d.state].chip}`}>{STATE[d.state].label}</span></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{d.filing?.reference_no || '—'}</td>
                    <td className="px-3 py-2 text-xs">{filesOf(d.filing).length ? <span className="inline-flex items-center gap-1"><Paperclip className="h-3 w-3" />{filesOf(d.filing).length}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent></Card>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Deadlines assume a calendar-year {profile.isCorporate ? 'corporation' : 'sole proprietor'}, {profile.vatRegistered ? 'VAT-registered' : 'non-VAT'}, filing via eBIRForms.
          Due dates on a weekend, regular holiday or nationwide special non-working day roll to the next working day. Holidays follow the proclamations for 2025–2027; later years are estimated.
          Sudden declarations (e.g. typhoon suspensions) aren&apos;t included — verify against current BIR issuances before filing.
        </p>
      </div>

      <FilingDialog key={selected?.key ?? 'none'} deadline={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); loadFilings(); onChanged?.() }} />
    </div>
  )
}

function Kpi({ icon, label, items, tone, onPick }: { icon: React.ReactNode; label: string; items: Resolved[]; tone: State; onPick: (d: Resolved) => void }) {
  return (
    <Card><CardContent className="pb-4 pt-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${STATE[tone].chip}`}>{icon}</span>{label}
        <span className="ml-auto text-2xl font-bold tabular-nums">{items.length}</span>
      </div>
      <div className="mt-2 space-y-1">
        {items.slice(0, 4).map(d => (
          <button key={d.key} type="button" onClick={() => onPick(d)} className="flex w-full justify-between gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-muted">
            <span className="truncate"><b className="font-mono">{d.form}</b> · {d.period}</span>
            <span className="shrink-0 text-muted-foreground">{fmtDate(d.due)}</span>
          </button>
        ))}
        {items.length > 4 && <div className="px-1.5 text-xs text-muted-foreground">+{items.length - 4} more</div>}
        {items.length === 0 && <div className="px-1.5 text-xs text-muted-foreground">None 🎉</div>}
      </div>
    </CardContent></Card>
  )
}

function FilingDialog({ deadline, onClose, onSaved }: { deadline: Resolved | null; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  // Initialised from the opened deadline; the parent re-mounts this dialog (key) per deadline.
  const f0 = deadline?.filing
  const [filedOn, setFiledOn] = useState(f0?.filing_date ?? toISODate(new Date()))
  const [reference, setReference] = useState(f0?.reference_no ?? '')
  const [amount, setAmount] = useState(f0?.amount_due != null ? String(f0.amount_due) : deadline?.amount != null ? String(deadline.amount) : '')
  const [files, setFiles] = useState<Attachment[]>(filesOf(f0))
  const [amendment, setAmendment] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!deadline) return null
  const d = deadline

  async function upload(list: FileList | null) {
    if (!list?.length) return
    setUploading(true)
    try {
      const up = await Promise.all(Array.from(list).map(f => uploadFileToDrive(f, { folder: 'BIR Filings' })))
      setFiles(prev => [...prev, ...up])
    } catch (err) { toast.error(getErrorMessage(err, 'Upload failed')) }
    setUploading(false)
  }

  async function save(status: 'filed' | 'pending') {
    setSaving(true)
    const row: Record<string, unknown> = {
      form_type: d.form, tax_period: d.period, due_date: d.due, is_amendment: amendment,
      status, filing_date: status === 'filed' ? filedOn || null : null,
      amount_due: amount === '' ? null : Number(amount),
      attachment_url: files[0]?.url ?? null,
    }
    // Columns added by migration 039 — only sent when used, so filing still works before it's applied.
    if (reference.trim()) row.reference_no = reference.trim()
    if (files.length > 1) row.attachments = files
    const { error } = await supabase.from('bir_filings').upsert(row, { onConflict: 'form_type,tax_period,is_amendment' })
    setSaving(false)
    if (error) { toast.error(getErrorMessage(error, 'Could not save — has migration 039 been applied?')); return }
    toast.success(status === 'filed' ? `${d.form} ${d.period} marked filed` : `${d.form} ${d.period} reopened`)
    onSaved()
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent size="landscape" className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">{d.form}</span> · {d.period}
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATE[d.state].chip}`}>{STATE[d.state].label}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-xl bg-muted/40 p-4 text-sm">
            <Row label="Obligation" value={d.title} />
            <Row label="Covers" value={`${fmtDate(d.periodStart)} – ${fmtDate(d.periodEnd)}`} />
            <Row label="Due" value={<>{fmtDate(d.due)}{d.due !== d.statutoryDate && <span className="block text-xs text-muted-foreground">moved from {fmtDate(d.statutoryDate)} ({d.movedBecause.join(', ')})</span>}</>} />
            <Row label="Tax (computed)" value={d.amount != null ? peso(d.amount) : 'Not computable from the books'} />
            {d.note && <p className="pt-1 text-xs text-muted-foreground">{d.note}</p>}
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Date filed</Label><Input type="date" value={filedOn} onChange={e => setFiledOn(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Amount paid</Label><Input type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" /></div>
            </div>
            <div className="space-y-1.5"><Label>Reference / confirmation no.</Label><Input value={reference} onChange={e => setReference(e.target.value)} placeholder="eBIRForms / eFPS reference" /></div>
            <div className="space-y-1.5">
              <Label>Filed return &amp; proof of payment</Label>
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <span key={f.url} className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs">
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="max-w-[160px] truncate underline">{f.name}</a>
                    <button type="button" onClick={() => setFiles(x => x.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
                  </span>
                ))}
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-input px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}Add files
                  <input type="file" multiple className="hidden" onChange={e => { upload(e.target.files); e.target.value = '' }} />
                </label>
              </div>
            </div>
            {d.state === 'done' && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-[#F84400]" checked={amendment} onChange={e => setAmendment(e.target.checked)} />
                This is an amended return
              </label>
            )}
          </div>
        </div>
        <DialogFooter>
          {d.state === 'done' && !amendment && <Button variant="ghost" onClick={() => save('pending')} disabled={saving}>Mark not filed</Button>}
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => save('filed')} disabled={saving || uploading} className="gap-1.5 bg-[#F84400] hover:bg-[#e03d00]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {d.state === 'done' ? (amendment ? 'Save Amendment' : 'Update Filing') : 'Mark Filed'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex justify-between gap-3"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>
}
