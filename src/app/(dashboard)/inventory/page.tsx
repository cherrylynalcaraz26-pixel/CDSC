'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Search, Loader2, BoxesIcon } from 'lucide-react'

interface InventoryItem {
  id: string
  item_code: string
  item_name: string
  unit_of_measure: string
  cost: number
  status: string
  category?: { category_name: string } | null
  stock_levels?: { quantity_on_hand: number; quantity_reserved: number; quantity_available: number }[]
}

export default function InventoryPage() {
  const supabase = createClient()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    const allItems: InventoryItem[] = []
    const PAGE = 1000
    let from = 0
    while (true) {
      const { data } = await supabase
        .from('items')
        .select('id, item_code, item_name, unit_of_measure, cost, status, category:category_id(category_name), stock_levels(quantity_on_hand, quantity_reserved, quantity_available)')
        .order('item_name')
        .range(from, from + PAGE - 1)
      if (!data || data.length === 0) break
      allItems.push(...(data as unknown as InventoryItem[]))
      if (data.length < PAGE) break
      from += PAGE
    }
    setItems(allItems)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = items.filter(i => {
    const q = search.toLowerCase()
    return (
      i.item_name.toLowerCase().includes(q) ||
      i.item_code.toLowerCase().includes(q) ||
      (i.category?.category_name ?? '').toLowerCase().includes(q)
    )
  })

  const totalItems = filtered.length
  const inStock = filtered.filter(i => (i.stock_levels?.[0]?.quantity_on_hand ?? 0) > 0).length
  const lowStock = filtered.filter(i => {
    const qty = i.stock_levels?.[0]?.quantity_on_hand ?? 0
    return qty > 0 && qty <= 10
  }).length
  const outOfStock = filtered.filter(i => (i.stock_levels?.[0]?.quantity_on_hand ?? 0) === 0).length

  function stockBadge(qty: number) {
    if (qty === 0) return <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">Out of Stock</Badge>
    if (qty <= 10) return <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50">Low Stock</Badge>
    return <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">In Stock</Badge>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="text-muted-foreground text-sm">Current stock levels for all items</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{loading ? '—' : totalItems}</div>
            <div className="text-xs text-muted-foreground">Total Items</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-green-600">{loading ? '—' : inStock}</div>
            <div className="text-xs text-muted-foreground">In Stock</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-yellow-600">{loading ? '—' : lowStock}</div>
            <div className="text-xs text-muted-foreground">Low Stock</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-red-600">{loading ? '—' : outOfStock}</div>
            <div className="text-xs text-muted-foreground">Out of Stock</div>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search item, code, category…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">On Hand</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      No items found.
                    </TableCell>
                  </TableRow>
                ) : filtered.map(item => {
                  const sl = item.stock_levels?.[0]
                  const onHand = Number(sl?.quantity_on_hand ?? 0)
                  const reserved = Number(sl?.quantity_reserved ?? 0)
                  const available = Number(sl?.quantity_available ?? 0)
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm text-red-600">{item.item_code}</TableCell>
                      <TableCell className="text-sm font-medium">{item.item_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.category?.category_name ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.unit_of_measure}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{onHand}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{reserved}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{available}</TableCell>
                      <TableCell>{stockBadge(onHand)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
