'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, FileText, ChevronDown, ChevronUp, Package, Truck, CheckCircle2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useSearchContext } from '@/context/search-context'
import { getErrorMessage } from '@/lib/error-message'

interface SOItem {
  id: string
  item_name: string
  quantity: number
  unit: string | null
  unit_price: number
  selling_price: number | null
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

interface DeliveryItem {
  item_name: string
  unit: string | null
  quantity: number
}

interface Delivery {
  dr_number: string
  dr_date: string | null
  status: string
  so_number: string | null
  client_accepted_at: string | null
  client_accepted_by: string | null
  items: DeliveryItem[]
}

const STATUS: Record<string, { label: string; cls: string }> = {
  draft:      { label: 'Pending Review', cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  confirmed:  { label: 'Confirmed',      cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  processing: { label: 'In Progress',    cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  delivered:  { label: 'Delivered',      cls: 'bg-green-100 text-green-700 border-green-200' },
  cancelled:  { label: 'Cancelled',      cls: 'bg-red-100 text-red-600 border-red-200' },
}

const FILTERS = [
  { value: '',           label: 'All' },
  { value: 'draft',      label: 'Pending' },
  { value: 'confirmed',  label: 'Confirmed' },
  { value: 'processing', label: 'In Progress' },
  { value: 'delivered',  label: 'Delivered' },
  { value: 'cancelled',  label: 'Cancelled' },
]

export default function PortalRequests() {
  const supabase = createClient()
  const router = useRouter()
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const { query: search } = useSearchContext()
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [clientName, setClientName] = useState('')
  const [acceptingDR, setAcceptingDR] = useState<Delivery | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [addToStockDR, setAddToStockDR] = useState<Delivery | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: clientRow } = await supabase
        .from('clients').select('company_name').eq('auth_user_id', session.user.id).single()
      if (clientRow) {
        setClientName((clientRow as any).company_name ?? '')
        const { data } = await supabase
          .from('sales_orders')
          .select('id, so_number, client_po_number, so_date, created_at, status, total_amount, remarks, so_items(id, item_name, quantity, unit, unit_price, selling_price, total_amount)')
          .eq('client_name', clientRow.company_name)
          .eq('show_in_portal', true)
          .order('created_at', { ascending: false })
        const soList = (data ?? []) as unknown as SalesOrder[]
        setOrders(soList)

        const soNums = soList.map(o => o.so_number).filter(Boolean) as string[]
        if (soNums.length > 0) {
          const { data: drData } = await supabase
            .from('dr_logs').select('dr_number,dr_date,status,po_number,client_accepted_at,client_accepted_by').in('po_number', soNums)
          const drNums = (drData ?? []).map((d: any) => d.dr_number).filter(Boolean)
          let drItems: any[] = []
          if (drNums.length > 0) {
            const { data: itemsData } = await supabase
              .from('dr_log_items').select('dr_number,item_name,unit,quantity').in('dr_number', drNums)
            drItems = itemsData ?? []
          }
          setDeliveries((drData ?? []).map((d: any) => ({
            dr_number: d.dr_number,
            dr_date: d.dr_date,
            status: d.status,
            so_number: d.po_number,
            client_accepted_at: d.client_accepted_at ?? null,
            client_accepted_by: d.client_accepted_by ?? null,
            items: drItems.filter((i: any) => i.dr_number === d.dr_number).map((i: any) => ({
              item_name: i.item_name,
              unit: i.unit ?? null,
              quantity: Number(i.quantity),
            })),
          })))
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

  // Effective status: if all DRs received → delivered, regardless of SO status field
  function effectiveStatus(o: SalesOrder): string {
    const orderDRs = deliveries.filter(d => d.so_number === o.so_number)
    if (orderDRs.length > 0 && orderDRs.every(d => d.status === 'received' || d.status === 'delivered')) {
      return 'delivered'
    }
    // Treat 'shipped' as 'processing' for display
    if (o.status === 'shipped') return 'processing'
    return o.status
  }

  async function confirmAccept() {
    if (!acceptingDR || !clientName) return
    setAccepting(true)
    const { error } = await supabase.from('dr_logs')
      .update({ client_accepted_at: new Date().toISOString(), client_accepted_by: clientName })
      .eq('dr_number', acceptingDR.dr_number)
    if (error) {
      toast.error(getErrorMessage(error))
      setAccepting(false)
      return
    }
    const accepted = { ...acceptingDR, client_accepted_at: new Date().toISOString(), client_accepted_by: clientName }
    setDeliveries(prev => prev.map(d => d.dr_number === acceptingDR.dr_number ? accepted : d))
    setAcceptingDR(null)
    setAccepting(false)
    toast.success(`Delivery ${accepted.dr_number} accepted by ${clientName}`)
    setAddToStockDR(accepted)
  }

  const filtered = orders.filter(o => {
    const s = search.toLowerCase()
    const eff = effectiveStatus(o)
    const matchSearch = !s ||
      (o.so_number ?? '').toLowerCase().includes(s) ||
      (o.client_po_number ?? '').toLowerCase().includes(s) ||
      (o.remarks ?? '').toLowerCase().includes(s) ||
      (STATUS[eff]?.label ?? eff).toLowerCase().includes(s) ||
      o.so_items.some(i => i.item_name.toLowerCase().includes(s))
    const matchFilter = !filter || eff === filter
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

      {/* Status filter */}
      <div className="w-full sm:w-56">
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          {FILTERS.map(f => (
            <option key={f.value} value={f.value}>
              {f.label}{f.value === '' && !loading ? ` (${orders.length})` : ''}
            </option>
          ))}
        </select>
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
            const eff = effectiveStatus(o)
            const st = STATUS[eff] ?? { label: eff, cls: 'bg-gray-100 text-gray-600 border-gray-200' }
            const date = o.so_date ?? o.created_at
            const isOpen = expanded.has(o.id)
            const hasItems = o.so_items?.length > 0
            const orderDRs = deliveries.filter(d => d.so_number === o.so_number)
            const deliveredDRs = orderDRs.filter(d => d.status === 'received' || d.status === 'delivered')
            const pendingDRs = orderDRs.filter(d => d.status !== 'received' && d.status !== 'delivered')
            const hasDeliveries = orderDRs.length > 0

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
                        {hasDeliveries && (
                          <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border',
                            pendingDRs.length === 0
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-orange-50 text-orange-700 border-orange-200')}>
                            <Truck className="h-3 w-3" />
                            {deliveredDRs.length}/{orderDRs.length} delivered
                          </span>
                        )}
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
                      </div>
                      {o.remarks && (
                        <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{o.remarks}</p>
                      )}
                    </div>
                    {(hasItems || hasDeliveries) && (
                      <button
                        onClick={() => toggleExpand(o.id)}
                        className="shrink-0 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        {isOpen ? (
                          <><ChevronUp className="h-3.5 w-3.5" /> Hide</>
                        ) : (
                          <><ChevronDown className="h-3.5 w-3.5" /> Details</>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <>
                    {/* Delivery records with item details */}
                    {orderDRs.length > 0 && (
                      <div className="border-t border-gray-100">
                        {orderDRs.map(dr => {
                          const isDone = dr.status === 'received' || dr.status === 'delivered'
                          const isPartial = dr.status === 'partial'
                          return (
                            <div key={dr.dr_number} className={cn('px-5 py-3 border-b border-gray-100 last:border-b-0', isDone ? 'bg-green-50/40' : isPartial ? 'bg-yellow-50/40' : 'bg-orange-50/40')}>
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                {isDone
                                  ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                  : <Truck className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                                }
                                <span className="font-mono text-xs font-semibold text-red-600">{dr.dr_number}</span>
                                <span className="text-xs text-gray-400">{dr.dr_date ? format(new Date(dr.dr_date), 'MMM d, yyyy') : '—'}</span>
                                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize',
                                  isDone ? 'bg-green-100 text-green-700' : isPartial ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700')}>
                                  {isDone ? 'Delivered' : isPartial ? 'Partial' : 'Pending'}
                                </span>
                                {isDone && dr.client_accepted_at && (
                                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                                    ✓ Accepted by {dr.client_accepted_by} · {format(new Date(dr.client_accepted_at), 'MMM d')}
                                  </span>
                                )}
                                {isDone && !dr.client_accepted_at && (
                                  <button
                                    onClick={() => setAcceptingDR(dr)}
                                    className="ml-auto text-xs bg-green-600 hover:bg-green-700 text-white font-semibold px-3 py-1 rounded-lg transition-colors">
                                    Accept Delivery
                                  </button>
                                )}
                              </div>
                              {dr.items.length > 0 && (
                                <div className="ml-5 space-y-1">
                                  {dr.items.map((it, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-xs text-gray-600">
                                      <span className="text-gray-400">•</span>
                                      <span className="font-medium">{it.item_name}</span>
                                      <span className="text-gray-400 ml-auto">{it.quantity} {it.unit ?? 'pcs'}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Order items */}
                    {hasItems && (
                      <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
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
                                <th className="text-right pb-2 font-medium pr-4">Price</th>
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
                                    {((item.selling_price ?? 0) > 0 || item.unit_price > 0)
                                      ? `₱${(item.selling_price ?? item.unit_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
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
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Accept delivery confirmation modal */}
      {acceptingDR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => { if (e.target === e.currentTarget && !accepting) setAcceptingDR(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-bold text-gray-900">Confirm Receipt</h3>
              <button onClick={() => setAcceptingDR(null)} disabled={accepting} className="text-gray-400 hover:text-gray-600 disabled:opacity-40">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-gray-700">
                You are confirming receipt of delivery <strong className="font-mono text-red-600">{acceptingDR.dr_number}</strong>.
              </p>
              {acceptingDR.items.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                  {acceptingDR.items.map((it, i) => (
                    <div key={i} className="flex justify-between text-xs text-gray-700">
                      <span>{it.item_name}</span>
                      <span className="text-gray-500">{it.quantity} {it.unit ?? 'pcs'}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500">
                This will be recorded as accepted by <strong>{clientName}</strong>.
              </p>
            </div>
            <div className="px-6 pb-5 flex gap-3 justify-end border-t pt-3">
              <button onClick={() => setAcceptingDR(null)} disabled={accepting} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">
                Cancel
              </button>
              <button onClick={confirmAccept} disabled={accepting}
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-60">
                {accepting && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add to Receive Stock prompt after acceptance */}
      {addToStockDR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => { if (e.target === e.currentTarget) setAddToStockDR(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-bold text-gray-900">Add to Receive Stock?</h3>
              <button onClick={() => setAddToStockDR(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-gray-700">
                Would you like to add the items from <strong className="font-mono text-red-600">{addToStockDR.dr_number}</strong> to your Receive Stock?
              </p>
              {addToStockDR.items.length > 0 && (
                <div className="bg-green-50 rounded-lg p-3 space-y-1">
                  {addToStockDR.items.map((it, i) => (
                    <div key={i} className="flex justify-between text-xs text-gray-700">
                      <span className="font-medium">{it.item_name}</span>
                      <span className="text-green-700 font-semibold">{it.quantity} {it.unit ?? 'pcs'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 pb-5 flex gap-3 justify-end border-t pt-3">
              <button onClick={() => setAddToStockDR(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                Not now
              </button>
              <button onClick={() => { router.push(`/portal/stock?dr=${addToStockDR.dr_number}`); setAddToStockDR(null) }}
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2 rounded-lg">
                Go to Receive Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
