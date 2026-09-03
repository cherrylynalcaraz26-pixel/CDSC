'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, SortableTableHead,
} from '@/components/ui/table'
import { useTableSort } from '@/lib/use-table-sort'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, Truck } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useSearchContext } from '@/context/search-context'

interface SalesDelivery {
  id: string
  delivery_number: string
  so_number: string | null
  dr_number: string | null
  delivery_date: string | null
  status: string
  client_name: string | null
  created_at: string
}

interface DeliveryItem {
  id: string
  delivery_number: string
  item_name: string
  unit: string
  quantity: number
}

interface EnrichedDelivery extends SalesDelivery {
  items: DeliveryItem[]
}

const STATUS_COLORS: Record<string, string> = {
  received: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
}

export default function SalesDeliveriesPage() {
  const { query: search } = useSearchContext()
  const [deliveries, setDeliveries] = useState<EnrichedDelivery[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('_all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const { data: dvs } = await supabase
      .from('sales_deliveries')
      .select('*')
      .order('created_at', { ascending: false })

    if (!dvs || dvs.length === 0) {
      setDeliveries([])
      setLoading(false)
      return
    }

    const nums = dvs.map((d: SalesDelivery) => d.delivery_number)
    const { data: items } = await supabase
      .from('sales_delivery_items')
      .select('*')
      .in('delivery_number', nums)

    const itemsMap: Record<string, DeliveryItem[]> = {}
    for (const it of (items ?? [])) {
      if (!itemsMap[it.delivery_number]) itemsMap[it.delivery_number] = []
      itemsMap[it.delivery_number].push(it)
    }

    setDeliveries(dvs.map((d: SalesDelivery) => ({ ...d, items: itemsMap[d.delivery_number] ?? [] })))
    setLoading(false)
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const q = search.toLowerCase()
  const filtered = deliveries.filter(d => {
    if (statusFilter !== '_all' && d.status !== statusFilter) return false
    if (dateFrom && (!d.delivery_date || d.delivery_date < dateFrom)) return false
    if (dateTo && (!d.delivery_date || d.delivery_date > dateTo)) return false
    if (!q) return true
    return (
      d.delivery_number?.toLowerCase().includes(q) ||
      d.so_number?.toLowerCase().includes(q) ||
      d.dr_number?.toLowerCase().includes(q) ||
      d.client_name?.toLowerCase().includes(q) ||
      d.status?.toLowerCase().includes(q) ||
      d.items.some(i => i.item_name.toLowerCase().includes(q))
    )
  })

  type DeliverySortKey = 'delivery_number' | 'so_number' | 'dr_number' | 'delivery_date' | 'client_name' | 'items' | 'status'
  const { sorted: sortedDeliveries, sortKey: deliverySortKey, sortDir: deliverySortDir, onSort: onSortDelivery } = useTableSort<EnrichedDelivery, DeliverySortKey>(filtered, (d, key) => {
    switch (key) {
      case 'delivery_number': return d.delivery_number ?? ''
      case 'so_number': return d.so_number ?? ''
      case 'dr_number': return d.dr_number ?? ''
      case 'delivery_date': return d.delivery_date ?? ''
      case 'client_name': return d.client_name ?? ''
      case 'items': return d.items.length
      case 'status': return d.status ?? ''
    }
  })

  const statusCounts = deliveries.reduce<Record<string, number>>((acc, d) => {
    acc[d.status] = (acc[d.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Truck className="w-6 h-6" /> Sales Deliveries
        </h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {['received', 'partial', 'pending', 'rejected'].map(s => (
          <Card key={s} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter(statusFilter === s ? '_all' : s)}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground capitalize">{s}</p>
              <p className="text-2xl font-bold">{statusCounts[s] ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Status</Label>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? '_all')}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Statuses</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
          <Input type="date" className="w-40" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
          <Input type="date" className="w-40" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo('') }}>Clear</Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Delivery Records ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {deliveries.length === 0
                ? 'No delivery records yet. Save a DR with an SO Reference to populate this table.'
                : 'No records match the current filter.'}
            </div>
          ) : (
            <div className="max-h-[600px] overflow-x-auto overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="w-10">No.</TableHead>
                  <TableHead className="w-8" />
                  <SortableTableHead label="Delivery #" sortKey="delivery_number" activeKey={deliverySortKey} direction={deliverySortDir} onSort={onSortDelivery} />
                  <SortableTableHead label="SO Number" sortKey="so_number" activeKey={deliverySortKey} direction={deliverySortDir} onSort={onSortDelivery} />
                  <SortableTableHead label="DR Number" sortKey="dr_number" activeKey={deliverySortKey} direction={deliverySortDir} onSort={onSortDelivery} />
                  <SortableTableHead label="Delivery Date" sortKey="delivery_date" activeKey={deliverySortKey} direction={deliverySortDir} onSort={onSortDelivery} />
                  <SortableTableHead label="Client" sortKey="client_name" activeKey={deliverySortKey} direction={deliverySortDir} onSort={onSortDelivery} />
                  <SortableTableHead label="Items" sortKey="items" activeKey={deliverySortKey} direction={deliverySortDir} onSort={onSortDelivery} />
                  <SortableTableHead label="Status" sortKey="status" activeKey={deliverySortKey} direction={deliverySortDir} onSort={onSortDelivery} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDeliveries.map((d, idx) => (
                  <>
                    <TableRow key={d.id} className="cursor-pointer hover:bg-red-50/40 transition-colors" onClick={() => toggleExpand(d.id)}>
                      <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                      <TableCell>
                        {expanded.has(d.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </TableCell>
                      <TableCell className="font-mono">{d.delivery_number}</TableCell>
                      <TableCell className="font-mono text-blue-600">{d.so_number ?? '—'}</TableCell>
                      <TableCell className="font-mono">{d.dr_number ?? '—'}</TableCell>
                      <TableCell>{d.delivery_date ? format(parseISO(d.delivery_date), 'MMM d, yyyy') : '—'}</TableCell>
                      <TableCell>{d.client_name ?? '—'}</TableCell>
                      <TableCell>{d.items.length} item{d.items.length !== 1 ? 's' : ''}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[d.status] ?? ''}`}>
                          {d.status}
                        </span>
                      </TableCell>
                    </TableRow>
                    {expanded.has(d.id) && (
                      <TableRow key={`${d.id}-items`} className="bg-muted/30">
                        <TableCell colSpan={9} className="p-0">
                          <div className="px-10 py-3">
                            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Items Delivered</p>
                            <table className="text-sm w-full">
                              <thead>
                                <tr className="text-muted-foreground">
                                  <th className="text-left pb-1 pr-6">Item</th>
                                  <th className="text-right pb-1 pr-6">Qty</th>
                                  <th className="text-left pb-1">Unit</th>
                                </tr>
                              </thead>
                              <tbody>
                                {d.items.map(it => (
                                  <tr key={it.id}>
                                    <td className="pr-6 py-0.5">{it.item_name}</td>
                                    <td className="pr-6 text-right">{it.quantity}</td>
                                    <td>{it.unit}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
