'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Search, Loader2 } from 'lucide-react'

interface InventoryRow {
  client: string
  item_name: string
  unit: string
  dr_qty: number
  csi_qty: number
  balance: number
}

export default function InventoryPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState('all')

  async function load() {
    setLoading(true)

    // Paginate DR log items with their client (supplier_name)
    const drMap: Record<string, Record<string, { qty: number; unit: string }>> = {}
    const PAGE = 1000
    let from = 0
    while (true) {
      const { data } = await supabase
        .from('dr_log_items')
        .select('item_name, unit, quantity, dr_number')
        .range(from, from + PAGE - 1)
      if (!data || data.length === 0) break
      for (const item of data) {
        if (!item.dr_number) continue
        if (!drMap[item.dr_number]) drMap[item.dr_number] = {}
        const key = item.item_name
        if (!drMap[item.dr_number][key]) drMap[item.dr_number][key] = { qty: 0, unit: item.unit ?? '' }
        drMap[item.dr_number][key].qty += Number(item.quantity) || 0
      }
      if (data.length < PAGE) break
      from += PAGE
    }

    // Get DR logs to map dr_number → client
    const drClientMap: Record<string, string> = {}
    from = 0
    while (true) {
      const { data } = await supabase
        .from('dr_logs')
        .select('dr_number, supplier_name')
        .not('supplier_name', 'is', null)
        .range(from, from + PAGE - 1)
      if (!data || data.length === 0) break
      for (const dr of data) {
        if (dr.supplier_name) drClientMap[dr.dr_number] = dr.supplier_name
      }
      if (data.length < PAGE) break
      from += PAGE
    }

    // Aggregate DR qty per client per item
    const drByClient: Record<string, Record<string, { qty: number; unit: string }>> = {}
    for (const [drNum, items] of Object.entries(drMap)) {
      const client = drClientMap[drNum]
      if (!client) continue
      if (!drByClient[client]) drByClient[client] = {}
      for (const [itemName, val] of Object.entries(items)) {
        if (!drByClient[client][itemName]) drByClient[client][itemName] = { qty: 0, unit: val.unit }
        drByClient[client][itemName].qty += val.qty
      }
    }

    // Paginate CSI records
    const csiByClient: Record<string, Record<string, { qty: number; unit: string }>> = {}
    from = 0
    while (true) {
      const { data } = await supabase
        .from('csi_records')
        .select('client_name, item_name, unit, quantity')
        .not('client_name', 'is', null)
        .range(from, from + PAGE - 1)
      if (!data || data.length === 0) break
      for (const rec of data) {
        const client = rec.client_name!
        if (!csiByClient[client]) csiByClient[client] = {}
        if (!csiByClient[client][rec.item_name]) csiByClient[client][rec.item_name] = { qty: 0, unit: rec.unit ?? '' }
        csiByClient[client][rec.item_name].qty += Number(rec.quantity) || 0
      }
      if (data.length < PAGE) break
      from += PAGE
    }

    // Merge into inventory rows
    const allClients = new Set([...Object.keys(drByClient), ...Object.keys(csiByClient)])
    const result: InventoryRow[] = []
    for (const client of allClients) {
      const drItems = drByClient[client] ?? {}
      const csiItems = csiByClient[client] ?? {}
      const allItems = new Set([...Object.keys(drItems), ...Object.keys(csiItems)])
      for (const itemName of allItems) {
        const drQty = drItems[itemName]?.qty ?? 0
        const csiQty = csiItems[itemName]?.qty ?? 0
        const unit = drItems[itemName]?.unit || csiItems[itemName]?.unit || ''
        result.push({ client, item_name: itemName, unit, dr_qty: drQty, csi_qty: csiQty, balance: drQty - csiQty })
      }
    }

    result.sort((a, b) => a.client.localeCompare(b.client) || a.item_name.localeCompare(b.item_name))
    setRows(result)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const clients = Array.from(new Set(rows.map(r => r.client))).sort()

  const filtered = rows.filter(r => {
    const matchClient = clientFilter === 'all' || r.client === clientFilter
    const q = search.toLowerCase()
    const matchSearch = !q || r.item_name.toLowerCase().includes(q) || r.client.toLowerCase().includes(q)
    return matchClient && matchSearch
  })

  const totalItems = filtered.length
  const inStock = filtered.filter(r => r.balance > 0).length
  const balanced = filtered.filter(r => r.balance === 0).length
  const negative = filtered.filter(r => r.balance < 0).length

  function balanceBadge(balance: number) {
    if (balance > 0) return <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">In Stock</Badge>
    if (balance === 0) return <Badge variant="outline" className="text-gray-500 border-gray-300 bg-gray-50">Balanced</Badge>
    return <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">Deficit</Badge>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="text-muted-foreground text-sm">Stock balance per client (DR delivered − CSI charged)</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{loading ? '—' : totalItems}</div>
            <div className="text-xs text-muted-foreground">Line Items</div>
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
            <div className="text-2xl font-bold text-gray-500">{loading ? '—' : balanced}</div>
            <div className="text-xs text-muted-foreground">Balanced</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-red-600">{loading ? '—' : negative}</div>
            <div className="text-xs text-muted-foreground">Deficit</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search item or client…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={clientFilter} onValueChange={v => setClientFilter(v ?? 'all')}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Filter by client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">DR Qty</TableHead>
                  <TableHead className="text-right">CSI Qty</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      No inventory data found.
                    </TableCell>
                  </TableRow>
                ) : filtered.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{row.client}</TableCell>
                    <TableCell className="text-sm font-medium">{row.item_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.unit}</TableCell>
                    <TableCell className="text-right text-sm">{Number(row.dr_qty)}</TableCell>
                    <TableCell className="text-right text-sm">{Number(row.csi_qty)}</TableCell>
                    <TableCell className={`text-right text-sm font-semibold ${row.balance > 0 ? 'text-green-600' : row.balance < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                      {Number(row.balance)}
                    </TableCell>
                    <TableCell>{balanceBadge(row.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
