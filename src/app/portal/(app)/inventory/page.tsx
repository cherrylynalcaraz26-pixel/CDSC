'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Package, Loader2, Tag, ShoppingCart, Plus, Minus, X, Send, ChevronDown, ChevronUp, ShoppingBag, LayoutGrid, List, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useSearchContext } from '@/context/search-context'

interface InventoryItem {
  id: string
  item_name: string
  item_code: string | null
  category: string | null
  unit: string | null
  selling_price: number | null
  description: string | null
  isMine: boolean
}

// Item names/descriptions in the master catalog sometimes carry double
// spaces or stray whitespace from data entry — normalize to one clean line.
function cleanText(s: string) {
  return s.replace(/\s+/g, ' ').trim()
}

interface CartEntry {
  item: InventoryItem
  qty: number
}

export default function PortalInventoryPage() {
  const supabase = createClient()
  const router = useRouter()
  const [items, setItems] = useState<InventoryItem[]>([])
  const { query: search, setQuery: setSearch } = useSearchContext()
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('')

  // Cart state
  const [cart, setCart] = useState<CartEntry[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [poRef, setPoRef] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [clientId, setClientId] = useState<string | null>(null)
  const [clientName, setClientName] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [localSearch, setLocalSearch] = useState('')
  const [scope, setScope] = useState<'mine' | 'all'>('mine')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: clientRow } = await supabase
          .from('clients').select('id, company_name').eq('auth_user_id', session.user.id).single()
        if (clientRow) {
          const companyName = clientRow.company_name ?? ''
          setClientId(clientRow.id); setClientName(companyName)
          // Browse Catalog lists CDSC's master product catalog (so clients can shop
          // and place new orders), not the client's own already-received stock.
          // "My Items" history is scoped to the same show_in_portal-visible records
          // the rest of the portal (My Orders, My Stock) uses — not everything CDSC
          // has on file for this client.
          const [{ data, error }, { data: soRows }, { data: csiRows }] = await Promise.all([
            supabase
              .from('items')
              .select('id, item_name, item_code, description, unit_of_measure, selling_price, category:categories(category_name)')
              .eq('status', 'active')
              .order('item_name'),
            companyName
              ? supabase.from('sales_orders').select('so_number, so_items(item_name)').eq('client_name', companyName).eq('show_in_portal', true)
              : Promise.resolve({ data: [] as { so_number: string | null; so_items: { item_name: string }[] }[] }),
            companyName
              ? supabase.from('csi_records').select('item_name').eq('client_name', companyName).eq('show_in_portal', true)
              : Promise.resolve({ data: [] as { item_name: string }[] }),
          ])
          if (error) toast.error(error.message)

          const visibleSoNumbers = (soRows ?? []).map(so => so.so_number).filter(Boolean) as string[]
          let drItemNames: string[] = []
          if (visibleSoNumbers.length > 0) {
            const { data: drRows } = await supabase.from('dr_logs').select('dr_number').eq('supplier_name', companyName).in('po_number', visibleSoNumbers)
            const drNums = (drRows ?? []).map(d => d.dr_number).filter(Boolean)
            if (drNums.length > 0) {
              const { data: drItems } = await supabase.from('dr_log_items').select('item_name').in('dr_number', drNums)
              drItemNames = (drItems ?? []).map(i => i.item_name)
            }
          }
          const soItemNames = (soRows ?? []).flatMap(so => (so.so_items ?? []).map(it => it.item_name))
          const csiItemNames = (csiRows ?? []).map(r => r.item_name)
          const myNames = new Set(
            [...soItemNames, ...drItemNames, ...csiItemNames].filter(Boolean).map(n => cleanText(n).toLowerCase())
          )

          setItems((data ?? []).map((r: {
            id: string; item_name: string; item_code: string | null; description: string | null
            unit_of_measure: string | null; selling_price: number | null; category: { category_name: string }[] | null
          }) => ({
            id: r.id,
            item_name: cleanText(r.item_name),
            item_code: r.item_code,
            category: r.category?.[0]?.category_name ?? null,
            unit: r.unit_of_measure,
            selling_price: r.selling_price != null ? Number(r.selling_price) : null,
            description: r.description ? cleanText(r.description) : null,
            isMine: myNames.has(cleanText(r.item_name).toLowerCase()),
          })))
          // Default to a scoped "My Items" view; fall back to the full catalog
          // automatically if this client has no purchase history yet.
          if (myNames.size === 0) setScope('all')
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  const categories = ['', ...Array.from(new Set(items.map(i => i.category).filter(Boolean) as string[])).sort()]
  const myItemCount = items.filter(i => i.isMine).length

  const filtered = items.filter(i => {
    const q = (search || localSearch).toLowerCase()
    const matchSearch = !q ||
      i.item_name.toLowerCase().includes(q) ||
      (i.item_code ?? '').toLowerCase().includes(q) ||
      (i.category ?? '').toLowerCase().includes(q) ||
      (i.unit ?? '').toLowerCase().includes(q) ||
      (i.description ?? '').toLowerCase().includes(q)
    const matchCat = !category || i.category === category
    const matchScope = scope === 'all' || i.isMine
    return matchSearch && matchCat && matchScope
  })

  // Cart helpers
  function cartQty(id: string) {
    return cart.find(e => e.item.id === id)?.qty ?? 0
  }

  function addToCart(item: InventoryItem) {
    setCart(prev => {
      const existing = prev.find(e => e.item.id === item.id)
      if (existing) return prev.map(e => e.item.id === item.id ? { ...e, qty: e.qty + 1 } : e)
      return [...prev, { item, qty: 1 }]
    })
    setCartOpen(true)
  }

  function updateQty(id: string, delta: number) {
    setCart(prev => prev
      .map(e => e.item.id === id ? { ...e, qty: Math.max(0, e.qty + delta) } : e)
      .filter(e => e.qty > 0)
    )
  }

  function removeFromCart(id: string) {
    setCart(prev => prev.filter(e => e.item.id !== id))
  }

  const cartCount = cart.reduce((s, e) => s + e.qty, 0)
  const cartTotal = cart.reduce((s, e) => {
    const price = e.item.selling_price ?? 0
    return s + price * e.qty
  }, 0)

  const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

  async function submitOrder() {
    if (!clientId) { toast.error('Client account not linked'); return }
    if (cart.length === 0) { toast.error('Cart is empty'); return }
    if (!poRef.trim()) { toast.error('Please enter a PO reference'); return }
    setSubmitting(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const soNumber = `SO-P-${Date.now().toString().slice(-8)}`
      const { data: soData, error: soErr } = await supabase
        .from('sales_orders')
        .insert({
          so_number: soNumber,
          so_date: today,
          client_id: clientId,
          client_name: clientName,
          client_po_number: poRef.trim(),
          remarks: notes.trim() || null,
          status: 'draft',
          total_amount: cartTotal,
        })
        .select('id')
        .single()
      if (soErr) throw soErr
      if (soData?.id) {
        const itemRows = cart.map(e => ({
          so_id: soData.id,
          item_name: e.item.item_name,
          quantity: e.qty,
          unit: e.item.unit ?? null,
          unit_price: e.item.selling_price ?? 0,
          selling_price: e.item.selling_price ?? null,
          total_amount: (e.item.selling_price ?? 0) * e.qty,
        }))
        const { error: itemErr } = await supabase.from('so_items').insert(itemRows)
        if (itemErr) toast.error(`Items: ${itemErr.message}`)
      }
      toast.success('Order submitted successfully!')
      setCart([])
      setCartOpen(false)
      setPoRef('')
      setNotes('')
      router.push('/portal/requests')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to submit order')
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-6 pb-48 lg:pb-32">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Browse Catalog</h1>
        <p className="text-sm text-gray-500 mt-1">Browse our product catalog and add items to a new order.</p>
      </div>

      {/* Stats row */}
      <div className="flex gap-3 flex-wrap">
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <Package className="h-5 w-5 text-red-600" />
          <div>
            <div className="text-xl font-bold text-gray-900">{loading ? '—' : items.length}</div>
            <div className="text-xs text-gray-500">Total Products</div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <Tag className="h-5 w-5 text-orange-500" />
          <div>
            <div className="text-xl font-bold text-gray-900">{loading ? '—' : categories.length - 1}</div>
            <div className="text-xs text-gray-500">Categories</div>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-400 -mt-3">Prices shown are indicative and may change upon order confirmation.</p>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button onClick={() => setScope('mine')}
              className={cn('h-10 px-4 text-sm font-medium transition-colors whitespace-nowrap',
                scope === 'mine' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>
              My Items {!loading && `(${myItemCount})`}
            </button>
            <button onClick={() => setScope('all')}
              className={cn('h-10 px-4 text-sm font-medium border-l border-gray-300 transition-colors whitespace-nowrap',
                scope === 'all' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>
              All Items {!loading && `(${items.length})`}
            </button>
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              value={localSearch}
              onChange={e => setLocalSearch(e.target.value)}
              placeholder="Search products…"
              className="w-full h-10 pl-9 pr-9 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            {localSearch && (
              <button onClick={() => setLocalSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('grid')}
              className={cn('h-10 w-10 flex items-center justify-center transition-colors',
                viewMode === 'grid' ? 'bg-red-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50')}>
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button onClick={() => setViewMode('list')}
              className={cn('h-10 w-10 flex items-center justify-center border-l border-gray-300 transition-colors',
                viewMode === 'list' ? 'bg-red-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50')}>
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
        {categories.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {categories.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)}
                className={cn(
                  'px-3 py-1 text-xs rounded-full font-medium border transition-colors',
                  category === cat
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                )}>
                {cat === '' ? 'All Categories' : cat}
                {cat !== '' && (
                  <span className="ml-1 opacity-60">{items.filter(i => i.category === cat).length}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results count */}
      {!loading && (
        <p className="text-xs text-gray-400">
          {filtered.length} product{filtered.length !== 1 ? 's' : ''}
          {(search || localSearch || category) ? ' found' : ' available'}
        </p>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <Package className="h-9 w-9 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">
            {scope === 'mine' && !search && !category
              ? "You haven't ordered anything from the catalog yet."
              : search || category ? 'No products match your filters.' : 'No products available.'}
          </p>
          {scope === 'mine' && items.length > 0 && (
            <button onClick={() => setScope('all')} className="mt-3 text-sm text-red-600 hover:underline">
              Browse all {items.length} products
            </button>
          )}
          {(search || category) && (
            <button onClick={() => { setSearch(''); setCategory('') }}
              className="mt-3 text-sm text-red-600 hover:underline">
              Clear filters
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(item => {
            const price = item.selling_price
            const qty = cartQty(item.id)
            return (
              <div key={item.id} className={cn(
                'bg-white rounded-xl border p-5 flex flex-col gap-3 transition-shadow',
                qty > 0 ? 'border-red-300 shadow-md ring-1 ring-red-200' : 'border-gray-200 hover:shadow-md'
              )}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight truncate">{item.item_name}</h3>
                    {item.item_code && (
                      <p className="text-xs text-gray-400 mt-0.5">{item.item_code}</p>
                    )}
                  </div>
                  {item.unit && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 bg-gray-100 text-gray-500">
                      per {item.unit}
                    </span>
                  )}
                </div>

                {item.description && (
                  <p className="text-xs text-gray-500 line-clamp-2">{item.description}</p>
                )}

                <div className="flex items-center justify-between gap-2 mt-auto pt-1">
                  <div />
                  {price != null && (
                    <span className="font-bold text-red-600 text-sm">{fmt(price)}</span>
                  )}
                </div>

                {qty === 0 ? (
                  <button
                    onClick={() => addToCart(item)}
                    className="w-full mt-1 h-9 flex items-center justify-center gap-2 text-sm font-semibold rounded-lg border-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-colors">
                    <ShoppingCart className="h-3.5 w-3.5" />
                    Add to Order
                  </button>
                ) : (
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden flex-1">
                      <button onClick={() => updateQty(item.id, -1)}
                        className="h-9 w-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="flex-1 text-center text-sm font-bold text-gray-900">{qty}</span>
                      <button onClick={() => updateQty(item.id, 1)}
                        className="h-9 w-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button onClick={() => removeFromCart(item.id)}
                      className="h-9 w-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors border border-gray-200">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* List view */
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Category</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Unit</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Price</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(item => {
                const price = item.selling_price
                const qty = cartQty(item.id)
                return (
                  <tr key={item.id} className={cn('hover:bg-gray-50 transition-colors', qty > 0 && 'bg-red-50/40')}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.item_name}</div>
                      {item.item_code && <div className="text-xs text-gray-400">{item.item_code}</div>}
                      {item.description && <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.description}</div>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {item.category && (
                        <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">{item.category}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
                        {item.unit ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {price != null ? (
                        <span className="font-bold text-red-600 text-sm">{fmt(price)}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {qty === 0 ? (
                        <button onClick={() => addToCart(item)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 border border-red-300 px-3 py-1.5 rounded-lg hover:bg-red-600 hover:text-white transition-colors">
                          <Plus className="h-3 w-3" /> Add
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
                          <button onClick={() => updateQty(item.id, -1)} className="h-7 w-7 flex items-center justify-center text-gray-500 hover:bg-gray-100">
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-6 text-center text-sm font-bold text-gray-900">{qty}</span>
                          <button onClick={() => updateQty(item.id, 1)} className="h-7 w-7 flex items-center justify-center text-gray-500 hover:bg-gray-100">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Floating cart bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 z-40 p-4 md:px-8">
          <div className="max-w-3xl mx-auto">
            {/* Expanded cart panel */}
            {cartOpen && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-2xl mb-3 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b">
                  <div className="flex items-center gap-2 font-semibold text-gray-800 text-sm">
                    <ShoppingBag className="h-4 w-4 text-red-600" />
                    Your Order ({cartCount} item{cartCount !== 1 ? 's' : ''})
                  </div>
                  <button onClick={() => setCartOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>

                {/* Cart items */}
                <div className="max-h-56 overflow-y-auto divide-y">
                  {cart.map(e => {
                    const price = e.item.selling_price ?? 0
                    return (
                      <div key={e.item.id} className="px-5 py-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 truncate">{e.item.item_name}</div>
                          <div className="text-xs text-gray-400">{fmt(price)} / {e.item.unit ?? 'pc'}</div>
                        </div>
                        <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
                          <button onClick={() => updateQty(e.item.id, -1)} className="h-7 w-7 flex items-center justify-center text-gray-500 hover:bg-gray-100">
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center text-sm font-bold text-gray-900">{e.qty}</span>
                          <button onClick={() => updateQty(e.item.id, 1)} className="h-7 w-7 flex items-center justify-center text-gray-500 hover:bg-gray-100">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="text-sm font-semibold text-red-600 w-20 text-right shrink-0">
                          {fmt(price * e.qty)}
                        </div>
                        <button onClick={() => removeFromCart(e.item.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* PO Reference + Notes */}
                <div className="px-5 py-4 border-t space-y-2 bg-gray-50">
                  <input
                    value={poRef}
                    onChange={e => setPoRef(e.target.value)}
                    placeholder="PO Reference / Order Name *"
                    className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white"
                  />
                  <input
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Delivery notes (optional)"
                    className="w-full h-9 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white"
                  />
                </div>

                {/* Total */}
                <div className="px-5 py-3 border-t flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Total <span className="font-bold text-gray-900 ml-1">{fmt(cartTotal)}</span>
                  </div>
                  <button
                    onClick={submitOrder}
                    disabled={submitting || !poRef.trim()}
                    className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Submit Order
                  </button>
                </div>
              </div>
            )}

            {/* Collapsed cart tab */}
            {!cartOpen && (
              <button
                onClick={() => setCartOpen(true)}
                className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl px-5 py-3.5 flex items-center justify-between shadow-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <ShoppingCart className="h-5 w-5" />
                    <span className="absolute -top-2 -right-2 bg-white text-red-600 text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                      {cartCount}
                    </span>
                  </div>
                  <span className="font-semibold text-sm">{cartCount} item{cartCount !== 1 ? 's' : ''} in order</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold">{fmt(cartTotal)}</span>
                  <ChevronUp className="h-4 w-4 opacity-70" />
                </div>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
