'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import Link from 'next/link'
import { Plus, Loader2, FileText, ChevronDown, ChevronUp, Package, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSearchContext } from '@/context/search-context'

interface SOItem {
  id: string
  item_name: string
  quantity: number
  unit: string | null
  unit_price: number
  total_amount: number
}

interface SalesOrder {
  id: string
  so_number: string | null
  client_po_number: string | null
  so_date: string | null
  created_at: string
  status: string
  total_amount: number
  remarks: string | null
  so_items: SOItem[]
}

interface Delivery {
  dr_number: string
  dr_date: string | null
  status: string
  so_number: string | null
}

const STATUS: Record<string, { label: string; cls: string }> = {
  draft:      { label: 'Pending Review', cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  confirmed:  { label: 'Confirmed',      cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  processing: { label: 'In Progress',    cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  shipped:    { label: 'Shipped',        cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  delivered:  { label: 'Delivered',      cls: 'bg-green-100 text-green-700 border-green-200' },
  cancelled:  { label: 'Cancelled',      cls: 'bg-red-100 text-red-600 border-red-200' },
}

const FILTERS = [
  { value: '',           label: 'All' },
  { value: 'draft',      label: 'Pending' },
  { value: 'confirmed',  label: 'Confirmed' },
  { value: 'processing', label: 'In Progress' },
  { value: 'shipped',    label: 'Shipped' },
  { value: 'delivered',  label: 'Delivered' },
  { value: 'cancelled',  label: 'Cancelled' },
]

export default function PortalRequests() {
  const supabase = createClient()
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const { query: search } = useSearchContext()
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: clientRow } = await supabase
        .from('clients').select('company_name').eq('auth_user_id', session.user.id).single()
      if (clientRow) {
        const { data } = await supabase
          .from('sales_orders')
          .select('id, so_number, client_po_number, so_date, created_at, status, total_amount, remarks, so_items(id, item_name, quantity, unit, unit_price, total_amount)')
          .eq('client_name', clientRow.company_name)
          .order('created_at', { ascending: false })
        const soList = (data ?? []) as unknown as SalesOrder[]
        setOrders(soList)
        // Load deliveries for these SOs from dr_logs (source of truth)
        const soNums = soList.map(o => o.so_number).filter(Boolean) as string[]
        if (soNums.length > 0) {
          const { data: drData } = await supabase
            .from('dr_logs').select('dr_number,dr_date,status,po_number').in('po_number', soNums)
          setDeliveries((drData ?? []).map((d: any) => ({ dr_number: d.dr_number, dr_date: d.dr_date, status: d.status, so_number: d.po_number })))
        }
      }
      setLoading(false)
    }
    init()
  }, [])

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filtered = orders.filter(o => {
    const s = search.toLowerCase()
    const matchSearch = !s ||
      (o.so_number ?? '').toLowerCase().includes(s) ||
      (o.client_po_number ?? '').toLowerCase().includes(s) ||
      (o.remarks ?? '').toLowerCase().includes(s) ||
      (o.status ? (STATUS[o.status]?.label ?? o.status).toLowerCase().includes(s) : false) ||
      o.so_items.some(i => i.item_name.toLowerCase().includes(s) || (i.unit ?? '').toLowerCase().includes(s))
    const matchFilter = !filter || o.status === filter
    return matchSearch && matchFilter
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track your purchase orders with CDSC Industrial Supply</p>
        </div>
        <Link href="/portal/requests/new"
          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          <Plus className="h-4 w-4" /> New Order
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={cn(
              'px-3.5 py-1.5 text-sm rounded-lg font-medium transition-colors',
              filter === f.value
                ? 'bg-red-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            )}>
            {f.label}
            {f.value === '' && !loading && (
              <span className="ml-1.5 text-xs opacity-70">{orders.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <FileText className="h-9 w-9 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">
            {filter ? 'No orders with this status.' : 'No orders yet.'}
          </p>
          {!filter && (
            <Link href="/portal/requests/new"
              className="mt-4 inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <Plus className="h-4 w-4" /> Submit your first order
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(o => {
            const st = STATUS[o.status] ?? { label: o.status, cls: 'bg-gray-100 text-gray-600 border-gray-200' }
            const date = o.so_date ?? o.created_at
            const isOpen = expanded.has(o.id)
            const hasItems = o.so_items?.length > 0
            const orderDRs = deliveries.filter(d => d.so_number === o.so_number)
            const deliveredCount = orderDRs.filter(d => d.status === 'received' || d.status === 'delivered').length
            const pendingDRs = orderDRs.filter(d => d.status !== 'received' && d.status !== 'delivered')

            return (
              <div key={o.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Order header row */}
                <div className="px-5 py-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">
                          {o.client_po_number ?? o.so_number ?? 'Order'}
                        </span>
                        {o.so_number && o.client_po_number && (
                          <span className="text-xs text-gray-400">{o.so_number}</span>
                        )}
                        <span className={cn('text-xs px-2.5 py-0.5 rounded-full font-medium border', st.cls)}>
                          {st.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-xs text-gray-400">
                          Submitted {format(new Date(date), 'MMM d, yyyy')}
                        </span>
                        {o.total_amount > 0 && (
                          <span className="text-sm font-semibold text-red-600">
                            ₱{o.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                        {hasItems && (
                          <span className="text-xs text-gray-400">
                            {o.so_items.length} item{o.so_items.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {orderDRs.length > 0 && (
                          <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border', pendingDRs.length > 0 ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-green-50 text-green-700 border-green-200')}>
                            <Truck className="h-3 w-3" />
                            {deliveredCount}/{orderDRs.length} DR{orderDRs.length !== 1 ? 's' : ''} delivered
                          </span>
                        )}
                      </div>
                      {o.remarks && (
                        <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{o.remarks}</p>
                      )}
                    </div>
                    {hasItems && (
                      <button
                        onClick={() => toggleExpand(o.id)}
                        className="shrink-0 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        {isOpen ? (
                          <><ChevronUp className="h-3.5 w-3.5" /> Hide items</>
                        ) : (
                          <><ChevronDown className="h-3.5 w-3.5" /> View items</>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Delivery status section */}
                {isOpen && orderDRs.length > 0 && (
                  <div className="border-t border-gray-100 bg-blue-50/40 px-5 py-3">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Truck className="h-3 w-3" /> Delivery Records
                    </div>
                    <div className="space-y-1.5">
                      {orderDRs.map(dr => {
                        const isDelivered = dr.status === 'received' || dr.status === 'delivered'
                        const isPartial = dr.status === 'partial'
                        return (
                          <div key={dr.dr_number} className="flex items-center gap-3 text-xs">
                            <span className="font-mono font-semibold text-red-600">{dr.dr_number}</span>
                            <span className="text-gray-400">{dr.dr_date ? format(new Date(dr.dr_date), 'MMM d, yyyy') : '—'}</span>
                            <span className={cn('px-2 py-0.5 rounded-full font-medium capitalize', isDelivered ? 'bg-green-100 text-green-700' : isPartial ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700')}>
                              {isDelivered ? 'Delivered' : isPartial ? 'Partial' : 'Pending'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Expandable items */}
                {isOpen && hasItems && (
                  <div className="border-t border-gray-100 bg-gray-50">
                    <div className="px-5 py-3">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <Package className="h-3 w-3" /> Order Items
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-gray-400">
                              <th className="text-left pb-2 font-medium pr-4">Item</th>
                              <th className="text-right pb-2 font-medium pr-4">Qty</th>
                              <th className="text-left pb-2 font-medium pr-4">Unit</th>
                              <th className="text-right pb-2 font-medium pr-4">Unit Price</th>
                              <th className="text-right pb-2 font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {o.so_items.map(item => (
                              <tr key={item.id}>
                                <td className="py-2 pr-4 font-medium text-gray-800">{item.item_name}</td>
                                <td className="py-2 pr-4 text-right text-gray-600">{item.quantity}</td>
                                <td className="py-2 pr-4 text-gray-500">{item.unit ?? '—'}</td>
                                <td className="py-2 pr-4 text-right text-gray-600">
                                  {item.unit_price > 0
                                    ? `₱${item.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                                    : '—'}
                                </td>
                                <td className="py-2 text-right font-semibold text-gray-800">
                                  {item.total_amount > 0
                                    ? `₱${item.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
