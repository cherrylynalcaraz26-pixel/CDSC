'use client'

import { useState, useEffect, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Search, Loader2, ChevronRight, ChevronDown, Pencil, AlertTriangle, Plus } from 'lucide-react'
import { toast } from 'sonner'

interface DrDetail  { dr_number: string; qty: number; unit: string; unit_price: number | null }
interface CsiDetail { si_number: string; qty: number; unit: string; unit_price: number | null }
interface WsDetail  { id: string; notes: string | null; qty: number; unit: string; created_at: string }

interface InventoryRow {
  client: string
  item_name: string
  unit: string
  dr_qty: number
  ws_qty: number
  csi_qty: number
  balance: number
  dr_details: DrDetail[]
  csi_details: CsiDetail[]
  ws_details: WsDetail[]
}

interface ItemOption { item_name: string; unit: string }

export default function InventoryPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [clientFilter, setClientFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const [editRow, setEditRow] = useState<InventoryRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editUnit, setEditUnit] = useState('')
  const [saving, setSaving] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [addClient, setAddClient] = useState('')
  const [addItemName, setAddItemName] = useState('')
  const [addQty, setAddQty] = useState('')
  const [addUnit, setAddUnit] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [itemOptions, setItemOptions] = useState<ItemOption[]>([])

  async function load() {
    setLoading(true)
    const PAGE = 1000

    const itemCostMap: Record<string, number | null> = {}
    {
      let f = 0
      while (true) {
        const { data } = await supabase.from('items').select('item_name, cost').range(f, f + PAGE - 1)
        if (!data || data.length === 0) break
        for (const it of data) itemCostMap[it.item_name] = it.cost ?? null
        if (data.length < PAGE) break
        f += PAGE
      }
    }

    const drMap: Record<string, Record<string, { qty: number; unit: string }>> = {}
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
        if (!drMap[item.dr_number][item.item_name]) drMap[item.dr_number][item.item_name] = { qty: 0, unit: item.unit ?? '' }
        drMap[item.dr_number][item.item_name].qty += Number(item.quantity) || 0
      }
      if (data.length < PAGE) break
      from += PAGE
    }

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

    const drByClient: Record<string, Record<string, { qty: number; unit: string; details: DrDetail[] }>> = {}
    for (const [drNum, items] of Object.entries(drMap)) {
      const client = drClientMap[drNum]
      if (!client) continue
      if (!drByClient[client]) drByClient[client] = {}
      for (const [itemName, val] of Object.entries(items)) {
        if (!drByClient[client][itemName]) drByClient[client][itemName] = { qty: 0, unit: val.unit, details: [] }
        drByClient[client][itemName].qty += val.qty
        drByClient[client][itemName].details.push({
          dr_number: drNum,
          qty: val.qty,
          unit: val.unit,
          unit_price: itemCostMap[itemName] ?? null,
        })
      }
    }

    const csiByClient: Record<string, Record<string, { qty: number; unit: string; details: CsiDetail[] }>> = {}
    from = 0
    while (true) {
      const { data } = await supabase
        .from('csi_records')
        .select('client_name, item_name, unit, quantity, si_number, unit_price')
        .not('client_name', 'is', null)
        .range(from, from + PAGE - 1)
      if (!data || data.length === 0) break
      for (const rec of data) {
        const client = rec.client_name!
        if (!csiByClient[client]) csiByClient[client] = {}
        if (!csiByClient[client][rec.item_name]) csiByClient[client][rec.item_name] = { qty: 0, unit: rec.unit ?? '', details: [] }
        csiByClient[client][rec.item_name].qty += Number(rec.quantity) || 0
        csiByClient[client][rec.item_name].details.push({
          si_number: rec.si_number,
          qty: Number(rec.quantity) || 0,
          unit: rec.unit ?? '',
          unit_price: rec.unit_price != null ? Number(rec.unit_price) : null,
        })
      }
      if (data.length < PAGE) break
      from += PAGE
    }

    const wsMap: Record<string, { qty: number; details: WsDetail[] }> = {}
    from = 0
    while (true) {
      const { data } = await supabase
        .from('warehouse_stock')
        .select('id, client_name, item_name, unit, quantity, notes, created_at')
        .range(from, from + PAGE - 1)
      if (!data || data.length === 0) break
      for (const rec of data) {
        const clientKey = rec.client_name ?? ''
        const wsKey = `${clientKey}||${rec.item_name}`
        if (!wsMap[wsKey]) wsMap[wsKey] = { qty: 0, details: [] }
        wsMap[wsKey].qty += Number(rec.quantity) || 0
        wsMap[wsKey].details.push({
          id: rec.id,
          notes: rec.notes ?? null,
          qty: Number(rec.quantity) || 0,
          unit: rec.unit ?? '',
          created_at: rec.created_at,
        })
      }
      if (data.length < PAGE) break
      from += PAGE
    }

    const allClients = new Set([...Object.keys(drByClient), ...Object.keys(csiByClient)])
    const result: InventoryRow[] = []
    for (const client of allClients) {
      const drItems = drByClient[client] ?? {}
      const csiItems = csiByClient[client] ?? {}
      const allItems = new Set([...Object.keys(drItems), ...Object.keys(csiItems)])
      for (const itemName of allItems) {
        const drQty  = drItems[itemName]?.qty ?? 0
        const csiQty = csiItems[itemName]?.qty ?? 0
        const unit   = drItems[itemName]?.unit || csiItems[itemName]?.unit || ''
        const dr_details  = (drItems[itemName]?.details ?? []).sort((a, b) => a.dr_number.localeCompare(b.dr_number))
        const csi_details = (csiItems[itemName]?.details ?? []).sort((a, b) => a.si_number.localeCompare(b.si_number))

        const wsClientEntry = wsMap[`${client}||${itemName}`]
        const wsGeneralEntry = wsMap[`||${itemName}`]
        const wsQty = (wsClientEntry?.qty ?? 0) + (wsGeneralEntry?.qty ?? 0)
        const ws_details: WsDetail[] = [
          ...(wsClientEntry?.details ?? []),
          ...(wsGeneralEntry?.details ?? []),
        ].sort((a, b) => a.created_at.localeCompare(b.created_at))

        result.push({
          client,
          item_name: itemName,
          unit,
          dr_qty: drQty,
          ws_qty: wsQty,
          csi_qty: csiQty,
          balance: drQty + wsQty - csiQty,
          dr_details,
          csi_details,
          ws_details,
        })
      }
    }

    result.sort((a, b) => a.client.localeCompare(b.client) || a.item_name.localeCompare(b.item_name))
    setRows(result)
    setLoading(false)
  }

  async function loadItemOptions() {
    const { data } = await supabase.from('items').select('item_name, unit').order('item_name')
    if (data) setItemOptions(data)
  }

  useEffect(() => { load() }, [])

  function openAddDialog() {
    setAddClient('')
    setAddItemName('')
    setAddQty('')
    setAddUnit('')
    setAddNotes('')
    loadItemOptions()
    setAddOpen(true)
  }

  function handleAddItemSelect(value: string) {
    setAddItemName(value)
    const found = itemOptions.find(o => o.item_name === value)
    if (found) setAddUnit(found.unit ?? '')
  }

  async function saveAddStock() {
    if (!addItemName.trim() || !addQty.trim()) return
    setAddSaving(true)
    const { error } = await supabase.from('warehouse_stock').insert({
      client_name: addClient.trim() || null,
      item_name: addItemName.trim(),
      unit: addUnit.trim(),
      quantity: Number(addQty),
      notes: addNotes.trim() || null,
    })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Warehouse stock added')
      setAddOpen(false)
      load()
    }
    setAddSaving(false)
  }

  const clients = Array.from(new Set(rows.map(r => r.client))).sort()

  const filtered = rows.filter(r => {
    const matchClient = clientFilter === 'all' || r.client === clientFilter
    const q = search.toLowerCase()
    const matchSearch = !q || r.item_name.toLowerCase().includes(q) || r.client.toLowerCase().includes(q)
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'in_stock' && r.balance > 0) ||
      (statusFilter === 'balanced' && r.balance === 0) ||
      (statusFilter === 'deficit' && r.balance < 0)
    return matchClient && matchSearch && matchStatus
  })

  const totalItems = filtered.length
  const inStock  = filtered.filter(r => r.balance > 0).length
  const balanced = filtered.filter(r => r.balance === 0).length
  const negative = filtered.filter(r => r.balance < 0).length

  function rowKey(r: InventoryRow) { return `${r.client}||${r.item_name}` }

  function toggleRow(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function openEdit(e: React.MouseEvent, row: InventoryRow) {
    e.stopPropagation()
    setEditRow(row)
    setEditName(row.item_name)
    setEditUnit(row.unit)
  }

  async function saveEdit() {
    if (!editRow || !editName.trim()) return
    setSaving(true)
    const oldName = editRow.item_name
    const newName = editName.trim()
    const newUnit = editUnit.trim()

    const { error: drErr } = await supabase
      .from('dr_log_items')
      .update({ item_name: newName, ...(newUnit ? { unit: newUnit } : {}) })
      .eq('item_name', oldName)

    const { error: csiErr } = await supabase
      .from('csi_records')
      .update({ item_name: newName, ...(newUnit ? { unit: newUnit } : {}) })
      .eq('item_name', oldName)

    if (drErr || csiErr) {
      toast.error((drErr || csiErr)!.message)
    } else {
      toast.success(`Updated "${oldName}" → "${newName}" in DR and CSI records`)
      setEditRow(null)
      load()
    }
    setSaving(false)
  }

  function balanceBadge(balance: number) {
    if (balance > 0) return <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">In Stock</Badge>
    if (balance === 0) return <Badge variant="outline" className="text-gray-500 border-gray-300 bg-gray-50">Balanced</Badge>
    return <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">Deficit</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="text-muted-foreground text-sm">Stock balance per client (DR delivered + WH Stock − CSI charged)</p>
        </div>
        <Button onClick={openAddDialog} className="bg-red-600 hover:bg-red-700 text-white shrink-0">
          <Plus className="h-4 w-4 mr-1.5" /> Add Stock
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-2xl font-bold">{loading ? '—' : totalItems}</div>
          <div className="text-xs text-muted-foreground">Line Items</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-2xl font-bold text-green-600">{loading ? '—' : inStock}</div>
          <div className="text-xs text-muted-foreground">In Stock</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-2xl font-bold text-gray-500">{loading ? '—' : balanced}</div>
          <div className="text-xs text-muted-foreground">Balanced</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-2xl font-bold text-red-600">{loading ? '—' : negative}</div>
          <div className="text-xs text-muted-foreground">Deficit</div>
        </CardContent></Card>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search item or client…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={clientFilter} onValueChange={v => setClientFilter(v ?? 'all')}>
          <SelectTrigger className="w-60">
            <SelectValue placeholder="Filter by client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'all')}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="in_stock">In Stock</SelectItem>
            <SelectItem value="balanced">Balanced</SelectItem>
            <SelectItem value="deficit">Deficit</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Client</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">DR Qty</TableHead>
                  <TableHead className="text-right">WH Stock</TableHead>
                  <TableHead className="text-right">CSI Qty</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">No inventory data found.</TableCell>
                  </TableRow>
                ) : filtered.map((row) => {
                  const key = rowKey(row)
                  const isOpen = expanded.has(key)
                  const isDeficit = row.balance < 0
                  return (
                    <Fragment key={key}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleRow(key)}
                      >
                        <TableCell className="text-muted-foreground">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell className="text-sm">{row.client}</TableCell>
                        <TableCell className="text-sm font-medium">
                          <span className="flex items-center gap-1.5">
                            {isDeficit && (
                              <span title="Deficit: CSI charges exceed DR deliveries + WH Stock">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                              </span>
                            )}
                            {row.item_name}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.unit}</TableCell>
                        <TableCell className="text-right text-sm">{Number(row.dr_qty)}</TableCell>
                        <TableCell className="text-right text-sm">
                          {row.ws_qty > 0
                            ? <span className="text-green-600 font-medium">{Number(row.ws_qty)}</span>
                            : <span className="text-muted-foreground">—</span>
                          }
                        </TableCell>
                        <TableCell className="text-right text-sm">{Number(row.csi_qty)}</TableCell>
                        <TableCell className={`text-right text-sm font-semibold ${row.balance > 0 ? 'text-green-600' : row.balance < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                          {Number(row.balance)}
                        </TableCell>
                        <TableCell>{balanceBadge(row.balance)}</TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <button
                            onClick={e => openEdit(e, row)}
                            className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
                          >
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                        </TableCell>
                      </TableRow>

                      {isOpen && (
                        <TableRow key={`${key}-detail`}>
                          <TableCell colSpan={10} className="p-0 bg-muted/20">
                            <div className="px-10 py-3 grid grid-cols-3 gap-6">
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">DR Deliveries</p>
                                {row.dr_details.length === 0 ? (
                                  <p className="text-xs text-muted-foreground italic">No DR records</p>
                                ) : (
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-muted-foreground border-b">
                                        <th className="text-left pb-1">DR #</th>
                                        <th className="text-right pb-1">Qty</th>
                                        <th className="text-left pb-1 pl-2">Unit</th>
                                        <th className="text-right pb-1">Unit Price</th>
                                        <th className="text-right pb-1">Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {row.dr_details.map((d, j) => {
                                        const amount = d.unit_price != null ? d.qty * d.unit_price : null
                                        return (
                                          <tr key={j} className="border-b border-muted/30">
                                            <td className="py-1 font-mono text-blue-600">{d.dr_number}</td>
                                            <td className="py-1 text-right font-medium">{Number(d.qty)}</td>
                                            <td className="py-1 pl-2 text-muted-foreground">{d.unit}</td>
                                            <td className="py-1 text-right text-blue-600 font-medium">
                                              {d.unit_price != null ? `₱${Number(d.unit_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                                            </td>
                                            <td className="py-1 text-right font-semibold">
                                              {amount != null ? `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                                            </td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Warehouse Stock</p>
                                {row.ws_details.length === 0 ? (
                                  <p className="text-xs text-muted-foreground italic">No warehouse stock</p>
                                ) : (
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-muted-foreground border-b">
                                        <th className="text-left pb-1">Date Added</th>
                                        <th className="text-left pb-1 pl-2">Notes</th>
                                        <th className="text-right pb-1">Qty</th>
                                        <th className="text-left pb-1 pl-2">Unit</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {row.ws_details.map((d) => (
                                        <tr key={d.id} className="border-b border-muted/30">
                                          <td className="py-1 font-mono text-green-700">{new Date(d.created_at).toLocaleDateString('en-PH')}</td>
                                          <td className="py-1 pl-2 text-muted-foreground">{d.notes ?? '—'}</td>
                                          <td className="py-1 text-right font-medium text-green-600">{Number(d.qty)}</td>
                                          <td className="py-1 pl-2 text-muted-foreground">{d.unit}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">CSI Charges</p>
                                {row.csi_details.length === 0 ? (
                                  <p className="text-xs text-muted-foreground italic">No CSI records</p>
                                ) : (
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-muted-foreground border-b">
                                        <th className="text-left pb-1">SI #</th>
                                        <th className="text-right pb-1">Qty</th>
                                        <th className="text-left pb-1 pl-2">Unit</th>
                                        <th className="text-right pb-1">Unit Price</th>
                                        <th className="text-right pb-1">Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {row.csi_details.map((d, j) => {
                                        const amount = d.unit_price != null ? d.qty * d.unit_price : null
                                        return (
                                          <tr key={j} className="border-b border-muted/30">
                                            <td className="py-1 font-mono text-red-600">{d.si_number}</td>
                                            <td className="py-1 text-right font-medium">{Number(d.qty)}</td>
                                            <td className="py-1 pl-2 text-muted-foreground">{d.unit}</td>
                                            <td className="py-1 text-right text-blue-600 font-medium">
                                              {d.unit_price != null ? `₱${Number(d.unit_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                                            </td>
                                            <td className="py-1 text-right font-semibold">
                                              {amount != null ? `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                                            </td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editRow} onOpenChange={o => { if (!o) setEditRow(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-yellow-600" /> Edit Item
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            This will rename the item in <strong>all</strong> matching DR Log and CSI records.
          </p>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Item Name</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Item name" />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Input value={editUnit} onChange={e => setEditUnit(e.target.value)} placeholder="e.g. Piece/s" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving || !editName.trim()} className="bg-yellow-600 hover:bg-yellow-700 text-white">
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={o => { if (!o) setAddOpen(false) }}>
        <DialogContent className="w-[95vw] max-w-lg sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-red-600" /> Add Warehouse Stock
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Client <span className="text-muted-foreground text-xs">(optional — blank = General Warehouse Stock)</span></Label>
              <Input value={addClient} onChange={e => setAddClient(e.target.value)} placeholder="Client name" />
            </div>
            <div className="space-y-1.5">
              <Label>Item Name <span className="text-red-500">*</span></Label>
              <Select value={addItemName} onValueChange={handleAddItemSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select item…" />
                </SelectTrigger>
                <SelectContent>
                  {itemOptions.map(o => (
                    <SelectItem key={o.item_name} value={o.item_name}>{o.item_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quantity <span className="text-red-500">*</span></Label>
              <Input type="number" min="0" value={addQty} onChange={e => setAddQty(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Input value={addUnit} onChange={e => setAddUnit(e.target.value)} placeholder="e.g. Piece/s" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input value={addNotes} onChange={e => setAddNotes(e.target.value)} placeholder="Optional notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={saveAddStock}
              disabled={addSaving || !addItemName.trim() || !addQty.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {addSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Add Stock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
