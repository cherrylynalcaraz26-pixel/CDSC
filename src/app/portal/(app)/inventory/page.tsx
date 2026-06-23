'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Package, Loader2, Search, Tag, ShoppingCart, Plus, Minus, X, Send, ChevronDown, ChevronUp, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface InventoryItem {
  id: string
  item_name: string
  item_code: string | null
  category: string | null
  unit: string | null
  quantity_on_hand: number | null
  unit_price: number | null
  selling_price: number | null
  description: string | null
}

interface CartEntry {
  item: InventoryItem
  qty: number
}

export default function PortalInventoryPage() {
  const supabase = createClient()
  const router = useRouter()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [stockFilter, setStockFilter] = useState(false)

  // Cart state
  const [cart, setCart] = useState<CartEntry[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [poRef, setPoRef] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [clientId, setClientId] = useState<string | null>(null)
  const [clientName, setClientName] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: clientRow } = await supabase
          .from('clients').select('id, company_name').eq('auth_user_id', session.user.id).single()
        if (clientRow) { setClientId(clientRow.id); setClientName(clientRow.company_name) }
      }
      const { data } = await supabase
        .from('items')
        .select('id, item_name, item_code, category, unit, quantity_on_hand, unit_price, selling_price, description')
        .eq('status', 'active')
        .order('item_name')
      setItems(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const categories = ['', ...Array.from(new Set(items.map(i => i.category).filter(Boolean) as string[])).sort()]

  const filtered = items.filter(i => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      i.item_name.toLowerCase().includes(q) ||
      (i.item_code ?? '').toLowerCase().includes(q) ||
      (i.description ?? '').toLowerCase().includes(q)
    const matchCat = !category || i.category === category
    const matchStock = !stockFilter || (i.quantity_on_hand ?? 0) > 0
    return matchSearch && matchCat && matchStock
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
    const price = e.item.selling_price ?? e.item.unit_price ?? 0
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
          unit_price: e.item.selling_price ?? e.item.unit_price ?? 0,
          total_amount: (e.item.selling_price ?? e.item.unit_price ?? 0) * e.qty,
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
    <div className="space-y-6 pb-32">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Product Catalog</h1>
        <p className="text-sm text-gray-500 mt-1">Browse available products and add them to your order.</p>
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
          <Tag className="h-5 w-5 text-indigo-500" />
          <div>
            <div className="text-xl font-bold text-gray-900">{loading ? '—' : categories.length - 1}</div>
            <div className="text-xs text-gray-500">Categories</div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <Package className="h-5 w-5 text-green-500" />
          <div>
            <div className="text-xl font-bold text-gray-900">{loading ? '—' : items.filter(i => (i.quantity_on_hand ?? 0) > 0).length}</div>
            <div className="text-xs text-gray-500">In Stock</div>
          </div>
        </div>
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products, codes..."
              className="w-full h-10 pl-9 pr-4 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setStockFilter(v => !v)}
            className={cn(
              'h-10 px-4 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap',
              stockFilter
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            )}>
            In Stock Only
          </button>
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
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results count */}
      {!loading && (
        <p className="text-xs text-gray-400">
          {filtered.length} product{filtered.length !== 1 ? 's' : ''}
          {(search || category || stockFilter) ? ' found' : ' available'}
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
            {search || category || stockFilter ? 'No products match your filters.' : 'No products available.'}
          </p>
          {(search || category || stockFilter) && (
            <button onClick={() => { setSearch(''); setCategory(''); setStockFilter(false) }}
              className="mt-3 text-sm text-red-600 hover:underline">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(item => {
            const inStock = (item.quantity_on_hand ?? 0) > 0
            const price = item.selling_price ?? item.unit_price
            const qty = cartQty(item.id)
            return (
              <div key={item.id} className={cn(
                'bg-white rounded-xl border p-5 flex flex-col gap-3 transition-shadow',
                qty > 0 ? 'border-red-300 shadow-md ring-1 ring-red-200' : 'border-gray-200 hover:shadow-md'
              )}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight">{item.item_name}</h3>
                    {item.item_code && (
                      <p className="text-xs text-gray-400 mt-0.5">{item.item_code}</p>
                    )}
                  </div>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium shrink-0',
                    inStock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  )}>
                    {inStock ? 'In Stock' : 'Out of Stock'}
                  </span>
                </div>

                {item.description && (
                  <p className="text-xs text-gray-500 line-clamp-2">{item.description}</p>
                )}

                <div className="flex items-center justify-between mt-auto pt-1">
                  <div className="flex items-center gap-2">
                    {item.category && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{item.category}</span>
                    )}
                    {item.unit && (
                      <span className="text-xs text-gray-400">per {item.unit}</span>
                    )}
                  </div>
                  {price != null && (
                    <span className="text-sm font-bold text-red-600">
                      {fmt(price)}
                    </span>
                  )}
                </div>

                {/* Add to cart controls */}
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
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        className="h-9 w-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="flex-1 text-center text-sm font-bold text-gray-900">{qty}</span>
                      <button
                        onClick={() => updateQty(item.id, 1)}
                        className="h-9 w-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="h-9 w-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors border border-gray-200">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Floating cart bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4 md:px-8">
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
                    const price = e.item.selling_price ?? e.item.unit_price ?? 0
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
