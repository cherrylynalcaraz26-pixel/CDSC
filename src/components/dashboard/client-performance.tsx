'use client'

// Dashboard → Client Performance. One year and one client filter drive two charts:
//   1. CSI vs DR — delivery receipts issued vs sales invoices issued. With "All
//      clients" it is one pair of bars per client; with a client picked it is
//      month by month for that client. "Not yet invoiced" counts DRs that no
//      CSI references, which is the number that needs follow-up.
//   2. Sales — confirmed sales orders. Per client for the year, or month by
//      month for the picked client.
// Cancelled DRs and cancelled SIs are never counted.

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { parseDrNumbers } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList,
} from 'recharts'

const SERIES_1 = '#e5132a'
const SERIES_2 = '#2a78d6'
const GRID = '#ececea'
const AXIS = '#6b6a66'
const axisProps = { stroke: AXIS, fontSize: 11, tickLine: false, axisLine: false } as const
const peso = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const norm = (s: string | null | undefined) => (s ?? '').trim()
const short = (s: string) => s.length > 18 ? s.slice(0, 17) + '…' : s

type So = { so_date: string | null; created_at: string; client_name: string | null; total_amount: number | null; status: string }
type Dr = { dr_number: string; dr_date: string | null; supplier_name: string | null; status: string }
type Csi = { si_number: string; si_date: string | null; client_name: string | null; dr_number: string | null; collection_status: string | null }

function Tip({ active, payload, label, money }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; money?: boolean }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg bg-background px-3 py-2 text-xs shadow-lg shadow-black/10">
      <div className="mb-1 font-semibold">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-medium tabular-nums">{money ? peso(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

const selectCls = 'h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:border-[#E8112D]/50'

export function ClientPerformance({ sos }: { sos: So[] }) {
  const supabase = createClient()
  const [drs, setDrs] = useState<Dr[]>([])
  const [csis, setCsis] = useState<Csi[]>([])
  const [year, setYear] = useState(() => String(new Date().getFullYear()))
  const [client, setClient] = useState('')

  useEffect(() => {
    let on = true
    Promise.all([
      fetchAllRows((f, t) => supabase.from('dr_logs').select('id, dr_number, dr_date, supplier_name, status').in('status', ['received', 'partial']).not('supplier_name', 'is', null).order('id').range(f, t)),
      fetchAllRows((f, t) => supabase.from('csi_records').select('id, si_number, si_date, client_name, dr_number, collection_status').or('collection_status.is.null,collection_status.neq.cancelled').not('client_name', 'is', null).order('id').range(f, t)),
    ]).then(([d, c]) => {
      if (!on) return
      setDrs(d as Dr[])
      // csi_records holds one row per line item; keep one row per SI.
      const seen = new Set<string>()
      setCsis((c as Csi[]).filter(r => !seen.has(r.si_number) && !!seen.add(r.si_number)))
    })
    return () => { on = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const confirmedSos = useMemo(() => sos.filter(s => s.status !== 'cancelled' && s.status !== 'draft'), [sos])

  const years = useMemo(() => {
    const ys = new Set<string>([String(new Date().getFullYear())])
    for (const s of confirmedSos) { const y = (s.so_date ?? s.created_at ?? '').slice(0, 4); if (y) ys.add(y) }
    for (const d of drs) { const y = (d.dr_date ?? '').slice(0, 4); if (y) ys.add(y) }
    for (const c of csis) { const y = (c.si_date ?? '').slice(0, 4); if (y) ys.add(y) }
    return [...ys].sort((a, b) => b.localeCompare(a))
  }, [confirmedSos, drs, csis])

  const clients = useMemo(() => {
    const m = new Map<string, string>()
    for (const n of [...confirmedSos.map(s => s.client_name), ...drs.map(d => d.supplier_name), ...csis.map(c => c.client_name)]) {
      const v = norm(n); if (v) m.set(v.toLowerCase(), v)
    }
    return [...m.values()].sort((a, b) => a.localeCompare(b))
  }, [confirmedSos, drs, csis])

  const inYear = (d: string | null | undefined) => (d ?? '').startsWith(year)
  const isClient = (n: string | null | undefined) => !client || norm(n).toLowerCase() === client.toLowerCase()

  // DR numbers that at least one (non-cancelled) SI references.
  const invoicedDrs = useMemo(() => {
    const s = new Set<string>()
    for (const c of csis) for (const dr of parseDrNumbers(c.dr_number)) s.add(dr.trim().toUpperCase())
    return s
  }, [csis])

  const csiVsDr = useMemo(() => {
    const yDrs = drs.filter(d => inYear(d.dr_date) && isClient(d.supplier_name))
    const yCsis = csis.filter(c => inYear(c.si_date) && isClient(c.client_name))
    const pending = (d: Dr) => !invoicedDrs.has(d.dr_number.trim().toUpperCase())
    if (client) {
      return MONTHS.map((label, i) => {
        const mk = `${year}-${String(i + 1).padStart(2, '0')}`
        const md = yDrs.filter(d => (d.dr_date ?? '').startsWith(mk))
        return { name: label, 'DR Issued': md.length, 'CSI Issued': yCsis.filter(c => (c.si_date ?? '').startsWith(mk)).length, 'Not yet invoiced': md.filter(pending).length }
      })
    }
    const m = new Map<string, { name: string; 'DR Issued': number; 'CSI Issued': number; 'Not yet invoiced': number }>()
    const slot = (n: string) => {
      const k = n.toLowerCase()
      if (!m.has(k)) m.set(k, { name: n, 'DR Issued': 0, 'CSI Issued': 0, 'Not yet invoiced': 0 })
      return m.get(k)!
    }
    for (const d of yDrs) { const r = slot(norm(d.supplier_name)); r['DR Issued']++; if (pending(d)) r['Not yet invoiced']++ }
    for (const c of yCsis) slot(norm(c.client_name))['CSI Issued']++
    return [...m.values()].sort((a, b) => (b['DR Issued'] + b['CSI Issued']) - (a['DR Issued'] + a['CSI Issued'])).slice(0, 10)
      .map(r => ({ ...r, name: short(r.name) }))
  }, [drs, csis, invoicedDrs, year, client]) // eslint-disable-line react-hooks/exhaustive-deps

  const sales = useMemo(() => {
    const rows = confirmedSos.filter(s => inYear(s.so_date ?? s.created_at) && isClient(s.client_name))
    if (client) {
      return MONTHS.map((label, i) => {
        const mk = `${year}-${String(i + 1).padStart(2, '0')}`
        return { name: label, Sales: rows.filter(s => (s.so_date ?? s.created_at ?? '').startsWith(mk)).reduce((t, s) => t + (Number(s.total_amount) || 0), 0) }
      })
    }
    const m = new Map<string, { name: string; Sales: number }>()
    for (const s of rows) {
      const n = norm(s.client_name) || 'Unknown'
      const k = n.toLowerCase()
      if (!m.has(k)) m.set(k, { name: n, Sales: 0 })
      m.get(k)!.Sales += Number(s.total_amount) || 0
    }
    return [...m.values()].sort((a, b) => b.Sales - a.Sales).slice(0, 10).map(r => ({ ...r, name: short(r.name) }))
  }, [confirmedSos, year, client]) // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => ({
    sales: sales.reduce((t, r) => t + r.Sales, 0),
    dr: csiVsDr.reduce((t, r) => t + r['DR Issued'], 0),
    csi: csiVsDr.reduce((t, r) => t + r['CSI Issued'], 0),
    pending: csiVsDr.reduce((t, r) => t + r['Not yet invoiced'], 0),
  }), [sales, csiVsDr])

  const scope = client || 'All clients'
  const empty = (n: number) => n === 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">Client Performance</CardTitle>
            <p className="text-xs text-muted-foreground">Sales and CSI vs DR for {scope}, {year}. Cancelled DRs and SIs are excluded.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Year" className={selectCls} value={year} onChange={e => setYear(e.target.value)}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select aria-label="Client" className={`${selectCls} max-w-56`} value={client} onChange={e => setClient(e.target.value)}>
              <option value="">All clients</option>
              {clients.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Sales', value: peso(totals.sales) },
            { label: 'DR issued', value: String(totals.dr) },
            { label: 'CSI issued', value: String(totals.csi) },
            { label: 'DR not yet invoiced', value: String(totals.pending), warn: totals.pending > 0 },
          ].map(t => (
            <div key={t.label} className="rounded-xl bg-muted/50 px-3 py-2">
              <div className={`text-base font-bold tabular-nums ${t.warn ? 'text-amber-600' : ''}`}>{t.value}</div>
              <div className="text-[11px] text-muted-foreground">{t.label}</div>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold">CSI vs DR {client ? 'by month' : 'by client'}</p>
          <div className="h-72">
            {empty(totals.dr + totals.csi) ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No DR or CSI for {scope} in {year}</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={csiVsDr} margin={{ top: 16, right: 8, bottom: client ? 0 : 40, left: 0 }} barGap={2} barCategoryGap="24%">
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="name" {...axisProps} interval={0} angle={client ? 0 : -30} textAnchor={client ? 'middle' : 'end'} height={client ? 24 : 56} />
                  <YAxis {...axisProps} width={32} allowDecimals={false} />
                  <Tooltip content={<Tip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                  <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingBottom: 4 }} />
                  <Bar dataKey="DR Issued" fill={SERIES_2} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="DR Issued" position="top" style={{ fontSize: 10, fill: AXIS }} formatter={(v: unknown) => Number(v) || ''} />
                  </Bar>
                  <Bar dataKey="CSI Issued" fill={SERIES_1} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="CSI Issued" position="top" style={{ fontSize: 10, fill: AXIS }} formatter={(v: unknown) => Number(v) || ''} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold">Sales {client ? 'by month' : 'by client'} (confirmed sales orders)</p>
          <div className="h-72">
            {empty(totals.sales) ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No sales for {scope} in {year}</div>
            ) : client ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sales} margin={{ top: 16, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="name" {...axisProps} />
                  <YAxis {...axisProps} width={96} tickFormatter={peso} />
                  <Tooltip content={<Tip money />} cursor={{ stroke: AXIS, strokeDasharray: '3 3' }} />
                  <Line type="monotone" dataKey="Sales" stroke={SERIES_1} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sales} layout="vertical" margin={{ top: 4, right: 72, bottom: 0, left: 0 }} barCategoryGap="28%">
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis type="number" {...axisProps} tickFormatter={peso} />
                  <YAxis type="category" dataKey="name" {...axisProps} width={130} />
                  <Tooltip content={<Tip money />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                  <Bar dataKey="Sales" fill={SERIES_1} radius={[0, 4, 4, 0]}>
                    <LabelList dataKey="Sales" position="right" formatter={(v: unknown) => peso(Number(v))} style={{ fontSize: 11, fill: AXIS }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
