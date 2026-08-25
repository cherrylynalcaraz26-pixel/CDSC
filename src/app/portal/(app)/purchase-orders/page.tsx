'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { ClipboardList, Loader2, ChevronDown, ChevronUp, Package, ShoppingCart, CheckCircle2, TrendingUp } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useSearchContext } from '@/context/search-context'

type POStatus = 'open' | 'partially_delivered' | 'completed' | 'cancelled'

const STATUS_CFG: Record<POStatus, { label: string; cls: string }> = {
  open:                { label: 'Pending',          cls: 'bg-blue-100 text-blue-700' },
  partially_delivered: { label: 'Partial Delivery', cls: 'bg-yellow-100 text-yellow-700' },
  completed:           { label: 'Completed',        cls: 'bg-green-100 text-green-700' },
  cancelled:           { label: 'Cancelled',        cls: 'bg-red-100 text-red-700' },
}

interface PO {
  id: string
  po_number: string | null
  po_date: string | null
  delivery_date: string | null
  status: POStatus
  total_amount: number
  payment_terms: string | null
  remarks: string | null
}

interface POItem {
  item_name: string
  quantity: number
  unit_of_measure: string | null
  unit_cost: number
  total_cost: number
}

function fmt(n: number) {
  return '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const KPI_GRAD: Record<string, { grad: string; tint: string; shadow: string }> = {
  gray: { grad: 'from-slate-400 to-slate-500', tint: 'from-slate-50', shadow: 'shadow-slate-500/30' },
  blue: { grad: 'from-blue-500 to-blue-600', tint: 'from-blue-50', shadow: 'shadow-blue-500/30' },
  green: { grad: 'from-green-500 to-green-600', tint: 'from-green-50', shadow: 'shadow-green-500/30' },
  red: { grad: 'from-red-600 to-red-800', tint: 'from-red-50', shadow: 'shadow-red-600/30' },
}

function buildYearlyValueData(pos: PO[]) {
  const year = new Date().getFullYear()
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(year, i, 1)
    return { month: format(d, 'MMM'), start: startOfMonth(d), end: endOfMonth(d), amount: 0 }
  })
  for (const po of pos) {
    if (po.status === 'cancelled' || !po.po_date) continue
    const d = new Date(po.po_date)
    for (const m of months) {
      if (d >= m.start && d <= m.end) m.amount += Number(po.total_amount) || 0
    }
  }
  return months.map(m => ({ month: m.month, Amount: m.amount }))
}

export default function VendorPurchaseOrdersPage() {
  const supabase = createClient()
  const { query: search } = useSearchContext()
  const [loading, setLoading] = useState(true)
  const [pos, setPOs] = useState<PO[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [itemsByPO, setItemsByPO] = useState<Record<string, POItem[]>>({})
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }
      const { data: supplierRow } = await supabase.from('suppliers').select('id').eq('auth_user_id', session.user.id).single()
      if (!supplierRow) { setLoading(false); return }
      const { data } = await supabase.from('purchase_orders')
        .select('id, po_number, po_date, delivery_date, status, total_amount, payment_terms, remarks')
        .eq('supplier_id', supplierRow.id)
        .order('po_date', { ascending: false })
      setPOs((data ?? []) as PO[])
      setLoading(false)
    }
    load()
  }, [])

  async function toggleExpand(po: PO) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(po.id)) next.delete(po.id)
      else next.add(po.id)
      return next
    })
    if (!itemsByPO[po.id]) {
      setLoadingItems(prev => new Set(prev).add(po.id))
      const { data } = await supabase.from('po_items')
        .select('item_name, quantity, unit_of_measure, unit_cost, total_cost')
        .eq('po_id', po.id)
        .order('created_at')
      setItemsByPO(prev => ({ ...prev, [po.id]: (data ?? []) as POItem[] }))
      setLoadingItems(prev => { const next = new Set(prev); next.delete(po.id); return next })
    }
  }

  const filtered = pos.filter(po => {
    const q = search.toLowerCase()
    return !q || (po.po_number ?? '').toLowerCase().includes(q) || (po.remarks ?? '').toLowerCase().includes(q)
  })

  const openCount = pos.filter(p => p.status === 'open').length
  const completedCount = pos.filter(p => p.status === 'completed').length
  const totalValue = pos.filter(p => p.status !== 'cancelled').reduce((s, p) => s + (Number(p.total_amount) || 0), 0)
  const yearlyData = buildYearlyValueData(pos)

  if (loading) return (
    <div className="flex justify-center py-24">
      <Loader2 className="h-7 w-7 text-red-600 animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
        <p className="text-sm text-gray-500 mt-0.5">Purchase orders raised against your company by CDSC Industrial Supply</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total POs',   value: pos.length,      icon: ShoppingCart, family: 'gray' },
          { label: 'Pending',     value: openCount,       icon: ClipboardList, family: 'blue' },
          { label: 'Completed',   value: completedCount,  icon: CheckCircle2, family: 'green' },
          { label: 'Total Value', value: fmt(totalValue), icon: TrendingUp,   family: 'red', isText: true },
        ].map(s => {
          const { grad, tint, shadow } = KPI_GRAD[s.family]
          return (
            <div key={s.label} className="relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm p-4">
              <div className={`absolute inset-0 bg-gradient-to-br ${tint} to-transparent`} />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <div className={`font-bold text-gray-900 ${'isText' in s ? 'text-lg' : 'text-2xl'}`}>{s.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                </div>
                <div className={`h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-sm ${shadow}`}>
                  <s.icon className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-gray-200 shadow-lg">
        <div className="bg-gradient-to-r from-red-700 to-red-900 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Total Value</h2>
            <p className="text-xs text-red-100 mt-0.5">{new Date().getFullYear()} full year</p>
          </div>
          <TrendingUp className="h-5 w-5 text-red-200" />
        </div>
        <div className="bg-white p-5">
          {yearlyData.every(m => m.Amount === 0) ? (
            <div className="flex items-center justify-center h-40 text-gray-300 text-sm">No PO data yet this year</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={yearlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="poLogValueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `₱${(v / 1000).toLocaleString()}k`} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} formatter={v => [fmt(Number(v ?? 0)), 'Total Value']} />
                <Area type="monotone" dataKey="Amount" stroke="#dc2626" strokeWidth={2.5} fill="url(#poLogValueGrad)" dot={false} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50/60 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-red-600" />
          <span className="text-sm font-semibold text-gray-900">Purchase Order Log</span>
        </div>
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="h-8 w-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No purchase orders yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((po, idx) => {
              const cfg = STATUS_CFG[po.status] ?? STATUS_CFG.open
              const isOpen = expanded.has(po.id)
              return (
                <div key={po.id}>
                  <button
                    onClick={() => toggleExpand(po)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <span className="text-xs text-gray-400 w-6 shrink-0 text-right">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{po.po_number ?? 'PO'}</div>
                      <div className="text-xs text-gray-400">
                        {po.po_date ? format(new Date(po.po_date), 'MMM d, yyyy') : '—'}
                        {po.delivery_date && <> · Delivery: {format(new Date(po.delivery_date), 'MMM d, yyyy')}</>}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 hidden sm:block">{fmt(po.total_amount)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>{cfg.label}</span>
                    {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 bg-gray-50/40">
                      {loadingItems.has(po.id) ? (
                        <div className="py-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50 text-gray-500">
                                <th className="text-left px-3 py-2 font-medium">Item</th>
                                <th className="text-right px-3 py-2 font-medium">Qty</th>
                                <th className="text-left px-3 py-2 font-medium">Unit</th>
                                <th className="text-right px-3 py-2 font-medium">Unit Cost</th>
                                <th className="text-right px-3 py-2 font-medium">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {(itemsByPO[po.id] ?? []).map((it, i) => (
                                <tr key={i}>
                                  <td className="px-3 py-2 text-gray-800">{it.item_name}</td>
                                  <td className="px-3 py-2 text-right text-gray-600">{it.quantity}</td>
                                  <td className="px-3 py-2 text-gray-600">{it.unit_of_measure ?? '—'}</td>
                                  <td className="px-3 py-2 text-right text-gray-600">{fmt(it.unit_cost)}</td>
                                  <td className="px-3 py-2 text-right font-medium text-gray-800">{fmt(it.total_cost)}</td>
                                </tr>
                              ))}
                              {(itemsByPO[po.id] ?? []).length === 0 && (
                                <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-400">No line items</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {po.remarks && <p className="text-xs text-gray-500 mt-2">Remarks: {po.remarks}</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
