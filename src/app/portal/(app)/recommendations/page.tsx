'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { subMonths, format } from 'date-fns'
import { toast } from 'sonner'
import { Lightbulb, Loader2, TrendingUp, MessageSquareQuote, Plus, History, Layers } from 'lucide-react'

interface OpenRequest {
  id: string
  item_name: string
  description: string | null
  unit_of_measure: string | null
  selling_price: number | null
  client_name: string | null
  created_at: string
}

interface DemandRow {
  item_name: string
  totalQty: number
  orderCount: number
}

interface PastPurchasedRow {
  item_name: string
  unit_of_measure: string | null
  lastPrice: number | null
  orderCount: number
}

function fmt(n: number | null) {
  if (n === null || n === undefined) return '—'
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function addToCatalogHref(name: string, desc?: string | null, unit?: string | null, price?: number | null) {
  const params = new URLSearchParams({ prefill_name: name })
  if (desc) params.set('prefill_desc', desc)
  if (unit) params.set('prefill_unit', unit)
  if (price) params.set('prefill_price', String(price))
  return `/portal/catalog?${params.toString()}`
}

export default function VendorRecommendationsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [openRequests, setOpenRequests] = useState<OpenRequest[]>([])
  const [demandRows, setDemandRows] = useState<DemandRow[]>([])
  const [pastPurchasedRows, setPastPurchasedRows] = useState<PastPurchasedRow[]>([])
  const [addingAll, setAddingAll] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }
    const { data: supplierRow } = await supabase.from('suppliers').select('id').eq('auth_user_id', session.user.id).single()
    if (!supplierRow) { setLoading(false); return }
    setSupplierId(supplierRow.id)

    const [{ data: catalogRows }, { data: suggestions }, soItemsRows, poItemsRows] = await Promise.all([
      supabase.from('vendor_catalog_items').select('item_name').eq('supplier_id', supplierRow.id),
      supabase.from('item_suggestions').select('id, item_name, description, unit_of_measure, selling_price, client_name, created_at').eq('status', 'pending').order('created_at', { ascending: false }),
      fetchAllRows((from, to) =>
        supabase.from('so_items')
          .select('item_name, quantity, so_id, sales_orders!inner(status, so_date, created_at)')
          .neq('sales_orders.status', 'cancelled')
          .order('id')
          .range(from, to)
      ),
      fetchAllRows((from, to) =>
        supabase.from('po_items')
          .select('item_name, unit_of_measure, unit_cost, po_id, purchase_orders!inner(supplier_id, status)')
          .eq('purchase_orders.supplier_id', supplierRow.id)
          .order('id')
          .range(from, to)
      ),
    ])

    const myCatalogNames = new Set((catalogRows ?? []).map((r: any) => r.item_name.trim().toLowerCase()))

    setOpenRequests(((suggestions ?? []) as OpenRequest[]).filter(s => !myCatalogNames.has(s.item_name.trim().toLowerCase())))

    // Demand over the last 6 months, aggregated by item — a simple "what's
    // actually selling" signal without exposing per-order client details.
    const sixMonthsAgo = subMonths(new Date(), 6).toISOString().slice(0, 10)
    const demandMap: Record<string, { qty: number; orders: Set<string> }> = {}
    for (const r of soItemsRows as any[]) {
      const so = r.sales_orders
      const date = (so?.so_date ?? so?.created_at ?? '').slice(0, 10)
      if (!date || date < sixMonthsAgo) continue
      const name = (r.item_name ?? '').trim()
      if (!name || myCatalogNames.has(name.toLowerCase())) continue
      if (!demandMap[name]) demandMap[name] = { qty: 0, orders: new Set() }
      demandMap[name].qty += Number(r.quantity) || 0
      demandMap[name].orders.add(r.so_id)
    }
    const demand = Object.entries(demandMap)
      .map(([item_name, v]) => ({ item_name, totalQty: v.qty, orderCount: v.orders.size }))
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 15)
    setDemandRows(demand)

    // Items CDSC has already ordered from this vendor before — the strongest
    // possible signal, since it's not a suggestion, it's history.
    const pastMap: Record<string, { unit: string | null; price: number | null; orders: Set<string> }> = {}
    for (const r of poItemsRows as any[]) {
      if (r.purchase_orders?.status === 'cancelled') continue
      const name = (r.item_name ?? '').trim()
      if (!name || myCatalogNames.has(name.toLowerCase())) continue
      if (!pastMap[name]) pastMap[name] = { unit: r.unit_of_measure ?? null, price: null, orders: new Set() }
      pastMap[name].price = r.unit_cost != null ? Number(r.unit_cost) : pastMap[name].price
      pastMap[name].orders.add(r.po_id)
    }
    const pastPurchased = Object.entries(pastMap)
      .map(([item_name, v]) => ({ item_name, unit_of_measure: v.unit, lastPrice: v.price, orderCount: v.orders.size }))
      .sort((a, b) => b.orderCount - a.orderCount)
    setPastPurchasedRows(pastPurchased)

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addAllToCatalog(section: string, rows: { item_name: string; unit_of_measure?: string | null; price?: number | null }[]) {
    if (!supplierId || rows.length === 0) return
    setAddingAll(section)
    const payload = rows.map(r => ({
      supplier_id: supplierId,
      item_name: r.item_name,
      unit_of_measure: r.unit_of_measure || 'piece',
      price: r.price ?? null,
    }))
    const { error } = await supabase.from('vendor_catalog_items').insert(payload)
    if (error) toast.error(error.message)
    else { toast.success(`${rows.length} item${rows.length !== 1 ? 's' : ''} added to your catalog`); load() }
    setAddingAll(null)
  }

  if (loading) return (
    <div className="flex justify-center py-24">
      <Loader2 className="h-7 w-7 text-red-600 animate-spin" />
    </div>
  )

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" /> Recommendations
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">What CDSC&apos;s clients are asking for and buying — a guide to what&apos;s worth offering.</p>
      </div>

      {/* Past purchased */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-gray-900">Items You&apos;ve Supplied Before</h2>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{pastPurchasedRows.length}</span>
          </div>
          {pastPurchasedRows.length > 0 && (
            <button
              onClick={() => addAllToCatalog('past', pastPurchasedRows.map(r => ({ item_name: r.item_name, unit_of_measure: r.unit_of_measure, price: r.lastPrice })))}
              disabled={addingAll === 'past'}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {addingAll === 'past' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />} Add All to My Catalog
            </button>
          )}
        </div>
        {pastPurchasedRows.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-10 text-center">
            <p className="text-sm text-gray-400">CDSC hasn&apos;t ordered anything from you yet that isn&apos;t already in your catalog.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {pastPurchasedRows.map(p => (
              <div key={p.item_name} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{p.item_name}</div>
                  <div className="text-xs text-gray-400">
                    Ordered {p.orderCount} time{p.orderCount !== 1 ? 's' : ''} before
                    {p.lastPrice != null && <> · Last price {fmt(p.lastPrice)}</>}
                  </div>
                </div>
                <Link
                  href={addToCatalogHref(p.item_name, undefined, p.unit_of_measure, p.lastPrice)}
                  className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Add to My Catalog
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Client requests */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquareQuote className="h-4 w-4 text-red-600" />
            <h2 className="text-sm font-semibold text-gray-900">Client Requests You Could Fulfill</h2>
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{openRequests.length}</span>
          </div>
          {openRequests.length > 0 && (
            <button
              onClick={() => addAllToCatalog('requests', openRequests.map(r => ({ item_name: r.item_name, unit_of_measure: r.unit_of_measure, price: r.selling_price })))}
              disabled={addingAll === 'requests'}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {addingAll === 'requests' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />} Add All to My Catalog
            </button>
          )}
        </div>
        {openRequests.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-10 text-center">
            <p className="text-sm text-gray-400">No open client requests right now that aren&apos;t already in your catalog.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {openRequests.map(r => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate" title={r.item_name}>{r.item_name}</div>
                  {r.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{r.description}</p>}
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                    {r.client_name && <span>Requested by {r.client_name}</span>}
                    <span>· {format(new Date(r.created_at), 'MMM d, yyyy')}</span>
                  </div>
                  {r.selling_price != null && (
                    <div className="text-xs font-semibold text-gray-600 mt-1">Suggested price: {fmt(r.selling_price)}</div>
                  )}
                </div>
                <Link
                  href={addToCatalogHref(r.item_name, r.description, r.unit_of_measure, r.selling_price)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors w-fit"
                >
                  <Plus className="h-3.5 w-3.5" /> Add to My Catalog
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Frequently purchased */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-900">Frequently Purchased Items You Don&apos;t Carry Yet</h2>
          </div>
          {demandRows.length > 0 && (
            <button
              onClick={() => addAllToCatalog('demand', demandRows.map(r => ({ item_name: r.item_name })))}
              disabled={addingAll === 'demand'}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {addingAll === 'demand' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />} Add All to My Catalog
            </button>
          )}
        </div>
        {demandRows.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-10 text-center">
            <p className="text-sm text-gray-400">No demand data available yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {demandRows.map(d => (
              <div key={d.item_name} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{d.item_name}</div>
                  <div className="text-xs text-gray-400">{d.totalQty.toLocaleString()} units across {d.orderCount} order{d.orderCount !== 1 ? 's' : ''} in the last 6 months</div>
                </div>
                <Link
                  href={addToCatalogHref(d.item_name)}
                  className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Add to My Catalog
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
