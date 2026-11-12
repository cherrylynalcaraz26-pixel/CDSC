'use client'

// Dashboard — charts with minimal detail. Four headline numbers, then four charts:
// Sales vs Purchases, Cash In vs Cash Out, Top Clients, Orders by Status.
// Palette validated with the dataviz checker (orange #eb6834 / blue #2a78d6 pass
// lightness, chroma, CVD and contrast on the light surface). One y-axis per chart.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList,
} from 'recharts'

const SERIES_1 = '#eb6834' // orange — sales / cash in / sales orders
const SERIES_2 = '#2a78d6' // blue — purchases / cash out / purchase orders
const GRID = '#ececea'
const AXIS = '#6b6a66'

const peso = (n: number) => `₱${n.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`
const pesoShort = (n: number) => {
  const a = Math.abs(n)
  if (a >= 1_000_000) return `₱${(n / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`
  if (a >= 1_000) return `₱${(n / 1_000).toFixed(a >= 100_000 ? 0 : 1)}K`
  return `₱${Math.round(n)}`
}

interface Row { date: string | null; amount: number }

function lastMonths(n: number) {
  const out: { key: string; label: string }[] = []
  const d = new Date()
  d.setDate(1)
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push({ key: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`, label: m.toLocaleDateString('en-US', { month: 'short' }) })
  }
  return out
}

function byMonth(rows: Row[], keys: string[]) {
  const m = new Map(keys.map(k => [k, 0]))
  for (const r of rows) {
    const k = (r.date ?? '').slice(0, 7)
    if (m.has(k)) m.set(k, (m.get(k) ?? 0) + r.amount)
  }
  return m
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg bg-background px-3 py-2 text-xs shadow-lg shadow-black/10">
      <div className="mb-1 font-semibold">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-medium tabular-nums">{typeof p.value === 'number' && p.name !== 'Orders' && p.name !== 'Sales Orders' && p.name !== 'Purchase Orders' ? peso(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

function ChartCard({ title, subtitle, href, children }: { title: string; subtitle: string; href?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex items-baseline justify-between gap-2">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {href && <Link href={href} className="text-xs text-muted-foreground hover:text-foreground">Open →</Link>}
        </div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="h-64 pt-2">{children}</CardContent>
    </Card>
  )
}

const axisProps = { stroke: AXIS, fontSize: 11, tickLine: false, axisLine: false } as const

export default function DashboardPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [sos, setSos] = useState<{ so_date: string | null; created_at: string; client_name: string | null; total_amount: number | null; status: string }[]>([])
  const [pos, setPos] = useState<{ po_date: string | null; created_at: string; gross_amount: number | null; total_amount: number | null; status: string }[]>([])
  const [cashIn, setCashIn] = useState<Row[]>([])
  const [cashOut, setCashOut] = useState<Row[]>([])

  useEffect(() => {
    let active = true
    Promise.all([
      fetchAllRows((f, t) => supabase.from('sales_orders').select('so_date, created_at, client_name, total_amount, status').order('id').range(f, t)),
      fetchAllRows((f, t) => supabase.from('purchase_orders').select('*').order('id').range(f, t)),
      fetchAllRows((f, t) => supabase.from('collections').select('id, collection_date, amount, status').eq('status', 'posted').order('id').range(f, t)),
      fetchAllRows((f, t) => supabase.from('disbursements').select('id, disb_date, amount, status').eq('status', 'posted').order('id').range(f, t)),
    ]).then(([so, po, col, dis]) => {
      if (!active) return
      setSos(so as typeof sos)
      setPos(po as typeof pos)
      setCashIn((col as { collection_date: string | null; amount: number | null }[]).map(c => ({ date: c.collection_date, amount: Number(c.amount) || 0 })))
      setCashOut((dis as { disb_date: string | null; amount: number | null }[]).map(d => ({ date: d.disb_date, amount: Number(d.amount) || 0 })))
      setLoading(false)
    })
    return () => { active = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const months = useMemo(() => lastMonths(12), [])
  const keys = useMemo(() => months.map(m => m.key), [months])
  const thisMonth = keys[keys.length - 1]

  // Sales = sales orders that are real orders (not drafts awaiting review, not cancelled).
  const salesRows: Row[] = useMemo(() => sos
    .filter(s => s.status !== 'cancelled' && s.status !== 'draft')
    .map(s => ({ date: s.so_date ?? s.created_at, amount: Number(s.total_amount) || 0 })), [sos])
  const purchaseRows: Row[] = useMemo(() => pos
    .filter(p => p.status !== 'cancelled')
    .map(p => ({ date: p.po_date ?? p.created_at, amount: Number(p.gross_amount) || Number(p.total_amount) || 0 })), [pos])

  const salesVsPurchases = useMemo(() => {
    const s = byMonth(salesRows, keys), p = byMonth(purchaseRows, keys)
    return months.map(m => ({ month: m.label, Sales: s.get(m.key) ?? 0, Purchases: p.get(m.key) ?? 0 }))
  }, [salesRows, purchaseRows, months, keys])

  const cashFlow = useMemo(() => {
    const i = byMonth(cashIn, keys), o = byMonth(cashOut, keys)
    return months.map(m => ({ month: m.label, 'Cash In': i.get(m.key) ?? 0, 'Cash Out': o.get(m.key) ?? 0 }))
  }, [cashIn, cashOut, months, keys])

  const topClients = useMemo(() => {
    const since = keys[0]
    const m = new Map<string, number>()
    for (const s of sos) {
      if (s.status === 'cancelled' || s.status === 'draft') continue
      if ((s.so_date ?? s.created_at ?? '').slice(0, 7) < since) continue
      const name = (s.client_name ?? 'Unknown').trim() || 'Unknown'
      m.set(name, (m.get(name) ?? 0) + (Number(s.total_amount) || 0))
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, total]) => ({ name: name.length > 22 ? name.slice(0, 21) + '…' : name, Sales: total }))
  }, [sos, keys])

  const orderStatus = useMemo(() => {
    const soStage = (s: string) => s === 'draft' ? 'New' : s === 'delivered' ? 'Completed' : s === 'cancelled' ? null : 'In Progress'
    const poStage = (s: string) => s === 'open' ? 'New' : s === 'completed' ? 'Completed' : s === 'cancelled' ? null : 'In Progress'
    const stages = ['New', 'In Progress', 'Completed']
    return stages.map(st => ({
      stage: st,
      'Sales Orders': sos.filter(s => soStage(s.status) === st).length,
      'Purchase Orders': pos.filter(p => poStage(p.status) === st).length,
    }))
  }, [sos, pos])

  const sum = (rows: Row[]) => rows.filter(r => (r.date ?? '').startsWith(thisMonth)).reduce((s, r) => s + r.amount, 0)
  const tiles = [
    { label: 'Sales this month', value: peso(sum(salesRows)) },
    { label: 'Collected this month', value: peso(sum(cashIn)) },
    { label: 'Spent this month', value: peso(sum(cashOut)) },
    { label: 'Open orders', value: String(orderStatus.reduce((s, r) => s + (r.stage === 'Completed' ? 0 : r['Sales Orders'] + r['Purchase Orders']), 0)) },
  ]

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Last 12 months at a glance</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map(t => (
          <Card key={t.label}>
            <CardContent className="pb-4 pt-5">
              <div className="text-2xl font-bold tabular-nums">{t.value}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{t.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Sales vs Purchases" subtitle="Monthly, confirmed sales orders vs purchase orders" href="/sales-orders">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={salesVsPurchases} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} width={56} tickFormatter={pesoShort} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: AXIS, strokeDasharray: '3 3' }} />
              <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingBottom: 4 }} />
              <Line type="monotone" dataKey="Sales" stroke={SERIES_1} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
              <Line type="monotone" dataKey="Purchases" stroke={SERIES_2} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Cash In vs Cash Out" subtitle="Monthly, posted collections vs disbursements" href="/accounting?tab=collections">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cashFlow} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...axisProps} width={56} tickFormatter={pesoShort} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingBottom: 4 }} />
              <Bar dataKey="Cash In" fill={SERIES_1} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Cash Out" fill={SERIES_2} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 5 Clients" subtitle="Sales over the last 12 months" href="/clients">
          {topClients.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No sales yet</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topClients} layout="vertical" margin={{ top: 4, right: 64, bottom: 0, left: 0 }} barCategoryGap="30%">
                <CartesianGrid stroke={GRID} horizontal={false} />
                <XAxis type="number" {...axisProps} tickFormatter={pesoShort} />
                <YAxis type="category" dataKey="name" {...axisProps} width={150} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Bar dataKey="Sales" fill={SERIES_1} radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="Sales" position="right" formatter={(v: unknown) => pesoShort(Number(v))} style={{ fontSize: 11, fill: AXIS }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Orders by Status" subtitle="All sales and purchase orders, excluding cancelled" href="/purchase-orders">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={orderStatus} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barGap={2} barCategoryGap="32%">
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="stage" {...axisProps} />
              <YAxis {...axisProps} width={40} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Legend verticalAlign="top" align="right" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingBottom: 4 }} />
              <Bar dataKey="Sales Orders" fill={SERIES_1} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="Sales Orders" position="top" style={{ fontSize: 11, fill: AXIS }} />
              </Bar>
              <Bar dataKey="Purchase Orders" fill={SERIES_2} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="Purchase Orders" position="top" style={{ fontSize: 11, fill: AXIS }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
