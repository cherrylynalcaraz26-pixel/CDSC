'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { ClipboardList, Loader2, ChevronDown, ChevronUp, Package } from 'lucide-react'
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
          { label: 'Total POs',   value: pos.length,      color: 'text-gray-700',  bg: 'bg-gray-100' },
          { label: 'Pending',     value: openCount,       color: 'text-blue-600',  bg: 'bg-blue-50' },
          { label: 'Completed',   value: completedCount,  color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Total Value', value: fmt(totalValue), color: 'text-red-600',   bg: 'bg-red-50', isText: true },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`text-2xl font-bold ${s.color} ${'isText' in s ? 'text-lg' : ''}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
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
            {filtered.map(po => {
              const cfg = STATUS_CFG[po.status] ?? STATUS_CFG.open
              const isOpen = expanded.has(po.id)
              return (
                <div key={po.id}>
                  <button
                    onClick={() => toggleExpand(po)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
                  >
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
