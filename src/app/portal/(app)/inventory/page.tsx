'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Package, Loader2, Search, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InventoryItem {
  id: string
  item_name: string
  item_code: string | null
  category: string | null
  unit: string | null
  quantity_on_hand: number | null
  unit_price: number | null
  description: string | null
}

export default function PortalInventoryPage() {
  const supabase = createClient()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('items')
        .select('id, item_name, item_code, category, unit, quantity_on_hand, unit_price, description')
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
    return matchSearch && matchCat
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Product Catalog</h1>
        <p className="text-sm text-gray-500 mt-1">Browse available products and supplies from CDSC Industrial Supply.</p>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 flex-wrap">
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-center gap-3">
          <Package className="h-5 w-5 text-red-600" />
          <div>
            <div className="text-xl font-bold text-gray-900">{loading ? '—' : items.length}</div>
            <div className="text-xs text-gray-500">Total Products</div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-center gap-3">
          <Tag className="h-5 w-5 text-indigo-500" />
          <div>
            <div className="text-xl font-bold text-gray-900">{loading ? '—' : categories.length - 1}</div>
            <div className="text-xs text-gray-500">Categories</div>
          </div>
        </div>
      </div>

      {/* Search + category filter */}
      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products, codes..."
            className="w-full h-10 pl-9 pr-4 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
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
          {(search || category) ? ' found' : ' available'}
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
            {search || category ? 'No products match your filters.' : 'No products available.'}
          </p>
          {(search || category) && (
            <button onClick={() => { setSearch(''); setCategory('') }}
              className="mt-3 text-sm text-red-600 hover:underline">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(item => {
            const inStock = (item.quantity_on_hand ?? 0) > 0
            return (
              <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
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
                  {item.unit_price != null && (
                    <span className="text-sm font-bold text-red-600">
                      ₱{item.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
