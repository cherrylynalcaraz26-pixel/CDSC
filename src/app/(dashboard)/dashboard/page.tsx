'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  Package, ShoppingCart, Truck, FileText, ClipboardList,
  TrendingUp, Cpu, Users, ArrowRight, Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

interface KPI {
  totalItems: number
  activeSuppliers: number
  openPOs: number
  pendingPRs: number
  drLogsThisMonth: number
  csiThisMonth: number
  totalAssets: number
  totalDRs: number
}

interface MonthBar { month: string; dr: number; csi: number }
interface RecentDR { id: string; dr_number: string | null; date: string | null; delivered_to: string | null; status: string }
interface RecentPR { id: string; pr_number: string | null; created_at: string; department: string | null; priority: string; status: string }

interface ORClientRow { client: string; collected: number; ewt: number; ors: number }
interface CSIClientRow { client: string; billed: number; invoices: number; items: number }
interface ReconRow { client: string; csi_billed: number; or_collected: number; diff: number; status: 'Balanced' | 'Outstanding' | 'Over-collected' }

const STATUS_COLORS: Record<string, string> = {
  open:       'bg-blue-100 text-blue-700',
  completed:  'bg-green-100 text-green-700',
  draft:      'bg-gray-100 text-gray-600',
  submitted:  'bg-blue-100 text-blue-700',
  dept_approved: 'bg-yellow-100 text-yellow-700',
  admin_approved: 'bg-orange-100 text-orange-700',
  purchasing_approved: 'bg-purple-100 text-purple-700',
  converted_to_po: 'bg-green-100 text-green-700',
  rejected:   'bg-red-100 text-red-700',
}

function StatCard({ title, value, icon: Icon, sub, color, href }: {
  title: string; value: string | number; icon: any; sub?: string; color?: string; href?: string
}) {
  const inner = (
    <Card className={href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color ?? 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

export default function DashboardPage() {
  const supabase = createClient()
  const [kpi, setKpi] = useState<KPI>({ totalItems: 0, activeSuppliers: 0, openPOs: 0, pendingPRs: 0, drLogsThisMonth: 0, csiThisMonth: 0, totalAssets: 0, totalDRs: 0 })
  const [monthlyData, setMonthlyData] = useState<MonthBar[]>([])
  const [recentDRs, setRecentDRs] = useState<RecentDR[]>([])
  const [recentPRs, setRecentPRs] = useState<RecentPR[]>([])
  const [orRows, setOrRows] = useState<ORClientRow[]>([])
  const [csiRows, setCsiRows] = useState<CSIClientRow[]>([])
  const [reconRows, setReconRows] = useState<ReconRow[]>([])
  const [orDetails, setOrDetails] = useState<Record<string, any[]>>({})
  const [csiDetails, setCsiDetails] = useState<Record<string, any[]>>({})
  const [detailModal, setDetailModal] = useState<{ type: 'or' | 'csi' | 'recon'; client: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const now = new Date()
      const thisMonthStart = startOfMonth(now).toISOString()
      const thisMonthEnd = endOfMonth(now).toISOString()

      // Build 6-month range for bar chart
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(now, 5 - i)
        return { label: format(d, 'MMM'), start: startOfMonth(d).toISOString(), end: endOfMonth(d).toISOString() }
      })

      const [items, suppliers, pos, prs, assets, drLogs, csiRecs, recentDRData, recentPRData, collectionData, csiDetailData] = await Promise.all([
        supabase.from('items').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('suppliers').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('purchase_orders').select('id, status', { count: 'exact' }),
        supabase.from('purchase_requests').select('id, status', { count: 'exact' }),
        supabase.from('assets').select('id', { count: 'exact', head: true }),
        supabase.from('dr_logs').select('id, date', { count: 'exact' }),
        supabase.from('csi_records').select('id, date', { count: 'exact' }),
        supabase.from('dr_logs').select('id, dr_number, date, delivered_to, status').order('date', { ascending: false }).limit(8),
        supabase.from('purchase_requests').select('id, pr_number, created_at, department, priority, status').order('created_at', { ascending: false }).limit(6),
        supabase.from('collections').select('client_name, or_number, amount, form_2307, status, date'),
        supabase.from('csi_records').select('client_name, si_number, item_name, quantity, unit_price, date'),
      ])

      const allPOs = pos.data ?? []
      const allPRs = prs.data ?? []
      const allDRs = drLogs.data ?? []
      const allCSI = csiRecs.data ?? []

      // Monthly bar chart data
      const bars: MonthBar[] = months.map(m => ({
        month: m.label,
        dr: allDRs.filter(d => d.date && d.date >= m.start.slice(0, 10) && d.date <= m.end.slice(0, 10)).length,
        csi: allCSI.filter(c => c.date && c.date >= m.start.slice(0, 10) && c.date <= m.end.slice(0, 10)).length,
      }))

      setKpi({
        totalItems: items.count ?? 0,
        activeSuppliers: suppliers.count ?? 0,
        openPOs: allPOs.filter(p => p.status === 'open').length,
        pendingPRs: allPRs.filter(p => ['submitted', 'dept_approved', 'admin_approved'].includes(p.status)).length,
        drLogsThisMonth: allDRs.filter(d => d.date && d.date >= thisMonthStart.slice(0, 10) && d.date <= thisMonthEnd.slice(0, 10)).length,
        csiThisMonth: allCSI.filter(c => c.date && c.date >= thisMonthStart.slice(0, 10) && c.date <= thisMonthEnd.slice(0, 10)).length,
        totalAssets: assets.count ?? 0,
        totalDRs: drLogs.count ?? 0,
      })

      // --- OR collections by client ---
      const orMap: Record<string, { collected: number; ewt: number; ors: number }> = {}
      const orDetailMap: Record<string, any[]> = {}
      for (const c of collectionData.data ?? []) {
        const name = c.client_name?.trim() || 'Unknown'
        if (!orMap[name]) orMap[name] = { collected: 0, ewt: 0, ors: 0 }
        orMap[name].collected += Number(c.amount) || 0
        orMap[name].ewt += Number(c.form_2307) || 0
        orMap[name].ors += 1
        if (!orDetailMap[name]) orDetailMap[name] = []
        orDetailMap[name].push(c)
      }
      const orSorted: ORClientRow[] = Object.entries(orMap)
        .map(([client, v]) => ({ client, ...v }))
        .sort((a, b) => b.collected - a.collected)
      setOrRows(orSorted)
      setOrDetails(orDetailMap)

      // --- CSI invoices by client ---
      const csiMap: Record<string, { billed: number; siNums: Set<string>; items: number }> = {}
      const csiDetailMap: Record<string, any[]> = {}
      for (const r of csiDetailData.data ?? []) {
        const name = r.client_name?.trim() || 'Unknown'
        if (!csiMap[name]) csiMap[name] = { billed: 0, siNums: new Set(), items: 0 }
        csiMap[name].billed += (Number(r.quantity) || 0) * (Number(r.unit_price) || 0)
        if (r.si_number) csiMap[name].siNums.add(r.si_number)
        csiMap[name].items += 1
        if (!csiDetailMap[name]) csiDetailMap[name] = []
        csiDetailMap[name].push(r)
      }
      const csiSorted: CSIClientRow[] = Object.entries(csiMap)
        .map(([client, v]) => ({ client, billed: v.billed, invoices: v.siNums.size, items: v.items }))
        .sort((a, b) => b.billed - a.billed)
      setCsiRows(csiSorted)
      setCsiDetails(csiDetailMap)

      // --- Reconciliation ---
      const allClients = new Set([...Object.keys(orMap), ...Object.keys(csiMap)])
      const recon: ReconRow[] = Array.from(allClients).map(client => {
        const csi = csiMap[client]?.billed ?? 0
        const or  = orMap[client]?.collected ?? 0
        const diff = csi - or
        const status: ReconRow['status'] =
          Math.abs(diff) < 0.01 ? 'Balanced' :
          diff > 0 ? 'Outstanding' : 'Over-collected'
        return { client, csi_billed: csi, or_collected: or, diff, status }
      }).sort((a, b) => b.csi_billed - a.csi_billed)
      setReconRows(recon)

      setMonthlyData(bars)
      setRecentDRs((recentDRData.data ?? []) as RecentDR[])
      setRecentPRs((recentPRData.data ?? []) as RecentPR[])
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground text-sm">{format(new Date(), 'EEEE, MMMM d, yyyy')} — Live overview</p>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatCard title="Items" value={loading ? '—' : kpi.totalItems.toLocaleString()} icon={Package} href="/items" />
        <StatCard title="Suppliers" value={loading ? '—' : kpi.activeSuppliers} icon={TrendingUp} href="/setup" />
        <StatCard title="Open POs" value={loading ? '—' : kpi.openPOs} icon={ShoppingCart} color="text-blue-600" href="/purchase-orders" sub="Awaiting delivery" />
        <StatCard title="Pending PRs" value={loading ? '—' : kpi.pendingPRs} icon={FileText} color="text-yellow-600" href="/purchase-requests" sub="In approval" />
        <StatCard title="DR Logs" value={loading ? '—' : kpi.totalDRs.toLocaleString()} icon={Truck} href="/dr-logs" sub="All time" />
        <StatCard title="DR This Month" value={loading ? '—' : kpi.drLogsThisMonth} icon={ClipboardList} color="text-green-600" href="/dr-logs" />
        <StatCard title="CSI This Month" value={loading ? '—' : kpi.csiThisMonth} icon={TrendingUp} color="text-purple-600" href="/csi-monitoring" />
        <StatCard title="Assets" value={loading ? '—' : kpi.totalAssets} icon={Cpu} href="/assets" />
      </div>

      {/* Charts + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Bar chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Monthly Activity (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.every(m => m.dr === 0 && m.csi === 0) ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-xs">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthlyData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="dr" name="DR Logs" fill="#dc2626" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="csi" name="CSI Records" fill="#f97316" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="flex gap-4 mt-2 justify-center text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-600 inline-block" />DR Logs</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-orange-500 inline-block" />CSI Records</span>
            </div>
          </CardContent>
        </Card>

        {/* Recent DRs */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Recent DR Logs</CardTitle>
            <Link href="/dr-logs">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
                View all <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">DR #</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Delivered To</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-xs">Loading…</td></tr>
                ) : recentDRs.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-xs">No DR logs yet</td></tr>
                ) : recentDRs.map(dr => (
                  <tr key={dr.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs font-semibold text-red-600">{dr.dr_number ?? '—'}</td>
                    <td className="px-4 py-2 text-xs max-w-[140px] truncate">{dr.delivered_to ?? '—'}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {dr.date ? format(new Date(dr.date), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[dr.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {dr.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Collections + CSI tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collections by Client */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Collections by Client (OR Log)</CardTitle>
            <span className="text-xs text-muted-foreground">Click row for details</span>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-red-600 text-white text-xs">
                  <th className="px-3 py-2 text-left w-8">#</th>
                  <th className="px-3 py-2 text-left">CLIENT</th>
                  <th className="px-3 py-2 text-right">COLLECTED</th>
                  <th className="px-3 py-2 text-right">EWT</th>
                  <th className="px-3 py-2 text-right">ORs</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-6 text-muted-foreground text-xs">Loading…</td></tr>
                ) : orRows.map((r, i) => (
                  <tr key={r.client} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => setDetailModal({ type: 'or', client: r.client })}>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 text-xs text-blue-600 font-medium">{r.client}</td>
                    <td className="px-3 py-2 text-xs text-right text-green-600 font-medium tabular-nums">
                      ₱{r.collected.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-xs text-right text-orange-500 tabular-nums">
                      ₱{r.ewt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-xs text-right">{r.ors}</td>
                  </tr>
                ))}
                {!loading && orRows.length > 0 && (
                  <tr className="border-t bg-muted/20 font-semibold text-xs">
                    <td colSpan={2} className="px-3 py-2 text-right">TOTAL</td>
                    <td className="px-3 py-2 text-right text-green-600 tabular-nums">
                      ₱{orRows.reduce((s, r) => s + r.collected, 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-right text-orange-500 tabular-nums">
                      ₱{orRows.reduce((s, r) => s + r.ewt, 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-right">{orRows.reduce((s, r) => s + r.ors, 0)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* CSI Invoices by Client */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">CSI Invoices by Client</CardTitle>
            <span className="text-xs text-muted-foreground">Click row for details</span>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-red-600 text-white text-xs">
                  <th className="px-3 py-2 text-left w-8">#</th>
                  <th className="px-3 py-2 text-left">CLIENT</th>
                  <th className="px-3 py-2 text-right">BILLED</th>
                  <th className="px-3 py-2 text-right">INVOICES</th>
                  <th className="px-3 py-2 text-right">ITEMS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-6 text-muted-foreground text-xs">Loading…</td></tr>
                ) : csiRows.map((r, i) => (
                  <tr key={r.client} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => setDetailModal({ type: 'csi', client: r.client })}>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 text-xs font-medium">{r.client}</td>
                    <td className="px-3 py-2 text-xs text-right text-blue-600 font-medium tabular-nums">
                      ₱{r.billed.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-xs text-right">{r.invoices}</td>
                    <td className="px-3 py-2 text-xs text-right">{r.items}</td>
                  </tr>
                ))}
                {!loading && csiRows.length > 0 && (
                  <tr className="border-t bg-muted/20 font-semibold text-xs">
                    <td colSpan={2} className="px-3 py-2 text-right">TOTAL</td>
                    <td className="px-3 py-2 text-right text-blue-600 tabular-nums">
                      ₱{csiRows.reduce((s, r) => s + r.billed, 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-right">{csiRows.reduce((s, r) => s + r.invoices, 0)}</td>
                    <td className="px-3 py-2 text-right">{csiRows.reduce((s, r) => s + r.items, 0)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* CSI vs OR Reconciliation */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">CSI vs OR Reconciliation by Client</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-red-600 text-white text-xs">
                <th className="px-3 py-2 text-left w-8">#</th>
                <th className="px-3 py-2 text-left">CLIENT</th>
                <th className="px-3 py-2 text-right">CSI BILLED</th>
                <th className="px-3 py-2 text-right">OR COLLECTED</th>
                <th className="px-3 py-2 text-right">DIFFERENCE</th>
                <th className="px-3 py-2 text-left">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-6 text-muted-foreground text-xs">Loading…</td></tr>
              ) : reconRows.map((r, i) => (
                <tr key={r.client} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => setDetailModal({ type: 'recon', client: r.client })}>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 text-xs font-medium">{r.client}</td>
                  <td className="px-3 py-2 text-xs text-right text-blue-600 tabular-nums">
                    ₱{r.csi_billed.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-xs text-right text-green-600 tabular-nums">
                    ₱{r.or_collected.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className={`px-3 py-2 text-xs text-right tabular-nums font-medium ${r.diff > 0 ? 'text-orange-600' : r.diff < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                    {r.diff > 0 ? '+' : ''}₱{r.diff.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.status === 'Balanced' ? 'bg-green-100 text-green-700' :
                      r.status === 'Outstanding' ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!detailModal} onOpenChange={() => setDetailModal(null)}>
        <DialogContent className="w-[95vw] max-w-4xl sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {detailModal?.type === 'or' && `Collections — ${detailModal.client}`}
              {detailModal?.type === 'csi' && `CSI Invoices — ${detailModal.client}`}
              {detailModal?.type === 'recon' && `Reconciliation — ${detailModal.client}`}
            </DialogTitle>
          </DialogHeader>
          {detailModal?.type === 'or' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-red-600 text-white text-xs">
                    <th className="px-3 py-2 text-left">OR Number</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-right">EWT (2307)</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(orDetails[detailModal.client] ?? []).map((r, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs text-red-600">{r.or_number ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{r.date ? format(new Date(r.date), 'MMM d, yyyy') : '—'}</td>
                      <td className="px-3 py-2 text-xs text-right text-green-600 tabular-nums font-medium">₱{(Number(r.amount) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-xs text-right text-orange-500 tabular-nums">₱{(Number(r.form_2307) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-xs">{r.status ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {detailModal?.type === 'csi' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-red-600 text-white text-xs">
                    <th className="px-3 py-2 text-left">SI Number</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Item</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Unit Price</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(csiDetails[detailModal.client] ?? []).map((r, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs text-red-600">{r.si_number ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{r.date ? format(new Date(r.date), 'MMM d, yyyy') : '—'}</td>
                      <td className="px-3 py-2 text-xs">{r.item_name ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-right tabular-nums">{Number(r.quantity) || 0}</td>
                      <td className="px-3 py-2 text-xs text-right tabular-nums">₱{(Number(r.unit_price) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-xs text-right text-blue-600 tabular-nums font-medium">₱{((Number(r.quantity) || 0) * (Number(r.unit_price) || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {detailModal?.type === 'recon' && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1 mb-2">OR Collections</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-green-700 text-white text-xs">
                      <th className="px-3 py-2 text-left">OR Number</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-right">EWT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(orDetails[detailModal.client] ?? []).length === 0
                      ? <tr><td colSpan={4} className="px-3 py-3 text-xs text-muted-foreground text-center">No OR records</td></tr>
                      : (orDetails[detailModal.client] ?? []).map((r, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-3 py-1.5 font-mono text-xs text-red-600">{r.or_number ?? '—'}</td>
                          <td className="px-3 py-1.5 text-xs text-muted-foreground">{r.date ? format(new Date(r.date), 'MMM d, yyyy') : '—'}</td>
                          <td className="px-3 py-1.5 text-xs text-right text-green-600 tabular-nums">₱{(Number(r.amount) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                          <td className="px-3 py-1.5 text-xs text-right text-orange-500 tabular-nums">₱{(Number(r.form_2307) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1 mb-2">CSI Invoices</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-700 text-white text-xs">
                      <th className="px-3 py-2 text-left">SI Number</th>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(csiDetails[detailModal.client] ?? []).length === 0
                      ? <tr><td colSpan={4} className="px-3 py-3 text-xs text-muted-foreground text-center">No CSI records</td></tr>
                      : (csiDetails[detailModal.client] ?? []).map((r, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-3 py-1.5 font-mono text-xs text-red-600">{r.si_number ?? '—'}</td>
                          <td className="px-3 py-1.5 text-xs">{r.item_name ?? '—'}</td>
                          <td className="px-3 py-1.5 text-xs text-right tabular-nums">{Number(r.quantity) || 0}</td>
                          <td className="px-3 py-1.5 text-xs text-right text-blue-600 tabular-nums">₱{((Number(r.quantity) || 0) * (Number(r.unit_price) || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Recent PRs + Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Recent PRs */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Recent Purchase Requests</CardTitle>
            <Link href="/purchase-requests">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
                View all <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">PR #</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Department</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Priority</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-xs">Loading…</td></tr>
                ) : recentPRs.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-xs">No purchase requests yet</td></tr>
                ) : recentPRs.map(pr => (
                  <tr key={pr.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs font-semibold text-red-600">{pr.pr_number ?? '—'}</td>
                    <td className="px-4 py-2 text-xs">{pr.department ?? '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pr.priority === 'urgent' ? 'bg-red-100 text-red-700' : pr.priority === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                        {pr.priority}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[pr.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {pr.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: 'New Purchase Request', href: '/purchase-requests', icon: FileText, color: 'text-blue-600' },
              { label: 'Create Purchase Order', href: '/purchase-orders', icon: ShoppingCart, color: 'text-green-600' },
              { label: 'Add DR Log', href: '/dr-logs', icon: Truck, color: 'text-red-600' },
              { label: 'CSI Monitoring', href: '/csi-monitoring', icon: TrendingUp, color: 'text-purple-600' },
              { label: 'View Inventory', href: '/inventory', icon: Package, color: 'text-orange-600' },
              { label: 'Issue Asset', href: '/assets', icon: Cpu, color: 'text-teal-600' },
            ].map(item => (
              <Link key={item.href} href={item.href} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <item.icon className={`h-4 w-4 shrink-0 ${item.color}`} />
                <span className="text-sm font-medium">{item.label}</span>
                <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
