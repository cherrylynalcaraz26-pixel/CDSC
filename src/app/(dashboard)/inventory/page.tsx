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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Search, Loader2, ChevronRight, ChevronDown, Pencil, AlertTriangle, Plus, X, MoreHorizontal, Trash2, FileText, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { useSearchContext } from '@/context/search-context'

interface DrDetail  { dr_number: string; qty: number; unit: string; unit_price: number | null; show_in_portal: boolean }
interface CsiDetail { si_number: string; qty: number; unit: string; unit_price: number | null; show_in_portal: boolean }
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

interface ItemOption {
  item_name: string; unit_of_measure: string; item_code: string
  brand: string | null; attribute: string | null
  cost: number | null; selling_price: number | null; status: string
}

export default function InventoryPage() {
  const supabase = createClient()
  const { query: search } = useSearchContext()
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [uomMap, setUomMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [clientFilter, setClientFilter] = useState('all')
  const [itemFilter, setItemFilter] = useState('all')
  const [itemSearch, setItemSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'by_client' | 'by_item' | 'by_warehouse'>('by_client')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const [warehouseRows, setWarehouseRows] = useState<{id: string; client_name: string | null; item_name: string; unit: string; quantity: number; notes: string | null; created_at: string; hasClientRecord: boolean}[]>([])
  const [warehouseUpdateOpen, setWarehouseUpdateOpen] = useState(false)
  const [warehouseUpdateRow, setWarehouseUpdateRow] = useState<{id: string; item_name: string; unit: string; notes: string | null} | null>(null)
  const [warehouseUpdateQty, setWarehouseUpdateQty] = useState('')
  const [warehouseUpdateNotes, setWarehouseUpdateNotes] = useState('')
  const [warehouseUpdateSaving, setWarehouseUpdateSaving] = useState(false)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmMsg, setConfirmMsg] = useState('')
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportClient, setReportClient] = useState('')
  const [reportScope, setReportScope] = useState<'all' | 'portal'>('all')

  function askConfirm(msg: string, action: () => void) {
    setConfirmMsg(msg)
    setConfirmAction(() => action)
    setConfirmOpen(true)
  }

  const [editRow, setEditRow] = useState<InventoryRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editUnit, setEditUnit] = useState('')
  const [saving, setSaving] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [addItemName, setAddItemName] = useState('')
  const [addItemSearch, setAddItemSearch] = useState('')
  const [addItemFocus, setAddItemFocus] = useState(false)
  const [addSelectedItem, setAddSelectedItem] = useState<ItemOption | null>(null)
  const [addQty, setAddQty] = useState('')
  const [addUnit, setAddUnit] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [itemOptions, setItemOptions] = useState<ItemOption[]>([])

  async function load() {
    setLoading(true)
    const PAGE = 1000

    const { data: uomData } = await supabase.from('uom_list').select('code, name')
    const uomLookup: Record<string, string> = {}
    for (const u of uomData ?? []) uomLookup[u.code] = u.name
    setUomMap(uomLookup)

    const itemCostMap: Record<string, number | null> = {}
    {
      let f = 0
      while (true) {
        const { data } = await supabase.from('items').select('item_name, cost').order('id').range(f, f + PAGE - 1)
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
        .order('id')
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

    // A DR's portal visibility is inherited from its linked Sales Order's show_in_portal
    // flag (DRs don't carry their own) — used so the report can filter to portal-visible
    // deliveries/invoices only, same rule the client portal itself uses.
    const soPortalMap: Record<string, boolean> = {}
    from = 0
    while (true) {
      const { data } = await supabase.from('sales_orders').select('so_number, show_in_portal').order('id').range(from, from + PAGE - 1)
      if (!data || data.length === 0) break
      for (const so of data) if (so.so_number) soPortalMap[so.so_number] = so.show_in_portal === true
      if (data.length < PAGE) break
      from += PAGE
    }

    // Only DRs actually received (fully or partially) should count toward inventory — a
    // rejected or returned DR shouldn't add its items to the balance.
    const drClientMap: Record<string, string> = {}
    const drPoNumberMap: Record<string, string> = {}
    from = 0
    while (true) {
      const { data } = await supabase
        .from('dr_logs')
        .select('dr_number, supplier_name, po_number')
        .not('supplier_name', 'is', null)
        .in('status', ['received', 'partial'])
        .order('id')
        .range(from, from + PAGE - 1)
      if (!data || data.length === 0) break
      for (const dr of data) {
        if (dr.supplier_name) drClientMap[dr.dr_number] = dr.supplier_name
        if (dr.po_number) drPoNumberMap[dr.dr_number] = dr.po_number
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
          show_in_portal: soPortalMap[drPoNumberMap[drNum]] ?? false,
        })
      }
    }

    const csiByClient: Record<string, Record<string, { qty: number; unit: string; details: CsiDetail[] }>> = {}
    from = 0
    while (true) {
      const { data } = await supabase
        .from('csi_records')
        .select('client_name, item_name, unit, quantity, si_number, unit_price, show_in_portal')
        .not('client_name', 'is', null)
        .order('id')
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
          show_in_portal: rec.show_in_portal === true,
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
        .order('id')
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

    // Build warehouse view rows — all warehouse_stock entries
    const allItemsWithClientRecord = new Set(result.map(r => r.item_name))
    const whRows: typeof warehouseRows = []
    from = 0
    while (true) {
      const { data } = await supabase
        .from('warehouse_stock')
        .select('id, client_name, item_name, unit, quantity, notes, created_at')
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, from + PAGE - 1)
      if (!data || data.length === 0) break
      for (const rec of data) {
        whRows.push({
          id: rec.id,
          client_name: rec.client_name ?? null,
          item_name: rec.item_name,
          unit: rec.unit ?? '',
          quantity: Number(rec.quantity) || 0,
          notes: rec.notes ?? null,
          created_at: rec.created_at,
          hasClientRecord: allItemsWithClientRecord.has(rec.item_name),
        })
      }
      if (data.length < PAGE) break
      from += PAGE
    }
    setWarehouseRows(whRows)
    setLoading(false)
  }

  async function loadItemOptions() {
    const { data } = await supabase
      .from('items')
      .select('item_name, unit_of_measure, item_code, brand, attribute, cost, selling_price, status')
      .eq('status', 'active')
      .order('item_name')
    if (data) setItemOptions(data)
  }

  useEffect(() => { load() }, [])
  useEffect(() => { setPage(1) }, [clientFilter, itemFilter, statusFilter, search, viewMode])

  function uomName(code: string) { return uomMap[code] || code }

  function openWarehouseUpdate(row: typeof warehouseRows[0]) {
    setWarehouseUpdateRow({ id: row.id, item_name: row.item_name, unit: row.unit, notes: row.notes })
    setWarehouseUpdateQty(String(row.quantity))
    setWarehouseUpdateNotes(row.notes ?? '')
    setWarehouseUpdateOpen(true)
  }

  async function saveWarehouseUpdate() {
    if (!warehouseUpdateRow) return
    setWarehouseUpdateSaving(true)
    const { error } = await supabase.from('warehouse_stock').update({
      quantity: Number(warehouseUpdateQty),
      notes: warehouseUpdateNotes.trim() || null,
    }).eq('id', warehouseUpdateRow.id)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Warehouse stock updated')
      setWarehouseUpdateOpen(false)
      load()
    }
    setWarehouseUpdateSaving(false)
  }

  function openAddDialog() {
    setAddItemName('')
    setAddItemSearch('')
    setAddItemFocus(false)
    setAddSelectedItem(null)
    setAddQty('')
    setAddUnit('')
    setAddNotes('')
    loadItemOptions()
    setAddOpen(true)
  }

  function handleAddItemSelect(opt: ItemOption) {
    setAddItemName(opt.item_name)
    setAddItemSearch('')
    setAddItemFocus(false)
    setAddSelectedItem(opt)
    setAddUnit(opt.unit_of_measure ?? '')
  }

  async function saveAddStock() {
    if (!addItemName.trim() || !addQty.trim()) return
    setAddSaving(true)
    const { error } = await supabase.from('warehouse_stock').insert({
      client_name: null,
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
  const itemNames = Array.from(new Set(rows.map(r => r.item_name))).sort()
  const filteredItemNames = itemSearch.trim()
    ? itemNames.filter(n => n.toLowerCase().includes(itemSearch.toLowerCase()))
    : itemNames

  const filtered = rows.filter(r => {
    const matchClient = clientFilter === 'all' || r.client === clientFilter
    const matchItem = itemFilter === 'all' || r.item_name === itemFilter
    const q = search.toLowerCase()
    const matchSearch = !q || r.item_name.toLowerCase().includes(q) || r.client.toLowerCase().includes(q)
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'in_stock' && r.balance > 0) ||
      (statusFilter === 'balanced' && r.balance === 0) ||
      (statusFilter === 'deficit' && r.balance < 0)
    return matchClient && matchItem && matchSearch && matchStatus
  })

  // Group by item for By Item view
  interface ItemGroup {
    item_name: string; unit: string
    total_dr: number; total_ws: number; total_csi: number; total_balance: number
    rows: InventoryRow[]
  }
  const byItemGroups: ItemGroup[] = []
  if (viewMode === 'by_item') {
    const map = new Map<string, ItemGroup>()
    for (const r of filtered) {
      if (!map.has(r.item_name)) {
        map.set(r.item_name, { item_name: r.item_name, unit: r.unit, total_dr: 0, total_ws: 0, total_csi: 0, total_balance: 0, rows: [] })
      }
      const g = map.get(r.item_name)!
      g.total_dr += Number(r.dr_qty)
      g.total_ws += Number(r.ws_qty)
      g.total_csi += Number(r.csi_qty)
      g.total_balance += Number(r.balance)
      g.rows.push(r)
    }
    byItemGroups.push(...Array.from(map.values()).sort((a, b) => a.item_name.localeCompare(b.item_name)))
  }

  const PAGE_SIZE = 30
  const [page, setPage] = useState(1)

  const totalItems = filtered.length
  const inStock  = filtered.filter(r => r.balance > 0).length
  const balanced = filtered.filter(r => r.balance === 0).length
  const negative = filtered.filter(r => r.balance < 0).length

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pagedFiltered = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pagedByItemGroups = byItemGroups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pagedWarehouseRows = warehouseRows
    .filter(r => { const q = search.toLowerCase(); return !q || r.item_name.toLowerCase().includes(q) || (r.client_name ?? '').toLowerCase().includes(q) })
    .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const warehouseTotalPages = Math.max(1, Math.ceil(
    warehouseRows.filter(r => { const q = search.toLowerCase(); return !q || r.item_name.toLowerCase().includes(q) || (r.client_name ?? '').toLowerCase().includes(q) }).length / PAGE_SIZE
  ))

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

  async function deleteRow(row: InventoryRow) {
    askConfirm(`Delete all DR and CSI records for "${row.item_name}" under "${row.client}"? This cannot be undone.`, async () => {
    const { error: drErr } = await supabase
      .from('dr_log_items')
      .delete()
      .eq('item_name', row.item_name)
    const { error: csiErr } = await supabase
      .from('csi_records')
      .delete()
      .eq('item_name', row.item_name)
      .eq('client_name', row.client)
    if (drErr || csiErr) {
      toast.error((drErr || csiErr)!.message)
    } else {
      toast.success(`Deleted "${row.item_name}" records`)
      load()
    }
    })
  }

  function deleteWarehouseRow(id: string, item_name: string) {
    askConfirm(`Delete this warehouse stock entry for "${item_name}"? This cannot be undone.`, async () => {
      const { error } = await supabase.from('warehouse_stock').delete().eq('id', id)
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Warehouse stock entry deleted')
        load()
      }
    })
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
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => {
              if (!reportOpen) setReportClient(clientFilter !== 'all' ? clientFilter : clients[0] ?? '')
              setReportOpen(v => !v)
            }}
            disabled={rows.length === 0}
            className={reportOpen ? 'border-red-300 text-red-600 bg-red-50 gap-1.5' : 'border-gray-300 text-gray-700 gap-1.5'}
          >
            <FileText className="h-4 w-4" /> {reportOpen ? 'Close Report' : 'Generate Report'}
          </Button>
          <Button onClick={openAddDialog} className="bg-red-600 hover:bg-red-700 text-white">
            <Plus className="h-4 w-4 mr-1.5" /> Add Stock
          </Button>
        </div>
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

      {/* View toggle — hidden when report is open */}
      {!reportOpen && <div className="flex items-center gap-3 flex-wrap">
        <div className="flex border rounded-md overflow-hidden">
          <button
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${viewMode === 'by_client' ? 'bg-red-600 text-white' : 'hover:bg-muted text-muted-foreground'}`}
            onClick={() => setViewMode('by_client')}
          >By Client</button>
          <button
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${viewMode === 'by_item' ? 'bg-red-600 text-white' : 'hover:bg-muted text-muted-foreground'}`}
            onClick={() => setViewMode('by_item')}
          >By Item</button>
          <button
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${viewMode === 'by_warehouse' ? 'bg-red-600 text-white' : 'hover:bg-muted text-muted-foreground'}`}
            onClick={() => setViewMode('by_warehouse')}
          >By Warehouse</button>
        </div>
      </div>}

      {/* Filters — hidden when report is open */}
      {!reportOpen && <div className="flex gap-3 flex-wrap items-center">
        {/* Item name searchable select */}
        <div className="relative min-w-[240px] max-w-xs flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              className="w-full rounded-md border border-input bg-background pl-9 pr-8 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={itemFilter !== 'all' ? itemFilter : 'Search item name…'}
              value={itemSearch}
              onChange={e => { setItemSearch(e.target.value); if (e.target.value) setItemFilter('all') }}
            />
            {(itemFilter !== 'all' || itemSearch) && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => { setItemFilter('all'); setItemSearch('') }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {itemSearch.trim() && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 max-h-52 overflow-y-auto">
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted text-muted-foreground"
                onMouseDown={() => { setItemFilter('all'); setItemSearch('') }}
              >All Items</button>
              {filteredItemNames.slice(0, 50).map(n => (
                <button
                  key={n}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                  onMouseDown={() => { setItemFilter(n); setItemSearch('') }}
                >{n}</button>
              ))}
              {filteredItemNames.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">No items match</div>
              )}
            </div>
          )}
        </div>

        <Select value={clientFilter} onValueChange={v => setClientFilter(v ?? 'all')}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Filter by client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'all')}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="in_stock">In Stock</SelectItem>
            <SelectItem value="balanced">Balanced</SelectItem>
            <SelectItem value="deficit">Deficit</SelectItem>
          </SelectContent>
        </Select>
      </div>}

      {/* Client inventory summary box — hidden when report is open */}
      {!reportOpen && clientFilter !== 'all' && (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-blue-800">Inventory Summary — {clientFilter}</span>
              <span className="ml-auto text-xs text-blue-600">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg border border-blue-100 px-3 py-2">
                <div className="text-xs text-muted-foreground">Total DR Qty</div>
                <div className="text-lg font-bold text-blue-700">{filtered.reduce((s, r) => s + r.dr_qty, 0)}</div>
              </div>
              <div className="bg-white rounded-lg border border-blue-100 px-3 py-2">
                <div className="text-xs text-muted-foreground">WH Stock</div>
                <div className="text-lg font-bold text-green-600">{filtered.reduce((s, r) => s + r.ws_qty, 0)}</div>
              </div>
              <div className="bg-white rounded-lg border border-blue-100 px-3 py-2">
                <div className="text-xs text-muted-foreground">CSI Charged</div>
                <div className="text-lg font-bold text-red-600">{filtered.reduce((s, r) => s + r.csi_qty, 0)}</div>
              </div>
              <div className="bg-white rounded-lg border border-blue-100 px-3 py-2">
                <div className="text-xs text-muted-foreground">Net Balance</div>
                <div className={`text-lg font-bold ${filtered.reduce((s, r) => s + r.balance, 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {filtered.reduce((s, r) => s + r.balance, 0)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!reportOpen && viewMode === 'by_warehouse' && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-44">Client</TableHead>
                    <TableHead className="min-w-[280px]">Item Name</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Warehouse Note</TableHead>
                    <TableHead>Date Added</TableHead>
                    <TableHead className="w-28">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                  ) : warehouseRows.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No warehouse stock records found.</TableCell></TableRow>
                  ) : pagedWarehouseRows.map(r => {
                    const noClientRecord = !r.hasClientRecord || !r.client_name
                    return (
                      <TableRow key={r.id} className={noClientRecord ? 'bg-amber-50/60' : ''}>
                        <TableCell className="text-sm">
                          {r.client_name ? (
                            <span>{r.client_name}</span>
                          ) : (
                            <span className="text-muted-foreground italic text-xs">No Client</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          <span className="flex items-center gap-1.5">
                            {noClientRecord && <span title="No client DR/CSI record — update stock"><AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" /></span>}
                            {r.item_name}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.unit ? uomName(r.unit) : '—'}</TableCell>
                        <TableCell className="text-right text-sm font-semibold text-green-700">{r.quantity}</TableCell>
                        <TableCell className="text-sm max-w-[220px]">
                          {noClientRecord ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 text-xs font-medium">
                              {r.notes || 'No DR/CSI record — update stock'}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">{r.notes || '—'}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString('en-PH')}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent">
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openWarehouseUpdate(r)}>
                                <Pencil className="h-3.5 w-3.5 mr-2 text-blue-600" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => deleteWarehouseRow(r.id, r.item_name)} className="text-red-600 focus:text-red-600">
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {!reportOpen && viewMode !== 'by_warehouse' && <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  {viewMode === 'by_client'
                    ? <><TableHead className="w-40">Client</TableHead><TableHead className="min-w-[300px]">Item Name</TableHead></>
                    : <><TableHead className="min-w-[300px]">Item Name</TableHead><TableHead className="w-40">Clients</TableHead></>
                  }
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">DR Qty</TableHead>
                  <TableHead className="text-right">WH Stock</TableHead>
                  <TableHead className="text-right">CSI Qty</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  {viewMode === 'by_client' && <TableHead className="w-16">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : viewMode === 'by_item' ? (
                  // ── By Item view ──────────────────────────────
                  byItemGroups.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No inventory data found.</TableCell></TableRow>
                  ) : pagedByItemGroups.map(g => {
                    const key = 'item||' + g.item_name
                    const isOpen = expanded.has(key)
                    const isDeficit = g.total_balance < 0
                    return (
                      <Fragment key={key}>
                        <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRow(key)}>
                          <TableCell className="text-muted-foreground">
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            <span className="flex items-center gap-1.5">
                              {isDeficit && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                              <span className="break-words">{g.item_name}</span>
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{g.rows.length} client{g.rows.length !== 1 ? 's' : ''}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{uomName(g.unit)}</TableCell>
                          <TableCell className="text-right text-sm">{g.total_dr}</TableCell>
                          <TableCell className="text-right text-sm">
                            {g.total_ws > 0 ? <span className="text-green-600 font-medium">{g.total_ws}</span> : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right text-sm">{g.total_csi}</TableCell>
                          <TableCell className={`text-right text-sm font-semibold ${g.total_balance > 0 ? 'text-green-600' : g.total_balance < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                            {g.total_balance}
                          </TableCell>
                          <TableCell>{balanceBadge(g.total_balance)}</TableCell>
                        </TableRow>
                        {isOpen && g.rows.map(r => (
                          <TableRow key={r.client} className="bg-muted/20 text-xs">
                            <TableCell />
                            <TableCell className="pl-6 text-muted-foreground italic">{r.item_name}</TableCell>
                            <TableCell className="font-medium">{r.client}</TableCell>
                            <TableCell className="text-muted-foreground">{uomName(r.unit)}</TableCell>
                            <TableCell className="text-right">{Number(r.dr_qty)}</TableCell>
                            <TableCell className="text-right">{r.ws_qty > 0 ? <span className="text-green-600">{Number(r.ws_qty)}</span> : '—'}</TableCell>
                            <TableCell className="text-right">{Number(r.csi_qty)}</TableCell>
                            <TableCell className={`text-right font-semibold ${r.balance > 0 ? 'text-green-600' : r.balance < 0 ? 'text-red-600' : 'text-gray-500'}`}>{Number(r.balance)}</TableCell>
                            <TableCell>{balanceBadge(r.balance)}</TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    )
                  })
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">No inventory data found.</TableCell>
                  </TableRow>
                ) : pagedFiltered.map((row) => {
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
                        <TableCell className="text-sm font-medium min-w-[200px]">
                          <span className="flex items-center gap-1.5">
                            {isDeficit && (
                              <span title="Deficit: CSI charges exceed DR deliveries + WH Stock">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                              </span>
                            )}
                            <span className="break-words">{row.item_name}</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{uomName(row.unit)}</TableCell>
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
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent">
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={e => openEdit(e, row)}>
                                <Pencil className="h-3.5 w-3.5 mr-2 text-yellow-600" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => deleteRow(row)} className="text-red-600 focus:text-red-600">
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
                                            <td className="py-1 pl-2 text-muted-foreground">{uomName(d.unit)}</td>
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
                                          <td className="py-1 pl-2 text-muted-foreground">{uomName(d.unit)}</td>
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
                                            <td className="py-1 pl-2 text-muted-foreground">{uomName(d.unit)}</td>
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
      </Card>}

      {/* Pagination — hidden when report is open */}
      {!reportOpen && (() => {
        const activeTotalPages = viewMode === 'by_warehouse' ? warehouseTotalPages : totalPages
        const activeTotal = viewMode === 'by_warehouse'
          ? warehouseRows.filter(r => { const q = search.toLowerCase(); return !q || r.item_name.toLowerCase().includes(q) || (r.client_name ?? '').toLowerCase().includes(q) }).length
          : viewMode === 'by_item' ? byItemGroups.length : filtered.length
        if (activeTotalPages <= 1) return null
        return (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, activeTotal)} of {activeTotal}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-md border text-sm font-medium disabled:opacity-40 hover:bg-muted transition-colors"
              >← Prev</button>
              {Array.from({ length: activeTotalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${p === page ? 'bg-red-600 text-white' : 'border hover:bg-muted'}`}
                >{p}</button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(activeTotalPages, p + 1))}
                disabled={page === activeTotalPages}
                className="px-3 py-1.5 rounded-md border text-sm font-medium disabled:opacity-40 hover:bg-muted transition-colors"
              >Next →</button>
            </div>
          </div>
        )
      })()}

      {/* Inline Inventory Report — shown instead of table when reportOpen */}
      {reportOpen && (() => {
        const baseRows = rows.filter(r => r.client === reportClient)
        const reportRows = reportScope === 'all' ? baseRows : baseRows
          .map(r => {
            const dr_details = r.dr_details.filter(d => d.show_in_portal)
            const csi_details = r.csi_details.filter(d => d.show_in_portal)
            const dr_qty = dr_details.reduce((s, d) => s + d.qty, 0)
            const csi_qty = csi_details.reduce((s, d) => s + d.qty, 0)
            return { ...r, dr_details, csi_details, dr_qty, csi_qty, balance: dr_qty + r.ws_qty - csi_qty }
          })
          .filter(r => r.dr_qty > 0 || r.csi_qty > 0)
        const totalBalance = reportRows.reduce((s, r) => s + r.balance, 0)
        const totalDr = reportRows.reduce((s, r) => s + r.dr_qty, 0)
        const totalWs = reportRows.reduce((s, r) => s + r.ws_qty, 0)
        const totalCsi = reportRows.reduce((s, r) => s + r.csi_qty, 0)
        const totalEstValue = reportRows.reduce((s, r) => {
          const price = r.csi_details.length > 0
            ? r.csi_details[r.csi_details.length - 1].unit_price
            : r.dr_details.length > 0 ? r.dr_details[r.dr_details.length - 1].unit_price : null
          return s + (price != null ? r.balance * price : 0)
        }, 0)
        const today = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
        return (
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b flex-wrap">
              <FileText className="h-4 w-4 text-red-600 shrink-0" />
              <span className="font-semibold text-sm text-gray-800 shrink-0">Inventory Report</span>
              <div className="w-px h-4 bg-gray-300 mx-1 shrink-0" />
              <label className="text-sm text-gray-500 shrink-0">Client:</label>
              <Select value={reportClient} onValueChange={v => setReportClient(v ?? '')}>
                <SelectTrigger className="w-80 h-8 text-sm">
                  <SelectValue placeholder="Select client" className="truncate" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex border border-gray-300 rounded-md overflow-hidden shrink-0">
                <button
                  onClick={() => setReportScope('all')}
                  className={`h-8 px-3 text-xs font-medium transition-colors ${reportScope === 'all' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >All</button>
                <button
                  onClick={() => setReportScope('portal')}
                  className={`h-8 px-3 text-xs font-medium border-l border-gray-300 transition-colors ${reportScope === 'portal' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >Visible in Client Portal</button>
              </div>
              <Button
                className="ml-auto bg-red-600 hover:bg-red-700 text-white h-8 text-sm gap-1.5 shrink-0"
                onClick={() => {
                  const el = document.getElementById('inventory-report-print')
                  if (!el) return
                  const win = window.open('', '_blank', 'width=1100,height=800')
                  if (!win) return
                  win.document.write(`<!DOCTYPE html><html><head><title>Inventory Report - ${reportClient}</title><style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: Arial, sans-serif; background: #fff; color: #111; padding: 32px; }
                    .accent { background: #dc2626; height: 5px; border-radius: 3px; margin-bottom: 20px; }
                    .letterhead { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid #e5e7eb; }
                    .co-name { font-size: 22px; font-weight: 800; color: #dc2626; }
                    .co-sub { font-size: 10px; color: #9ca3af; margin-top: 2px; }
                    .rpt-title { text-align: right; font-size: 15px; font-weight: 700; }
                    .rpt-date { font-size: 10px; color: #9ca3af; margin-top: 2px; }
                    .cards { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 18px; }
                    .card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 14px; background: #f9fafb; }
                    .card-label { font-size: 9px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
                    .card-val { font-size: 20px; font-weight: 700; margin-top: 3px; }
                    .blue { color: #1d4ed8; } .green { color: #15803d; } .orange { color: #c2410c; } .red { color: #dc2626; }
                    table { width: 100%; border-collapse: collapse; font-size: 11px; }
                    th { background: #1f2937; color: #fff; text-align: left; padding: 7px 10px; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
                    th.r { text-align: right; }
                    td { padding: 6px 10px; border-bottom: 1px solid #f3f4f6; }
                    td.r { text-align: right; }
                    tr:nth-child(even) td { background: #f9fafb; }
                    tfoot td { font-weight: 700; background: #f3f4f6; border-top: 2px solid #d1d5db; }
                    .note { margin-top: 20px; padding-top: 10px; border-top: 1px solid #f3f4f6; font-size: 9px; color: #9ca3af; display: flex; justify-content: space-between; }
                    @media print { @page { margin: 12mm; size: A4 landscape; } }
                  </style></head><body>
                    <div class="accent"></div>
                    <div class="letterhead">
                      <div><img src="/cdsc-logo.jpg" style="height:50px;width:auto;display:block;margin-bottom:4px;" /><div style="font-size:11px;font-weight:600;color:#374151">CDSC Industrial Supply</div></div>
                      <div><div class="rpt-title">Inventory Report</div><div class="rpt-date">As of ${today}</div></div>
                    </div>
                    ${el.innerHTML}
                  </body></html>`)
                  win.document.close()
                  win.focus()
                  setTimeout(() => { win.print() }, 400)
                }}
              >
                <Printer className="h-4 w-4" /> Print / Save PDF
              </Button>
            </div>

            {/* Report body */}
            <div className="bg-white p-8" id="inventory-report-print">
              <div className="h-1 bg-red-600 rounded-full mb-6" />
              <div className="flex justify-between items-start mb-6 pb-5 border-b border-gray-200">
                <div>
                  <img src="/cdsc-logo.jpg" alt="CDSC" className="h-12 w-auto object-contain" />
                  <div className="text-xs font-semibold text-gray-700 mt-1">CDSC Industrial Supply</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold text-gray-800">Inventory Report</div>
                  <div className="text-xs text-gray-400 mt-0.5">As of {today}</div>
                </div>
              </div>
              <div className="mb-5 flex items-center gap-3">
                <div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-0.5">Client</div>
                  <div className="text-xl font-bold text-gray-900">{reportClient || '—'}</div>
                </div>
                {reportScope === 'portal' && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Visible in Client Portal Only
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                  { label: 'DR Delivered', value: totalDr,      cls: 'text-blue-700' },
                  { label: 'WH Stock',     value: totalWs,      cls: 'text-green-700' },
                  { label: 'CSI Issued',   value: totalCsi,     cls: 'text-orange-600' },
                  { label: 'Net Balance',  value: totalBalance, cls: totalBalance >= 0 ? 'text-green-700' : 'text-red-600' },
                ].map(c => (
                  <div key={c.label} className="border border-gray-200 rounded-lg px-4 py-3 bg-gray-50">
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{c.label}</div>
                    <div className={`text-2xl font-bold mt-1 ${c.cls}`}>{c.value}</div>
                  </div>
                ))}
              </div>
              {reportRows.length === 0 ? (
                <div className="text-center py-12 text-gray-400 italic text-sm">No inventory data for this client.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-gray-800 text-white">
                        <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase tracking-wide w-8">#</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase tracking-wide">Item Description</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase tracking-wide w-20">Unit</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-[10px] uppercase tracking-wide w-16">DR Qty</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-[10px] uppercase tracking-wide w-16">WH Stock</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-[10px] uppercase tracking-wide w-20">CSI Issued</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-[10px] uppercase tracking-wide w-16">Balance</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-[10px] uppercase tracking-wide w-28">Est. Unit Price</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-[10px] uppercase tracking-wide w-28">Est. Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportRows.map((r, i) => {
                        const latestPrice = r.csi_details.length > 0
                          ? r.csi_details[r.csi_details.length - 1].unit_price
                          : r.dr_details.length > 0 ? r.dr_details[r.dr_details.length - 1].unit_price : null
                        const estValue = latestPrice != null ? r.balance * latestPrice : null
                        return (
                          <tr key={r.item_name} className={i % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="px-3 py-2 text-gray-400 border-b border-gray-100">{i + 1}</td>
                            <td className="px-3 py-2 font-medium text-gray-800 border-b border-gray-100">{r.item_name}</td>
                            <td className="px-3 py-2 text-gray-500 border-b border-gray-100">{uomName(r.unit)}</td>
                            <td className="px-3 py-2 text-right text-gray-700 border-b border-gray-100">{r.dr_qty}</td>
                            <td className="px-3 py-2 text-right border-b border-gray-100">
                              {r.ws_qty > 0 ? <span className="text-green-600 font-medium">{r.ws_qty}</span> : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700 border-b border-gray-100">{r.csi_qty}</td>
                            <td className={`px-3 py-2 text-right font-bold border-b border-gray-100 ${r.balance > 0 ? 'text-green-700' : r.balance < 0 ? 'text-red-600' : 'text-gray-400'}`}>{r.balance}</td>
                            <td className="px-3 py-2 text-right text-blue-600 border-b border-gray-100">
                              {latestPrice != null ? `₱${latestPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : <span className="text-gray-300">—</span>}
                            </td>
                            <td className={`px-3 py-2 text-right font-semibold border-b border-gray-100 ${estValue != null && estValue < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                              {estValue != null ? `₱${estValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : <span className="text-gray-300">—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100">
                        <td colSpan={6} className="px-3 py-2.5 text-right text-xs font-bold text-gray-600 border-t-2 border-gray-300">TOTAL</td>
                        <td className={`px-3 py-2.5 text-right text-sm font-bold border-t-2 border-gray-300 ${totalBalance > 0 ? 'text-green-700' : totalBalance < 0 ? 'text-red-600' : 'text-gray-500'}`}>{totalBalance}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-gray-400 border-t-2 border-gray-300">—</td>
                        <td className="px-3 py-2.5 text-right text-sm font-bold text-gray-800 border-t-2 border-gray-300">
                          ₱{totalEstValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              <div className="mt-8 pt-4 border-t border-gray-100 text-[10px] text-gray-400 flex justify-between flex-wrap gap-2">
                <span>Est. Unit Price is based on the latest CSI or DR record. Values are for reference only.</span>
                <span>Generated {today} · CDSC Inventory System</span>
              </div>
            </div>
          </div>
        )
      })()}

      <Dialog open={warehouseUpdateOpen} onOpenChange={o => { if (!o) setWarehouseUpdateOpen(false) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-blue-600" /> Update Warehouse Stock
            </DialogTitle>
          </DialogHeader>
          {warehouseUpdateRow && (
            <div className="space-y-4 py-2">
              <div className="rounded-md bg-muted/40 px-3 py-2 text-sm font-medium">{warehouseUpdateRow.item_name}</div>
              <div className="space-y-1.5">
                <Label>Quantity <span className="text-red-500">*</span></Label>
                <Input type="number" min="0" value={warehouseUpdateQty} onChange={e => setWarehouseUpdateQty(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Warehouse Note</Label>
                <Input value={warehouseUpdateNotes} onChange={e => setWarehouseUpdateNotes(e.target.value)} placeholder="Notes about this stock entry" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setWarehouseUpdateOpen(false)}>Cancel</Button>
            <Button
              onClick={saveWarehouseUpdate}
              disabled={warehouseUpdateSaving || !warehouseUpdateQty.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {warehouseUpdateSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Update Stock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <Dialog open={addOpen} onOpenChange={o => { if (!o) { setAddOpen(false); setAddItemFocus(false) } }}>
        <DialogContent className="w-[95vw] max-w-lg sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-red-600" /> Add Warehouse Stock
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">

            {/* Item picker */}
            <div className="space-y-1.5">
              <Label>Item Name <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  className="w-full rounded-md border border-input bg-background pl-9 pr-8 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
                  placeholder={addItemName || 'Search and select item…'}
                  value={addItemSearch}
                  onChange={e => { setAddItemSearch(e.target.value); setAddItemFocus(true) }}
                  onFocus={() => setAddItemFocus(true)}
                  onBlur={() => setTimeout(() => setAddItemFocus(false), 150)}
                />
                {addItemName && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onMouseDown={() => { setAddItemName(''); setAddSelectedItem(null); setAddUnit(''); setAddItemSearch('') }}
                  ><X className="h-3.5 w-3.5" /></button>
                )}
                {addItemFocus && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 max-h-56 overflow-y-auto">
                    {(() => {
                      const q = addItemSearch.toLowerCase()
                      const matches = q
                        ? itemOptions.filter(o => o.item_name.toLowerCase().includes(q) || (o.item_code ?? '').toLowerCase().includes(q) || (o.brand ?? '').toLowerCase().includes(q))
                        : itemOptions
                      if (matches.length === 0) return <div className="px-3 py-3 text-sm text-muted-foreground">No items found</div>
                      return matches.map(o => (
                        <button
                          key={o.item_name}
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted border-b last:border-0 flex flex-col gap-0.5"
                          onMouseDown={() => handleAddItemSelect(o)}
                        >
                          <span className="font-medium">{o.item_name}</span>
                          <span className="text-xs text-muted-foreground flex gap-2">
                            {o.item_code && <span>{o.item_code}</span>}
                            {o.brand && <span>· {o.brand}</span>}
                            {o.attribute && <span>· {o.attribute}</span>}
                            <span>· {o.unit_of_measure}</span>
                          </span>
                        </button>
                      ))
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Selected item detail card */}
            {addSelectedItem && (
              <div className="rounded-lg border bg-muted/30 px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                <div><span className="text-muted-foreground text-xs">Item Code</span><div className="font-mono font-medium">{addSelectedItem.item_code || '—'}</div></div>
                <div><span className="text-muted-foreground text-xs">Unit</span><div>{addSelectedItem.unit_of_measure || '—'}</div></div>
                <div><span className="text-muted-foreground text-xs">Brand</span><div>{addSelectedItem.brand || '—'}</div></div>
                <div><span className="text-muted-foreground text-xs">Attribute</span><div>{addSelectedItem.attribute || '—'}</div></div>
                <div><span className="text-muted-foreground text-xs">Unit Cost</span><div className="font-medium">₱{(addSelectedItem.cost ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div></div>
                <div><span className="text-muted-foreground text-xs">Selling Price</span><div className="font-medium">{addSelectedItem.selling_price != null ? `₱${addSelectedItem.selling_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}</div></div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Quantity <span className="text-red-500">*</span></Label>
                <Input type="number" min="0" value={addQty} onChange={e => setAddQty(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <div className="h-9 flex items-center px-3 text-sm bg-muted/30 rounded border text-muted-foreground">
                  {addUnit || '— auto-filled —'}
                </div>
              </div>
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
              className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
            >
              {addSaving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <><Plus className="h-4 w-4" />Add Stock</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={o => { if (!o) setConfirmOpen(false) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Confirm Delete</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{confirmMsg}</p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => { confirmAction?.(); setConfirmOpen(false) }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
