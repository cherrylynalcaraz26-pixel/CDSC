'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useSearchContext } from '@/context/search-context'
import {
  Plus, Trash2, Loader2, FileText, RefreshCw, Users, TrendingUp,
  RotateCcw, Eye, X, Save, Search, Truck, Package, BarChart3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnrichedDrItem {
  dr_number: string
  dr_date: string
  client_name: string
  item_name: string
  unit: string
  quantity: number
  so_number: string | null
}

interface CsiRecord {
  id: string
  si_number: string
  si_date: string
  client_name: string | null
  item_name: string
  unit: string | null
  quantity: number
  unit_price: number
  amount: number
  collection_status: string | null
}

interface PulloutLine {
  request_id: string
  pr_number: string
  date: string
  client_name: string
  item_name: string
  unit: string
  quantity: number
}

interface PulloutRequestItem {
  item_id: string
  item_name: string
  qty: number
  unit: string
}

interface PulloutRequest {
  id: string
  pr_number: string
  date: string
  client_id: string
  client_name: string
  items: PulloutRequestItem[]
  reason: string
  status: 'pending' | 'approved' | 'completed' | 'cancelled' | 'rejected'
}

interface ItemOption {
  id: string
  item_name: string
  unit_of_measure: string
  selling_price: number | null
}

interface ClientOption {
  id: string
  company_name: string
}

interface ProductRow {
  product: string
  unit: string
  price: number
  delivered: number
  billed: number
  pulledOut: number
  onHand: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const peso = (n: number) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtNum = (n: number) => n.toLocaleString('en-PH')
const fmtDate = (d: string) => { try { return format(new Date(d), 'MMM d, yyyy') } catch { return d || '—' } }

function onHandCls(v: number) {
  if (v > 0) return 'text-amber-600 font-semibold'
  if (v < 0) return 'text-red-600 font-semibold'
  return 'text-gray-400'
}

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-700 border-amber-200',
  approved:  'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  rejected:  'bg-red-100 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
}

const TODAY = new Date().toISOString().slice(0, 10)
const EMPTY_CSI = { date: '', si_number: '', client_name: '', item_name: '', unit: '', quantity: '', unit_price: '', amount: '' }
const EMPTY_PR = { date: TODAY, pr_number: '', client_id: '', client_name: '', item_name: '', unit: '', quantity: '', reason: '' }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PullOutBillingPage() {
  const supabase = createClient()
  const { query } = useSearchContext()

  // Data
  const [drItems, setDrItems] = useState<EnrichedDrItem[]>([])
  const [csiItems, setCsiItems] = useState<CsiRecord[]>([])
  const [pulloutLines, setPulloutLines] = useState<PulloutLine[]>([])
  const [pulloutRequests, setPulloutRequests] = useState<PulloutRequest[]>([])
  const [allItems, setAllItems] = useState<ItemOption[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [counts, setCounts] = useState({ csi: 0, dr: 0, pr: 0 })

  // UI
  const [tab, setTab] = useState<'stock' | 'client' | 'movements' | 'requests'>('stock')
  const [clientFilter, setClientFilter] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [selectedClientStock, setSelectedClientStock] = useState('')

  // Pull-out modal
  const [pulloutOpen, setPulloutOpen] = useState(false)
  const [pulloutForm, setPulloutForm] = useState(EMPTY_PR)
  const [pulloutSaving, setPulloutSaving] = useState(false)

  // Bill CSI modal
  const [csiOpen, setCsiOpen] = useState(false)
  const [csiForm, setCsiForm] = useState(EMPTY_CSI)
  const [csiSaving, setCsiSaving] = useState(false)

  // Product detail modal
  const [detailProduct, setDetailProduct] = useState<ProductRow | null>(null)

  // Request view modal
  const [viewReq, setViewReq] = useState<PulloutRequest | null>(null)
  const [reqSaving, setReqSaving] = useState(false)

  // Requests tab filter
  const [reqSearch, setReqSearch] = useState('')
  const [reqStatusFilter, setReqStatusFilter] = useState('all')

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    const [
      { data: drLogs },
      { data: drLogItems },
      { data: csiData },
      { data: prData },
      { data: itemsData },
      { data: clientsData },
    ] = await Promise.all([
      supabase.from('dr_logs').select('dr_number, dr_date, supplier_name, po_number').order('dr_date', { ascending: false }),
      supabase.from('dr_log_items').select('dr_number, item_name, quantity, unit'),
      supabase.from('csi_records').select('id, si_number, si_date, client_name, item_name, unit, quantity, unit_price, amount, collection_status').order('si_date', { ascending: false }),
      supabase.from('pull_out_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('items').select('id, item_name, unit_of_measure, selling_price').order('item_name'),
      supabase.from('clients').select('id, company_name').order('company_name'),
    ])

    // Build enriched DR items
    const drMap = new Map<string, { dr_date: string; client_name: string; so_number: string | null }>()
    for (const log of drLogs ?? []) {
      drMap.set(log.dr_number, { dr_date: log.dr_date ?? '', client_name: log.supplier_name ?? '', so_number: log.po_number ?? null })
    }
    const enriched: EnrichedDrItem[] = (drLogItems ?? []).map(it => ({
      dr_number: it.dr_number ?? '',
      dr_date: drMap.get(it.dr_number)?.dr_date ?? '',
      client_name: drMap.get(it.dr_number)?.client_name ?? '',
      item_name: it.item_name ?? '',
      unit: it.unit ?? '',
      quantity: Number(it.quantity) || 0,
      so_number: drMap.get(it.dr_number)?.so_number ?? null,
    }))

    // Flatten pull_out_requests items
    const prLines: PulloutLine[] = []
    const prs: PulloutRequest[] = []
    for (const pr of prData ?? []) {
      const items: PulloutRequestItem[] = Array.isArray(pr.items) ? pr.items : []
      prs.push({ ...pr, items })
      for (const it of items) {
        prLines.push({
          request_id: pr.id,
          pr_number: pr.pr_number ?? '',
          date: pr.date ?? '',
          client_name: pr.client_name ?? '',
          item_name: it.item_name ?? '',
          unit: it.unit ?? '',
          quantity: Number(it.qty) || 0,
        })
      }
    }

    setDrItems(enriched)
    setCsiItems((csiData ?? []) as CsiRecord[])
    setPulloutLines(prLines)
    setPulloutRequests(prs)
    setAllItems((itemsData ?? []) as ItemOption[])
    setClients((clientsData ?? []) as ClientOption[])
    setCounts({
      csi: new Set((csiData ?? []).map((r: any) => r.si_number)).size,
      dr: new Set((drLogs ?? []).map((r: any) => r.dr_number)).size,
      pr: (prData ?? []).length,
    })
  }, [supabase])

  useEffect(() => {
    async function init() {
      setLoading(true)
      await loadData()
      setLoading(false)
    }
    init()
  }, [loadData])

  useEffect(() => {
    const channel = supabase
      .channel('pullout-billing-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dr_logs' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dr_log_items' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'csi_records' }, () => loadData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  // ── Derived data ────────────────────────────────────────────────────────────

  const clientNames = useMemo(() =>
    Array.from(new Set([
      ...drItems.map(r => r.client_name),
      ...csiItems.map(r => r.client_name ?? ''),
    ].filter(Boolean))).sort()
  , [drItems, csiItems])

  const allProducts = useMemo(() =>
    Array.from(new Set([
      ...drItems.map(r => r.item_name),
      ...csiItems.map(r => r.item_name),
      ...pulloutLines.map(r => r.item_name),
    ].filter(Boolean))).sort()
  , [drItems, csiItems, pulloutLines])

  const rows = useMemo<ProductRow[]>(() => {
    return allProducts.map(product => {
      const itemDef = allItems.find(i => i.item_name === product)
      const unit = drItems.find(r => r.item_name === product)?.unit
        || csiItems.find(r => r.item_name === product)?.unit
        || pulloutLines.find(r => r.item_name === product)?.unit
        || ''
      const price = itemDef?.selling_price ?? 0

      const drFiltered = clientFilter ? drItems.filter(r => r.client_name.toLowerCase().includes(clientFilter)) : drItems
      const csiFiltered = clientFilter ? csiItems.filter(r => (r.client_name ?? '').toLowerCase().includes(clientFilter)) : csiItems
      const poFiltered = clientFilter ? pulloutLines.filter(r => r.client_name.toLowerCase().includes(clientFilter)) : pulloutLines

      const delivered = drFiltered.filter(r => r.item_name === product).reduce((s, r) => s + r.quantity, 0)
      const billed = csiFiltered.filter(r => r.item_name === product).reduce((s, r) => s + (r.quantity ?? 0), 0)
      const pulledOut = poFiltered.filter(r => r.item_name === product).reduce((s, r) => s + r.quantity, 0)
      return { product, unit, price, delivered, billed, pulledOut, onHand: delivered - billed - pulledOut }
    }).filter(r => r.delivered > 0 || r.billed > 0 || r.pulledOut > 0)
  }, [allProducts, allItems, drItems, csiItems, pulloutLines, clientFilter])

  const filteredRows = useMemo(() =>
    productSearch ? rows.filter(r => r.product.toLowerCase().includes(productSearch.toLowerCase())) : rows
  , [rows, productSearch])

  const movements = useMemo(() => {
    const drMoves = drItems
      .filter(r => !clientFilter || r.client_name.toLowerCase().includes(clientFilter))
      .filter(r => !productSearch || r.item_name.toLowerCase().includes(productSearch.toLowerCase()))
      .map(r => ({ date: r.dr_date, type: 'DR' as const, ref: r.dr_number, so: r.so_number, client: r.client_name, product: r.item_name, unit: r.unit, qty: r.quantity, dir: 'IN' as const }))
    const csiMoves = csiItems
      .filter(r => !clientFilter || (r.client_name ?? '').toLowerCase().includes(clientFilter))
      .filter(r => !productSearch || r.item_name.toLowerCase().includes(productSearch.toLowerCase()))
      .map(r => ({ date: r.si_date, type: 'CSI' as const, ref: r.si_number, so: null as string | null, client: r.client_name ?? '', product: r.item_name, unit: r.unit ?? '', qty: r.quantity, dir: 'OUT' as const }))
    return [...drMoves, ...csiMoves].sort((a, b) => b.date.localeCompare(a.date))
  }, [drItems, csiItems, clientFilter, productSearch])

  interface ClientRow { client: string; products: number; delivered: number; billed: number; pulledOut: number; onHand: number; value: number }
  const clientStock = useMemo<ClientRow[]>(() => {
    return clientNames.map(client => {
      const drC = drItems.filter(r => r.client_name === client)
      const csiC = csiItems.filter(r => r.client_name === client)
      const poC = pulloutLines.filter(r => r.client_name === client)
      const products = new Set([...drC.map(r => r.item_name), ...csiC.map(r => r.item_name)].filter(Boolean)).size
      const delivered = drC.reduce((s, r) => s + r.quantity, 0)
      const billed = csiC.reduce((s, r) => s + (r.quantity ?? 0), 0)
      const pulledOut = poC.reduce((s, r) => s + r.quantity, 0)
      const onHand = delivered - billed - pulledOut
      const value = rows
        .filter(r => drC.some(d => d.item_name === r.product))
        .reduce((s, r) => {
          const d = drC.filter(d => d.item_name === r.product).reduce((a, d) => a + d.quantity, 0)
          const b = csiC.filter(c => c.item_name === r.product).reduce((a, c) => a + (c.quantity ?? 0), 0)
          const p = poC.filter(p => p.item_name === r.product).reduce((a, p) => a + p.quantity, 0)
          return s + Math.max(0, d - b - p) * r.price
        }, 0)
      return { client, products, delivered, billed, pulledOut, onHand, value }
    }).sort((a, b) => b.onHand - a.onHand)
  }, [clientNames, drItems, csiItems, pulloutLines, rows])

  const onHandSkus = rows.filter(r => r.onHand > 0).length
  const negSkus = rows.filter(r => r.onHand < 0).length
  const estValue = rows.reduce((s, r) => s + r.onHand * r.price, 0)

  const filteredRequests = pulloutRequests
    .filter(p => reqStatusFilter === 'all' || p.status === reqStatusFilter)
    .filter(p => {
      if (!reqSearch.trim()) return true
      const q = reqSearch.toLowerCase()
      return p.pr_number?.toLowerCase().includes(q) || p.client_name?.toLowerCase().includes(q)
    })
    .filter(p => {
      if (!query.trim()) return true
      const q = query.toLowerCase()
      return p.pr_number?.toLowerCase().includes(q) || p.client_name?.toLowerCase().includes(q)
    })

  const detailDrRows = useMemo(() =>
    detailProduct ? drItems.filter(r => r.item_name === detailProduct.product && (!clientFilter || r.client_name.toLowerCase().includes(clientFilter))) : []
  , [detailProduct, drItems, clientFilter])

  const detailCsiRows = useMemo(() =>
    detailProduct ? csiItems.filter(r => r.item_name === detailProduct.product && (!clientFilter || (r.client_name ?? '').toLowerCase().includes(clientFilter))) : []
  , [detailProduct, csiItems, clientFilter])

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function handleSavePullout() {
    if (!pulloutForm.client_name.trim()) { toast.error('Client is required'); return }
    if (!pulloutForm.item_name.trim()) { toast.error('Item name is required'); return }
    if (!pulloutForm.quantity || Number(pulloutForm.quantity) <= 0) { toast.error('Enter a valid quantity'); return }
    setPulloutSaving(true)
    const prNumber = pulloutForm.pr_number.trim() || ('PR-' + Date.now().toString().slice(-6))
    const client = clients.find(c => c.company_name === pulloutForm.client_name)
    const payload = {
      pr_number: prNumber,
      date: pulloutForm.date,
      client_id: client?.id ?? null,
      client_name: pulloutForm.client_name,
      items: [{ item_id: '', item_name: pulloutForm.item_name, qty: Number(pulloutForm.quantity), unit: pulloutForm.unit }],
      reason: pulloutForm.reason || null,
      status: 'pending',
    }
    const { error } = await supabase.from('pull_out_requests').insert(payload)
    setPulloutSaving(false)
    if (error) { toast.error('Failed to save: ' + error.message); return }
    toast.success('Pull-out request recorded!')
    setPulloutOpen(false)
    setPulloutForm(EMPTY_PR)
    await loadData()
  }

  async function handleSaveCSI() {
    if (!csiForm.client_name.trim()) { toast.error('Client is required'); return }
    if (!csiForm.si_number.trim()) { toast.error('SI Number is required'); return }
    if (!csiForm.item_name.trim()) { toast.error('Item name is required'); return }
    setCsiSaving(true)
    const { error } = await supabase.from('csi_records').insert({
      si_date: csiForm.date || TODAY,
      si_number: csiForm.si_number,
      client_name: csiForm.client_name,
      item_name: csiForm.item_name,
      unit: csiForm.unit || null,
      quantity: csiForm.quantity ? Number(csiForm.quantity) : null,
      unit_price: csiForm.unit_price ? Number(csiForm.unit_price) : null,
      amount: csiForm.amount ? Number(csiForm.amount) : null,
      collection_status: 'for_collection',
    })
    setCsiSaving(false)
    if (error) { toast.error('Failed to save: ' + error.message); return }
    toast.success('CSI entry created!')
    setCsiOpen(false)
    setCsiForm(EMPTY_CSI)
    await loadData()
  }

  async function handleReqApprove(id: string) {
    await supabase.from('pull_out_requests').update({ status: 'approved' }).eq('id', id)
    toast.success('Request approved')
    await loadData()
    if (viewReq?.id === id) setViewReq(prev => prev ? { ...prev, status: 'approved' } : null)
  }

  async function handleReqReject(id: string) {
    await supabase.from('pull_out_requests').update({ status: 'rejected' }).eq('id', id)
    toast.success('Request rejected')
    await loadData()
    if (viewReq?.id === id) setViewReq(prev => prev ? { ...prev, status: 'rejected' as PulloutRequest['status'] } : null)
  }

  async function handleReqComplete(id: string) {
    setReqSaving(true)
    await supabase.from('pull_out_requests').update({ status: 'completed' }).eq('id', id)
    setReqSaving(false)
    toast.success('Request marked completed')
    await loadData()
    if (viewReq?.id === id) setViewReq(prev => prev ? { ...prev, status: 'completed' } : null)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-orange-600/10 flex items-center justify-center">
            <RotateCcw className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold leading-none">Pull-Out &amp; Billing</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Stock on-hand, movement history and pull-out requests</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Refresh
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100"
            onClick={() => { setPulloutForm({ ...EMPTY_PR, date: TODAY }); setPulloutOpen(true) }}>
            <RotateCcw className="h-4 w-4" />Pull Out
          </Button>
          <Button size="sm" className="gap-1.5 bg-red-600 hover:bg-red-700 text-white"
            onClick={() => { setCsiForm(EMPTY_CSI); setCsiOpen(true) }}>
            <Plus className="h-4 w-4" />Bill CSI
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total Products',    value: rows.length,    color: '',               icon: <Package className="h-3.5 w-3.5 text-gray-500" /> },
          { label: 'On-Hand SKUs',      value: onHandSkus,     color: 'text-amber-600', icon: <BarChart3 className="h-3.5 w-3.5 text-amber-500" /> },
          { label: 'Negative SKUs',     value: negSkus,        color: 'text-red-600',   icon: <TrendingUp className="h-3.5 w-3.5 text-red-500 rotate-180" /> },
          { label: 'Est. Value',        value: peso(estValue), color: 'text-green-700', icon: <TrendingUp className="h-3.5 w-3.5 text-green-600" /> },
          { label: 'CSI Invoices',      value: counts.csi,     color: 'text-indigo-600',icon: <FileText className="h-3.5 w-3.5 text-indigo-500" /> },
          { label: 'DR Logs',           value: counts.dr,      color: '',               icon: <Truck className="h-3.5 w-3.5 text-gray-500" /> },
          { label: 'Pull-Out Reqs',     value: counts.pr,      color: '',               icon: <RotateCcw className="h-3.5 w-3.5 text-gray-500" /> },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="pt-4 pb-3">
              <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 leading-tight">{k.icon}{k.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters + Tab Bar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
        {tab !== 'requests' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Filter by Client</label>
              <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 min-w-[200px] bg-gray-50">
                <option value="">All Clients</option>
                {clientNames.map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Search Product</label>
              <div className="relative">
                <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)}
                  list="pullout-products" placeholder="Type or select product…"
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 min-w-[260px] bg-gray-50 pr-8" />
                {productSearch && (
                  <button onClick={() => setProductSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <datalist id="pullout-products">{allProducts.map(p => <option key={p} value={p} />)}</datalist>
            </div>
          </>
        )}
        <div className="flex gap-2 ml-auto">
          {([
            { key: 'stock',     icon: <FileText className="h-3.5 w-3.5" />,     label: 'Stock' },
            { key: 'client',    icon: <Users className="h-3.5 w-3.5" />,        label: 'By Client' },
            { key: 'movements', icon: <TrendingUp className="h-3.5 w-3.5" />,   label: 'Movements' },
            { key: 'requests',  icon: <RotateCcw className="h-3.5 w-3.5" />,    label: 'Requests' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-red-600 text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
        </CardContent>
      </Card>

      {/* ── Stock Tab ─────────────────────────────────────────────────────────── */}
      {tab === 'stock' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />Stock On-Hand ({filteredRows.length} products)
              <span className="text-xs font-normal text-muted-foreground ml-1">Click a row to see DR &amp; CSI details</span>
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ background: '#DC2626' }} className="text-white text-xs uppercase">
                  <th className="px-3 py-2.5 text-left">#</th>
                  <th className="px-3 py-2.5 text-left">Product</th>
                  <th className="px-3 py-2.5 text-left">Unit</th>
                  <th className="px-3 py-2.5 text-right">Delivered</th>
                  <th className="px-3 py-2.5 text-right">Billed</th>
                  <th className="px-3 py-2.5 text-right">Pulled Out</th>
                  <th className="px-3 py-2.5 text-right">On-Hand</th>
                  <th className="px-3 py-2.5 text-right">Price</th>
                  <th className="px-3 py-2.5 text-right">Est. Value</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, i) => (
                  <tr key={row.product} onClick={() => setDetailProduct(row)}
                    className="hover:bg-red-50/40 border-b border-gray-100 cursor-pointer active:bg-red-50">
                    <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-gray-800">{row.product}</td>
                    <td className="px-3 py-2 text-gray-500">{row.unit || '—'}</td>
                    <td className="px-3 py-2 text-right text-blue-700 font-semibold">{fmtNum(row.delivered)}</td>
                    <td className="px-3 py-2 text-right text-purple-700 font-semibold">{fmtNum(row.billed)}</td>
                    <td className="px-3 py-2 text-right text-orange-600 font-semibold">{row.pulledOut > 0 ? fmtNum(row.pulledOut) : '—'}</td>
                    <td className={`px-3 py-2 text-right ${onHandCls(row.onHand)}`}>{fmtNum(row.onHand)}</td>
                    <td className="px-3 py-2 text-right font-mono">{peso(row.price)}</td>
                    <td className="px-3 py-2 text-right font-mono text-green-700">{peso(row.onHand * row.price)}</td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400">No data found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── By Client Tab ─────────────────────────────────────────────────────── */}
      {tab === 'client' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2"><Package className="h-4 w-4" />Stock by Client ({clientStock.length} clients)</CardTitle>
              <span className="text-xs text-muted-foreground">Click a client to drill into their items</span>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ background: '#DC2626' }} className="text-white text-xs uppercase">
                    <th className="px-3 py-2.5 text-left">#</th>
                    <th className="px-3 py-2.5 text-left">Client</th>
                    <th className="px-3 py-2.5 text-right">Products</th>
                    <th className="px-3 py-2.5 text-right">Delivered</th>
                    <th className="px-3 py-2.5 text-right">Billed</th>
                    <th className="px-3 py-2.5 text-right">Pulled Out</th>
                    <th className="px-3 py-2.5 text-right">On-Hand (units)</th>
                    <th className="px-3 py-2.5 text-right">Est. Value</th>
                  </tr>
                </thead>
                <tbody>
                  {clientStock.map((row, i) => (
                    <tr key={row.client}
                      onClick={() => setSelectedClientStock(prev => prev === row.client ? '' : row.client)}
                      className={`border-b border-gray-100 cursor-pointer transition-colors ${selectedClientStock === row.client ? 'bg-red-50 border-l-4 border-l-red-600' : 'hover:bg-gray-50'}`}>
                      <td className="px-3 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-3 py-2.5 font-semibold text-gray-900">{row.client}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{fmtNum(row.products)}</td>
                      <td className="px-3 py-2.5 text-right text-blue-700 font-semibold">{fmtNum(row.delivered)}</td>
                      <td className="px-3 py-2.5 text-right text-purple-700">{fmtNum(row.billed)}</td>
                      <td className="px-3 py-2.5 text-right text-orange-600">{row.pulledOut > 0 ? fmtNum(row.pulledOut) : '—'}</td>
                      <td className={`px-3 py-2.5 text-right font-bold ${onHandCls(row.onHand)}`}>{fmtNum(row.onHand)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs text-green-700 font-semibold">{row.value > 0 ? peso(row.value) : '—'}</td>
                    </tr>
                  ))}
                  {clientStock.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">No data.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          {selectedClientStock && (() => {
            const clientRows = filteredRows.map(r => {
              const drC = drItems.filter(d => d.client_name === selectedClientStock && d.item_name === r.product)
              const csiC = csiItems.filter(c => c.client_name === selectedClientStock && c.item_name === r.product)
              const poC = pulloutLines.filter(p => p.client_name === selectedClientStock && p.item_name === r.product)
              const d = drC.reduce((s, x) => s + x.quantity, 0)
              const b = csiC.reduce((s, x) => s + (x.quantity ?? 0), 0)
              const p = poC.reduce((s, x) => s + x.quantity, 0)
              if (d === 0 && b === 0 && p === 0) return null
              return { ...r, delivered: d, billed: b, pulledOut: p, onHand: d - b - p }
            }).filter(Boolean) as ProductRow[]
            return (
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium">{selectedClientStock} — Item Breakdown</CardTitle>
                  <span className="text-xs text-muted-foreground">{clientRows.length} items</span>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr style={{ background: '#DC2626' }} className="text-white text-xs uppercase">
                        <th className="px-3 py-2.5 text-left">#</th>
                        <th className="px-3 py-2.5 text-left">Product</th>
                        <th className="px-3 py-2.5 text-left">Unit</th>
                        <th className="px-3 py-2.5 text-right">Delivered</th>
                        <th className="px-3 py-2.5 text-right">Billed</th>
                        <th className="px-3 py-2.5 text-right">Pulled Out</th>
                        <th className="px-3 py-2.5 text-right">On-Hand</th>
                        <th className="px-3 py-2.5 text-right">Price</th>
                        <th className="px-3 py-2.5 text-right">Est. Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientRows.map((row, i) => (
                        <tr key={row.product} className="border-b border-gray-100 hover:bg-muted/30">
                          <td className="px-3 py-2 text-muted-foreground text-xs">{i + 1}</td>
                          <td className="px-3 py-2 font-medium">{row.product}</td>
                          <td className="px-3 py-2 text-muted-foreground">{row.unit || '—'}</td>
                          <td className="px-3 py-2 text-right text-blue-700 font-semibold">{fmtNum(row.delivered)}</td>
                          <td className="px-3 py-2 text-right text-purple-700 font-semibold">{fmtNum(row.billed)}</td>
                          <td className="px-3 py-2 text-right text-orange-600">{row.pulledOut > 0 ? fmtNum(row.pulledOut) : '—'}</td>
                          <td className={`px-3 py-2 text-right ${onHandCls(row.onHand)}`}>{fmtNum(row.onHand)}</td>
                          <td className="px-3 py-2 text-right font-mono">{peso(row.price)}</td>
                          <td className="px-3 py-2 text-right font-mono text-green-700">{peso(Math.max(0, row.onHand) * row.price)}</td>
                        </tr>
                      ))}
                      {clientRows.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">No items for this client.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Card>
            )
          })()}
        </div>
      )}

      {/* ── Movements Tab ────────────────────────────────────────────────────── */}
      {tab === 'movements' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />Stock Movements ({movements.length})
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0">
                <tr style={{ background: '#DC2626' }} className="text-white text-xs uppercase">
                  <th className="px-3 py-2.5 text-left">#</th>
                  <th className="px-3 py-2.5 text-left">Date</th>
                  <th className="px-3 py-2.5 text-left">Type</th>
                  <th className="px-3 py-2.5 text-left">Dir</th>
                  <th className="px-3 py-2.5 text-left">Ref #</th>
                  <th className="px-3 py-2.5 text-left">SO #</th>
                  <th className="px-3 py-2.5 text-left">Client</th>
                  <th className="px-3 py-2.5 text-left">Product</th>
                  <th className="px-3 py-2.5 text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m, i) => (
                  <tr key={i} className={`border-b border-gray-100 ${m.dir === 'IN' ? 'hover:bg-green-50' : 'hover:bg-red-50'}`}>
                    <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-3 py-2 text-gray-500">{m.date || '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${m.type === 'DR' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{m.type}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${m.dir === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{m.dir === 'IN' ? '▲ IN' : '▼ OUT'}</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs font-semibold text-red-700">{m.ref || '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs text-blue-700">{m.so || '—'}</td>
                    <td className="px-3 py-2 font-medium">{m.client}</td>
                    <td className="px-3 py-2 text-gray-700">{m.product}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${m.dir === 'IN' ? 'text-green-700' : 'text-red-700'}`}>{m.dir === 'IN' ? '+' : '-'}{fmtNum(m.qty)}</td>
                  </tr>
                ))}
                {movements.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">No movements found.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Requests Tab ─────────────────────────────────────────────────────── */}
      {tab === 'requests' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {([
              ['Total', pulloutRequests.length],
              ['Pending', pulloutRequests.filter(p => p.status === 'pending').length],
              ['Approved', pulloutRequests.filter(p => p.status === 'approved').length],
              ['Completed', pulloutRequests.filter(p => p.status === 'completed').length],
            ] as const).map(([label, value]) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-3 text-center">
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={reqSearch} onChange={e => setReqSearch(e.target.value)}
                    placeholder="Search by PR# or client…"
                    className="pl-9" />
                </div>
                <select value={reqStatusFilter} onChange={e => setReqStatusFilter(e.target.value)}
                  className="px-3 py-2 text-sm border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring bg-background">
                  <option value="all">All Status</option>
                  {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-red-600 text-white text-xs">
                  <th className="px-5 py-3 text-left">PR #</th>
                  <th className="px-4 py-3 text-left">Client</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                  <th className="px-4 py-3 text-center">Items</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRequests.length === 0
                  ? <tr><td colSpan={7} className="p-8 text-center text-gray-400">No pull-out requests found.</td></tr>
                  : filteredRequests.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-mono font-semibold text-gray-900">{p.pr_number || '—'}</td>
                      <td className="px-4 py-3 text-gray-700 font-medium">{p.client_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{p.date ? fmtDate(p.date) : '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate">{p.reason || '—'}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{p.items?.length || 0}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className={`text-xs capitalize ${STATUS_COLORS[p.status] ?? ''}`}>{p.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setViewReq(p)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {p.status === 'pending' && <>
                            <button onClick={() => handleReqApprove(p.id)} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium">Approve</button>
                            <button onClick={() => handleReqReject(p.id)} className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium">Reject</button>
                          </>}
                          {p.status === 'approved' && (
                            <button onClick={() => handleReqComplete(p.id)} disabled={reqSaving} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-medium disabled:opacity-50">Complete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Product Detail Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!detailProduct} onOpenChange={o => { if (!o) setDetailProduct(null) }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Product Details — {detailProduct?.product}</DialogTitle>
          </DialogHeader>
          {detailProduct && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button size="sm" className="gap-1.5 bg-orange-600 hover:bg-orange-700 text-white"
                  onClick={() => { setDetailProduct(null); setPulloutForm({ ...EMPTY_PR, date: TODAY, item_name: detailProduct.product, unit: detailProduct.unit }); setPulloutOpen(true) }}>
                  <RotateCcw className="h-3.5 w-3.5" />Pull Out This Item
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
                  <div className="text-xs text-blue-500 font-semibold">Delivered</div>
                  <div className="text-2xl font-black text-blue-700">{fmtNum(detailProduct.delivered)}</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center border border-purple-100">
                  <div className="text-xs text-purple-500 font-semibold">Billed (CSI)</div>
                  <div className="text-2xl font-black text-purple-700">{fmtNum(detailProduct.billed)}</div>
                </div>
                <div className={`rounded-lg p-3 text-center border ${detailProduct.onHand > 0 ? 'bg-amber-50 border-amber-100' : detailProduct.onHand < 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                  <div className="text-xs font-semibold text-gray-500">On-Hand</div>
                  <div className={`text-2xl font-black ${onHandCls(detailProduct.onHand)}`}>{fmtNum(detailProduct.onHand)}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center border border-green-100">
                  <div className="text-xs text-green-500 font-semibold">Est. Value</div>
                  <div className="text-lg font-black text-green-700">{peso(detailProduct.onHand * detailProduct.price)}</div>
                </div>
              </div>

              {/* DR Records */}
              <div>
                <div className="font-semibold text-gray-700 text-sm mb-2 flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">DR</span>
                  Delivery Records ({detailDrRows.length})
                </div>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-blue-600 text-white">
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">DR #</th>
                      <th className="px-3 py-2 text-left">Client</th>
                      <th className="px-3 py-2 text-left">Unit</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                    </tr></thead>
                    <tbody>
                      {detailDrRows.length === 0
                        ? <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-400">No DR records.</td></tr>
                        : detailDrRows.map((r, i) => (
                          <tr key={i} className="border-b border-gray-100 hover:bg-blue-50/30">
                            <td className="px-3 py-2 text-gray-500">{r.dr_date || '—'}</td>
                            <td className="px-3 py-2 font-mono font-semibold text-blue-700">{r.dr_number || '—'}</td>
                            <td className="px-3 py-2 font-medium">{r.client_name || '—'}</td>
                            <td className="px-3 py-2 text-gray-500">{r.unit || '—'}</td>
                            <td className="px-3 py-2 text-right font-semibold text-blue-700">{r.quantity}</td>
                          </tr>
                        ))}
                    </tbody>
                    {detailDrRows.length > 0 && (
                      <tfoot><tr className="bg-blue-50 font-bold">
                        <td colSpan={4} className="px-3 py-2 text-right text-xs">Total Delivered</td>
                        <td className="px-3 py-2 text-right text-blue-700">{detailDrRows.reduce((s, r) => s + r.quantity, 0)}</td>
                      </tr></tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* CSI Records */}
              <div>
                <div className="font-semibold text-gray-700 text-sm mb-2 flex items-center gap-2">
                  <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold">CSI</span>
                  Sales Invoice Records ({detailCsiRows.length})
                </div>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-purple-600 text-white">
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">SI #</th>
                      <th className="px-3 py-2 text-left">Client</th>
                      <th className="px-3 py-2 text-left">Unit</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Unit Price</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr></thead>
                    <tbody>
                      {detailCsiRows.length === 0
                        ? <tr><td colSpan={8} className="px-3 py-4 text-center text-gray-400">No CSI records.</td></tr>
                        : detailCsiRows.map(r => (
                          <tr key={r.id} className="border-b border-gray-100 hover:bg-purple-50/30">
                            <td className="px-3 py-2 text-gray-500">{r.si_date || '—'}</td>
                            <td className="px-3 py-2 font-mono font-semibold text-purple-700">{r.si_number || '—'}</td>
                            <td className="px-3 py-2 font-medium">{r.client_name || '—'}</td>
                            <td className="px-3 py-2 text-gray-500">{r.unit || '—'}</td>
                            <td className="px-3 py-2 text-right font-semibold text-purple-700">{r.quantity ?? '—'}</td>
                            <td className="px-3 py-2 text-right font-mono">{peso(r.unit_price)}</td>
                            <td className="px-3 py-2 text-right font-mono text-blue-700">{peso(r.amount)}</td>
                            <td className="px-3 py-2">
                              <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${r.collection_status === 'collected' ? 'bg-green-100 text-green-700' : r.collection_status === 'uncollectible' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {(r.collection_status || 'for_collection').replace(/_/g, ' ')}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                    {detailCsiRows.length > 0 && (
                      <tfoot><tr className="bg-purple-50 font-bold">
                        <td colSpan={4} className="px-3 py-2 text-right text-xs">Total Billed</td>
                        <td className="px-3 py-2 text-right text-purple-700">{detailCsiRows.reduce((s, r) => s + (r.quantity ?? 0), 0)}</td>
                        <td />
                        <td className="px-3 py-2 text-right font-mono text-blue-700">{peso(detailCsiRows.reduce((s, r) => s + (r.amount ?? 0), 0))}</td>
                        <td />
                      </tr></tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── View Request Dialog ───────────────────────────────────────────────── */}
      <Dialog open={!!viewReq} onOpenChange={o => { if (!o) setViewReq(null) }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <DialogTitle>{viewReq?.pr_number || 'Pull-Out Request'}</DialogTitle>
              {viewReq && <Badge variant="outline" className={`text-xs capitalize ${STATUS_COLORS[viewReq.status] ?? ''}`}>{viewReq.status}</Badge>}
            </div>
          </DialogHeader>
          {viewReq && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-xs text-gray-500">Client</p><p className="font-semibold">{viewReq.client_name || '—'}</p></div>
                <div><p className="text-xs text-gray-500">Date</p><p>{viewReq.date ? fmtDate(viewReq.date) : '—'}</p></div>
                <div className="col-span-2"><p className="text-xs text-gray-500">Reason</p><p>{viewReq.reason || '—'}</p></div>
              </div>
              <table className="w-full text-sm border border-gray-100 rounded-xl overflow-hidden">
                <thead><tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <th className="px-4 py-2 text-left">Item</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-center">Unit</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {(viewReq.items || []).map((it, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 font-medium">{it.item_name}</td>
                      <td className="px-4 py-2 text-right">{it.qty}</td>
                      <td className="px-4 py-2 text-center text-xs text-gray-500">{it.unit || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {viewReq.status === 'pending' && (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleReqApprove(viewReq.id)}>Approve</Button>
                  <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" onClick={() => handleReqReject(viewReq.id)}>Reject</Button>
                </div>
              )}
              {viewReq.status === 'approved' && (
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleReqComplete(viewReq.id)} disabled={reqSaving}>
                  {reqSaving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}Mark as Completed
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Pull-Out Modal ────────────────────────────────────────────────────── */}
      <Dialog open={pulloutOpen} onOpenChange={o => { if (!o) setPulloutOpen(false) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><RotateCcw className="h-4 w-4 text-orange-600" />Record Pull-Out</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {([
              { label: 'Date *',       key: 'date',        type: 'date' },
              { label: 'PR Number',    key: 'pr_number',   type: 'text' },
              { label: 'Client *',     key: 'client_name', type: 'text', list: 'po-clients' },
              { label: 'Item Name *',  key: 'item_name',   type: 'text', list: 'po-items' },
              { label: 'Unit',         key: 'unit',        type: 'text' },
              { label: 'Quantity *',   key: 'quantity',    type: 'number' },
            ] as const).map(f => (
              <div key={f.key}>
                <Label className="text-xs font-semibold text-gray-600">{f.label}</Label>
                <input type={f.type} step={f.type === 'number' ? '1' : undefined}
                  value={(pulloutForm as any)[f.key]}
                  list={'list' in f ? f.list : undefined}
                  required={f.label.includes('*')}
                  onChange={e => setPulloutForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50" />
              </div>
            ))}
            <datalist id="po-clients">{clientNames.map(c => <option key={c} value={c} />)}</datalist>
            <datalist id="po-items">{allProducts.map(p => <option key={p} value={p} />)}</datalist>
            <div className="col-span-2">
              <Label className="text-xs font-semibold text-gray-600">Reason</Label>
              <textarea value={pulloutForm.reason} onChange={e => setPulloutForm(p => ({ ...p, reason: e.target.value }))}
                className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50" rows={2} />
            </div>
            <div className="col-span-2 flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setPulloutOpen(false)}>Cancel</Button>
              <Button className="bg-orange-600 hover:bg-orange-700 text-white gap-1.5" onClick={handleSavePullout} disabled={pulloutSaving}>
                {pulloutSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Record Pull-Out
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Bill CSI Modal ────────────────────────────────────────────────────── */}
      <Dialog open={csiOpen} onOpenChange={o => { if (!o) setCsiOpen(false) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-red-600" />Bill CSI — New Entry</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {([
              { label: 'Date *',       key: 'date',        type: 'date' },
              { label: 'SI Number *',  key: 'si_number',   type: 'text' },
              { label: 'Client *',     key: 'client_name', type: 'text' },
              { label: 'Item Name *',  key: 'item_name',   type: 'text' },
              { label: 'Unit',         key: 'unit',        type: 'text' },
              { label: 'Quantity',     key: 'quantity',    type: 'number' },
              { label: 'Unit Price',   key: 'unit_price',  type: 'number' },
              { label: 'Amount',       key: 'amount',      type: 'number' },
            ] as const).map(f => (
              <div key={f.key}>
                <Label className="text-xs font-semibold text-gray-600">{f.label}</Label>
                <input type={f.type} step={f.type === 'number' ? '0.01' : undefined}
                  value={(csiForm as any)[f.key]}
                  required={f.label.includes('*')}
                  onChange={e => setCsiForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-gray-50" />
              </div>
            ))}
            <div className="col-span-2 flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setCsiOpen(false)}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white gap-1.5" onClick={handleSaveCSI} disabled={csiSaving}>
                {csiSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create CSI Entry
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
