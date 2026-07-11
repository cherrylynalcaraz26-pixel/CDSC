'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import Link from 'next/link'
import {
  ShoppingCart, Clock, Truck, CheckCircle2, Plus, Package,
  ChevronRight, Loader2, FileText, Boxes, ClipboardList,
  TrendingUp, AlertTriangle, Send, CheckCircle, XCircle, Receipt,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { DemoVideoButton } from '@/components/live-video-button'

interface SalesOrder {
  id: string
  so_number: string | null
  client_po_number: string | null
  so_date: string | null
  created_at: string
  status: string
  total_amount: number
}

interface Quotation {
  id: string
  quote_number: string | null
  quote_date: string | null
  status: string
  total_amount: number
}

interface StockRow {
  id: string
  item_name: string
  quantity_on_hand: number
  low_stock_threshold: number
  unit: string | null
}

const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  draft:      { label: 'Pending Review', cls: 'bg-yellow-100 text-yellow-700' },
  confirmed:  { label: 'Confirmed',      cls: 'bg-blue-100 text-blue-700' },
  processing: { label: 'In Progress',    cls: 'bg-indigo-100 text-indigo-700' },
  shipped:    { label: 'Shipped',        cls: 'bg-purple-100 text-purple-700' },
  delivered:  { label: 'Delivered',      cls: 'bg-green-100 text-green-700' },
  cancelled:  { label: 'Cancelled',      cls: 'bg-red-100 text-red-700' },
}

const QUOTE_STATUS: Record<string, { label: string; color: string }> = {
  sent:     { label: 'Pending', color: '#3b82f6' },
  accepted: { label: 'Accepted', color: '#22c55e' },
  declined: { label: 'Declined', color: '#ef4444' },
  expired:  { label: 'Expired', color: '#f59e0b' },
}

function fmt(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Build last-6-months order activity data
function buildMonthlyData(orders: SalesOrder[]) {
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), 5 - i)
    return { month: format(d, 'MMM'), start: startOfMonth(d), end: endOfMonth(d), count: 0, amount: 0 }
  })
  for (const o of orders) {
    const d = new Date(o.so_date ?? o.created_at)
    for (const m of months) {
      if (d >= m.start && d <= m.end) { m.count++; m.amount += o.total_amount }
    }
  }
  return months.map(m => ({ month: m.month, Orders: m.count, Amount: m.amount }))
}

export default function PortalDashboard() {
  const supabase = createClient()
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [stock, setStock] = useState<StockRow[]>([])
  const [clientName, setClientName] = useState('')
  const [userName, setUserName] = useState('')
  const [billing, setBilling] = useState<{ billed: number; collected: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', session.user.id).single()
      setUserName(profile?.full_name ?? session.user.email?.split('@')[0] ?? '')
      const { data: clientRow } = await supabase.from('clients').select('id, company_name, show_csi_in_portal').eq('auth_user_id', session.user.id).single()
      if (clientRow) {
        setClientName(clientRow.company_name)
        const [{ data: orderData }, { data: quoteData }, { data: stockData }] = await Promise.all([
          supabase.from('sales_orders').select('id, so_number, client_po_number, so_date, created_at, status, total_amount').eq('client_name', clientRow.company_name).eq('show_in_portal', true).order('created_at', { ascending: false }),
          supabase.from('quotations').select('id, quote_number, quote_date, status, total_amount').eq('client_name', clientRow.company_name).neq('status', 'draft').order('created_at', { ascending: false }),
          supabase.from('client_inventory').select('id, item_name, quantity_on_hand, low_stock_threshold, unit').eq('client_id', clientRow.id).order('item_name'),
        ])
        setOrders(orderData ?? [])
        setQuotations(quoteData ?? [])
        setStock(stockData ?? [])

        // Billed vs collected — tells the client whether CDSC still has a
        // collection pending from them (same recon the admin dashboard uses).
        if (clientRow.show_csi_in_portal) {
          const [csiRows, { data: colRows }] = await Promise.all([
            fetchAllRows((from, to) => supabase.from('csi_records').select('quantity, unit_price').eq('client_name', clientRow.company_name).order('id').range(from, to)),
            supabase.from('collections').select('amount').eq('client_name', clientRow.company_name).eq('status', 'posted'),
          ])
          const billed = csiRows.reduce((s, r: any) => s + (Number(r.quantity) || 0) * (Number(r.unit_price) || 0), 0)
          const collected = (colRows ?? []).reduce((s, r: any) => s + (Number(r.amount) || 0), 0)
          if (billed > 0) setBilling({ billed, collected })
        }
      }
      setLoading(false)
    }
    init()
  }, [])

  // Order stats
  const totalOrders   = orders.length
  const pendingOrders = orders.filter(o => o.status === 'draft').length
  const activeOrders  = orders.filter(o => ['confirmed', 'processing', 'shipped'].includes(o.status)).length
  const delivered     = orders.filter(o => o.status === 'delivered').length
  const totalSpend    = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.total_amount, 0)

  // Quotation stats
  const totalQuotes    = quotations.length
  const pendingQuotes  = quotations.filter(q => q.status === 'sent').length
  const acceptedQuotes = quotations.filter(q => q.status === 'accepted').length
  const quotePieData   = Object.entries(QUOTE_STATUS).map(([k, v]) => ({
    name: v.label, value: quotations.filter(q => q.status === k).length, color: v.color,
  })).filter(d => d.value > 0)

  // Stock stats
  const totalItems    = stock.length
  const lowStockItems = stock.filter(s => s.quantity_on_hand > 0 && s.quantity_on_hand <= s.low_stock_threshold)
  const outOfStock    = stock.filter(s => s.quantity_on_hand === 0)
  const stockBarData  = stock.slice(0, 8).map(s => ({
    name: s.item_name.length > 14 ? s.item_name.slice(0, 14) + '…' : s.item_name,
    qty: s.quantity_on_hand,
    threshold: s.low_stock_threshold,
  }))

  // Monthly order chart
  const monthlyData = buildMonthlyData(orders)
  const recent      = orders.slice(0, 5)

  if (loading) return (
    <div className="flex justify-center py-24">
      <Loader2 className="h-7 w-7 text-red-600 animate-spin" />
    </div>
  )

  return (
    <div className="space-y-7">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back{clientName ? `, ${clientName}` : userName ? `, ${userName}` : ''}!
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Here's your overview for today.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <DemoVideoButton />
          <Link href="/portal/requests/new"
            className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            <Plus className="h-4 w-4" /> New Order
          </Link>
          <Link href="/portal/inventory"
            className="inline-flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            <Package className="h-4 w-4" /> Browse Catalog
          </Link>
        </div>
      </div>

      {/* Pending collection notice — is CDSC still waiting on a payment? */}
      {billing && (billing.billed - billing.collected > 0.01 ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Receipt className="h-4 w-4 text-red-600 shrink-0" />
            <div>
              <span className="text-sm font-semibold text-red-800 block">Pending Collection</span>
              <span className="text-xs text-red-700">
                CDSC has a pending collection of <span className="font-bold">{fmt(billing.billed - billing.collected)}</span> on your account
                ({fmt(billing.billed)} billed, {fmt(billing.collected)} collected). Please coordinate payment with CDSC.
              </span>
            </div>
          </div>
          <Link href="/portal/stock"
            className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-red-700 border border-red-300 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors">
            View Invoices <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <span className="text-xs text-green-800">
            <span className="font-semibold">No pending collections</span> — your account with CDSC is fully settled ({fmt(billing.billed)} billed and collected).
          </span>
        </div>
      ))}

      {/* Low stock / out of stock alerts */}
      {(lowStockItems.length > 0 || outOfStock.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-sm font-semibold text-amber-800">Stock Alerts</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {outOfStock.map(s => (
              <span key={s.id} className="text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-1 rounded-lg font-medium">
                ⚠ {s.item_name} — Out of Stock
              </span>
            ))}
            {lowStockItems.map(s => (
              <span key={s.id} className="text-xs bg-amber-100 text-amber-800 border border-amber-200 px-2 py-1 rounded-lg font-medium">
                {s.item_name} — {s.quantity_on_hand} {s.unit ?? 'pcs'} left
              </span>
            ))}
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total Orders',   value: totalOrders,   icon: ShoppingCart,  color: 'text-gray-700',   bg: 'bg-gray-100' },
          { label: 'Pending Review', value: pendingOrders, icon: Clock,         color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'In Progress',    value: activeOrders,  icon: Truck,         color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Delivered',      value: delivered,     icon: CheckCircle2,  color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Total Spend',    value: fmt(totalSpend), icon: TrendingUp,  color: 'text-red-600',    bg: 'bg-red-50', isText: true },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`inline-flex items-center justify-center h-9 w-9 rounded-lg ${s.bg} mb-2`}>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <div className={`text-2xl font-bold ${s.color} ${'isText' in s ? 'text-lg' : ''}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Monthly orders area chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Order Activity</h2>
              <p className="text-xs text-gray-400">Last 6 months</p>
            </div>
            <TrendingUp className="h-4 w-4 text-gray-300" />
          </div>
          {monthlyData.every(m => m.Orders === 0) ? (
            <div className="flex items-center justify-center h-44 text-gray-300 text-sm">No order data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="orderGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(v, name) => [name === 'Amount' ? fmt(Number(v ?? 0)) : v, name as string]}
                />
                <Area type="monotone" dataKey="Orders" stroke="#dc2626" strokeWidth={2} fill="url(#orderGrad)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Quotation bar chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Quotations</h2>
              <p className="text-xs text-gray-400">{totalQuotes} total</p>
            </div>
            <ClipboardList className="h-4 w-4 text-gray-300" />
          </div>
          {quotePieData.length === 0 ? (
            <div className="flex items-center justify-center h-44 text-gray-300 text-sm">No quotations yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={quotePieData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={60} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {quotePieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="mt-3 pt-3 border-t flex gap-4 text-xs">
            <div>
              <span className="text-gray-400">Pending </span>
              <span className="font-semibold text-blue-600">{pendingQuotes}</span>
            </div>
            <div>
              <span className="text-gray-400">Accepted </span>
              <span className="font-semibold text-green-600">{acceptedQuotes}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stock bar chart + summary */}
      {stock.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Stock Levels</h2>
                <p className="text-xs text-gray-400">Top {Math.min(8, stock.length)} items</p>
              </div>
              <Boxes className="h-4 w-4 text-gray-300" />
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stockBarData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Bar dataKey="qty" name="On Hand" radius={[4, 4, 0, 0]}>
                  {stockBarData.map((entry, i) => (
                    <Cell key={i} fill={entry.qty <= entry.threshold ? '#f59e0b' : '#22c55e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Stock Summary</h2>
            <div className="space-y-3">
              {[
                { label: 'Total Items',   value: totalItems,          color: 'text-gray-800',   bg: 'bg-gray-100' },
                { label: 'In Stock',      value: stock.filter(s => s.quantity_on_hand > s.low_stock_threshold).length, color: 'text-green-700', bg: 'bg-green-50' },
                { label: 'Low Stock',     value: lowStockItems.length,  color: 'text-amber-700',  bg: 'bg-amber-50' },
                { label: 'Out of Stock',  value: outOfStock.length,     color: 'text-red-700',    bg: 'bg-red-50' },
              ].map(s => (
                <div key={s.label} className={`flex items-center justify-between px-3 py-2 rounded-lg ${s.bg}`}>
                  <span className="text-xs text-gray-600">{s.label}</span>
                  <span className={`text-sm font-bold ${s.color}`}>{s.value}</span>
                </div>
              ))}
            </div>
            <Link href="/portal/stock" className="flex items-center justify-between text-xs text-red-600 hover:text-red-700 mt-2">
              Manage Stock <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Bottom row: recent orders + recent quotations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent orders */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Recent Orders</h2>
            <Link href="/portal/requests" className="text-xs text-red-600 hover:text-red-700 flex items-center gap-0.5">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {recent.length === 0 ? (
              <div className="py-10 text-center">
                <FileText className="h-7 w-7 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No orders yet</p>
                <Link href="/portal/requests/new" className="mt-3 inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg">
                  <Plus className="h-3.5 w-3.5" /> New Order
                </Link>
              </div>
            ) : recent.map(o => {
              const st = ORDER_STATUS[o.status] ?? { label: o.status, cls: 'bg-gray-100 text-gray-600' }
              const date = o.so_date ?? o.created_at
              return (
                <Link key={o.id} href="/portal/requests" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {o.client_po_number ?? o.so_number ?? 'Order'}
                    </div>
                    <div className="text-xs text-gray-400">{format(new Date(date), 'MMM d, yyyy')}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {o.total_amount > 0 && (
                      <span className="text-xs font-semibold text-gray-600 hidden sm:block">{fmt(o.total_amount)}</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Recent quotations */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Recent Quotations</h2>
            <Link href="/portal/quotations" className="text-xs text-red-600 hover:text-red-700 flex items-center gap-0.5">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {quotations.length === 0 ? (
              <div className="py-10 text-center">
                <ClipboardList className="h-7 w-7 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No quotations yet</p>
              </div>
            ) : quotations.slice(0, 5).map(q => {
              const qs = QUOTE_STATUS[q.status] ?? { label: q.status, color: '#9ca3af' }
              return (
                <Link key={q.id} href="/portal/quotations" className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{q.quote_number ?? 'Quotation'}</div>
                    <div className="text-xs text-gray-400">{q.quote_date ? format(parseISO(q.quote_date), 'MMM d, yyyy') : '—'}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {q.total_amount > 0 && (
                      <span className="text-xs font-semibold text-gray-600 hidden sm:block">{fmt(q.total_amount)}</span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: qs.color + '20', color: qs.color }}>
                      {qs.label}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
