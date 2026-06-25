'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Package, ShoppingCart, Truck, FileText, ClipboardList,
  TrendingUp, TrendingDown, Cpu, Users, ArrowRight, Loader2, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2, Clock, Lightbulb, Bell,
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
interface RecentDR { id: string; dr_number: string | null; dr_date: string | null; supplier_name: string | null; status: string }
interface RecentPO { id: string; po_number: string | null; created_at: string; supplier: { company_name: string | null } | null; status: string; total_amount: number }

interface ORClientRow { client: string; collected: number; ewt: number; ors: number }
interface CSIClientRow { client: string; billed: number; invoices: number; items: number }
interface ReconRow { client: string; csi_billed: number; or_collected: number; diff: number; status: 'Balanced' | 'Outstanding' | 'Over-collected' }
interface MonthlySOBar { month: string; revenue: number; orders: number }
interface TopClient { client: string; revenue: number; orders: number }

interface Insight {
  priority: 'critical' | 'warning' | 'info' | 'good'
  text: string
  link: string
  linkLabel: string
}

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
  partially_delivered: 'bg-yellow-100 text-yellow-700',
  closed:     'bg-gray-100 text-gray-600',
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
  const router = useRouter()
  const [kpi, setKpi] = useState<KPI>({ totalItems: 0, activeSuppliers: 0, openPOs: 0, pendingPRs: 0, drLogsThisMonth: 0, csiThisMonth: 0, totalAssets: 0, totalDRs: 0 })
  const [monthlyData, setMonthlyData] = useState<MonthBar[]>([])
  const [recentDRs, setRecentDRs] = useState<RecentDR[]>([])
  const [recentPOs, setRecentPOs] = useState<RecentPO[]>([])
  const [pipelinePOs, setPipelinePOs] = useState<any[]>([])
  const [receivedPONumbers, setReceivedPONumbers] = useState<Set<string>>(new Set())
  const [pipelineSOs, setPipelineSOs] = useState<any[]>([])
  const [collectedClients, setCollectedClients] = useState<Set<string>>(new Set())
  const [drLogSONumbers, setDrLogSONumbers] = useState<Set<string>>(new Set())
  const [poPipelineOpen, setPoPipelineOpen] = useState(true)
  const [soPipelineOpen, setSoPipelineOpen] = useState(true)
  const [decisionMakerOpen, setDecisionMakerOpen] = useState(true)
  const [orRows, setOrRows] = useState<ORClientRow[]>([])
  const [csiRows, setCsiRows] = useState<CSIClientRow[]>([])
  const [reconRows, setReconRows] = useState<ReconRow[]>([])
  const [orDetails, setOrDetails] = useState<Record<string, any[]>>({})
  const [csiDetails, setCsiDetails] = useState<Record<string, any[]>>({})
  const [detailModal, setDetailModal] = useState<{ type: 'or' | 'csi' | 'recon'; client: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [overduePOCount, setOverduePOCount] = useState(0)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [soMonthlyBars, setSoMonthlyBars] = useState<MonthlySOBar[]>([])
  const [topClients, setTopClients] = useState<TopClient[]>([])
  const [clientLowStock, setClientLowStock] = useState<{ client_name: string; item_name: string; quantity_on_hand: number; low_stock_threshold: number; unit: string | null }[]>([])
  const [clientLowStockOpen, setClientLowStockOpen] = useState(true)
  const [realtimeTick, setRealtimeTick] = useState(0)

  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dr_logs' }, () => setRealtimeTick(t => t + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_orders' }, () => setRealtimeTick(t => t + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () => setRealtimeTick(t => t + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'csi_records' }, () => setRealtimeTick(t => t + 1))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    async function load() {
      const now = new Date()
      const thisMonthStart = startOfMonth(now).toISOString()
      const thisMonthEnd = endOfMonth(now).toISOString()

      const months = Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(now, 5 - i)
        return { label: format(d, 'MMM'), start: startOfMonth(d).toISOString(), end: endOfMonth(d).toISOString() }
      })

      const [items, suppliers, pos, prs, assets, drLogs, csiRecs, recentDRData, recentPOData, collectionData, csiDetailData] = await Promise.all([
        supabase.from('items').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('suppliers').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('purchase_orders').select('id, status', { count: 'exact' }),
        supabase.from('purchase_requests').select('id, status', { count: 'exact' }),
        supabase.from('assets').select('id', { count: 'exact', head: true }),
        supabase.from('dr_logs').select('id, dr_date', { count: 'exact' }),
        supabase.from('csi_records').select('id, si_date', { count: 'exact' }),
        supabase.from('dr_logs').select('id, dr_number, dr_date, supplier_name, status').order('dr_date', { ascending: false }).limit(8),
        supabase.from('purchase_orders').select('id, po_number, created_at, status, total_amount, supplier:suppliers(company_name)').order('created_at', { ascending: false }).limit(6),
        supabase.from('collections').select('client_name, or_number, amount, form_2307, status, collection_date'),
        supabase.from('csi_records').select('client_name, si_number, item_name, quantity, unit_price, si_date'),
      ])

      const allPOs = pos.data ?? []
      const allPRs = prs.data ?? []
      const allDRs = drLogs.data ?? []
      const allCSI = csiRecs.data ?? []

      const bars: MonthBar[] = months.map(m => ({
        month: m.label,
        dr: allDRs.filter(d => d.dr_date && d.dr_date >= m.start.slice(0, 10) && d.dr_date <= m.end.slice(0, 10)).length,
        csi: allCSI.filter(c => c.si_date && c.si_date >= m.start.slice(0, 10) && c.si_date <= m.end.slice(0, 10)).length,
      }))

      setKpi({
        totalItems: items.count ?? 0,
        activeSuppliers: suppliers.count ?? 0,
        openPOs: allPOs.filter(p => p.status === 'open').length,
        pendingPRs: allPRs.filter(p => ['submitted', 'dept_approved', 'admin_approved'].includes(p.status)).length,
        drLogsThisMonth: allDRs.filter(d => d.dr_date && d.dr_date >= thisMonthStart.slice(0, 10) && d.dr_date <= thisMonthEnd.slice(0, 10)).length,
        csiThisMonth: allCSI.filter(c => c.si_date && c.si_date >= thisMonthStart.slice(0, 10) && c.si_date <= thisMonthEnd.slice(0, 10)).length,
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

      // --- PO Pipeline ---
      const openPOsData = await supabase.from('purchase_orders').select('id, po_number, status, delivery_date, supplier:suppliers(company_name)').in('status', ['open', 'partially_delivered']).order('created_at', { ascending: false }).limit(10)
      const rrData = await supabase.from('receiving_reports').select('po_number, status').order('created_at', { ascending: false })
      setPipelinePOs(openPOsData.data ?? [])
      setReceivedPONumbers(new Set((rrData.data ?? []).map((r: any) => r.po_number).filter(Boolean)))

      // --- SO Pipeline ---
      const openSOsData = await supabase.from('sales_orders').select('id, so_number, client_po_number, status, client_name').not('status', 'in', '("cancelled","delivered")').order('created_at', { ascending: false }).limit(10)
      const colClientsData = await supabase.from('collections').select('client_name')
      const drSOData = await supabase.from('dr_logs').select('po_number')
      setPipelineSOs(openSOsData.data ?? [])
      setCollectedClients(new Set((colClientsData.data ?? []).map((r: any) => (r.client_name ?? '').trim()).filter(Boolean)))
      setDrLogSONumbers(new Set((drSOData.data ?? []).map((r: any) => r.po_number).filter(Boolean)))

      setMonthlyData(bars)
      setRecentDRs((recentDRData.data ?? []) as RecentDR[])
      setRecentPOs((recentPOData.data ?? []) as unknown as RecentPO[])

      // --- Overdue POs & low stock (for Decision Maker) ---
      const today = new Date().toISOString().slice(0, 10)
      const overduePOs = (openPOsData.data ?? []).filter((p: any) => p.delivery_date && p.delivery_date < today)
      setOverduePOCount(overduePOs.length)
      const { count: lsCount } = await supabase.from('items').select('id', { count: 'exact', head: true }).in('status', ['low_stock', 'out_of_stock'])
      setLowStockCount(lsCount ?? 0)

      // --- Decision Maker: monthly SO revenue + top clients ---
      const { data: soAll } = await supabase.from('sales_orders').select('so_date, created_at, client_name, total_amount, status').not('status', 'eq', 'cancelled')
      const soList = soAll ?? []
      const soBars: MonthlySOBar[] = Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(now, 5 - i)
        const start = startOfMonth(d).toISOString().slice(0, 10)
        const end = endOfMonth(d).toISOString().slice(0, 10)
        const monthSOs = soList.filter((s: any) => {
          const dt = (s.so_date ?? s.created_at ?? '').slice(0, 10)
          return dt >= start && dt <= end
        })
        return {
          month: format(d, 'MMM'),
          revenue: monthSOs.reduce((sum: number, s: any) => sum + (Number(s.total_amount) || 0), 0),
          orders: monthSOs.length,
        }
      })
      setSoMonthlyBars(soBars)
      const clientMap: Record<string, { revenue: number; orders: number }> = {}
      for (const s of soList) {
        const name = (s as any).client_name?.trim() || 'Unknown'
        if (!clientMap[name]) clientMap[name] = { revenue: 0, orders: 0 }
        clientMap[name].revenue += Number((s as any).total_amount) || 0
        clientMap[name].orders += 1
      }
      setTopClients(Object.entries(clientMap).map(([client, v]) => ({ client, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 5))

      // --- Client low stock alerts ---
      const { data: lowStockData } = await supabase
        .from('client_inventory')
        .select('client_id, item_name, unit, quantity_on_hand, low_stock_threshold')
        .filter('quantity_on_hand', 'lte', 'low_stock_threshold')
      const { data: clientsData } = await supabase.from('clients').select('id, company_name')
      const clientNameMap: Record<string, string> = {}
      for (const c of clientsData ?? []) clientNameMap[c.id] = c.company_name
      const lowRows = (lowStockData ?? [])
        .filter((r: any) => r.quantity_on_hand <= r.low_stock_threshold)
        .map((r: any) => ({ client_name: clientNameMap[r.client_id] ?? 'Unknown', item_name: r.item_name, quantity_on_hand: r.quantity_on_hand, low_stock_threshold: r.low_stock_threshold, unit: r.unit }))
        .sort((a: any, b: any) => a.quantity_on_hand - b.quantity_on_hand)
      setClientLowStock(lowRows)

      setLoading(false)
    }
    load()
  }, [realtimeTick])

  // Compute insights for Decision Maker
  const insights: Insight[] = !loading ? (() => {
    const result: Insight[] = []

    const currRev = soMonthlyBars[5]?.revenue ?? 0
    const prevRev = soMonthlyBars[4]?.revenue ?? 0
    const revPct = prevRev > 0 ? ((currRev - prevRev) / prevRev * 100) : null

    if (currRev > 0 || prevRev > 0) {
      if (revPct !== null && revPct < -10) {
        result.push({ priority: 'critical', text: `Sales revenue dropped ${Math.abs(revPct).toFixed(1)}% this month (₱${currRev.toLocaleString('en-PH', { minimumFractionDigits: 2 })})`, link: '/sales-orders', linkLabel: 'View Sales' })
      } else if (revPct !== null && revPct >= 0) {
        result.push({ priority: 'good', text: `Revenue ${revPct > 0 ? `up ${revPct.toFixed(1)}%` : 'flat'} vs last month — ₱${currRev.toLocaleString('en-PH', { minimumFractionDigits: 2 })} this month`, link: '/sales-orders', linkLabel: 'View Sales' })
      } else {
        result.push({ priority: 'warning', text: `Revenue slightly down this month vs last month (₱${currRev.toLocaleString('en-PH', { minimumFractionDigits: 2 })})`, link: '/sales-orders', linkLabel: 'View Sales' })
      }
    }

    if (overduePOCount > 0) {
      result.push({ priority: 'critical', text: `${overduePOCount} purchase order${overduePOCount > 1 ? 's are' : ' is'} past their delivery date — supplier follow-up needed`, link: '/purchase-orders', linkLabel: 'Review POs' })
    }

    if (kpi.pendingPRs > 0) {
      result.push({ priority: 'warning', text: `${kpi.pendingPRs} purchase request${kpi.pendingPRs > 1 ? 's are' : ' is'} pending approval and may delay procurement`, link: '/purchase-requests', linkLabel: 'Approve PRs' })
    }

    if (lowStockCount > 0) {
      result.push({ priority: 'critical', text: `${lowStockCount} item${lowStockCount > 1 ? 's are' : ' is'} low or out of stock — create a purchase order to replenish`, link: '/inventory', linkLabel: 'View Inventory' })
    }

    const outstandingBalance = reconRows.filter(r => r.status === 'Outstanding').reduce((s, r) => s + r.diff, 0)
    if (outstandingBalance > 0) {
      const outstandingClients = reconRows.filter(r => r.status === 'Outstanding').length
      result.push({ priority: 'warning', text: `₱${outstandingBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 })} uncollected across ${outstandingClients} client${outstandingClients > 1 ? 's' : ''} — follow up on collections`, link: '/accounting', linkLabel: 'View Accounting' })
    }

    if (topClients[0] && topClients[0].revenue > 0) {
      result.push({ priority: 'info', text: `Top client: ${topClients[0].client} — ₱${topClients[0].revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })} across ${topClients[0].orders} order${topClients[0].orders !== 1 ? 's' : ''}`, link: '/sales-orders', linkLabel: 'View Orders' })
    }

    if (kpi.openPOs === 0 && overduePOCount === 0 && lowStockCount === 0 && kpi.pendingPRs === 0) {
      result.push({ priority: 'good', text: 'All systems clear — no overdue POs, no stock issues, and no pending approvals', link: '/dashboard', linkLabel: 'Refresh' })
    }

    return result
  })() : []

  const INSIGHT_STYLE: Record<string, { border: string; icon: any; iconColor: string; badge: string }> = {
    critical: { border: 'border-red-200 bg-red-50', icon: AlertTriangle, iconColor: 'text-red-500', badge: 'bg-red-100 text-red-700' },
    warning:  { border: 'border-yellow-200 bg-yellow-50', icon: Clock, iconColor: 'text-yellow-500', badge: 'bg-yellow-100 text-yellow-700' },
    info:     { border: 'border-blue-200 bg-blue-50', icon: Lightbulb, iconColor: 'text-blue-500', badge: 'bg-blue-100 text-blue-700' },
    good:     { border: 'border-green-200 bg-green-50', icon: CheckCircle2, iconColor: 'text-green-500', badge: 'bg-green-100 text-green-700' },
  }

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

      {/* PO Pipeline */}
      <Card>
        <CardHeader className="pb-0 pt-4 px-4">
          <button className="flex items-center justify-between w-full text-left" onClick={() => setPoPipelineOpen(o => !o)}>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-red-600" />
              Purchase Order Pipeline — Next Actions
            </CardTitle>
            {poPipelineOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
        </CardHeader>
        {poPipelineOpen && (
          <CardContent className="p-0 mt-3">
            <div className="grid grid-cols-5 text-center text-[10px] font-semibold uppercase tracking-wider border-b border-t">
              {[
                { label: 'PO Created', color: 'text-blue-600 bg-blue-50' },
                { label: 'Receiving',  color: 'text-yellow-600 bg-yellow-50' },
                { label: 'DR Logged',  color: 'text-orange-600 bg-orange-50' },
                { label: 'CSI Issued', color: 'text-purple-600 bg-purple-50' },
                { label: 'Collected',  color: 'text-green-600 bg-green-50' },
              ].map(s => (
                <div key={s.label} className={`py-2 ${s.color}`}>{s.label}</div>
              ))}
            </div>
            {loading ? (
              <div className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>
            ) : pipelinePOs.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">No open purchase orders</div>
            ) : (
              <div className="divide-y">
                {pipelinePOs.map(po => {
                  const isReceived = receivedPONumbers.has(po.po_number ?? '')
                  const supplierName = (po.supplier as any)?.company_name ?? ''
                  const hasCsi = csiRows.some(r => r.client === supplierName)
                  const hasOr = orRows.some(r => r.client === supplierName)
                  const stages = [
                    { done: true,       label: po.po_number ?? '—', sub: STATUS_COLORS[po.status as any] ? po.status : po.status },
                    { done: isReceived, label: isReceived ? 'Received' : 'Pending' },
                    { done: isReceived, label: isReceived ? 'DR Expected' : '—' },
                    { done: hasCsi,     label: hasCsi ? 'Issued' : 'Pending' },
                    { done: hasOr,      label: hasOr ? 'Collected' : 'Pending' },
                  ]
                  return (
                    <div key={po.id} className="grid grid-cols-5 text-center text-xs cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => router.push('/purchase-orders')}>
                      {stages.map((s, i) => (
                        <div key={i} className={`py-2.5 px-1 border-r last:border-r-0 ${s.done ? '' : 'opacity-40'}`}>
                          <div className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold mx-auto mb-0.5 ${s.done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                            {s.done ? '✓' : (i + 1)}
                          </div>
                          <div className="font-medium truncate px-1">{s.label}</div>
                          {s.sub && <div className="text-[10px] text-muted-foreground">{s.sub}</div>}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* SO Pipeline */}
      <Card>
        <CardHeader className="pb-0 pt-4 px-4">
          <button className="flex items-center justify-between w-full text-left" onClick={() => setSoPipelineOpen(o => !o)}>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              Sales Order Pipeline — Next Actions
            </CardTitle>
            {soPipelineOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
        </CardHeader>
        {soPipelineOpen && (
          <CardContent className="p-0 mt-3">
            <div className="grid grid-cols-2 text-center text-[10px] font-semibold uppercase tracking-wider border-b border-t">
              {[
                { label: 'SO Created', color: 'text-blue-600 bg-blue-50' },
                { label: 'DR Logged',  color: 'text-orange-600 bg-orange-50' },
              ].map(s => (
                <div key={s.label} className={`py-2 ${s.color}`}>{s.label}</div>
              ))}
            </div>
            {loading ? (
              <div className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>
            ) : pipelineSOs.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">No active sales orders</div>
            ) : (
              <div className="divide-y">
                {pipelineSOs.map(so => {
                  const hasDR = drLogSONumbers.has(so.so_number ?? '') || (!!so.client_po_number && drLogSONumbers.has(so.client_po_number))
                  const stages = [
                    { done: true,  label: so.so_number ?? '—', sub: so.client_name ?? '' },
                    { done: hasDR, label: hasDR ? 'Logged' : 'Pending' },
                  ]
                  return (
                    <div key={so.id} className="grid grid-cols-2 text-center text-xs cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => router.push('/sales-orders')}>
                      {stages.map((s, i) => (
                        <div key={i} className={`py-2.5 px-1 border-r last:border-r-0 ${s.done ? '' : 'opacity-40'}`}>
                          <div className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold mx-auto mb-0.5 ${s.done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                            {s.done ? '✓' : (i + 1)}
                          </div>
                          <div className="font-medium truncate px-1">{s.label}</div>
                          {s.sub && <div className="text-[10px] text-muted-foreground truncate px-1">{s.sub}</div>}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Client Low Stock Alerts */}
      {(loading || clientLowStock.length > 0) && (
        <Card className={clientLowStock.length > 0 ? 'border-amber-200' : ''}>
          <CardHeader className="pb-0 pt-4 px-4">
            <button className="flex items-center justify-between w-full text-left" onClick={() => setClientLowStockOpen(o => !o)}>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-500" />
                Client Low Stock Alerts
                {!loading && clientLowStock.length > 0 && (
                  <span className="ml-1 bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {clientLowStock.length}
                  </span>
                )}
              </CardTitle>
              {clientLowStockOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CardHeader>
          {clientLowStockOpen && (
            <CardContent className="p-0 mt-3">
              {loading ? (
                <div className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>
              ) : clientLowStock.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" /> All client stock levels are healthy
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-amber-50 border-b border-amber-100 text-xs">
                      <th className="px-4 py-2.5 text-left font-semibold text-amber-800 uppercase tracking-wide">Client</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-amber-800 uppercase tracking-wide">Item</th>
                      <th className="px-4 py-2.5 text-center font-semibold text-amber-800 uppercase tracking-wide">On Hand</th>
                      <th className="px-4 py-2.5 text-center font-semibold text-amber-800 uppercase tracking-wide">Threshold</th>
                      <th className="px-4 py-2.5 text-center font-semibold text-amber-800 uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-50">
                    {clientLowStock.map((r, i) => {
                      const isOut = r.quantity_on_hand === 0
                      return (
                        <tr key={i} className="hover:bg-amber-50/50 transition-colors">
                          <td className="px-4 py-2.5 text-xs font-medium text-gray-900">{r.client_name}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-700">{r.item_name}</td>
                          <td className="px-4 py-2.5 text-center text-xs font-bold text-red-600">
                            {r.quantity_on_hand} {r.unit ?? 'pcs'}
                          </td>
                          <td className="px-4 py-2.5 text-center text-xs text-gray-500">
                            {r.low_stock_threshold} {r.unit ?? 'pcs'}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isOut ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                              {isOut ? 'Out of Stock' : 'Low Stock'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Decision Maker — Business Intelligence */}
      <Card>
        <CardHeader className="pb-0 pt-4 px-4">
          <button className="flex items-center justify-between w-full text-left" onClick={() => setDecisionMakerOpen(o => !o)}>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-600" />
              Decision Maker — Business Intelligence
            </CardTitle>
            {decisionMakerOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
        </CardHeader>
        {decisionMakerOpen && (
          <CardContent className="pt-4 space-y-5">

            {/* Summary KPI tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(() => {
                const currRev = soMonthlyBars[5]?.revenue ?? 0
                const prevRev = soMonthlyBars[4]?.revenue ?? 0
                const pct = prevRev > 0 ? ((currRev - prevRev) / prevRev * 100) : null
                const outstandingBal = reconRows.filter(r => r.status === 'Outstanding').reduce((s, r) => s + r.diff, 0)
                const totalBilled = csiRows.reduce((s, r) => s + r.billed, 0)
                const totalCollected = orRows.reduce((s, r) => s + r.collected, 0)
                return (
                  <>
                    <div className="rounded-lg border p-3 space-y-0.5">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">This Month Revenue</div>
                      <div className="text-xl font-bold tabular-nums">₱{currRev.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                      {pct !== null ? (
                        <div className={`flex items-center gap-1 text-xs font-medium ${pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {pct >= 0 ? '+' : ''}{pct.toFixed(1)}% vs last month
                        </div>
                      ) : <div className="text-xs text-muted-foreground">No prior data</div>}
                    </div>
                    <div className="rounded-lg border p-3 space-y-0.5">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total CSI Billed</div>
                      <div className="text-xl font-bold tabular-nums">₱{totalBilled.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                      <div className="text-xs text-muted-foreground">{csiRows.length} client{csiRows.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="rounded-lg border p-3 space-y-0.5">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Collected</div>
                      <div className="text-xl font-bold tabular-nums">₱{totalCollected.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                      <div className="text-xs text-muted-foreground">{orRows.reduce((s, r) => s + r.ors, 0)} OR{orRows.reduce((s, r) => s + r.ors, 0) !== 1 ? 's' : ''}</div>
                    </div>
                    <div className={`rounded-lg border p-3 space-y-0.5 ${outstandingBal > 0 ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-green-50'}`}>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Outstanding Balance</div>
                      <div className={`text-xl font-bold tabular-nums ${outstandingBal > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        ₱{outstandingBal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {outstandingBal > 0 ? `${reconRows.filter(r => r.status === 'Outstanding').length} client${reconRows.filter(r => r.status === 'Outstanding').length !== 1 ? 's' : ''} unpaid` : 'All balanced'}
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>

            {/* Chart + Recommendations */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Revenue chart */}
              <div className="lg:col-span-3 space-y-2">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Monthly Sales Revenue — Last 6 Months</p>
                  <p className="text-[10px] text-muted-foreground">Based on confirmed sales orders</p>
                </div>
                {loading || soMonthlyBars.every(m => m.revenue === 0) ? (
                  <div className="h-44 flex items-center justify-center text-muted-foreground text-xs border rounded-lg">{loading ? 'Loading…' : 'No revenue data yet'}</div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={soMonthlyBars} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: any) => [`₱${(v ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, 'Revenue']} />
                      <Bar dataKey="revenue" name="Revenue" fill="#4f46e5" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}

                {/* Top clients */}
                {topClients.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Top Clients by Revenue</p>
                    <div className="space-y-1.5">
                      {topClients.map((c, i) => {
                        const maxRev = topClients[0]?.revenue || 1
                        return (
                          <div key={c.client} className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full bg-indigo-100 text-indigo-700 text-[9px] font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium truncate">{c.client}</span>
                                <span className="text-xs font-semibold text-indigo-600 tabular-nums shrink-0">₱{c.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="h-1 bg-gray-100 rounded-full mt-0.5">
                                <div className="h-1 bg-indigo-400 rounded-full" style={{ width: `${(c.revenue / maxRev) * 100}%` }} />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Recommendations */}
              <div className="lg:col-span-2 space-y-2">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Recommendations</p>
                  <p className="text-[10px] text-muted-foreground">AI-generated insights based on current data</p>
                </div>
                {loading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Analyzing…</div>
                ) : insights.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No insights available yet.</div>
                ) : (
                  <div className="space-y-2">
                    {insights.map((ins, i) => {
                      const s = INSIGHT_STYLE[ins.priority]
                      const Icon = s.icon
                      return (
                        <div key={i} className={`rounded-lg border px-3 py-2.5 ${s.border}`}>
                          <div className="flex items-start gap-2">
                            <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${s.iconColor}`} />
                            <div className="flex-1 min-w-0 space-y-1">
                              <p className="text-xs leading-snug">{ins.text}</p>
                              <Link href={ins.link} className={`inline-flex items-center gap-0.5 text-[10px] font-semibold rounded px-1.5 py-0.5 ${s.badge}`}>
                                {ins.linkLabel} <ArrowRight className="h-2.5 w-2.5" />
                              </Link>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

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
                    <td className="px-4 py-2 text-xs max-w-[140px] truncate">{dr.supplier_name ?? '—'}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {dr.dr_date ? format(new Date(dr.dr_date), 'MMM d, yyyy') : '—'}
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
                      <td className="px-3 py-2 text-xs text-muted-foreground">{r.collection_date ? format(new Date(r.collection_date), 'MMM d, yyyy') : '—'}</td>
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
                      <td className="px-3 py-2 text-xs text-muted-foreground">{r.si_date ? format(new Date(r.si_date), 'MMM d, yyyy') : '—'}</td>
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
                          <td className="px-3 py-1.5 text-xs text-muted-foreground">{r.collection_date ? format(new Date(r.collection_date), 'MMM d, yyyy') : '—'}</td>
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

      {/* Recent POs + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Recent Purchase Orders */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Recent Purchase Orders</CardTitle>
            <Link href="/purchase-orders">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
                View all <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">PO #</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Supplier</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-xs">Loading…</td></tr>
                ) : recentPOs.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-xs">No purchase orders yet</td></tr>
                ) : recentPOs.map(po => (
                  <tr key={po.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => router.push('/purchase-orders')}>
                    <td className="px-4 py-2 font-mono text-xs font-semibold text-red-600">{po.po_number ?? '—'}</td>
                    <td className="px-4 py-2 text-xs max-w-[140px] truncate">{(po.supplier as any)?.company_name ?? '—'}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(po.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[po.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {po.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: 'New Purchase Order', href: '/purchase-orders', icon: ShoppingCart, color: 'text-blue-600' },
              { label: 'Create Sales Order', href: '/sales-orders', icon: FileText, color: 'text-green-600' },
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
