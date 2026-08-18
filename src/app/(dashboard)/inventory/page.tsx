'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { Search, Loader2, Pencil, AlertTriangle, Plus, MoreHorizontal, Trash2, FileText, Printer, Mail, Send, Truck, Package } from 'lucide-react'
import { toast } from 'sonner'
import { useSearchContext } from '@/context/search-context'
import { sendEmail } from '@/lib/send-email'

interface DrDetail  { dr_number: string; qty: number; unit: string; unit_price: number | null; show_in_portal: boolean }
interface CsiDetail { si_number: string; qty: number; unit: string; unit_price: number | null; show_in_portal: boolean }
interface WsDetail  { id: string; notes: string | null; qty: number; unit: string; created_at: string }

// Item detail modal (By Item view)
interface ItemDetail {
  item_name: string
  unit: string
  delivered: number
  billed: number
  balance: number
  price: number
}
interface ItemDetailDrRow  { dr_date: string | null; dr_number: string | null; client_name: string | null; unit: string | null; quantity: number }
interface ItemDetailCsiRow { id: string | number; si_date: string | null; si_number: string | null; client_name: string | null; unit: string | null; quantity: number | null; unit_price: number | null; amount: number | null; collection_status: string | null }

const peso = (v: number | null | undefined) =>
  '₱' + Number(v ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface InventoryRow {
  client: string
  item_name: string
  unit: string
  dr_qty: number
  ws_qty: number
  client_on_hand: number
  csi_qty: number
  balance: number
  dr_details: DrDetail[]
  csi_details: CsiDetail[]
  ws_details: WsDetail[]
  channelId: string | null
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
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'by_client' | 'by_item' | 'by_warehouse'>('by_client')
  const [clientDetailRow, setClientDetailRow] = useState<InventoryRow | null>(null)

  // Item detail modal (By Item view)
  const [detailItem, setDetailItem] = useState<ItemDetail | null>(null)
  const [detailDrRows, setDetailDrRows] = useState<ItemDetailDrRow[]>([])
  const [detailCsiRows, setDetailCsiRows] = useState<ItemDetailCsiRow[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const [warehouseRows, setWarehouseRows] = useState<{id: string; client_name: string | null; item_name: string; unit: string; quantity: number; notes: string | null; created_at: string; hasClientRecord: boolean}[]>([])
  const [warehouseUpdateOpen, setWarehouseUpdateOpen] = useState(false)
  const [warehouseUpdateRow, setWarehouseUpdateRow] = useState<{id: string; item_name: string; unit: string; notes: string | null} | null>(null)
  const [warehouseUpdateQty, setWarehouseUpdateQty] = useState('')
  const [warehouseUpdateNotes, setWarehouseUpdateNotes] = useState('')
  const [warehouseUpdateSaving, setWarehouseUpdateSaving] = useState(false)
  const [wsMarkDelivered, setWsMarkDelivered] = useState(false)
  const [wsDeliverClientId, setWsDeliverClientId] = useState('')
  const [wsDeliverQty, setWsDeliverQty] = useState('')
  const [clientOptions, setClientOptions] = useState<{ id: string; company_name: string }[]>([])
  const [channelOptions, setChannelOptions] = useState<{ id: string; name: string; color: string }[]>([])
  const [assignChannelRow, setAssignChannelRow] = useState<InventoryRow | null>(null)
  const [assignChannelValue, setAssignChannelValue] = useState('')
  const [assigningChannel, setAssigningChannel] = useState(false)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmMsg, setConfirmMsg] = useState('')
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportClient, setReportClient] = useState('')
  const [reportScope, setReportScope] = useState<'all' | 'portal'>('all')
  const [clientOnHandMap, setClientOnHandMap] = useState<Record<string, Record<string, number>>>({})
  const [emailReportOpen, setEmailReportOpen] = useState(false)
  const [emailReportTo, setEmailReportTo] = useState('')
  const [emailReportSubject, setEmailReportSubject] = useState('')
  const [emailReportBody, setEmailReportBody] = useState('')
  const [emailReportSending, setEmailReportSending] = useState(false)

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
  const [addItems, setAddItems] = useState<{ item_name: string; quantity: string; unit: string }[]>([{ item_name: '', quantity: '', unit: '' }])
  const [itemPickerRowIdx, setItemPickerRowIdx] = useState<number | null>(null)
  const [itemPickerSearch, setItemPickerSearch] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [itemOptions, setItemOptions] = useState<ItemOption[]>([])
  const [addPoOptions, setAddPoOptions] = useState<{ id: string; po_number: string }[]>([])
  const [addPoId, setAddPoId] = useState('')
  const [addPoItems, setAddPoItems] = useState<{ item_name: string; quantity: number; unit_of_measure: string | null }[]>([])
  const [addPoItemsLoading, setAddPoItemsLoading] = useState(false)

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

    // Each client's own self-reported "On Hand" quantity (client_inventory, kept live by
    // the portal's Receive/Issue actions and the DR-log auto-sync) — used by the Generate
    // Report's "Client WH Stock" column so it reflects what that client actually has at
    // their site, instead of CDSC's own shared warehouse pool.
    const clientIdToName: Record<string, string> = {}
    const clientOptionsList: { id: string; company_name: string }[] = []
    from = 0
    while (true) {
      const { data } = await supabase.from('clients').select('id, company_name').order('id').range(from, from + PAGE - 1)
      if (!data || data.length === 0) break
      for (const c of data) { clientIdToName[c.id] = c.company_name; clientOptionsList.push(c) }
      if (data.length < PAGE) break
      from += PAGE
    }
    setClientOptions(clientOptionsList.sort((a, b) => a.company_name.localeCompare(b.company_name)))

    const { data: channelsData } = await supabase.from('sales_channels').select('id, name, color').eq('is_active', true).order('sort_order')
    setChannelOptions(channelsData ?? [])

    const onHandByClient: Record<string, Record<string, number>> = {}
    const channelByClient: Record<string, Record<string, string | null>> = {}
    from = 0
    while (true) {
      const { data } = await supabase
        .from('client_inventory')
        .select('client_id, item_name, quantity_on_hand, channel_id')
        .order('id')
        .range(from, from + PAGE - 1)
      if (!data || data.length === 0) break
      for (const rec of data) {
        const clientName = clientIdToName[rec.client_id]
        if (!clientName) continue
        if (!onHandByClient[clientName]) onHandByClient[clientName] = {}
        onHandByClient[clientName][rec.item_name] = (onHandByClient[clientName][rec.item_name] ?? 0) + (Number(rec.quantity_on_hand) || 0)
        if (!channelByClient[clientName]) channelByClient[clientName] = {}
        if (rec.channel_id) channelByClient[clientName][rec.item_name] = rec.channel_id
      }
      if (data.length < PAGE) break
      from += PAGE
    }
    setClientOnHandMap(onHandByClient)

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
        const clientOnHand = onHandByClient[client]?.[itemName] ?? 0
        const channelId = channelByClient[client]?.[itemName] ?? null

        result.push({
          client,
          item_name: itemName,
          unit,
          dr_qty: drQty,
          ws_qty: wsQty,
          client_on_hand: clientOnHand,
          csi_qty: csiQty,
          balance: drQty + wsQty - csiQty,
          dr_details,
          csi_details,
          ws_details,
          channelId,
        })
      }
    }

    result.sort((a, b) => a.client.localeCompare(b.client) || a.item_name.localeCompare(b.item_name))
    setRows(result)

    // Build warehouse view rows — By Warehouse is CDSC's own unassigned stock only
    // (client_name IS NULL, the general pool Receiving always adds into). Once an
    // item has been fully delivered out of that pool its quantity is decremented
    // to 0 by DR Logs — at that point it's no longer sitting in the warehouse, so
    // drop it from this view instead of showing an empty/zero row.
    const allItemsWithClientRecord = new Set(result.map(r => r.item_name))
    const whRows: typeof warehouseRows = []
    from = 0
    while (true) {
      const { data } = await supabase
        .from('warehouse_stock')
        .select('id, client_name, item_name, unit, quantity, notes, created_at')
        .is('client_name', null)
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, from + PAGE - 1)
      if (!data || data.length === 0) break
      for (const rec of data) {
        const qty = Number(rec.quantity) || 0
        if (qty <= 0) continue
        whRows.push({
          id: rec.id,
          client_name: rec.client_name ?? null,
          item_name: rec.item_name,
          unit: rec.unit ?? '',
          quantity: qty,
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
  useEffect(() => { setPage(1) }, [clientFilter, statusFilter, search, viewMode])

  // Keep WH Stock (and DR/CSI totals) live — e.g. once a delivery is recorded
  // in DR Logs elsewhere, this page's Generate Report reflects it immediately
  // instead of needing a manual refresh.
  useEffect(() => {
    const channel = supabase
      .channel('inventory-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warehouse_stock' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dr_logs' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dr_log_items' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'csi_records' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  function uomName(code: string) { return uomMap[code] || code }

  function openWarehouseUpdate(row: typeof warehouseRows[0]) {
    setWarehouseUpdateRow({ id: row.id, item_name: row.item_name, unit: row.unit, notes: row.notes })
    setWarehouseUpdateQty(String(row.quantity))
    setWarehouseUpdateNotes(row.notes ?? '')
    setWsMarkDelivered(false)
    setWsDeliverClientId('')
    setWsDeliverQty(String(row.quantity))
    setWarehouseUpdateOpen(true)
  }

  async function saveWarehouseUpdate() {
    if (!warehouseUpdateRow) return
    setWarehouseUpdateSaving(true)

    // "Already delivered" is a manual fallback for when a DR's auto-decrement doesn't find
    // a matching row (e.g. an item-name mismatch) — it removes the delivered quantity from
    // this general pool and, if a client is picked, credits it to that client's own On Hand
    // ledger the same way the DR auto-sync does.
    if (wsMarkDelivered) {
      const qty = Number(wsDeliverQty)
      if (!qty || qty <= 0) { toast.error('Enter a valid quantity delivered'); setWarehouseUpdateSaving(false); return }
      const { data: wsRow } = await supabase.from('warehouse_stock').select('quantity').eq('id', warehouseUpdateRow.id).maybeSingle()
      const newQty = Math.max(0, (Number(wsRow?.quantity) || 0) - qty)
      const { error } = await supabase.from('warehouse_stock').update({
        quantity: newQty,
        notes: warehouseUpdateNotes.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', warehouseUpdateRow.id)
      if (error) { toast.error(error.message); setWarehouseUpdateSaving(false); return }

      const deliverClient = clientOptions.find(c => c.id === wsDeliverClientId)
      if (deliverClient) {
        const { data: ciRow } = await supabase.from('client_inventory').select('id, quantity_on_hand').eq('client_id', deliverClient.id).eq('item_name', warehouseUpdateRow.item_name).maybeSingle()
        if (ciRow) {
          await supabase.from('client_inventory').update({
            quantity_on_hand: Number(ciRow.quantity_on_hand) + qty,
            updated_at: new Date().toISOString(),
          }).eq('id', ciRow.id)
        } else {
          await supabase.from('client_inventory').insert({
            client_id: deliverClient.id,
            item_name: warehouseUpdateRow.item_name,
            unit: warehouseUpdateRow.unit || null,
            quantity_on_hand: qty,
            low_stock_threshold: 0,
          })
        }
        await supabase.from('client_inventory_transactions').insert({
          client_id: deliverClient.id,
          item_name: warehouseUpdateRow.item_name,
          unit: warehouseUpdateRow.unit || null,
          transaction_type: 'received',
          quantity: qty,
          notes: 'Manually marked delivered from Warehouse',
        })
      }
      toast.success('Marked as delivered — warehouse stock updated')
      setWarehouseUpdateOpen(false)
      load()
      setWarehouseUpdateSaving(false)
      return
    }

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
    setAddItems([{ item_name: '', quantity: '', unit: '' }])
    setItemPickerRowIdx(null)
    setItemPickerSearch('')
    setAddNotes('')
    setAddPoId('')
    setAddPoItems([])
    loadItemOptions()
    loadAddPoOptions()
    setAddOpen(true)
  }

  async function loadAddPoOptions() {
    const { data } = await supabase.from('purchase_orders').select('id, po_number').not('po_number', 'is', null).neq('status', 'cancelled').order('created_at', { ascending: false })
    setAddPoOptions((data ?? []) as { id: string; po_number: string }[])
  }

  async function selectAddPo(poId: string) {
    setAddPoId(poId)
    setAddPoItems([])
    if (!poId) return
    setAddPoItemsLoading(true)
    const { data } = await supabase.from('po_items').select('item_name, quantity, unit_of_measure').eq('po_id', poId)
    setAddPoItems((data ?? []) as { item_name: string; quantity: number; unit_of_measure: string | null }[])
    setAddPoItemsLoading(false)
  }

  function handleAddPoItemSelect(poItem: { item_name: string; quantity: number; unit_of_measure: string | null }) {
    const matched = itemOptions.find(o => o.item_name === poItem.item_name)
    const unit = poItem.unit_of_measure ?? matched?.unit_of_measure ?? ''
    setAddItems(prev => {
      const existingIdx = prev.findIndex(r => r.item_name === poItem.item_name)
      if (existingIdx >= 0) {
        const next = prev.filter((_, i) => i !== existingIdx)
        return next.length > 0 ? next : [{ item_name: '', quantity: '', unit: '' }]
      }
      const emptyIdx = prev.findIndex(r => !r.item_name)
      const row = { item_name: poItem.item_name, quantity: String(poItem.quantity), unit }
      if (emptyIdx >= 0) return prev.map((r, i) => i === emptyIdx ? row : r)
      return [...prev, row]
    })
    setItemPickerRowIdx(null)
    setItemPickerSearch('')
  }

  function openItemPicker(idx: number) {
    setItemPickerRowIdx(idx)
    setItemPickerSearch('')
  }

  function selectAddItemForRow(idx: number, opt: ItemOption) {
    setAddItems(prev => prev.map((row, i) => i === idx ? { ...row, item_name: opt.item_name, unit: opt.unit_of_measure ?? '' } : row))
    setItemPickerRowIdx(null)
    setItemPickerSearch('')
  }

  function updateAddItem(idx: number, field: 'quantity' | 'unit', value: string) {
    setAddItems(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row))
  }

  function addAddItemRow() {
    setAddItems(prev => [...prev, { item_name: '', quantity: '', unit: '' }])
  }

  function removeAddItemRow(idx: number) {
    setAddItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)
  }

  async function receiveAllPoItems() {
    if (addPoItems.length === 0) return
    setAddSaving(true)
    const rows = addPoItems.map(it => ({
      client_name: null,
      item_name: it.item_name,
      unit: it.unit_of_measure ?? '',
      quantity: Number(it.quantity) || 0,
      notes: addNotes.trim() || null,
    }))
    const { error } = await supabase.from('warehouse_stock').insert(rows)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`${rows.length} item${rows.length !== 1 ? 's' : ''} received`)
      setAddOpen(false)
      load()
    }
    setAddSaving(false)
  }

  async function saveAddStock() {
    const validItems = addItems.filter(it => it.item_name.trim() && it.quantity.trim())
    if (validItems.length === 0) return
    setAddSaving(true)
    const rows = validItems.map(it => ({
      client_name: null,
      item_name: it.item_name.trim(),
      unit: it.unit.trim(),
      quantity: Number(it.quantity),
      notes: addNotes.trim() || null,
    }))
    const { error } = await supabase.from('warehouse_stock').insert(rows)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(addPoId
        ? `${rows.length} item${rows.length !== 1 ? 's' : ''} received`
        : `${rows.length} item${rows.length !== 1 ? 's' : ''} added`)
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
      g.total_ws += Number(r.client_on_hand)
      g.total_csi += Number(r.csi_qty)
      g.total_balance += Number(r.balance)
      g.rows.push(r)
    }
    byItemGroups.push(...Array.from(map.values()).sort((a, b) => a.item_name.localeCompare(b.item_name)))
  }

  const PAGE_SIZE = 30
  const [page, setPage] = useState(1)

  // KPI stats per view mode
  // By Client — client × item line rows
  const totalItems = filtered.length
  const uniqueClients = new Set(filtered.map(r => r.client)).size
  const inStock  = filtered.filter(r => r.balance > 0).length
  const balanced = filtered.filter(r => r.balance === 0).length
  const negative = filtered.filter(r => r.balance < 0).length

  // By Item — grouped across clients (byItemGroups is only built in that view)
  const itemGroupsInStock  = byItemGroups.filter(g => g.total_balance > 0).length
  const itemGroupsBalanced = byItemGroups.filter(g => g.total_balance === 0).length
  const itemGroupsDeficit  = byItemGroups.filter(g => g.total_balance < 0).length
  const itemTotalDelivered = byItemGroups.reduce((s, g) => s + g.total_dr, 0)

  // By Warehouse — raw warehouse stock entries (search applies)
  const filteredWarehouseRows = warehouseRows.filter(r => {
    const q = search.toLowerCase()
    return !q || r.item_name.toLowerCase().includes(q) || (r.client_name ?? '').toLowerCase().includes(q)
  })
  const whTotalQty     = filteredWarehouseRows.reduce((s, r) => s + (Number(r.quantity) || 0), 0)
  const whUnassigned   = filteredWarehouseRows.filter(r => !r.client_name).length

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pagedFiltered = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pagedByItemGroups = byItemGroups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pagedWarehouseRows = filteredWarehouseRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const warehouseTotalPages = Math.max(1, Math.ceil(filteredWarehouseRows.length / PAGE_SIZE))

  // Est. Value per warehouse row — quantity × item Unit Cost.
  const itemPriceMap: Record<string, number> = {}
  for (const it of itemOptions) itemPriceMap[it.item_name] = it.cost ?? 0
  const warehouseEstValue = (r: { item_name: string; quantity: number }) => r.quantity * (itemPriceMap[r.item_name] ?? 0)
  const whTotalEstValue = filteredWarehouseRows.reduce((s, r) => s + warehouseEstValue(r), 0)

  function rowKey(r: InventoryRow) { return `${r.client}||${r.item_name}` }

  // Opens the Product Details modal for a By Item group; DR dates and CSI
  // statuses aren't part of the aggregated inventory data, so fetch them here.
  async function openItemDetail(g: { item_name: string; unit: string; total_dr: number; total_csi: number; total_balance: number; rows: InventoryRow[] }) {
    const price = g.rows.flatMap(r => r.dr_details).find(d => d.unit_price != null)?.unit_price ?? 0
    setDetailItem({
      item_name: g.item_name,
      unit: g.unit,
      delivered: g.total_dr,
      billed: g.total_csi,
      balance: g.total_balance,
      price,
    })
    setDetailLoading(true)
    setDetailDrRows([])
    setDetailCsiRows([])
    const [{ data: drItems }, { data: csiData }] = await Promise.all([
      supabase.from('dr_log_items').select('dr_number, unit, quantity').eq('item_name', g.item_name),
      supabase.from('csi_records').select('id, si_date, si_number, client_name, unit, quantity, unit_price, amount, collection_status').eq('item_name', g.item_name).order('si_date'),
    ])
    const drNums = Array.from(new Set((drItems ?? []).map(d => d.dr_number).filter(Boolean))) as string[]
    const logMap: Record<string, { dr_date: string | null; supplier_name: string | null }> = {}
    if (drNums.length > 0) {
      const { data: logs } = await supabase
        .from('dr_logs')
        .select('dr_number, dr_date, supplier_name')
        .in('dr_number', drNums)
        .in('status', ['received', 'partial'])
      for (const l of logs ?? []) logMap[l.dr_number] = { dr_date: l.dr_date ?? null, supplier_name: l.supplier_name ?? null }
    }
    setDetailDrRows(
      (drItems ?? [])
        .filter(d => d.dr_number && logMap[d.dr_number])
        .map(d => ({
          dr_date: logMap[d.dr_number!].dr_date,
          dr_number: d.dr_number,
          client_name: logMap[d.dr_number!].supplier_name,
          unit: d.unit ?? null,
          quantity: Number(d.quantity) || 0,
        }))
        .sort((a, b) => (a.dr_date ?? '').localeCompare(b.dr_date ?? ''))
    )
    setDetailCsiRows((csiData ?? []) as ItemDetailCsiRow[])
    setDetailLoading(false)
  }

  function openEdit(e: React.MouseEvent, row: InventoryRow) {
    e.stopPropagation()
    setEditRow(row)
    setEditName(row.item_name)
    setEditUnit(row.unit)
  }

  function openAssignChannel(e: React.MouseEvent, row: InventoryRow) {
    e.stopPropagation()
    setAssignChannelRow(row)
    setAssignChannelValue(row.channelId ?? '')
  }

  async function saveAssignChannel() {
    if (!assignChannelRow) return
    const clientId = clientOptions.find(c => c.company_name === assignChannelRow.client)?.id
    if (!clientId) { toast.error('Could not resolve this client'); return }
    setAssigningChannel(true)
    const { error } = await supabase
      .from('client_inventory')
      .update({ channel_id: assignChannelValue || null })
      .eq('client_id', clientId)
      .eq('item_name', assignChannelRow.item_name)
    if (error) toast.error(error.message)
    else { toast.success('Channel updated'); setAssignChannelRow(null); load() }
    setAssigningChannel(false)
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

      {/* KPI cards — specific to the active view */}
      {viewMode === 'by_client' && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card><CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-blue-600">{loading ? '—' : uniqueClients}</div>
            <div className="text-xs text-muted-foreground">Clients</div>
          </CardContent></Card>
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
      )}

      {viewMode === 'by_item' && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card><CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{loading ? '—' : byItemGroups.length}</div>
            <div className="text-xs text-muted-foreground">Unique Items</div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-blue-600">{loading ? '—' : itemTotalDelivered.toLocaleString('en-PH')}</div>
            <div className="text-xs text-muted-foreground">Total Delivered (DR)</div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-green-600">{loading ? '—' : itemGroupsInStock}</div>
            <div className="text-xs text-muted-foreground">In Stock</div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-gray-500">{loading ? '—' : itemGroupsBalanced}</div>
            <div className="text-xs text-muted-foreground">Balanced</div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-red-600">{loading ? '—' : itemGroupsDeficit}</div>
            <div className="text-xs text-muted-foreground">Deficit Items</div>
          </CardContent></Card>
        </div>
      )}

      {viewMode === 'by_warehouse' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{loading ? '—' : filteredWarehouseRows.length}</div>
            <div className="text-xs text-muted-foreground">Stock Entries</div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-green-600">{loading ? '—' : `₱${whTotalEstValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}</div>
            <div className="text-xs text-muted-foreground">Est. Value</div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-blue-600">{loading ? '—' : whTotalQty.toLocaleString('en-PH')}</div>
            <div className="text-xs text-muted-foreground">Total On Hand</div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-amber-600">{loading ? '—' : whUnassigned}</div>
            <div className="text-xs text-muted-foreground">General (No Client)</div>
          </CardContent></Card>
        </div>
      )}

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
        {viewMode !== 'by_warehouse' && (
          <Select value={clientFilter} onValueChange={v => setClientFilter(v ?? 'all')}>
            <SelectTrigger className="w-72">
              <SelectValue className="truncate">{(v: string) => v === 'all' ? 'Client' : v}</SelectValue>
            </SelectTrigger>
            <SelectContent className="min-w-[320px]">
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'all')}>
          <SelectTrigger className="w-40">
            <SelectValue>{(v: string) => v === 'all' ? 'Status' : v === 'in_stock' ? 'In Stock' : v === 'balanced' ? 'Balanced' : v === 'deficit' ? 'Deficit' : v}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="in_stock">In Stock</SelectItem>
            <SelectItem value="balanced">Balanced</SelectItem>
            <SelectItem value="deficit">Deficit</SelectItem>
          </SelectContent>
        </Select>
      </div>}

      {/* Client inventory summary box — hidden when report is open or viewing By Warehouse */}
      {!reportOpen && viewMode !== 'by_warehouse' && clientFilter !== 'all' && (
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
                <div className="text-lg font-bold text-green-600">{filtered.reduce((s, r) => s + r.client_on_hand, 0)}</div>
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
                    <TableHead className="w-12">No.</TableHead>
                    <TableHead className="w-44">Owner</TableHead>
                    <TableHead className="min-w-[280px]">Item Name</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Est. Value</TableHead>
                    <TableHead>Warehouse Note</TableHead>
                    <TableHead>Date Added</TableHead>
                    <TableHead className="w-28">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                  ) : warehouseRows.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No warehouse stock records found.</TableCell></TableRow>
                  ) : pagedWarehouseRows.map((r, i) => {
                    // client_name is null for general-pool stock by design (that's how
                    // Receiving always adds it) — that alone isn't a red flag. Only warn
                    // when the item has no DR/CSI history anywhere.
                    const noClientRecord = !r.hasClientRecord
                    return (
                      <TableRow key={r.id} className={noClientRecord ? 'bg-amber-50/60' : ''}>
                        <TableCell className="text-sm text-muted-foreground">{(page - 1) * PAGE_SIZE + i + 1}</TableCell>
                        <TableCell className="text-sm">
                          {r.client_name ? (
                            <span>{r.client_name}</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 text-xs font-medium">CDSC Stock</span>
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
                        <TableCell className="text-right text-sm font-medium text-gray-700">
                          {r.item_name in itemPriceMap ? `₱${warehouseEstValue(r).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : <span className="text-gray-300">—</span>}
                        </TableCell>
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
                  <TableHead className="w-12">No.</TableHead>
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
                  {viewMode === 'by_client' && <TableHead className="w-28">Channel</TableHead>}
                  {viewMode === 'by_client' && <TableHead className="w-16">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : viewMode === 'by_item' ? (
                  // ── By Item view — click a row to open the Product Details modal ──
                  byItemGroups.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No inventory data found.</TableCell></TableRow>
                  ) : pagedByItemGroups.map((g, i) => {
                    const isDeficit = g.total_balance < 0
                    return (
                      <TableRow key={'item||' + g.item_name} className="cursor-pointer hover:bg-muted/50" onClick={() => openItemDetail(g)}>
                        <TableCell className="text-sm text-muted-foreground">{(page - 1) * PAGE_SIZE + i + 1}</TableCell>
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
                    )
                  })
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">No inventory data found.</TableCell>
                  </TableRow>
                ) : pagedFiltered.map((row, i) => {
                  const key = rowKey(row)
                  const isDeficit = row.balance < 0
                  return (
                    <TableRow
                      key={key}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setClientDetailRow(row)}
                    >
                      <TableCell className="text-sm text-muted-foreground">{(page - 1) * PAGE_SIZE + i + 1}</TableCell>
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
                          {row.client_on_hand > 0
                            ? <span className="text-green-600 font-medium">{Number(row.client_on_hand)}</span>
                            : <span className="text-muted-foreground">—</span>
                          }
                        </TableCell>
                        <TableCell className="text-right text-sm">{Number(row.csi_qty)}</TableCell>
                        <TableCell className={`text-right text-sm font-semibold ${row.balance > 0 ? 'text-green-600' : row.balance < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                          {Number(row.balance)}
                        </TableCell>
                        <TableCell>{balanceBadge(row.balance)}</TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <button onClick={e => openAssignChannel(e, row)} className="inline-block">
                            {row.channelId ? (
                              <Badge
                                className="text-white"
                                style={{ backgroundColor: channelOptions.find(c => c.id === row.channelId)?.color ?? '#9ca3af' }}
                              >
                                {channelOptions.find(c => c.id === row.channelId)?.name ?? 'Unknown'}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">Unassigned</Badge>
                            )}
                          </button>
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent">
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={e => openEdit(e, row)}>
                                <Pencil className="h-3.5 w-3.5 mr-2 text-yellow-600" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={e => openAssignChannel(e, row)}>
                                <Send className="h-3.5 w-3.5 mr-2 text-blue-600" /> Assign Channel
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => deleteRow(row)} className="text-red-600 focus:text-red-600">
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
        const onHandMap = clientOnHandMap[reportClient] ?? {}
        const baseRows = rows.filter(r => r.client === reportClient)
        const scopedRows = reportScope === 'all' ? baseRows : baseRows
          .map(r => {
            const dr_details = r.dr_details.filter(d => d.show_in_portal)
            const csi_details = r.csi_details.filter(d => d.show_in_portal)
            const dr_qty = dr_details.reduce((s, d) => s + d.qty, 0)
            const csi_qty = csi_details.reduce((s, d) => s + d.qty, 0)
            return { ...r, dr_details, csi_details, dr_qty, csi_qty }
          })
          .filter(r => r.dr_qty > 0 || r.csi_qty > 0)
        // "Client WH Stock" is that client's own self-reported On Hand quantity
        // (client_inventory), not CDSC's shared warehouse pool — each client's report
        // should reflect what they actually have at their site.
        const reportRows = scopedRows.map(r => {
          const client_on_hand = onHandMap[r.item_name] ?? 0
          return { ...r, client_on_hand, balance: r.dr_qty + client_on_hand - r.csi_qty }
        })
        const totalBalance = reportRows.reduce((s, r) => s + r.balance, 0)
        const totalDr = reportRows.reduce((s, r) => s + r.dr_qty, 0)
        const totalOnHand = reportRows.reduce((s, r) => s + r.client_on_hand, 0)
        const totalCsi = reportRows.reduce((s, r) => s + r.csi_qty, 0)
        const totalEstValue = reportRows.reduce((s, r) => {
          const price = r.csi_details.length > 0
            ? r.csi_details[r.csi_details.length - 1].unit_price
            : r.dr_details.length > 0 ? r.dr_details[r.dr_details.length - 1].unit_price : null
          return s + (price != null ? r.dr_qty * price : 0)
        }, 0)
        const today = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })

        // Built from the report data using plain HTML/CSS (not a clone of the live DOM) —
        // the on-screen preview's styling comes from Tailwind utility classes, which don't
        // exist in a blank print window or an email client, so cloning it rendered unstyled.
        function buildReportHtml() {
          const cardsHtml = [
            { label: 'DR Delivered', value: totalDr, cls: 'blue' },
            { label: 'Client WH Stock', value: totalOnHand, cls: 'green' },
            { label: 'CSI Issued', value: totalCsi, cls: 'orange' },
            { label: 'Net Balance', value: totalBalance, cls: totalBalance >= 0 ? 'green' : 'red' },
          ].map(c => `<div class="card"><div class="card-label">${c.label}</div><div class="card-val ${c.cls}">${c.value}</div></div>`).join('')
          const rowsHtml = reportRows.length === 0
            ? `<tr><td colspan="9" style="text-align:center;padding:24px;color:#9ca3af;font-style:italic">No inventory data for this client.</td></tr>`
            : reportRows.map((r, i) => {
              const latestPrice = r.csi_details.length > 0
                ? r.csi_details[r.csi_details.length - 1].unit_price
                : r.dr_details.length > 0 ? r.dr_details[r.dr_details.length - 1].unit_price : null
              const estValue = latestPrice != null ? r.dr_qty * latestPrice : null
              const balColor = r.balance > 0 ? '#15803d' : r.balance < 0 ? '#dc2626' : '#9ca3af'
              return `<tr>
                <td>${i + 1}</td>
                <td style="font-weight:600;color:#1f2937">${r.item_name}</td>
                <td>${uomName(r.unit)}</td>
                <td class="r">${r.dr_qty}</td>
                <td class="r" style="color:#15803d;font-weight:600">${r.client_on_hand > 0 ? r.client_on_hand : '—'}</td>
                <td class="r">${r.csi_qty}</td>
                <td class="r" style="font-weight:700;color:${balColor}">${r.balance}</td>
                <td class="r">${latestPrice != null ? `₱${latestPrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}</td>
                <td class="r" style="font-weight:600">${estValue != null ? `₱${estValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}</td>
              </tr>`
            }).join('')
          return `<!DOCTYPE html><html><head><title>Inventory Report - ${reportClient}</title><style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; background: #fff; color: #111; padding: 32px; }
            .accent { background: #dc2626; height: 5px; border-radius: 3px; margin-bottom: 20px; }
            .letterhead { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid #e5e7eb; }
            .co-name { font-size: 22px; font-weight: 800; color: #dc2626; }
            .co-sub { font-size: 10px; color: #9ca3af; margin-top: 2px; }
            .rpt-title { text-align: right; font-size: 15px; font-weight: 700; }
            .rpt-date { font-size: 10px; color: #9ca3af; margin-top: 2px; }
            .client-block { margin-bottom: 18px; }
            .client-label { font-size: 9px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-bottom: 2px; }
            .client-name { font-size: 18px; font-weight: 800; color: #111827; }
            .scope-badge { display: inline-block; margin-left: 10px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; padding: 3px 8px; border-radius: 999px; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
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
            <div class="client-block">
              <div class="client-label">Client</div>
              <div><span class="client-name">${reportClient || '—'}</span>${reportScope === 'portal' ? '<span class="scope-badge">Visible in Client Portal Only</span>' : ''}</div>
            </div>
            <div class="cards">${cardsHtml}</div>
            <table>
              <thead>
                <tr>
                  <th style="width:24px">#</th>
                  <th>Item Description</th>
                  <th style="width:70px">Unit</th>
                  <th class="r" style="width:60px">DR Qty</th>
                  <th class="r" style="width:80px">Client WH Stock</th>
                  <th class="r" style="width:70px">CSI Issued</th>
                  <th class="r" style="width:60px">Balance</th>
                  <th class="r" style="width:90px">Est. Unit Price</th>
                  <th class="r" style="width:90px">Est. Value</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
              <tfoot>
                <tr>
                  <td colspan="6" class="r">TOTAL</td>
                  <td class="r" style="color:${totalBalance > 0 ? '#15803d' : totalBalance < 0 ? '#dc2626' : '#6b7280'}">${totalBalance}</td>
                  <td class="r">—</td>
                  <td class="r">₱${totalEstValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            </table>
            <div class="note">
              <span>Est. Unit Price is based on the latest CSI or DR record; Est. Value = DR Qty × Est. Unit Price. Values are for reference only.</span>
              <span>Generated ${today} &middot; CDSC Inventory System</span>
            </div>
          </body></html>`
        }

        async function openReportEmailDialog() {
          setEmailReportSubject(`Stock Update – ${reportClient}`)
          setEmailReportBody(
            `Hi,\n\nHere is your current stock summary with us as of ${today}:\n\n` +
            `DR Delivered: ${totalDr}\nClient WH Stock (On Hand): ${totalOnHand}\nCSI Issued: ${totalCsi}\nNet Balance: ${totalBalance}\n\n` +
            `Kindly review your balance below. Let us know if you'd like to update your stock records or place a new order.\n\nThank you.`
          )
          setEmailReportTo('')
          setEmailReportOpen(true)
          const { data } = await supabase.from('clients').select('email').eq('company_name', reportClient).maybeSingle()
          if (data?.email) setEmailReportTo(data.email)
        }

        async function handleSendReportEmail() {
          if (!emailReportTo.trim()) { toast.error('Recipient email is required'); return }
          setEmailReportSending(true)
          try {
            await sendEmail({
              to: emailReportTo.trim(),
              subject: emailReportSubject,
              body: emailReportBody,
              printHtml: buildReportHtml(),
              pdfFilename: `${reportClient} - Inventory Report.pdf`,
            })
            toast.success('Email sent')
            setEmailReportOpen(false)
          } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to send email')
          }
          setEmailReportSending(false)
        }

        return (
          <>
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
                variant="outline"
                className="ml-auto h-8 text-sm gap-1.5 shrink-0"
                onClick={() => openReportEmailDialog()}
              >
                <Mail className="h-4 w-4" /> Email Client
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white h-8 text-sm gap-1.5 shrink-0"
                onClick={() => {
                  const win = window.open('', '_blank', 'width=1100,height=800')
                  if (!win) return
                  win.document.write(buildReportHtml())
                  win.document.close()
                  win.focus()
                  setTimeout(() => { win.print() }, 400)
                }}
              >
                <Printer className="h-4 w-4" /> Print / Save PDF
              </Button>
            </div>

            {/* Report body */}
            <div className="bg-white p-8">
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
                  { label: 'DR Delivered',   value: totalDr,      cls: 'text-blue-700' },
                  { label: 'Client WH Stock', value: totalOnHand, cls: 'text-green-700' },
                  { label: 'CSI Issued',     value: totalCsi,     cls: 'text-orange-600' },
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
                        <th className="px-3 py-2.5 text-right font-semibold text-[10px] uppercase tracking-wide w-20">Client WH Stock</th>
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
                        const estValue = latestPrice != null ? r.dr_qty * latestPrice : null
                        return (
                          <tr key={r.item_name} className={i % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="px-3 py-2 text-gray-400 border-b border-gray-100">{i + 1}</td>
                            <td className="px-3 py-2 font-medium text-gray-800 border-b border-gray-100">{r.item_name}</td>
                            <td className="px-3 py-2 text-gray-500 border-b border-gray-100">{uomName(r.unit)}</td>
                            <td className="px-3 py-2 text-right text-gray-700 border-b border-gray-100">{r.dr_qty}</td>
                            <td className="px-3 py-2 text-right border-b border-gray-100">
                              {r.client_on_hand > 0 ? <span className="text-green-600 font-medium">{r.client_on_hand}</span> : <span className="text-gray-300">—</span>}
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
                <span>Est. Unit Price is based on the latest CSI or DR record; Est. Value = DR Qty × Est. Unit Price. Values are for reference only.</span>
                <span>Generated {today} · CDSC Inventory System</span>
              </div>
            </div>
          </div>

          {/* Email Client Dialog */}
          <Dialog open={emailReportOpen} onOpenChange={setEmailReportOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-600" />
                  Email Stock Report to {reportClient}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-1">
                <div className="space-y-1.5">
                  <Label>To (recipient email) <span className="text-destructive">*</span></Label>
                  <Input
                    type="email"
                    placeholder="client@example.com"
                    value={emailReportTo}
                    onChange={e => setEmailReportTo(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Subject</Label>
                  <Input
                    value={emailReportSubject}
                    onChange={e => setEmailReportSubject(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Message</Label>
                  <Textarea
                    rows={8}
                    value={emailReportBody}
                    onChange={e => setEmailReportBody(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">A PDF of this stock report will be attached automatically.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEmailReportOpen(false)}>Cancel</Button>
                <Button onClick={handleSendReportEmail} disabled={emailReportSending} className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
                  {emailReportSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send Email
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </>
        )
      })()}

      <Dialog open={warehouseUpdateOpen} onOpenChange={o => { if (!o) setWarehouseUpdateOpen(false) }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-blue-600" /> Update Warehouse Stock
            </DialogTitle>
          </DialogHeader>
          {warehouseUpdateRow && (
            <div className="space-y-4 py-2">
              <div className="rounded-md bg-muted/40 px-3 py-2 text-sm font-medium">{warehouseUpdateRow.item_name}</div>

              <div className="flex border rounded-md overflow-hidden">
                <button
                  type="button"
                  onClick={() => setWsMarkDelivered(false)}
                  className={`flex-1 h-8 text-xs font-medium transition-colors ${!wsMarkDelivered ? 'bg-blue-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                >Update Quantity</button>
                <button
                  type="button"
                  onClick={() => setWsMarkDelivered(true)}
                  className={`flex-1 h-8 text-xs font-medium border-l transition-colors flex items-center justify-center gap-1.5 ${wsMarkDelivered ? 'bg-blue-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                ><Truck className="h-3.5 w-3.5" />Already Delivered</button>
              </div>

              {wsMarkDelivered ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Quantity Delivered <span className="text-red-500">*</span></Label>
                    <Input type="number" min="0" value={wsDeliverQty} onChange={e => setWsDeliverQty(e.target.value)} placeholder="0" />
                    <p className="text-xs text-muted-foreground">Subtracted from this warehouse row&apos;s on-hand quantity.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Delivered To Client <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Select value={wsDeliverClientId} onValueChange={v => setWsDeliverClientId(v ?? '')}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select client…" /></SelectTrigger>
                      <SelectContent>
                        {clientOptions.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">If picked, this quantity is credited to that client&apos;s own On Hand ledger.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Warehouse Note</Label>
                    <Input value={warehouseUpdateNotes} onChange={e => setWarehouseUpdateNotes(e.target.value)} placeholder="Notes about this stock entry" />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label>Quantity <span className="text-red-500">*</span></Label>
                    <Input type="number" min="0" value={warehouseUpdateQty} onChange={e => setWarehouseUpdateQty(e.target.value)} placeholder="0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Warehouse Note</Label>
                    <Input value={warehouseUpdateNotes} onChange={e => setWarehouseUpdateNotes(e.target.value)} placeholder="Notes about this stock entry" />
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setWarehouseUpdateOpen(false)}>Cancel</Button>
            <Button
              onClick={saveWarehouseUpdate}
              disabled={warehouseUpdateSaving || (wsMarkDelivered ? !wsDeliverQty.trim() : !warehouseUpdateQty.trim())}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {warehouseUpdateSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : wsMarkDelivered ? 'Mark as Delivered' : 'Update Stock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={o => { if (!o) setEditRow(null) }}>
        <DialogContent className="sm:max-w-xl">
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

      {/* ── Assign Channel Dialog (By Client view) ─────────────────────────────── */}
      <Dialog open={!!assignChannelRow} onOpenChange={o => { if (!o) setAssignChannelRow(null) }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-blue-600" /> Assign Channel
            </DialogTitle>
          </DialogHeader>
          {assignChannelRow && (
            <p className="text-xs text-muted-foreground">
              Which sales channel is <strong>{assignChannelRow.client}</strong>&apos;s stock of <strong>{assignChannelRow.item_name}</strong> for?
            </p>
          )}
          <div className="py-2">
            <Select value={assignChannelValue || 'unassigned'} onValueChange={v => setAssignChannelValue(v === 'unassigned' ? '' : (v ?? ''))}>
              <SelectTrigger><SelectValue placeholder="Select channel…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {channelOptions.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignChannelRow(null)}>Cancel</Button>
            <Button onClick={saveAssignChannel} disabled={assigningChannel} className="bg-blue-600 hover:bg-blue-700 text-white">
              {assigningChannel ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Product Detail Dialog (By Item view) ──────────────────────────────── */}
      <Dialog open={!!detailItem} onOpenChange={o => { if (!o) setDetailItem(null) }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Product Details — {detailItem?.item_name}</DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
                  <div className="text-xs text-blue-500 font-semibold">Delivered</div>
                  <div className="text-2xl font-black text-blue-700">{detailItem.delivered}</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center border border-purple-100">
                  <div className="text-xs text-purple-500 font-semibold">Billed (CSI)</div>
                  <div className="text-2xl font-black text-purple-700">{detailItem.billed}</div>
                </div>
                <div className={`rounded-lg p-3 text-center border ${detailItem.balance > 0 ? 'bg-amber-50 border-amber-100' : detailItem.balance < 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                  <div className="text-xs font-semibold text-gray-500">On-Hand</div>
                  <div className={`text-2xl font-black ${detailItem.balance > 0 ? 'text-amber-600' : detailItem.balance < 0 ? 'text-red-600' : 'text-gray-500'}`}>{detailItem.balance}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center border border-green-100">
                  <div className="text-xs text-green-500 font-semibold">Est. Value</div>
                  <div className="text-lg font-black text-green-700">{peso(detailItem.balance * detailItem.price)}</div>
                </div>
              </div>

              {detailLoading ? (
                <div className="py-10 text-center">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* DR Records */}
                  <div>
                    <div className="font-semibold text-gray-700 text-sm mb-2 flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">DR</span>
                      Delivery Records ({detailDrRows.length})
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-xs">
                        <thead><tr className="bg-blue-600 text-white">
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">DR #</th>
                          <th className="px-3 py-2 text-left">Client</th>
                          <th className="px-3 py-2 text-left">Unit</th>
                          <th className="px-3 py-2 text-right">Qty</th>
                        </tr></thead>
                        <tbody>
                          {detailDrRows.length === 0
                            ? <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-400">No DR records.</td></tr>
                            : detailDrRows.map((r, i) => (
                              <tr key={i} className="border-b border-gray-100 hover:bg-blue-50/30">
                                <td className="px-3 py-2 text-gray-500">{r.dr_date || '—'}</td>
                                <td className="px-3 py-2 font-mono font-semibold text-blue-700">{r.dr_number || '—'}</td>
                                <td className="px-3 py-2 font-medium">{r.client_name || '—'}</td>
                                <td className="px-3 py-2 text-gray-500">{uomName(r.unit ?? '') || '—'}</td>
                                <td className="px-3 py-2 text-right font-semibold text-blue-700">{r.quantity}</td>
                              </tr>
                            ))}
                        </tbody>
                        {detailDrRows.length > 0 && (
                          <tfoot><tr className="bg-blue-50 font-bold">
                            <td colSpan={4} className="px-3 py-2 text-right text-xs">Total Delivered</td>
                            <td className="px-3 py-2 text-right text-blue-700">{detailDrRows.reduce((s, r) => s + r.quantity, 0)}</td>
                          </tr></tfoot>
                        )}
                      </table>
                    </div>
                  </div>

                  {/* CSI Records */}
                  <div>
                    <div className="font-semibold text-gray-700 text-sm mb-2 flex items-center gap-2">
                      <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold">CSI</span>
                      Sales Invoice Records ({detailCsiRows.length})
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-xs">
                        <thead><tr className="bg-purple-600 text-white">
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">SI #</th>
                          <th className="px-3 py-2 text-left">Client</th>
                          <th className="px-3 py-2 text-left">Unit</th>
                          <th className="px-3 py-2 text-right">Qty</th>
                          <th className="px-3 py-2 text-right">Unit Price</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                          <th className="px-3 py-2 text-left">Status</th>
                        </tr></thead>
                        <tbody>
                          {detailCsiRows.length === 0
                            ? <tr><td colSpan={8} className="px-3 py-4 text-center text-gray-400">No CSI records.</td></tr>
                            : detailCsiRows.map(r => (
                              <tr key={r.id} className="border-b border-gray-100 hover:bg-purple-50/30">
                                <td className="px-3 py-2 text-gray-500">{r.si_date || '—'}</td>
                                <td className="px-3 py-2 font-mono font-semibold text-purple-700">{r.si_number || '—'}</td>
                                <td className="px-3 py-2 font-medium">{r.client_name || '—'}</td>
                                <td className="px-3 py-2 text-gray-500">{uomName(r.unit ?? '') || '—'}</td>
                                <td className="px-3 py-2 text-right font-semibold text-purple-700">{r.quantity ?? '—'}</td>
                                <td className="px-3 py-2 text-right font-mono">{peso(r.unit_price)}</td>
                                <td className="px-3 py-2 text-right font-mono text-blue-700">{peso(r.amount)}</td>
                                <td className="px-3 py-2">
                                  <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${r.collection_status === 'collected' ? 'bg-green-100 text-green-700' : r.collection_status === 'uncollectible' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                    {(r.collection_status || 'for_collection').replace(/_/g, ' ')}
                                  </span>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                        {detailCsiRows.length > 0 && (
                          <tfoot><tr className="bg-purple-50 font-bold">
                            <td colSpan={4} className="px-3 py-2 text-right text-xs">Totals</td>
                            <td className="px-3 py-2 text-right text-purple-700">{detailCsiRows.reduce((s, r) => s + (Number(r.quantity) || 0), 0)}</td>
                            <td />
                            <td className="px-3 py-2 text-right font-mono text-blue-700">{peso(detailCsiRows.reduce((s, r) => s + (Number(r.amount) || 0), 0))}</td>
                            <td />
                          </tr></tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Client Row Detail Dialog (By Client view) ──────────────────────────── */}
      <Dialog open={!!clientDetailRow} onOpenChange={o => { if (!o) setClientDetailRow(null) }}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{clientDetailRow?.client} — {clientDetailRow?.item_name}</DialogTitle>
          </DialogHeader>
          {clientDetailRow && (
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">DR Deliveries</p>
                {clientDetailRow.dr_details.length === 0 ? (
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
                      {clientDetailRow.dr_details.map((d, j) => {
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
                {clientDetailRow.ws_details.length === 0 ? (
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
                      {clientDetailRow.ws_details.map((d) => (
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
                {clientDetailRow.csi_details.length === 0 ? (
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
                      {clientDetailRow.csi_details.map((d, j) => {
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
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={o => { if (!o) setAddOpen(false) }}>
        <DialogContent className="w-[95vw] max-w-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {addPoId ? <Truck className="h-4 w-4 text-red-600" /> : <Plus className="h-4 w-4 text-red-600" />}
              {addPoId ? 'Receive Stock' : 'Add Warehouse Stock'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">

            {/* PO picker — optional shortcut to pick items straight off a purchase order */}
            <div className="space-y-1.5">
              <Label>Purchase Order <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Select value={addPoId || '_none'} onValueChange={v => selectAddPo(!v || v === '_none' ? '' : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{() => addPoId ? (addPoOptions.find(p => p.id === addPoId)?.po_number ?? '—') : 'No PO — add stock manually'}</SelectValue>
                </SelectTrigger>
                <SelectContent className="min-w-[280px]">
                  <SelectItem value="_none">No PO — add stock manually</SelectItem>
                  {addPoOptions.map(po => <SelectItem key={po.id} value={po.id}>{po.po_number}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {addPoId && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Items on this PO</Label>
                  {addPoItems.length > 0 && (
                    <Button
                      type="button" size="sm" variant="outline"
                      className="h-7 text-xs gap-1.5"
                      disabled={addSaving}
                      onClick={receiveAllPoItems}
                    >
                      {addSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
                      Receive All ({addPoItems.length})
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Click items to add them below, or receive every item on this PO at once.</p>
                <div className="border rounded-lg max-h-40 overflow-y-auto">
                  {addPoItemsLoading ? (
                    <div className="flex items-center justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                  ) : addPoItems.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-muted-foreground">No items found on this PO.</div>
                  ) : addPoItems.map((it, i) => (
                    <button
                      key={i} type="button"
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-0 flex items-center justify-between gap-2 ${addItems.some(r => r.item_name === it.item_name) ? 'bg-red-50' : ''}`}
                      onClick={() => handleAddPoItemSelect(it)}
                    >
                      <span className="font-medium truncate">{it.item_name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{it.quantity} {it.unit_of_measure ?? ''}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Item rows — supports adding multiple items in one submission */}
            <div className="space-y-1.5">
              <Label>Items <span className="text-red-500">*</span></Label>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Item Name</TableHead>
                      <TableHead className="w-24">Qty</TableHead>
                      <TableHead className="w-24">Unit</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {addItems.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="py-1.5">
                          <button
                            type="button"
                            onClick={() => openItemPicker(idx)}
                            className="w-full h-8 pl-3 pr-2.5 rounded-md border border-input bg-background text-sm flex items-center justify-between gap-2 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span className={`truncate ${row.item_name ? '' : 'text-muted-foreground'}`}>{row.item_name || 'Select item…'}</span>
                            <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          </button>
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input type="number" min="0" className="h-8 text-sm" value={row.quantity} onChange={e => updateAddItem(idx, 'quantity', e.target.value)} placeholder="0" />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input className="h-8 text-sm bg-muted/30" value={row.unit} readOnly />
                        </TableCell>
                        <TableCell className="py-1.5">
                          {addItems.length > 1 && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeAddItemRow(idx)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addAddItemRow}><Plus className="h-3.5 w-3.5 mr-1.5" />Add Item</Button>
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
              disabled={addSaving || !addItems.some(it => it.item_name.trim() && it.quantity.trim())}
              className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
            >
              {addSaving
                ? <><Loader2 className="h-4 w-4 animate-spin" />{addPoId ? 'Receiving…' : 'Saving…'}</>
                : addPoId ? <><Truck className="h-4 w-4" />Receive</> : <><Plus className="h-4 w-4" />Add Stock</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Item Picker Dialog (Add Stock — box icon) ──────────────────────────── */}
      <Dialog open={itemPickerRowIdx !== null} onOpenChange={o => { if (!o) { setItemPickerRowIdx(null); setItemPickerSearch('') } }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" /> Select Item
            </DialogTitle>
          </DialogHeader>
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              autoFocus
              value={itemPickerSearch}
              onChange={e => setItemPickerSearch(e.target.value)}
              placeholder="Search by name, code, or brand…"
              className="w-full h-10 pl-9 pr-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex-1 overflow-y-auto -mx-2 px-2">
            {(() => {
              const q = itemPickerSearch.trim().toLowerCase()
              const matches = q
                ? itemOptions.filter(o => o.item_name.toLowerCase().includes(q) || (o.item_code ?? '').toLowerCase().includes(q) || (o.brand ?? '').toLowerCase().includes(q))
                : itemOptions
              if (matches.length === 0) {
                return <div className="py-10 text-center text-sm text-muted-foreground">No items found</div>
              }
              return (
                <div className="divide-y">
                  {matches.map(o => (
                    <button
                      key={o.item_name}
                      type="button"
                      onClick={() => { if (itemPickerRowIdx !== null) selectAddItemForRow(itemPickerRowIdx, o) }}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{o.item_name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                          {o.item_code && <span className="font-mono">{o.item_code}</span>}
                          {o.brand && <span>{o.brand}</span>}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{o.unit_of_measure}</span>
                    </button>
                  ))}
                </div>
              )
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={o => { if (!o) setConfirmOpen(false) }}>
        <DialogContent className="sm:max-w-lg">
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
