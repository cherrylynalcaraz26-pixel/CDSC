'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { subMonths, format } from 'date-fns'
import { Lightbulb, Loader2, TrendingUp, MessageSquareQuote, Plus } from 'lucide-react'

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
  const [openRequests, setOpenRequests] = useState<OpenRequest[]>([])
  const [demandRows, setDemandRows] = useState<DemandRow[]>([])

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }
      const { data: supplierRow } = await supabase.from('suppliers').select('id').eq('auth_user_id', session.user.id).single()
      if (!supplierRow) { setLoading(false); return }

      const [{ data: catalogRows }, { data: suggestions }, soItemsRows] = await Promise.all([
        supabase.from('vendor_catalog_items').select('item_name').eq('supplier_id', supplierRow.id),
        supabase.from('item_suggestions').select('id, item_name, description, unit_of_measure, selling_price, client_name, created_at').eq('status', 'pending').order('created_at', { ascending: false }),
        fetchAllRows((from, to) =>
          supabase.from('so_items')
            .select('item_name, quantity, so_id, sales_orders!inner(status, so_date, created_at)')
            .neq('sales_orders.status', 'cancelled')
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

      setLoading(false)
    }
    load()
  }, [])

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

      {/* Client requests */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <MessageSquareQuote className="h-4 w-4 text-red-600" />
          <h2 className="text-sm font-semibold text-gray-900">Client Requests You Could Fulfill</h2>
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{openRequests.length}</span>
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
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-900">Frequently Purchased Items You Don&apos;t Carry Yet</h2>
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
