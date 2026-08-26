'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  Package, ShoppingCart, Truck, FileText, ClipboardList,
  TrendingUp, TrendingDown, Users, ArrowRight, Loader2, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2, Clock, Lightbulb, Bell, HelpCircle, ImagePlus,
} from 'lucide-react'
import Link from 'next/link'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { DemoVideoButton } from '@/components/live-video-button'
import { uploadImageToDrive } from '@/lib/upload-image'
import { toast } from 'sonner'

interface KPI {
  totalItems: number
  activeSuppliers: number
  openPOs: number
  pendingPRs: number
  drLogsThisMonth: number
  csiThisMonth: number
  totalDRs: number
}

interface MonthBar { month: string; dr: number; csi: number }
interface RecentDR { id: string; dr_number: string | null; dr_date: string | null; supplier_name: string | null; status: string }
interface RecentPO { id: string; po_number: string | null; created_at: string; supplier: { company_name: string | null } | null; status: string; total_amount: number }

interface ORClientRow { client: string; collected: number; ewt: number; ors: number }
interface CSIClientRow { client: string; billed: number; invoices: number; items: number }
interface ReconRow { client: string; csi_billed: number; or_collected: number; diff: number; status: 'Balanced' | 'Outstanding' | 'Over-collected' }
interface MonthlySOBar { month: string; revenue: number; orders: number; csiRevenue: number; poAmount: number; collected: number; net: number }
interface TopClient { client: string; revenue: number; orders: number }

interface Insight {
  priority: 'critical' | 'warning' | 'info' | 'good'
  text: string
  link: string
  linkLabel: string
}

interface StockByClientRow { clientId: string; clientName: string; avatarUrl: string | null; itemCount: number; totalQty: number }
interface StockByChannelRow { id: string; name: string; color: string; totalQty: number; logoUrl: string | null }

// Simplified brand-colored marks for the marketplaces we integrate with — not
// the exact trademarked logo files, but recognizable at a glance. Returns null
// (so callers can fall back to initials) for any channel that isn't one of these three.
function channelIcon(name: string, className: string): React.ReactNode {
  const n = name.toLowerCase()
  if (n.includes('shopee')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none">
        <path d="M8 8.5V7a4 4 0 0 1 8 0v1.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M5.5 8.5h13l-1.1 11a2 2 0 0 1-2 1.8H8.6a2 2 0 0 1-2-1.8l-1.1-11z" fill="white" />
      </svg>
    )
  }
  if (n.includes('lazada')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none">
        <path d="M12 3l7 4v10l-7 4-7-4V7l7-4z" stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M9 12l2.2 2.2L15.5 9.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (n.includes('tiktok')) {
    return (
      <svg viewBox="0 0 24 24" className={className}>
        <path d="M15 4c.5 2.1 2 3.7 4 4.1v2.6c-1.5-.1-2.9-.6-4-1.5v5.6a5 5 0 1 1-4-4.9v2.7a2.3 2.3 0 1 0 1.6 2.2V4H15z" fill="#25F4EE" transform="translate(-0.5,-0.4)" opacity="0.85" />
        <path d="M15 4c.5 2.1 2 3.7 4 4.1v2.6c-1.5-.1-2.9-.6-4-1.5v5.6a5 5 0 1 1-4-4.9v2.7a2.3 2.3 0 1 0 1.6 2.2V4H15z" fill="#FE2C55" transform="translate(0.5,0.4)" opacity="0.85" />
        <path d="M15 4c.5 2.1 2 3.7 4 4.1v2.6c-1.5-.1-2.9-.6-4-1.5v5.6a5 5 0 1 1-4-4.9v2.7a2.3 2.3 0 1 0 1.6 2.2V4H15z" fill="white" />
      </svg>
    )
  }
  return null
}

// Segmented "equalizer" style progress bar (ticks instead of one solid fill).
function SegmentedBar({ pct, count = 28 }: { pct: number; count?: number }) {
  const filled = Math.round((Math.max(0, Math.min(100, pct)) / 100) * count)
  return (
    <div className="flex items-center gap-[3px]">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`w-[3px] h-3 rounded-full ${i < filled ? 'bg-teal-500' : 'bg-gray-200'}`} />
      ))}
    </div>
  )
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

const STAT_COLOR_GRAD: Record<string, { grad: string; tint: string; shadow: string }> = {
  blue:   { grad: 'from-blue-500 to-blue-600',     tint: 'from-blue-50',   shadow: 'shadow-blue-500/30' },
  green:  { grad: 'from-green-500 to-green-600',   tint: 'from-green-50',  shadow: 'shadow-green-500/30' },
  yellow: { grad: 'from-amber-500 to-amber-600',   tint: 'from-amber-50',  shadow: 'shadow-amber-500/30' },
  purple: { grad: 'from-purple-500 to-purple-600', tint: 'from-purple-50', shadow: 'shadow-purple-500/30' },
  red:    { grad: 'from-red-500 to-red-600',       tint: 'from-red-50',   shadow: 'shadow-red-500/30' },
  gray:   { grad: 'from-slate-400 to-slate-500',   tint: 'from-slate-50', shadow: 'shadow-slate-500/30' },
}

function StatCard({ title, value, icon: Icon, sub, color, href }: {
  title: string; value: string | number; icon: any; sub?: string; color?: string; href?: string
}) {
  const family = color?.match(/text-(\w+)-/)?.[1] ?? 'gray'
  const { grad, tint, shadow } = STAT_COLOR_GRAD[family] ?? STAT_COLOR_GRAD.gray
  const inner = (
    <Card className={`relative overflow-hidden border-none ${href ? 'hover:shadow-lg transition-shadow cursor-pointer' : ''}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${tint} to-transparent`} />
      <CardContent className="relative pt-4 pb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{title}</div>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className={`h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-sm ${shadow}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </CardContent>
    </Card>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [kpi, setKpi] = useState<KPI>({ totalItems: 0, activeSuppliers: 0, openPOs: 0, pendingPRs: 0, drLogsThisMonth: 0, csiThisMonth: 0, totalDRs: 0 })
  const [monthlyData, setMonthlyData] = useState<MonthBar[]>([])
  const [recentDRs, setRecentDRs] = useState<RecentDR[]>([])
  const [recentPOs, setRecentPOs] = useState<RecentPO[]>([])
  const [pipelinePOs, setPipelinePOs] = useState<any[]>([])
  const [receivedPONumbers, setReceivedPONumbers] = useState<Set<string>>(new Set())
  const [pipelineSOs, setPipelineSOs] = useState<any[]>([])
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
  const [stockByClient, setStockByClient] = useState<StockByClientRow[]>([])
  const [stockByChannel, setStockByChannel] = useState<StockByChannelRow[]>([])
  const [stockByClientOpen, setStockByClientOpen] = useState(true)
  const [realtimeTick, setRealtimeTick] = useState(0)
  const [uploadingChannelId, setUploadingChannelId] = useState<string | null>(null)

  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dr_logs' }, () => setRealtimeTick(t => t + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_orders' }, () => setRealtimeTick(t => t + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, () => setRealtimeTick(t => t + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'csi_records' }, () => setRealtimeTick(t => t + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collections' }, () => setRealtimeTick(t => t + 1))
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

      const [items, suppliers, pos, prs, allDRs, recentDRData, recentPOData, collectionData, allCSI] = await Promise.all([
        supabase.from('items').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('suppliers').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('purchase_orders').select('id, status', { count: 'exact' }),
        supabase.from('purchase_requests').select('id, status', { count: 'exact' }),
        fetchAllRows((from, to) => supabase.from('dr_logs').select('id, dr_date').order('id').range(from, to)),
        supabase.from('dr_logs').select('id, dr_number, dr_date, supplier_name, status').order('dr_date', { ascending: false }).limit(8),
        supabase.from('purchase_orders').select('id, po_number, created_at, status, total_amount, supplier:suppliers(company_name)').order('created_at', { ascending: false }).limit(6),
        supabase.from('collections').select('client_name, or_number, amount, form_2307, status, collection_date, si_number'),
        fetchAllRows((from, to) => supabase.from('csi_records').select('client_name, si_number, item_name, quantity, unit_price, si_date, po_number').order('id').range(from, to)),
      ])

      const allPOs = pos.data ?? []
      const allPRs = prs.data ?? []

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
        totalDRs: allDRs.length,
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
      for (const r of allCSI) {
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
      // Delivered orders still belong here — CSI billing and collection (the pipeline's
      // later stages) happen *after* delivery, so only cancelled orders are done-and-hidden.
      // Once an order's CSI invoices are all posted-collected there's nothing left to act
      // on, so — unlike DR/CSI status, which are shown either way — fully collected orders
      // are dropped from the list entirely rather than just checked off.
      const openSOsData = await supabase.from('sales_orders').select('id, so_number, client_po_number, status, client_name').not('status', 'eq', 'cancelled').order('created_at', { ascending: false }).limit(10)
      const drSOData = await supabase.from('dr_logs').select('po_number')
      const postedSiNumbers = new Set(
        (collectionData.data ?? []).filter(c => c.status === 'posted' && c.si_number).map(c => c.si_number)
      )
      const csiBySo = new Map<string, string[]>()
      for (const r of allCSI) {
        if (!r.po_number || !r.si_number) continue
        if (!csiBySo.has(r.po_number)) csiBySo.set(r.po_number, [])
        csiBySo.get(r.po_number)!.push(r.si_number)
      }
      const soWithStatus = (openSOsData.data ?? []).map(so => {
        const soRef = so.so_number ?? ''
        const siNumbers = csiBySo.get(soRef) ?? (so.client_po_number ? csiBySo.get(so.client_po_number) ?? [] : [])
        const hasCsi = siNumbers.length > 0
        const hasCollected = hasCsi && siNumbers.every(si => postedSiNumbers.has(si))
        return { ...so, hasCsi, hasCollected }
      })
      setPipelineSOs(soWithStatus.filter(so => !so.hasCollected))
      setDrLogSONumbers(new Set((drSOData.data ?? []).map((r: any) => r.po_number).filter(Boolean)))

      setMonthlyData(bars)
      setRecentDRs((recentDRData.data ?? []) as RecentDR[])
      setRecentPOs((recentPOData.data ?? []) as unknown as RecentPO[])

      // --- Overdue POs & low stock (for Decision Maker) ---
      const today = new Date().toISOString().slice(0, 10)
      const overduePOs = (openPOsData.data ?? []).filter((p: any) => p.delivery_date && p.delivery_date < today)
      setOverduePOCount(overduePOs.length)
      // items.status is only ever 'active' | 'inactive' | 'archived' — there's no
      // low/out-of-stock tracking on company items yet, so this always reads 0
      // rather than querying an enum value that doesn't exist (which 400s).
      setLowStockCount(0)

      // --- Decision Maker: monthly SO revenue + top clients ---
      const { data: soAll } = await supabase.from('sales_orders').select('so_date, created_at, client_name, total_amount, status').not('status', 'eq', 'cancelled')
      const soList = soAll ?? []
      const allCSIDetail = allCSI
      const { data: poAll } = await supabase.from('purchase_orders').select('created_at, total_amount, status').not('status', 'eq', 'cancelled')
      const poList = poAll ?? []
      const postedCollections = (collectionData.data ?? []).filter(c => c.status === 'posted')
      const soBars: MonthlySOBar[] = Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(now, 5 - i)
        const start = startOfMonth(d).toISOString().slice(0, 10)
        const end = endOfMonth(d).toISOString().slice(0, 10)
        const monthSOs = soList.filter((s: any) => {
          const dt = (s.so_date ?? s.created_at ?? '').slice(0, 10)
          return dt >= start && dt <= end
        })
        const monthCSI = allCSIDetail.filter((r: any) => r.si_date && r.si_date >= start && r.si_date <= end)
        const monthPOs = poList.filter(p => (p.created_at ?? '').slice(0, 10) >= start && (p.created_at ?? '').slice(0, 10) <= end)
        const monthCollections = postedCollections.filter(c => c.collection_date && c.collection_date >= start && c.collection_date <= end)
        const revenue = monthSOs.reduce((sum: number, s: any) => sum + (Number(s.total_amount) || 0), 0)
        const poAmount = monthPOs.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0)
        const collected = monthCollections.reduce((sum, c) => sum + (Number(c.amount) || 0), 0)
        return {
          month: format(d, 'MMM'),
          revenue,
          orders: monthSOs.length,
          csiRevenue: monthCSI.reduce((sum: number, r: any) => sum + (Number(r.quantity) || 0) * (Number(r.unit_price) || 0), 0),
          poAmount,
          collected,
          net: collected - poAmount,
        }
      })
      setSoMonthlyBars(soBars)
      const { data: clientsData } = await supabase.from('clients').select('id, company_name, avatar_url')
      // Seed every client (not just ones with SO history) so clients with no
      // sales orders yet still show up in the All Clients list, at zero.
      const clientMap: Record<string, { revenue: number; orders: number }> = {}
      for (const c of clientsData ?? []) clientMap[c.company_name] = { revenue: 0, orders: 0 }
      for (const s of soList) {
        const name = (s as any).client_name?.trim() || 'Unknown'
        if (!clientMap[name]) clientMap[name] = { revenue: 0, orders: 0 }
        clientMap[name].revenue += Number((s as any).total_amount) || 0
        clientMap[name].orders += 1
      }
      setTopClients(Object.entries(clientMap).map(([client, v]) => ({ client, ...v })).sort((a, b) => b.revenue - a.revenue || a.client.localeCompare(b.client)))

      // --- Client low stock alerts ---
      // PostgREST filters compare a column against a literal value, not another
      // column, so `.filter('quantity_on_hand', 'lte', 'low_stock_threshold')`
      // was trying (and failing, with a 400) to cast the string
      // "low_stock_threshold" to a number — fetch all rows and compare client-side.
      const { data: lowStockData } = await supabase
        .from('client_inventory')
        .select('client_id, item_name, unit, quantity_on_hand, low_stock_threshold')
      const clientNameMap: Record<string, string> = {}
      for (const c of clientsData ?? []) clientNameMap[c.id] = c.company_name
      const lowRows = (lowStockData ?? [])
        .filter((r: any) => r.quantity_on_hand <= r.low_stock_threshold)
        .map((r: any) => ({ client_name: clientNameMap[r.client_id] ?? 'Unknown', item_name: r.item_name, quantity_on_hand: r.quantity_on_hand, low_stock_threshold: r.low_stock_threshold, unit: r.unit }))
        .sort((a: any, b: any) => a.quantity_on_hand - b.quantity_on_hand)
      setClientLowStock(lowRows)

      // --- Stock by Client & Stock by Channel ---
      const [{ data: allClientStock }, { data: channelsData }] = await Promise.all([
        supabase.from('client_inventory').select('client_id, item_name, quantity_on_hand, channel_id'),
        supabase.from('sales_channels').select('id, name, color, logo_url').eq('is_active', true).order('sort_order'),
      ])
      const clientAvatarMap: Record<string, string | null> = {}
      for (const c of clientsData ?? []) clientAvatarMap[c.id] = c.avatar_url
      // Seed every client (not just ones with existing stock) so clients with no
      // stock yet still show up in the list, at zero.
      const byClientMap: Record<string, { itemCount: number; totalQty: number }> = {}
      for (const c of clientsData ?? []) byClientMap[c.id] = { itemCount: 0, totalQty: 0 }
      for (const r of allClientStock ?? []) {
        const cid = r.client_id
        if (!byClientMap[cid]) byClientMap[cid] = { itemCount: 0, totalQty: 0 }
        byClientMap[cid].itemCount += 1
        byClientMap[cid].totalQty += Number(r.quantity_on_hand) || 0
      }
      const stockByClientRows: StockByClientRow[] = Object.entries(byClientMap)
        .map(([clientId, v]) => ({ clientId, clientName: clientNameMap[clientId] ?? 'Unknown', avatarUrl: clientAvatarMap[clientId] ?? null, ...v }))
        .sort((a, b) => b.totalQty - a.totalQty || a.clientName.localeCompare(b.clientName))
      setStockByClient(stockByClientRows)

      const channelQtyMap: Record<string, number> = {}
      let unassignedQty = 0
      for (const r of allClientStock ?? []) {
        const qty = Number(r.quantity_on_hand) || 0
        if (r.channel_id) channelQtyMap[r.channel_id] = (channelQtyMap[r.channel_id] ?? 0) + qty
        else unassignedQty += qty
      }
      const channelRows: StockByChannelRow[] = (channelsData ?? []).map(ch => ({
        id: ch.id, name: ch.name, color: ch.color, totalQty: channelQtyMap[ch.id] ?? 0, logoUrl: ch.logo_url ?? null,
      }))
      if (unassignedQty > 0) channelRows.push({ id: 'unassigned', name: 'Unassigned', color: '#9ca3af', totalQty: unassignedQty, logoUrl: null })
      setStockByChannel(channelRows)

      setLoading(false)
    }
    load()
  }, [realtimeTick])

  async function handleChannelLogoFile(channel: StockByChannelRow, file: File) {
    setUploadingChannelId(channel.id)
    try {
      const url = await uploadImageToDrive(file, { displayName: channel.name, folder: 'Channels' })
      const { error } = await supabase.from('sales_channels').update({ logo_url: url }).eq('id', channel.id)
      if (error) throw error
      toast.success(`${channel.name} logo updated`)
      setRealtimeTick(t => t + 1)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload logo')
    }
    setUploadingChannelId(null)
  }

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
        <div className="flex items-center gap-3">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <DemoVideoButton />
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard title="Items" value={loading ? '—' : kpi.totalItems.toLocaleString()} icon={Package} color="text-red-600" href="/setup?tab=items" />
        <StatCard title="Suppliers" value={loading ? '—' : kpi.activeSuppliers} icon={TrendingUp} color="text-blue-600" href="/setup" />
        <StatCard title="Open POs" value={loading ? '—' : kpi.openPOs} icon={ShoppingCart} color="text-blue-600" href="/purchase-orders" sub="Awaiting delivery" />
        <StatCard title="Pending PRs" value={loading ? '—' : kpi.pendingPRs} icon={FileText} color="text-yellow-600" href="/purchase-requests" sub="In approval" />
        <StatCard title="DR Logs" value={loading ? '—' : kpi.totalDRs.toLocaleString()} icon={Truck} href="/dr-logs" sub="All time" />
        <StatCard title="DR This Month" value={loading ? '—' : kpi.drLogsThisMonth} icon={ClipboardList} color="text-green-600" href="/dr-logs" />
        <StatCard title="CSI This Month" value={loading ? '—' : kpi.csiThisMonth} icon={TrendingUp} color="text-purple-600" href="/csi-monitoring" />
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
                          {s.sub && <div className="text-[10px] text-muted-foreground capitalize">{s.sub}</div>}
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
            <div>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Sales Order Pipeline — Next Actions
              </CardTitle>
              <p className="text-[10px] text-muted-foreground mt-0.5">CSI is logged in CSI Monitoring → New Record</p>
            </div>
            {soPipelineOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
        </CardHeader>
        {soPipelineOpen && (
          <CardContent className="p-0 mt-3">
            <div className="grid grid-cols-4 text-center text-[10px] font-semibold uppercase tracking-wider border-b border-t">
              {[
                { label: 'SO Created', color: 'text-blue-600 bg-blue-50' },
                { label: 'DR Logged',  color: 'text-orange-600 bg-orange-50' },
                { label: 'CSI Billed', color: 'text-purple-600 bg-purple-50' },
                { label: 'Collected',  color: 'text-green-600 bg-green-50' },
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
                  const hasCsi = so.hasCsi
                  const hasCollected = so.hasCollected
                  const stages = [
                    { done: true,        label: so.so_number ?? '—', sub: so.client_name ?? '' },
                    { done: hasDR,       label: hasDR ? 'Logged' : 'Pending' },
                    { done: hasCsi,      label: hasCsi ? 'Billed' : 'Pending' },
                    { done: hasCollected, label: hasCollected ? 'Collected' : 'Pending' },
                  ]
                  return (
                    <div key={so.id} className="grid grid-cols-4 text-center text-xs cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => router.push('/sales-orders')}>
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

      {/* Stock by Client & Stock by Channel */}
      <Card>
        <CardHeader className="pb-0 pt-4 px-4">
          <button className="flex items-center justify-between w-full text-left" onClick={() => setStockByClientOpen(o => !o)}>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-teal-600" />
              Stock by Client
            </CardTitle>
            {stockByClientOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
        </CardHeader>
        {stockByClientOpen && (
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Stock by Client table */}
              <div className="lg:col-span-3 max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left px-2 py-2 font-medium">Client</th>
                      <th className="text-right px-2 py-2 font-medium">Items</th>
                      <th className="text-right px-2 py-2 font-medium">Total Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={3} className="text-center py-6 text-muted-foreground text-xs">Loading…</td></tr>
                    ) : stockByClient.length === 0 ? (
                      <tr><td colSpan={3} className="text-center py-6 text-muted-foreground text-xs">No clients yet</td></tr>
                    ) : stockByClient.map(r => (
                      <tr key={r.clientId} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full overflow-hidden flex items-center justify-center bg-teal-100 text-teal-700 text-[10px] font-semibold shrink-0">
                              {r.avatarUrl
                                ? <img src={r.avatarUrl} alt={r.clientName} className="h-full w-full object-cover" />
                                : r.clientName.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="font-medium truncate">{r.clientName}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right text-muted-foreground">{r.itemCount}</td>
                        <td className="px-2 py-2 text-right font-semibold tabular-nums">{r.totalQty.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Stock by Channel */}
              <div className="lg:col-span-2 space-y-2">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Stock by Channel</p>
                {loading ? (
                  <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" />Loading…</div>
                ) : stockByChannel.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No channel data yet</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {stockByChannel.map(ch => (
                      <div key={ch.id} className="flex items-center gap-2 rounded-lg border p-2.5">
                        {ch.id === 'unassigned' ? (
                          <div
                            className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                            style={{ backgroundColor: ch.color }}
                          >
                            <HelpCircle className="h-4 w-4 text-white/80" />
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              title={`Upload logo for ${ch.name}`}
                              onClick={() => document.getElementById(`channel-logo-input-${ch.id}`)?.click()}
                              className="relative h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 overflow-hidden group"
                              style={{ backgroundColor: ch.color }}
                            >
                              {uploadingChannelId === ch.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : ch.logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={ch.logoUrl} alt={ch.name} className="h-full w-full object-cover" />
                              ) : (
                                channelIcon(ch.name, 'h-4 w-4') ?? ch.name.slice(0, 2).toUpperCase()
                              )}
                              <span className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-black/50">
                                <ImagePlus className="h-3 w-3 text-white" />
                              </span>
                            </button>
                            <input
                              id={`channel-logo-input-${ch.id}`}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={e => { const f = e.target.files?.[0]; if (f) handleChannelLogoFile(ch, f); e.target.value = '' }}
                            />
                          </>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-medium truncate">{ch.name}</div>
                          <div className="text-sm font-bold tabular-nums">{ch.totalQty.toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

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
                const currCSIRev = soMonthlyBars[5]?.csiRevenue ?? 0
                const prevCSIRev = soMonthlyBars[4]?.csiRevenue ?? 0
                const pct = prevCSIRev > 0 ? ((currCSIRev - prevCSIRev) / prevCSIRev * 100) : null
                const outstandingBal = reconRows.filter(r => r.status === 'Outstanding').reduce((s, r) => s + r.diff, 0)
                const totalBilled = csiRows.reduce((s, r) => s + r.billed, 0)
                const totalCollected = orRows.reduce((s, r) => s + r.collected, 0)
                return (
                  <>
                    <div className="rounded-lg border p-3 space-y-0.5">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">CSI Revenue This Month</div>
                      <div className="text-xl font-bold tabular-nums">₱{currCSIRev.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
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
                  <p className="text-xs font-semibold text-muted-foreground">Monthly CSI Revenue — Last 6 Months</p>
                  <p className="text-[10px] text-muted-foreground">Based on CSI records (quantity × unit price)</p>
                </div>
                {loading || soMonthlyBars.every(m => m.csiRevenue === 0) ? (
                  <div className="h-44 flex items-center justify-center text-muted-foreground text-xs border rounded-lg">{loading ? 'Loading…' : 'No CSI revenue data yet'}</div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={soMonthlyBars} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₱${Number(v).toLocaleString('en-PH')}`} />
                      <Tooltip formatter={(v: any) => [`₱${(v ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`]} />
                      <Bar dataKey="csiRevenue" name="CSI Revenue" fill="#dc2626" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}

                {/* All clients */}
                {topClients.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">All Clients by Revenue</p>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
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
                              <div className="mt-1">
                                <SegmentedBar pct={(c.revenue / maxRev) * 100} />
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

            {/* Sales vs Purchases + Net */}
            <div className="pt-2 border-t space-y-2">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Sales Orders vs Purchases — Net (Last 6 Months)</p>
                <p className="text-[10px] text-muted-foreground">Bars compare monthly Collected (posted collections) and Purchase Order totals; the line is the Net difference (Collected − Purchases)</p>
              </div>
              {loading || soMonthlyBars.every(m => m.collected === 0 && m.poAmount === 0) ? (
                <div className="h-52 flex items-center justify-center text-muted-foreground text-xs border rounded-lg">{loading ? 'Loading…' : 'No sales or purchase data yet'}</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={soMonthlyBars} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₱${Number(v).toLocaleString('en-PH')}`} />
                    <Tooltip formatter={(v: any) => [`₱${(v ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="collected" name="Sales Orders (Collected)" fill="#2563eb" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="poAmount" name="Purchases" fill="#f97316" radius={[3, 3, 0, 0]} />
                    <Line type="monotone" dataKey="net" name="Net" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
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
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[dr.status] ?? 'bg-gray-100 text-gray-600'}`}>
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
        <DialogContent className="w-[95vw] max-w-5xl sm:max-w-5xl max-h-[85vh] overflow-y-auto">
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
                    <th className="px-3 py-2 text-right">CWT (2307)</th>
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
                      <td className="px-3 py-2 text-xs capitalize">{r.status ?? '—'}</td>
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
                      <th className="px-3 py-2 text-right">CWT</th>
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
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[po.status] ?? 'bg-gray-100 text-gray-600'}`}>
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
