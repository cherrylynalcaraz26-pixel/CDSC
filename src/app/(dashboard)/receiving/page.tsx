'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, SortableTableHead } from '@/components/ui/table'
import { useTableSort } from '@/lib/use-table-sort'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  Plus, MoreHorizontal, CheckCircle2, Package, Loader2, Trash2, X,
  ShoppingBag, ArrowLeftRight, Pencil, Printer, Search, FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { useSearchContext } from '@/context/search-context'
import { isImageAttachment, isPdfAttachment, driveImageSrc, driveEmbedUrl } from '@/lib/upload-image'

interface PO { id: string; po_number: string; status: string; supplier?: { company_name: string } | null; delivery_date: string | null }
interface RR { id: string; rr_number: string; po_number: string; supplier: string | null; delivery_date: string; received_by: string; status: string; dr_number?: string | null }
interface POItemLine { id: string; item_name: string; quantity: number; unit_of_measure: string; quantity_received: number }
interface Supplier { id: string; company_name: string }
interface Client { id: string; company_name: string }
interface ItemOption { item_name: string; unit_of_measure: string }

interface ReturnItem { item_name: string; unit: string; quantity: string; reason: string }
interface ItemReturn { id: string; return_number: string; return_type: string; return_date: string; supplier_name: string | null; client_name: string | null; notes: string | null; status: string }

interface SalesDeliveryItem { item_name: string; unit: string; quantity: string }
interface SalesDelivery { id: string; delivery_number: string; quote_number: string | null; client_name: string | null; delivery_date: string; delivered_by: string | null; status: string; notes: string | null; created_at: string; dr_number?: string | null; so_number?: string | null; hasCsi?: boolean }

const emptyReturnItem = (): ReturnItem => ({ item_name: '', unit: '', quantity: '', reason: '' })
const emptySalesItem = (): SalesDeliveryItem => ({ item_name: '', unit: '', quantity: '' })

const SALES_STATUS: Record<string, { label: string; cls: string }> = {
  pending:    { label: 'Pending',    cls: 'bg-yellow-100 text-yellow-700' },
  in_transit: { label: 'In Transit', cls: 'bg-blue-100 text-blue-700' },
  delivered:  { label: 'Delivered',  cls: 'bg-green-100 text-green-700' },
  cancelled:  { label: 'Cancelled',  cls: 'bg-red-100 text-red-700' },
}

export default function ReceivingPage() {
  const supabase = createClient()
  const { query } = useSearchContext()

  // Receiving Reports
  const [rrOpen, setRrOpen] = useState(false)
  const [editingRRId, setEditingRRId] = useState<string | null>(null)
  const [rrNumber, setRrNumber] = useState('')
  const [selectedPO, setSelectedPO] = useState('')
  const [pos, setPOs] = useState<PO[]>([])
  const [rrs, setRRs] = useState<RR[]>([])
  const [loading, setLoading] = useState(true)
  const [drNumber, setDrNumber] = useState('')
  const [rrSupplier, setRrSupplier] = useState<string | null>(null)
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0])
  const [receivedBy, setReceivedBy] = useState('')
  const [rrSaving, setRrSaving] = useState(false)
  const [rrDetailsId, setRrDetailsId] = useState<string | null>(null)
  const [rrAttachments, setRrAttachments] = useState<{ id: string; file_url: string; file_name: string }[]>([])
  const [previewAttachment, setPreviewAttachment] = useState<{ url: string; name: string } | null>(null)
  const [deleteRRId, setDeleteRRId] = useState<string | null>(null)
  const [rrDateFrom, setRrDateFrom] = useState('')
  const [rrDateTo, setRrDateTo] = useState('')
  const [poItemsByNumber, setPoItemsByNumber] = useState<Record<string, POItemLine[]>>({})
  // Qty being received on THIS delivery, keyed by po_items.id — defaults to whatever's
  // still outstanding (quantity - quantity_received) so a full delivery needs no editing,
  // but any item can be dialed down when the shipment doesn't cover everything ordered.
  const [rrReceiveQty, setRrReceiveQty] = useState<Record<string, string>>({})

  // Returns
  const [returnFormOpen, setReturnFormOpen] = useState(false)
  const [returnType, setReturnType] = useState<'warehouse' | 'supplier'>('warehouse')
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0])
  const [returnSupplierId, setReturnSupplierId] = useState('')
  const [returnClientId, setReturnClientId] = useState('')
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([emptyReturnItem()])
  const [returnNotes, setReturnNotes] = useState('')
  const [returnSaving, setReturnSaving] = useState(false)
  const [returns, setReturns] = useState<ItemReturn[]>([])
  const [returnsLoading, setReturnsLoading] = useState(true)
  const [returnItemSearches, setReturnItemSearches] = useState<Record<number, string>>({})
  const [returnItemDropdowns, setReturnItemDropdowns] = useState<Record<number, boolean>>({})

  // Shared refs
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [items, setItems] = useState<ItemOption[]>([])

  // Sales Deliveries
  const [salesdOpen, setSalesdOpen] = useState(false)
  const [salesdClientId, setSalesdClientId] = useState('')
  const [salesdQuote, setSalesdQuote] = useState('')
  const [salesdDate, setSalesdDate] = useState(new Date().toISOString().split('T')[0])
  const [salesdBy, setSalesdBy] = useState('')
  const [salesdNotes, setSalesdNotes] = useState('')
  const [salesdStatus, setSalesdStatus] = useState('pending')
  const [salesdItems, setSalesdItems] = useState<SalesDeliveryItem[]>([emptySalesItem()])
  const [salesdSaving, setSalesdSaving] = useState(false)
  const [salesDeliveries, setSalesDeliveries] = useState<SalesDelivery[]>([])
  const [salesdLoading, setSalesdLoading] = useState(true)
  const [salesdDateFrom, setSalesdDateFrom] = useState('')
  const [salesdDateTo, setSalesdDateTo] = useState('')
  const [salesDetailOpen, setSalesDetailOpen] = useState(false)
  const [salesDetailRow, setSalesDetailRow] = useState<SalesDelivery | null>(null)
  const [salesDetailItems, setSalesDetailItems] = useState<{ item_name: string; unit: string | null; quantity: number }[]>([])
  const [salesDetailLoading, setSalesDetailLoading] = useState(false)
  const [poDetail, setPoDetail] = useState<PO | null>(null)

  const selectedPOData = pos.find(p => p.po_number === selectedPO)
  const selectedSupplier = suppliers.find(s => s.id === returnSupplierId)
  const selectedReturnClient = clients.find(c => c.id === returnClientId)
  const salesdClient = clients.find(c => c.id === salesdClientId)

  async function loadRR() {
    setLoading(true)
    const [{ data: poData }, { data: rrData }, { data: allPoData }] = await Promise.all([
      supabase.from('purchase_orders').select('id, po_number, delivery_date, status, supplier:suppliers(company_name)')
        .not('po_number', 'is', null).in('status', ['open', 'partially_delivered', 'completed']).order('created_at', { ascending: false }),
      supabase.from('receiving_reports').select('*').order('created_at', { ascending: false }),
      // Unfiltered by status — used only to backfill an RR's Supplier column when it was
      // saved without one (e.g. a PO number typed in free-form instead of picked from the
      // dropdown), regardless of what state that PO is in now.
      supabase.from('purchase_orders').select('po_number, supplier:suppliers(company_name)').not('po_number', 'is', null),
    ])
    // A PO marked "completed" without ever being received would otherwise vanish from this
    // list, since completion and receiving are separate manual steps — so keep completed POs
    // visible here until a receiving report actually exists for them. Conversely, a PO left
    // marked "open" (status never advanced) that already has a receiving report has, in fact,
    // been received — only "partially_delivered" POs stay pending regardless of an existing
    // RR, since that status explicitly means more deliveries are still expected.
    const receivedPONumbers = new Set(((rrData ?? []) as RR[]).map(rr => rr.po_number))
    const pending = ((poData ?? []) as unknown as PO[]).filter(po => po.status === 'partially_delivered' || !receivedPONumbers.has(po.po_number))
    setPOs(pending)
    const supplierByPoNumber: Record<string, string> = {}
    for (const po of (allPoData ?? []) as unknown as { po_number: string; supplier: { company_name: string } | null }[]) {
      const name = po.supplier?.company_name
      if (name) supplierByPoNumber[po.po_number] = name
    }
    setRRs(((rrData ?? []) as RR[]).map(rr => ({ ...rr, supplier: rr.supplier || supplierByPoNumber[rr.po_number] || null })))
    setLoading(false)
  }

  // Maps every PO's line items by po_number (not just the currently-pending ones) so
  // Receiving Report row details/print can show what was on the referenced PO regardless
  // of that PO's current status.
  async function loadPoItemsMap() {
    const { data: allPOs } = await supabase.from('purchase_orders').select('id, po_number')
    const poIdToNumber: Record<string, string> = {}
    for (const po of allPOs ?? []) poIdToNumber[po.id] = po.po_number
    const poIds = Object.keys(poIdToNumber)
    if (poIds.length === 0) { setPoItemsByNumber({}); return }
    const { data: itemsData } = await supabase
      .from('po_items')
      .select('id, po_id, item_name, quantity, unit_of_measure, quantity_received')
      .in('po_id', poIds)
    const map: Record<string, POItemLine[]> = {}
    for (const it of itemsData ?? []) {
      const poNum = poIdToNumber[it.po_id]
      if (!poNum) continue
      if (!map[poNum]) map[poNum] = []
      map[poNum].push({ id: it.id, item_name: it.item_name, quantity: Number(it.quantity), unit_of_measure: it.unit_of_measure, quantity_received: Number(it.quantity_received) || 0 })
    }
    setPoItemsByNumber(map)
  }

  async function loadReturns() {
    setReturnsLoading(true)
    const { data } = await supabase.from('item_returns').select('*').order('created_at', { ascending: false })
    setReturns((data ?? []) as ItemReturn[])
    setReturnsLoading(false)
  }

  async function loadShared() {
    const [{ data: supData }, { data: clientData }, { data: itemData }] = await Promise.all([
      supabase.from('suppliers').select('id, company_name').eq('is_active', true).order('company_name'),
      supabase.from('clients').select('id, company_name').eq('status', 'active').order('company_name'),
      supabase.from('items').select('item_name, unit_of_measure').eq('status', 'active').order('item_name'),
    ])
    setSuppliers(supData ?? [])
    setClients(clientData ?? [])
    setItems((itemData ?? []) as ItemOption[])
  }

  async function loadSalesDeliveries() {
    setSalesdLoading(true)
    const [{ data }, { data: csiData }] = await Promise.all([
      supabase
        .from('dr_logs')
        .select('id, dr_number, po_number, supplier_name, dr_date, status')
        .order('dr_date', { ascending: false }),
      fetchAllRows((from, to) => supabase.from('csi_records').select('dr_number').not('dr_number', 'is', null).order('id').range(from, to)).then(data => ({ data })),
    ])
    const invoicedDrNumbers = new Set((csiData ?? []).map((r: { dr_number: string }) => r.dr_number))
    const mapped = (data ?? []).map((log: any) => ({
      id: log.id,
      delivery_number: log.dr_number,
      dr_number: log.dr_number,
      so_number: log.po_number,
      quote_number: log.po_number,
      client_name: log.supplier_name,
      delivery_date: log.dr_date,
      delivered_by: null,
      status: log.status,
      hasCsi: invoicedDrNumbers.has(log.dr_number),
      notes: null,
      created_at: '',
    }))
    setSalesDeliveries(mapped as SalesDelivery[])
    setSalesdLoading(false)
  }

  async function openSalesDetail(d: SalesDelivery) {
    setSalesDetailRow(d)
    setSalesDetailOpen(true)
    setSalesDetailLoading(true)
    const { data } = await supabase
      .from('dr_log_items')
      .select('item_name, unit, quantity')
      .eq('dr_number', d.dr_number ?? d.delivery_number)
      .order('id')
    setSalesDetailItems((data ?? []) as { item_name: string; unit: string | null; quantity: number }[])
    setSalesDetailLoading(false)
  }

  useEffect(() => {
    loadRR(); loadPoItemsMap(); loadReturns(); loadShared(); loadSalesDeliveries()
  }, [])

  // Attachments uploaded on the originating Purchase Order show up here too, since a
  // Receiving Report is just that PO's delivery being recorded.
  useEffect(() => {
    const poNumber = rrs.find(r => r.id === rrDetailsId)?.po_number
    if (!poNumber) { setRrAttachments([]); return }
    supabase.from('po_attachments').select('id, file_url, file_name').eq('po_number', poNumber).order('uploaded_at')
      .then(({ data }) => setRrAttachments(data ?? []))
  }, [rrDetailsId, rrs])

  // Re-defaults the per-item "receiving now" quantities to whatever's still outstanding
  // whenever the selected PO (or its item data) changes — skipped while editing an
  // existing RR, since editing doesn't resubmit inventory (see handleSaveRR).
  useEffect(() => {
    if (editingRRId || !selectedPO) { setRrReceiveQty({}); return }
    const poItems = poItemsByNumber[selectedPO] ?? []
    setRrReceiveQty(Object.fromEntries(
      poItems.map(it => [it.id, String(Math.max(0, it.quantity - it.quantity_received))])
    ))
  }, [selectedPO, poItemsByNumber, editingRRId])

  function resetRRForm() {
    setEditingRRId(null)
    setRrNumber('')
    setSelectedPO('')
    setDrNumber('')
    setDeliveryDate(new Date().toISOString().split('T')[0])
    setReceivedBy('')
    setRrSupplier(null)
    setRrReceiveQty({})
  }

  function openEditRR(rr: RR) {
    setEditingRRId(rr.id)
    setRrNumber(rr.rr_number)
    setSelectedPO(rr.po_number)
    setDeliveryDate(rr.delivery_date)
    setDrNumber(rr.dr_number ?? '')
    setReceivedBy(rr.received_by ?? '')
    // The RR's PO may no longer be in `pos` (it's excluded once completed and received),
    // so read the supplier straight off the RR itself rather than re-deriving it from the
    // PO dropdown — otherwise it'd silently blank out while editing an already-received RR.
    setRrSupplier(rr.supplier ?? null)
    setRrOpen(true)
  }

  function openRRDetails(id: string) {
    setRrDetailsId(id)
  }
  function resetReturnForm() { setReturnType('warehouse'); setReturnDate(new Date().toISOString().split('T')[0]); setReturnSupplierId(''); setReturnClientId(''); setReturnItems([emptyReturnItem()]); setReturnNotes(''); setReturnItemSearches({}); setReturnItemDropdowns({}) }
  function resetSalesdForm() { setSalesdClientId(''); setSalesdQuote(''); setSalesdDate(new Date().toISOString().split('T')[0]); setSalesdBy(''); setSalesdNotes(''); setSalesdStatus('pending'); setSalesdItems([emptySalesItem()]) }

  async function handleSaveRR() {
    if (!rrNumber.trim()) { toast.error('RR Number is required'); return }
    if (!selectedPO) { toast.error('Select a PO reference'); return }

    if (editingRRId) {
      // Editing only updates the record's own fields — it does not re-run the inventory
      // adjustment below, since that already happened once when the RR was first saved.
      setRrSaving(true)
      const payload = {
        rr_number: rrNumber.trim(),
        po_number: selectedPO,
        supplier: rrSupplier ?? (selectedPOData?.supplier as any)?.company_name ?? null,
        delivery_date: deliveryDate,
        received_by: receivedBy || null,
        dr_number: drNumber || null,
      }
      const { error } = await supabase.from('receiving_reports').update(payload).eq('id', editingRRId)
      if (error) { toast.error(error.message); setRrSaving(false); return }
      toast.success('Receiving report updated.')
      setRrOpen(false); resetRRForm(); loadRR()
      setRrSaving(false)
      return
    }

    // Not every item on a PO necessarily arrives in one shipment — `rrReceiveQty` holds
    // what's actually being received right now per item (defaults to the full outstanding
    // quantity, but can be dialed down), so a partial delivery only credits warehouse
    // stock for what showed up and leaves the rest outstanding for a later RR.
    const { data: rrPo } = await supabase.from('purchase_orders').select('id').eq('po_number', selectedPO).maybeSingle()
    if (!rrPo?.id) { toast.error('Could not find this PO'); return }
    const { data: poItems } = await supabase
      .from('po_items')
      .select('id, item_name, quantity, unit_of_measure, quantity_received')
      .eq('po_id', rrPo.id)
    const items = (poItems ?? []) as { id: string; item_name: string; quantity: number; unit_of_measure: string; quantity_received: number | null }[]

    const receivingNow = items
      .map(it => ({ it, qty: Math.max(0, Math.min(Number(rrReceiveQty[it.id]) || 0, it.quantity - (Number(it.quantity_received) || 0))) }))
      .filter(r => r.qty > 0)
    if (receivingNow.length === 0) { toast.error('Enter at least one item quantity received'); return }

    setRrSaving(true)

    const payload = {
      rr_number: rrNumber.trim(),
      po_number: selectedPO,
      supplier: rrSupplier ?? (selectedPOData?.supplier as any)?.company_name ?? null,
      delivery_date: deliveryDate,
      received_by: receivedBy || null,
      dr_number: drNumber || null,
      status: 'completed',
    }
    const { error } = await supabase.from('receiving_reports').insert(payload)
    if (error) { toast.error(error.message); setRrSaving(false); return }

    // Credit warehouse stock (unassigned to any client — general stock coming in from the
    // supplier) for exactly what's being received now, and accumulate it onto the PO
    // item's own running total so a later partial shipment sees the correct remainder.
    for (const { it, qty } of receivingNow) {
      const { data: wsRow } = await supabase
        .from('warehouse_stock')
        .select('id, quantity')
        .eq('item_name', it.item_name)
        .is('client_name', null)
        .maybeSingle()
      if (wsRow) {
        await supabase.from('warehouse_stock').update({
          quantity: Number(wsRow.quantity) + qty,
          updated_at: new Date().toISOString(),
        }).eq('id', wsRow.id)
      } else {
        await supabase.from('warehouse_stock').insert({
          item_name: it.item_name,
          unit: it.unit_of_measure ?? '',
          quantity: qty,
          client_name: null,
        })
      }
      await supabase.from('warehouse_stock_ledger').insert({
        item_name: it.item_name,
        unit: it.unit_of_measure ?? '',
        change_qty: qty,
        source_type: 'po_receiving',
        reference_no: selectedPO,
      })
      await supabase.from('po_items').update({
        quantity_received: (Number(it.quantity_received) || 0) + qty,
      }).eq('id', it.id)
    }

    // The PO is only "completed" once every line item's cumulative received quantity
    // meets what was ordered — otherwise it stays (or becomes) partially delivered so
    // Receiving's Pending Deliveries list keeps offering it up for the remaining balance.
    const receivedById = Object.fromEntries(receivingNow.map(r => [r.it.id, r.qty]))
    const fullyReceived = items.every(it => (Number(it.quantity_received) || 0) + (receivedById[it.id] ?? 0) >= it.quantity)
    await supabase.from('purchase_orders').update({
      status: fullyReceived ? 'completed' : 'partially_delivered',
    }).eq('id', rrPo.id)

    toast.success(fullyReceived ? 'Receiving report saved — inventory updated.' : 'Partial delivery recorded — inventory updated, PO stays open for the remaining balance.')
    setRrOpen(false); resetRRForm(); loadRR(); loadPoItemsMap()
    setRrSaving(false)
  }

  async function confirmDeleteRR() {
    if (!deleteRRId) return
    const { error } = await supabase.from('receiving_reports').delete().eq('id', deleteRRId)
    if (error) { toast.error(error.message); setDeleteRRId(null); return }
    setDeleteRRId(null)
    toast.success('Receiving report deleted.')
    loadRR()
  }

  function printRR(rr: RR) {
    const items = poItemsByNumber[rr.po_number] ?? []
    const html = `<!DOCTYPE html><html><head><title>RR ${rr.rr_number}</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
    <style>body{font-family:Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;}</style>
    </head><body class="p-6 text-[11px]">
    <div class="border rounded-lg bg-white p-4 space-y-3 font-sans text-[11px]">
      <div class="flex justify-between items-start border-b pb-3">
        <div class="text-[16px] font-extrabold text-red-700 uppercase tracking-widest">Receiving Report</div>
        <div class="text-right">
          <div class="text-[9px] font-semibold uppercase text-gray-400">RR Number</div>
          <div class="font-mono font-bold text-gray-800">${rr.rr_number}</div>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div>
          <div class="text-[9px] font-semibold uppercase text-gray-400 mb-0.5">PO Reference</div>
          <div class="font-mono text-gray-800">${rr.po_number}</div>
        </div>
        <div>
          <div class="text-[9px] font-semibold uppercase text-gray-400 mb-0.5">Supplier</div>
          <div class="font-semibold text-gray-800">${rr.supplier ?? '—'}</div>
        </div>
        <div>
          <div class="text-[9px] font-semibold uppercase text-gray-400 mb-0.5">Delivery Date</div>
          <div class="text-gray-800">${rr.delivery_date}</div>
        </div>
        <div>
          <div class="text-[9px] font-semibold uppercase text-gray-400 mb-0.5">DR / SI Number</div>
          <div class="font-mono text-gray-800">${rr.dr_number ?? '—'}</div>
        </div>
        <div>
          <div class="text-[9px] font-semibold uppercase text-gray-400 mb-0.5">Received By</div>
          <div class="text-gray-800">${rr.received_by ?? '—'}</div>
        </div>
        <div>
          <div class="text-[9px] font-semibold uppercase text-gray-400 mb-0.5">Status</div>
          <div class="text-gray-800 capitalize">${rr.status}</div>
        </div>
      </div>
      <table class="w-full border-collapse">
        <thead>
          <tr class="bg-red-700 text-white">
            <th class="text-left px-1.5 py-1">#</th>
            <th class="text-left px-1.5 py-1">Item Description</th>
            <th class="text-left px-1.5 py-1">Unit</th>
            <th class="text-right px-1.5 py-1">Qty</th>
          </tr>
        </thead>
        <tbody>
          ${items.length === 0 ? '<tr><td colspan="4" class="px-1.5 py-3 text-center text-gray-400 italic">No PO items found</td></tr>' :
            items.map((it, i) => `<tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
              <td class="px-1.5 py-1 text-gray-400">${i + 1}</td>
              <td class="px-1.5 py-1">${it.item_name}</td>
              <td class="px-1.5 py-1 text-gray-500">${it.unit_of_measure ?? '—'}</td>
              <td class="px-1.5 py-1 text-right font-medium">${it.quantity}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    </body></html>`
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(html)
    win.document.close()
    setTimeout(() => { win.focus(); win.print(); win.close() }, 800)
  }

  async function handleSaveReturn() {
    const validItems = returnItems.filter(i => i.item_name && parseFloat(i.quantity) > 0)
    if (validItems.length === 0) { toast.error('Add at least one item with a quantity'); return }
    setReturnSaving(true)
    const { data, error } = await supabase.from('item_returns').insert({
      return_type: returnType,
      return_date: returnDate,
      supplier_id: returnType === 'supplier' && returnSupplierId ? returnSupplierId : null,
      supplier_name: returnType === 'supplier' ? (selectedSupplier?.company_name ?? null) : null,
      client_id: returnType === 'warehouse' && returnClientId ? returnClientId : null,
      client_name: returnType === 'warehouse' ? (selectedReturnClient?.company_name ?? null) : null,
      notes: returnNotes || null,
      status: 'completed',
    }).select('return_number').single()
    if (error) { toast.error(error.message); setReturnSaving(false); return }
    const itemRows = validItems.map(i => ({ return_number: data.return_number, item_name: i.item_name, unit: i.unit || null, quantity: parseFloat(i.quantity), reason: i.reason || null }))
    const { error: ie } = await supabase.from('item_return_items').insert(itemRows)
    if (ie) { toast.error(ie.message); setReturnSaving(false); return }

    // Returning stock to CDSC's own warehouse puts it back into the general pool — and if
    // a client is named, that quantity leaves their own On Hand ledger the same way an
    // "Issue Item" in the portal would.
    if (returnType === 'warehouse') {
      for (const it of validItems) {
        const qty = parseFloat(it.quantity) || 0
        if (qty <= 0) continue
        const itemName = it.item_name.trim()
        const { data: wsRow } = await supabase.from('warehouse_stock').select('id, quantity').eq('item_name', itemName).is('client_name', null).maybeSingle()
        if (wsRow) {
          await supabase.from('warehouse_stock').update({ quantity: Number(wsRow.quantity) + qty, updated_at: new Date().toISOString() }).eq('id', wsRow.id)
        } else {
          await supabase.from('warehouse_stock').insert({ client_name: null, item_name: itemName, unit: it.unit || null, quantity: qty })
        }
        await supabase.from('warehouse_stock_ledger').insert({
          item_name: itemName,
          unit: it.unit || null,
          change_qty: qty,
          source_type: 'return_to_warehouse',
          reference_no: data.return_number,
        })
        if (returnClientId) {
          const { data: ciRow } = await supabase.from('client_inventory').select('id, quantity_on_hand').eq('client_id', returnClientId).eq('item_name', itemName).maybeSingle()
          if (ciRow) {
            await supabase.from('client_inventory').update({ quantity_on_hand: Math.max(0, Number(ciRow.quantity_on_hand) - qty), updated_at: new Date().toISOString() }).eq('id', ciRow.id)
          }
          await supabase.from('client_inventory_transactions').insert({
            client_id: returnClientId, item_name: itemName, unit: it.unit || null,
            transaction_type: 'issued', quantity: qty,
            reference_no: data.return_number, notes: `Returned to CDSC Warehouse (${data.return_number})`,
          })
        }
      }
    }

    toast.success(`Return ${data.return_number} saved${returnType === 'warehouse' ? ' — warehouse stock updated' : ''}.`)
    setReturnFormOpen(false); resetReturnForm(); loadReturns()
    setReturnSaving(false)
  }

  async function handleSaveSalesDelivery() {
    const validItems = salesdItems.filter(i => i.item_name && parseFloat(i.quantity) > 0)
    if (validItems.length === 0) { toast.error('Add at least one item with a quantity'); return }
    setSalesdSaving(true)
    const { data, error } = await supabase.from('sales_deliveries').insert({
      quote_number: salesdQuote || null,
      client_id: salesdClientId || null,
      client_name: salesdClient?.company_name ?? null,
      delivery_date: salesdDate,
      delivered_by: salesdBy || null,
      notes: salesdNotes || null,
      status: salesdStatus,
    }).select('delivery_number').single()
    if (error) { toast.error(error.message); setSalesdSaving(false); return }
    const rows = validItems.map(i => ({
      delivery_number: data.delivery_number,
      item_name: i.item_name,
      unit: i.unit || null,
      quantity: parseFloat(i.quantity),
    }))
    const { error: ie } = await supabase.from('sales_delivery_items').insert(rows)
    if (ie) { toast.error(ie.message); setSalesdSaving(false); return }
    toast.success(`Sales Delivery ${data.delivery_number} saved.`)
    setSalesdOpen(false); resetSalesdForm(); loadSalesDeliveries()
    setSalesdSaving(false)
  }

  function updateReturnItem(idx: number, field: keyof ReturnItem, value: string) {
    setReturnItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      if (field === 'item_name') {
        const found = items.find(it => it.item_name === value)
        return { ...item, item_name: value, unit: found?.unit_of_measure ?? item.unit }
      }
      return { ...item, [field]: value }
    }))
  }

  function updateSalesdItem(idx: number, field: keyof SalesDeliveryItem, value: string) {
    setSalesdItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      if (field === 'item_name') {
        const found = items.find(it => it.item_name === value)
        return { ...item, item_name: value, unit: found?.unit_of_measure ?? item.unit }
      }
      return { ...item, [field]: value }
    }))
  }

  const filterQ = (str: string) => !query.trim() || str.toLowerCase().includes(query.toLowerCase())
  const matchSalesdDate = (d: SalesDelivery) =>
    (!salesdDateFrom || d.delivery_date >= salesdDateFrom) && (!salesdDateTo || d.delivery_date <= salesdDateTo)
  const filteredSalesDeliveries = salesDeliveries.filter(d =>
    filterQ(`${d.delivery_number} ${(d as any).dr_number ?? ''} ${(d as any).so_number ?? ''} ${d.client_name ?? ''} ${d.status}`) && matchSalesdDate(d)
  )
  const matchRRDate = (rr: RR) =>
    (!rrDateFrom || rr.delivery_date >= rrDateFrom) && (!rrDateTo || rr.delivery_date <= rrDateTo)
  const filteredRRs = rrs.filter(rr => filterQ(`${rr.rr_number} ${rr.po_number} ${rr.supplier} ${rr.status}`) && matchRRDate(rr))

  type RrSortKey = 'rr_number' | 'po_number' | 'supplier' | 'delivery_date' | 'received_by' | 'status'
  const { sorted: sortedRRs, sortKey: rrSortKey, sortDir: rrSortDir, onSort: onSortRr } = useTableSort<RR, RrSortKey>(filteredRRs, (rr, key) => {
    switch (key) {
      case 'rr_number': return rr.rr_number ?? ''
      case 'po_number': return rr.po_number ?? ''
      case 'supplier': return rr.supplier ?? ''
      case 'delivery_date': return rr.delivery_date ?? ''
      case 'received_by': return rr.received_by ?? ''
      case 'status': return rr.status ?? ''
    }
  })

  type SdSortKey = 'dr_number' | 'so_number' | 'client_name' | 'delivery_date' | 'status'
  const { sorted: sortedSalesDeliveries, sortKey: sdSortKey, sortDir: sdSortDir, onSort: onSortSd } = useTableSort<SalesDelivery, SdSortKey>(filteredSalesDeliveries, (d, key) => {
    switch (key) {
      case 'dr_number': return d.dr_number ?? d.delivery_number ?? ''
      case 'so_number': return d.so_number ?? ''
      case 'client_name': return d.client_name ?? ''
      case 'delivery_date': return d.delivery_date ?? ''
      case 'status': return d.status ?? ''
    }
  })

  type ReturnSortKey = 'return_number' | 'return_date' | 'return_type' | 'party' | 'status'
  const { sorted: sortedReturns, sortKey: returnSortKey, sortDir: returnSortDir, onSort: onSortReturn } = useTableSort<ItemReturn, ReturnSortKey>(returns, (ret, key) => {
    switch (key) {
      case 'return_number': return ret.return_number ?? ''
      case 'return_date': return ret.return_date ?? ''
      case 'return_type': return ret.return_type ?? ''
      case 'party': return ret.return_type === 'supplier' ? (ret.supplier_name ?? '') : (ret.client_name ?? '')
      case 'status': return ret.status ?? ''
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Receiving</h2>
        <p className="text-muted-foreground text-sm">Manage incoming deliveries, stock, and returns</p>
      </div>

      <Tabs defaultValue="receiving">
        <TabsList>
          <TabsTrigger value="receiving" className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5" />Receiving Reports</TabsTrigger>
          <TabsTrigger value="sales" className="flex items-center gap-1.5"><ShoppingBag className="h-3.5 w-3.5" />Sales Deliveries</TabsTrigger>
          <TabsTrigger value="returns" className="flex items-center gap-1.5"><ArrowLeftRight className="h-3.5 w-3.5" />Returns</TabsTrigger>
        </TabsList>

        {/* ── Receiving Reports ── */}
        <TabsContent value="receiving" className="space-y-6 mt-4">
          <div>
            <h3 className="text-lg font-semibold">Receiving Reports</h3>
            <p className="text-muted-foreground text-sm">Record incoming deliveries from purchase orders</p>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" />Pending Deliveries</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : pos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No purchase orders pending delivery.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pos.map(po => {
                    const needsReceivingDespiteCompleted = po.status === 'completed'
                    return (
                      <div
                        key={po.id}
                        className={`flex items-center justify-between p-3 border rounded-lg ${needsReceivingDespiteCompleted ? 'bg-orange-50/50 border-orange-200' : 'bg-yellow-50/50 border-yellow-200'}`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="font-mono text-sm font-semibold text-primary">{po.po_number}</div>
                            {needsReceivingDespiteCompleted && (
                              <Badge variant="outline" className="text-[10px] text-orange-700 border-orange-300">Completed — not yet received</Badge>
                            )}
                          </div>
                          <div className="text-sm">{(po.supplier as any)?.company_name ?? '—'}</div>
                          <div className="text-xs text-muted-foreground">Expected: {po.delivery_date ?? 'TBD'}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button size="sm" variant="ghost" onClick={() => setPoDetail(po)}>View</Button>
                          <Button size="sm" variant="outline" onClick={() => { resetRRForm(); setSelectedPO(po.po_number); setRrOpen(true) }}>Receive</Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base">Receiving Report History</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Input type="date" className="h-8 w-36 text-xs" value={rrDateFrom} onChange={e => setRrDateFrom(e.target.value)} />
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Input type="date" className="h-8 w-36 text-xs" value={rrDateTo} onChange={e => setRrDateTo(e.target.value)} />
                </div>
                {(rrDateFrom || rrDateTo) && (
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => { setRrDateFrom(''); setRrDateTo('') }}>Clear</Button>
                )}
                <Button onClick={() => { resetRRForm(); setRrOpen(true) }} className="bg-red-600 hover:bg-red-700">
                  <Plus className="h-4 w-4 mr-2" />New Receiving Report
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[560px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-10">No.</TableHead>
                      <SortableTableHead label="RR Number" sortKey="rr_number" activeKey={rrSortKey} direction={rrSortDir} onSort={onSortRr} />
                      <SortableTableHead label="PO Reference" sortKey="po_number" activeKey={rrSortKey} direction={rrSortDir} onSort={onSortRr} />
                      <SortableTableHead label="Supplier" sortKey="supplier" activeKey={rrSortKey} direction={rrSortDir} onSort={onSortRr} />
                      <SortableTableHead label="Delivery Date" sortKey="delivery_date" activeKey={rrSortKey} direction={rrSortDir} onSort={onSortRr} />
                      <SortableTableHead label="Received By" sortKey="received_by" activeKey={rrSortKey} direction={rrSortDir} onSort={onSortRr} />
                      <SortableTableHead label="Status" sortKey="status" activeKey={rrSortKey} direction={rrSortDir} onSort={onSortRr} />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                    ) : sortedRRs.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No receiving reports found.</TableCell></TableRow>
                    ) : sortedRRs.map((rr, idx) => (
                      <TableRow key={rr.id} className="cursor-pointer hover:bg-red-50/40 transition-colors" onClick={() => openRRDetails(rr.id)}>
                        <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-red-600">{rr.rr_number ?? '—'}</TableCell>
                        <TableCell className="text-xs font-mono">{rr.po_number}</TableCell>
                        <TableCell className="text-sm font-medium">{rr.supplier ?? '—'}</TableCell>
                        <TableCell className="text-sm">{rr.delivery_date}</TableCell>
                        <TableCell className="text-sm">{rr.received_by ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs text-green-700 border-green-300 capitalize">✓ {rr.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RR Details Dialog */}
        <Dialog open={!!rrDetailsId} onOpenChange={o => { if (!o) setRrDetailsId(null) }}>
          <DialogContent className="w-[98vw] sm:!max-w-2xl max-h-[90vh] overflow-y-auto">
            {(() => {
              const rr = rrs.find(r => r.id === rrDetailsId)
              if (!rr) return null
              const rrItems = poItemsByNumber[rr.po_number] ?? []
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-red-600" />{rr.rr_number ?? 'Receiving Report'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <Badge variant="outline" className="text-xs text-green-700 border-green-300 capitalize">✓ {rr.status}</Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-muted/30 rounded-xl p-3">
                      <div><span className="text-muted-foreground block">DR / SI Number</span><span className="font-mono">{rr.dr_number ?? '—'}</span></div>
                      <div><span className="text-muted-foreground block">PO Reference</span><span className="font-mono">{rr.po_number}</span></div>
                      <div><span className="text-muted-foreground block">Supplier</span>{rr.supplier ?? '—'}</div>
                      <div><span className="text-muted-foreground block">Received By</span>{rr.received_by ?? '—'}</div>
                    </div>
                    {rrItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No line items found for this PO reference.</p>
                    ) : (
                      <div className="border rounded-xl overflow-hidden text-xs">
                        <table className="w-full">
                          <thead className="bg-muted/60">
                            <tr>
                              <th className="text-left px-3 py-1.5 font-medium">Item</th>
                              <th className="text-right px-3 py-1.5 font-medium w-20">Ordered</th>
                              <th className="text-right px-3 py-1.5 font-medium w-24">Received</th>
                              <th className="text-left px-3 py-1.5 font-medium w-24">Unit</th>
                              <th className="text-left px-3 py-1.5 font-medium w-20">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rrItems.map((it, i) => {
                              const isPartial = it.quantity_received < it.quantity
                              return (
                                <tr key={i} className="border-t">
                                  <td className="px-3 py-1">{it.item_name}</td>
                                  <td className="px-3 py-1 text-right font-medium">{it.quantity}</td>
                                  <td className="px-3 py-1 text-right font-medium">{it.quantity_received}</td>
                                  <td className="px-3 py-1 text-muted-foreground">{it.unit_of_measure}</td>
                                  <td className="px-3 py-1">
                                    <span className={`px-1.5 py-0.5 rounded-full font-medium ${isPartial ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                      {isPartial ? 'Partial' : 'Complete'}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {rrAttachments.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground font-medium">Attachments (from Purchase Order)</p>
                        <div className="flex flex-wrap gap-2">
                          {rrAttachments.map(a => (
                            <button
                              key={a.id} type="button" onClick={() => setPreviewAttachment({ url: a.file_url, name: a.file_name })}
                              className="flex items-center gap-1.5 text-xs border rounded-md pl-1 pr-2 py-1 bg-muted/30 hover:bg-muted/50"
                            >
                              {isImageAttachment(a.file_name)
                                ? // eslint-disable-next-line @next/next/no-img-element
                                  <img src={driveImageSrc(a.file_url)} alt="" className="h-6 w-6 object-cover rounded" />
                                : <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                              <span className="text-blue-600 truncate max-w-[160px]">{a.file_name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { openEditRR(rr); setRrDetailsId(null) }}>
                        <Pencil className="h-3.5 w-3.5" />Edit
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => printRR(rr)}>
                        <Printer className="h-3.5 w-3.5" />Print
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5 text-destructive ml-auto" onClick={() => { setDeleteRRId(rr.id); setRrDetailsId(null) }}>
                        <Trash2 className="h-3.5 w-3.5" />Delete
                      </Button>
                    </div>
                  </div>
                </>
              )
            })()}
          </DialogContent>
        </Dialog>

        {/* Attachment Preview */}
        <Dialog open={!!previewAttachment} onOpenChange={o => { if (!o) setPreviewAttachment(null) }}>
          <DialogContent className="w-[95vw] sm:!max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="truncate pr-6">{previewAttachment?.name}</DialogTitle>
            </DialogHeader>
            {previewAttachment && (
              isImageAttachment(previewAttachment.name) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={driveImageSrc(previewAttachment.url)} alt={previewAttachment.name} className="w-full max-h-[70vh] object-contain rounded-lg border" />
              ) : isPdfAttachment(previewAttachment.name) ? (
                <iframe src={driveEmbedUrl(previewAttachment.url)} className="w-full h-[70vh] rounded-lg border" />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
                  <FileText className="h-10 w-10" />
                  <p>Preview isn&apos;t available for this file type.</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => window.open(previewAttachment.url, '_blank', 'noopener,noreferrer')}>
                    Open File
                  </Button>
                </div>
              )
            )}
          </DialogContent>
        </Dialog>

        {/* ── Sales Deliveries (synced from DR Logs) ── */}
        <TabsContent value="sales" className="space-y-6 mt-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-lg font-semibold">Sales Deliveries</h3>
              <p className="text-muted-foreground text-sm">Outgoing deliveries synced from DR Logs</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input type="date" className="h-8 w-36 text-xs" value={salesdDateFrom} onChange={e => setSalesdDateFrom(e.target.value)} />
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input type="date" className="h-8 w-36 text-xs" value={salesdDateTo} onChange={e => setSalesdDateTo(e.target.value)} />
              </div>
              {(salesdDateFrom || salesdDateTo) && (
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => { setSalesdDateFrom(''); setSalesdDateTo('') }}>
                  Clear
                </Button>
              )}
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><ShoppingBag className="h-4 w-4" />DR Log → Sales Deliveries</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[560px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow>
                    <SortableTableHead label="DR Number" sortKey="dr_number" activeKey={sdSortKey} direction={sdSortDir} onSort={onSortSd} />
                    <SortableTableHead label="SO Reference" sortKey="so_number" activeKey={sdSortKey} direction={sdSortDir} onSort={onSortSd} />
                    <SortableTableHead label="Client" sortKey="client_name" activeKey={sdSortKey} direction={sdSortDir} onSort={onSortSd} />
                    <SortableTableHead label="Delivery Date" sortKey="delivery_date" activeKey={sdSortKey} direction={sdSortDir} onSort={onSortSd} />
                    <SortableTableHead label="Status" sortKey="status" activeKey={sdSortKey} direction={sdSortDir} onSort={onSortSd} />
                    <TableHead>CSI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesdLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                  ) : sortedSalesDeliveries.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                      {salesdDateFrom || salesdDateTo ? 'No sales deliveries in this date range.' : 'No sales deliveries yet. Create a DR Log to populate this list.'}
                    </TableCell></TableRow>
                  ) : sortedSalesDeliveries.map(d => {
                    const statusCls = d.status === 'delivered' ? 'bg-green-100 text-green-700' : d.status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700'
                    return (
                      <TableRow key={d.id} className="cursor-pointer hover:bg-muted/40" onClick={() => openSalesDetail(d)}>
                        <TableCell className="font-mono text-xs font-semibold text-red-600">{d.dr_number ?? '—'}</TableCell>
                        <TableCell className="text-xs font-mono text-blue-600">{d.so_number ?? '—'}</TableCell>
                        <TableCell className="text-sm font-medium">{d.client_name ?? '—'}</TableCell>
                        <TableCell className="text-sm">{d.delivery_date}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusCls}`}>{d.status}</span>
                        </TableCell>
                        <TableCell>
                          {d.hasCsi ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Invoiced</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">No CSI</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Returns ── */}
        <TabsContent value="returns" className="space-y-6 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Returns</h3>
              <p className="text-muted-foreground text-sm">Record items returned to warehouse or supplier</p>
            </div>
            {returnFormOpen ? (
              <Button variant="outline" onClick={() => { setReturnFormOpen(false); resetReturnForm() }}><X className="h-4 w-4 mr-2" />Cancel</Button>
            ) : (
              <Button onClick={() => { resetReturnForm(); setReturnFormOpen(true) }} className="bg-red-600 hover:bg-red-700"><Plus className="h-4 w-4 mr-2" />New Return</Button>
            )}
          </div>

          {returnFormOpen ? (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">New Return</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-1.5">
                  <Label>Return Type</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant={returnType === 'warehouse' ? 'default' : 'outline'} className={returnType === 'warehouse' ? 'bg-red-600 hover:bg-red-700' : ''} onClick={() => { setReturnType('warehouse'); setReturnSupplierId('') }}>Return to Warehouse</Button>
                    <Button type="button" variant={returnType === 'supplier' ? 'default' : 'outline'} className={returnType === 'supplier' ? 'bg-red-600 hover:bg-red-700' : ''} onClick={() => { setReturnType('supplier'); setReturnClientId('') }}>Return to Supplier</Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Return Date</Label>
                    <Input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
                  </div>
                  {returnType === 'supplier' ? (
                    <div className="space-y-1.5">
                      <Label>Supplier</Label>
                      <Select value={returnSupplierId} onValueChange={v => setReturnSupplierId(v ?? '')}>
                        <SelectTrigger className="w-full">
                          {returnSupplierId ? <span className="text-sm truncate">{suppliers.find(s => s.id === returnSupplierId)?.company_name}</span> : <span className="text-muted-foreground text-sm">Select supplier</span>}
                        </SelectTrigger>
                        <SelectContent className="min-w-[320px]">{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label>Client <span className="text-muted-foreground text-xs">(optional)</span></Label>
                      <Select value={returnClientId || '_none'} onValueChange={v => setReturnClientId(!v || v === '_none' ? '' : v)}>
                        <SelectTrigger className="w-full">
                          <SelectValue>{() => returnClientId ? selectedReturnClient?.company_name ?? '—' : 'No client — internal return'}</SelectValue>
                        </SelectTrigger>
                        <SelectContent className="min-w-[320px]">
                          <SelectItem value="_none">No client — internal return</SelectItem>
                          {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Items</Label>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead>Item Name</TableHead>
                          <TableHead className="w-24">Qty</TableHead>
                          <TableHead className="w-24">Unit</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {returnItems.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="py-1.5">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                                <input
                                  value={returnItemSearches[idx] ?? row.item_name}
                                  onChange={e => {
                                    setReturnItemSearches(s => ({ ...s, [idx]: e.target.value }))
                                    setReturnItemDropdowns(d => ({ ...d, [idx]: true }))
                                  }}
                                  onFocus={() => setReturnItemDropdowns(d => ({ ...d, [idx]: true }))}
                                  onBlur={() => setTimeout(() => setReturnItemDropdowns(d => ({ ...d, [idx]: false })), 150)}
                                  placeholder="Search item…"
                                  className="w-full h-8 pl-8 pr-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                />
                                {returnItemDropdowns[idx] && (
                                  <div className="absolute z-20 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-52 overflow-y-auto min-w-[240px]">
                                    {(() => {
                                      const q = (returnItemSearches[idx] ?? '').toLowerCase()
                                      const matches = q ? items.filter(it => it.item_name.toLowerCase().includes(q)) : items
                                      if (matches.length === 0) return <div className="px-3 py-2.5 text-sm text-muted-foreground">No items found</div>
                                      return matches.slice(0, 50).map(it => (
                                        <button
                                          key={it.item_name} type="button"
                                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-0"
                                          onMouseDown={() => {
                                            updateReturnItem(idx, 'item_name', it.item_name)
                                            setReturnItemSearches(s => ({ ...s, [idx]: it.item_name }))
                                            setReturnItemDropdowns(d => ({ ...d, [idx]: false }))
                                          }}
                                        >{it.item_name}</button>
                                      ))
                                    })()}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-1.5"><Input type="number" min="0" className="h-8 text-sm" value={row.quantity} onChange={e => updateReturnItem(idx, 'quantity', e.target.value)} /></TableCell>
                            <TableCell className="py-1.5"><Input className="h-8 text-sm bg-muted/30" value={row.unit} readOnly /></TableCell>
                            <TableCell className="py-1.5"><Input className="h-8 text-sm" placeholder="Reason" value={row.reason} onChange={e => updateReturnItem(idx, 'reason', e.target.value)} /></TableCell>
                            <TableCell className="py-1.5">
                              {returnItems.length > 1 && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setReturnItems(prev => prev.filter((_, i) => i !== idx))}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setReturnItems(prev => [...prev, emptyReturnItem()])}><Plus className="h-3.5 w-3.5 mr-1.5" />Add Item</Button>
                </div>
                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <textarea className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" placeholder="Additional notes..." value={returnNotes} onChange={e => setReturnNotes(e.target.value)} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setReturnFormOpen(false); resetReturnForm() }}>Cancel</Button>
                  <Button onClick={handleSaveReturn} disabled={returnSaving} className="bg-red-600 hover:bg-red-700">
                    {returnSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><CheckCircle2 className="h-4 w-4 mr-2" />Save Return</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Return History</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[560px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow>
                      <SortableTableHead label="Return #" sortKey="return_number" activeKey={returnSortKey} direction={returnSortDir} onSort={onSortReturn} />
                      <SortableTableHead label="Date" sortKey="return_date" activeKey={returnSortKey} direction={returnSortDir} onSort={onSortReturn} />
                      <SortableTableHead label="Type" sortKey="return_type" activeKey={returnSortKey} direction={returnSortDir} onSort={onSortReturn} />
                      <SortableTableHead label="Supplier / Warehouse" sortKey="party" activeKey={returnSortKey} direction={returnSortDir} onSort={onSortReturn} />
                      <SortableTableHead label="Status" sortKey="status" activeKey={returnSortKey} direction={returnSortDir} onSort={onSortReturn} />
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {returnsLoading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                    ) : sortedReturns.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No returns yet.</TableCell></TableRow>
                    ) : sortedReturns.map(ret => (
                      <TableRow key={ret.id}>
                        <TableCell className="font-mono text-xs font-semibold text-red-600">{ret.return_number}</TableCell>
                        <TableCell className="text-sm">{ret.return_date}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs capitalize">{ret.return_type === 'supplier' ? 'To Supplier' : 'To Warehouse'}</Badge></TableCell>
                        <TableCell className="text-sm">{ret.return_type === 'supplier' ? (ret.supplier_name ?? '—') : (ret.client_name ? `Warehouse — ${ret.client_name}` : 'Warehouse')}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs text-green-700 border-green-300 capitalize">✓ {ret.status}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{ret.notes ?? '—'}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => toast.info(`Return: ${ret.return_number}`)}>View Details</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit RR Dialog */}
      <Dialog open={rrOpen} onOpenChange={v => { setRrOpen(v); if (!v) resetRRForm() }}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingRRId ? 'Edit Receiving Report' : 'New Receiving Report'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>RR Number <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. RR-2026-00001" value={rrNumber} onChange={e => setRrNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Delivery Date</Label>
              <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>PO Reference <span className="text-destructive">*</span></Label>
              <Select value={selectedPO} onValueChange={v => {
                setSelectedPO(v ?? '')
                const po = pos.find(p => p.po_number === v)
                if (po) setRrSupplier((po.supplier as any)?.company_name ?? null)
              }}>
                <SelectTrigger>
                  {selectedPO ? <span className="text-sm truncate">{selectedPO}</span> : <span className="text-muted-foreground text-sm">Select PO</span>}
                </SelectTrigger>
                <SelectContent>
                  {pos.map(po => <SelectItem key={po.id} value={po.po_number}>{po.po_number} — {(po.supplier as any)?.company_name ?? ''}</SelectItem>)}
                  {selectedPO && !pos.some(po => po.po_number === selectedPO) && (
                    <SelectItem value={selectedPO}>{selectedPO}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>DR / SI Number</Label>
              <Input placeholder="Delivery Receipt or SI number" value={drNumber} onChange={e => setDrNumber(e.target.value)} />
            </div>
            {selectedPO && (
              <div className="sm:col-span-2 rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">PO Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div><span className="text-xs text-muted-foreground block">PO Number</span><span className="font-mono font-semibold text-red-600">{selectedPO}</span></div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">Supplier</span>
                    <Select value={rrSupplier ?? ''} onValueChange={v => setRrSupplier(v || null)}>
                      <SelectTrigger className="h-8 text-sm">
                        {rrSupplier ? <span className="truncate">{rrSupplier}</span> : <span className="text-muted-foreground">Select supplier</span>}
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map(s => <SelectItem key={s.id} value={s.company_name}>{s.company_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><span className="text-xs text-muted-foreground block">Expected</span><span>{selectedPOData?.delivery_date ?? '—'}</span></div>
                </div>
              </div>
            )}
            {selectedPO && !editingRRId && (poItemsByNumber[selectedPO] ?? []).length > 0 && (
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Items Received <span className="text-muted-foreground text-xs font-normal">(edit if the shipment doesn&apos;t cover everything ordered)</span></Label>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Item</TableHead>
                        <TableHead className="w-20 text-right">Ordered</TableHead>
                        <TableHead className="w-24 text-right">Already In</TableHead>
                        <TableHead className="w-28 text-right">Receiving Now</TableHead>
                        <TableHead className="w-20 text-right">Remaining</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(poItemsByNumber[selectedPO] ?? []).map(it => {
                        const outstanding = it.quantity - it.quantity_received
                        const nowQty = Number(rrReceiveQty[it.id]) || 0
                        const remaining = Math.max(0, outstanding - nowQty)
                        return (
                          <TableRow key={it.id}>
                            <TableCell className="text-sm">{it.item_name}</TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">{it.quantity}</TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">{it.quantity_received}</TableCell>
                            <TableCell className="py-1.5">
                              <Input
                                type="number" min={0} max={outstanding} className="h-8 text-sm text-right"
                                value={rrReceiveQty[it.id] ?? ''}
                                onChange={e => setRrReceiveQty(p => ({ ...p, [it.id]: e.target.value }))}
                              />
                            </TableCell>
                            <TableCell className={`text-right text-sm font-medium ${remaining > 0 ? 'text-amber-600' : 'text-green-600'}`}>{remaining}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Received By</Label>
              <Input placeholder="Name of person who received" value={receivedBy} onChange={e => setReceivedBy(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRrOpen(false); resetRRForm() }}>Cancel</Button>
            <Button onClick={handleSaveRR} disabled={rrSaving} className="bg-red-600 hover:bg-red-700">
              {rrSaving
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
                : editingRRId ? <><CheckCircle2 className="h-4 w-4 mr-2" />Update</> : <><CheckCircle2 className="h-4 w-4 mr-2" />Save & Update Inventory</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete RR Confirmation */}
      <Dialog open={!!deleteRRId} onOpenChange={() => setDeleteRRId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Receiving Report?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete this receiving report. It will not reverse the inventory quantities that
            were added to warehouse stock when it was saved — adjust those separately if needed.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRRId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteRR}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Sales Delivery Dialog */}
      <Dialog open={salesdOpen} onOpenChange={v => { setSalesdOpen(v); if (!v) resetSalesdForm() }}>
        <DialogContent className="w-[98vw] sm:!max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" />New Sales Delivery</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Client <span className="text-destructive">*</span></Label>
                <Select value={salesdClientId} onValueChange={v => setSalesdClientId(v ?? '')}>
                  <SelectTrigger>
                    {salesdClientId ? <span className="text-sm truncate">{salesdClient?.company_name}</span> : <span className="text-muted-foreground text-sm">Select client</span>}
                  </SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Quote Reference</Label>
                <Input placeholder="e.g. QT-2024-0001" value={salesdQuote} onChange={e => setSalesdQuote(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Delivery Date</Label>
                <Input type="date" value={salesdDate} onChange={e => setSalesdDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Delivered By</Label>
                <Input placeholder="Name / courier" value={salesdBy} onChange={e => setSalesdBy(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={salesdStatus} onValueChange={v => setSalesdStatus(v ?? 'pending')}>
                  <SelectTrigger>
                    <span className="text-sm">{SALES_STATUS[salesdStatus]?.label ?? salesdStatus}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SALES_STATUS).map(([v, cfg]) => <SelectItem key={v} value={v}>{cfg.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Items</Label>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Item</TableHead>
                      <TableHead className="w-24">Quantity</TableHead>
                      <TableHead className="w-24">Unit</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesdItems.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="py-1.5">
                          <Select value={row.item_name} onValueChange={v => updateSalesdItem(idx, 'item_name', v ?? '')}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select item" /></SelectTrigger>
                            <SelectContent>{items.map(it => <SelectItem key={it.item_name} value={it.item_name}>{it.item_name}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-1.5"><Input type="number" min="0" className="h-8 text-sm" placeholder="0" value={row.quantity} onChange={e => updateSalesdItem(idx, 'quantity', e.target.value)} /></TableCell>
                        <TableCell className="py-1.5"><Input className="h-8 text-sm bg-muted/30" value={row.unit} readOnly /></TableCell>
                        <TableCell className="py-1.5">
                          {salesdItems.length > 1 && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setSalesdItems(prev => prev.filter((_, i) => i !== idx))}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSalesdItems(prev => [...prev, emptySalesItem()])}><Plus className="h-3.5 w-3.5 mr-1.5" />Add Item</Button>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <textarea className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" placeholder="Delivery instructions or notes..." value={salesdNotes} onChange={e => setSalesdNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSalesdOpen(false); resetSalesdForm() }}>Cancel</Button>
            <Button onClick={handleSaveSalesDelivery} disabled={salesdSaving} className="bg-red-600 hover:bg-red-700">
              {salesdSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><CheckCircle2 className="h-4 w-4 mr-2" />Save Sales Delivery</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sales Delivery Detail */}
      <Dialog open={salesDetailOpen} onOpenChange={setSalesDetailOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" />Sales Delivery Details</DialogTitle>
          </DialogHeader>
          {salesDetailRow && (
            <div className="space-y-4 py-1">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-xs text-muted-foreground block">Delivery #</span><span className="font-mono font-semibold text-red-600">{salesDetailRow.delivery_number}</span></div>
                <div><span className="text-xs text-muted-foreground block">SO Reference</span><span className="font-mono text-blue-600">{salesDetailRow.so_number ?? '—'}</span></div>
                <div><span className="text-xs text-muted-foreground block">Client</span><span className="font-medium">{salesDetailRow.client_name ?? '—'}</span></div>
                <div><span className="text-xs text-muted-foreground block">Delivery Date</span><span>{salesDetailRow.delivery_date}</span></div>
                <div><span className="text-xs text-muted-foreground block">Status</span><span className="capitalize">{salesDetailRow.status}</span></div>
                <div><span className="text-xs text-muted-foreground block">CSI</span>
                  {salesDetailRow.hasCsi
                    ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Invoiced</span>
                    : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">No CSI</span>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Items</Label>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Item</TableHead>
                        <TableHead className="w-24">Unit</TableHead>
                        <TableHead className="w-20 text-right">Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesDetailLoading ? (
                        <TableRow><TableCell colSpan={3} className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                      ) : salesDetailItems.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground text-sm">No items recorded for this delivery.</TableCell></TableRow>
                      ) : salesDetailItems.map((it, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm">{it.item_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{it.unit ?? '—'}</TableCell>
                          <TableCell className="text-sm text-right font-medium">{it.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSalesDetailOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pending Delivery Detail */}
      <Dialog open={!!poDetail} onOpenChange={o => { if (!o) setPoDetail(null) }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Package className="h-4 w-4" />Pending Delivery Details</DialogTitle>
          </DialogHeader>
          {poDetail && (
            <div className="space-y-4 py-1">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-xs text-muted-foreground block">PO Number</span><span className="font-mono font-semibold text-red-600">{poDetail.po_number}</span></div>
                <div><span className="text-xs text-muted-foreground block">Status</span><span className="capitalize">{poDetail.status.replace(/_/g, ' ')}</span></div>
                <div><span className="text-xs text-muted-foreground block">Supplier</span><span className="font-medium">{poDetail.supplier?.company_name ?? '—'}</span></div>
                <div><span className="text-xs text-muted-foreground block">Expected Delivery</span><span>{poDetail.delivery_date ?? 'TBD'}</span></div>
              </div>
              <div className="space-y-1.5">
                <Label>Items</Label>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Item</TableHead>
                        <TableHead className="w-24">Unit</TableHead>
                        <TableHead className="w-20 text-right">Ordered</TableHead>
                        <TableHead className="w-20 text-right">Received</TableHead>
                        <TableHead className="w-20 text-right">Remaining</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(poItemsByNumber[poDetail.po_number] ?? []).length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">No items recorded for this PO.</TableCell></TableRow>
                      ) : (poItemsByNumber[poDetail.po_number] ?? []).map((it, idx) => {
                        const remaining = Math.max(0, it.quantity - it.quantity_received)
                        return (
                          <TableRow key={idx}>
                            <TableCell className="text-sm">{it.item_name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{it.unit_of_measure ?? '—'}</TableCell>
                            <TableCell className="text-sm text-right font-medium">{it.quantity}</TableCell>
                            <TableCell className="text-sm text-right text-muted-foreground">{it.quantity_received}</TableCell>
                            <TableCell className={`text-sm text-right font-medium ${remaining > 0 ? 'text-amber-600' : 'text-green-600'}`}>{remaining}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPoDetail(null)}>Close</Button>
            {poDetail && (
              <Button className="bg-red-600 hover:bg-red-700" onClick={() => { const po = poDetail; setPoDetail(null); resetRRForm(); setSelectedPO(po.po_number); setRrOpen(true) }}>Receive</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
