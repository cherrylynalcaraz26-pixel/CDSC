'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Package, Loader2, Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

interface InventoryItem {
  id: string
  item_name: string
  item_code: string | null
  category: string | null
  unit: string | null
  quantity_on_hand: number | null
  unit_price: number | null
  description: string | null
  status: string | null
}

export default function PortalInventoryPage() {
  const supabase = createClient()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('items')
        .select('id, item_name, item_code, category, unit, quantity_on_hand, unit_price, description, status')
        .eq('status', 'active')
        .order('item_name')
      setItems(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = items.filter(i => {
    const q = search.toLowerCase()
    return !q ||
      i.item_name.toLowerCase().includes(q) ||
      (i.item_code ?? '').toLowerCase().includes(q) ||
      (i.category ?? '').toLowerCase().includes(q)
  })

  const categories = [...new Set(items.map(i => i.category).filter(Boolean))]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Product Catalog</h1>
        <p className="text-muted-foreground text-sm mt-1">Browse available products and supplies from CDSC Industrial Supply.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Products', value: items.length },
          { label: 'Categories', value: categories.length },
          { label: 'Available', value: items.filter(i => (i.quantity_on_hand ?? 0) > 0).length },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold">{loading ? '—' : s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search products..."
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-center">Availability</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
              </TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12">
                <Package className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">{search ? 'No products match your search.' : 'No products available.'}</p>
              </TableCell></TableRow>
            ) : filtered.map(item => {
              const inStock = (item.quantity_on_hand ?? 0) > 0
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium text-sm">{item.item_name}</div>
                    {item.item_code && <div className="text-xs text-muted-foreground">{item.item_code}</div>}
                    {item.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</div>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.category ?? '—'}</TableCell>
                  <TableCell className="text-sm">{item.unit ?? '—'}</TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {item.unit_price != null ? `₱${item.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${inStock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {inStock ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
