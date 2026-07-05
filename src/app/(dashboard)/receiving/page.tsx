'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  Plus, MoreHorizontal, CheckCircle2, Package, Loader2, Trash2, X,
  Truck, ShoppingBag, ArrowLeftRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { useSearchContext } from '@/context/search-context'

interface PO { id: string; po_number: string; status: string; supplier?: { company_name: string } | null; delivery_date: string | null }
interface RR { id: string; rr_number: string; po_number: string; supplier: string; delivery_date: string; received_by: string; status: string }
interface Supplier { id: string; company_name: string }
interface Client { id: string; company_name: string }
interface ItemOption { item_name: string; unit_of_measure: string }

interface ReturnItem { item_name: string; unit: string; quantity: string; reason: string }
interface ItemReturn { id: string; return_number: string; return_type: string; return_date: string; supplier_name: string | null; notes: string | null; status: string }

interface StockDeliveryItem { item_name: string; unit: string; quantity_ordered: string; quantity_received: string; unit_cost: string }
interface StockDelivery { id: string; delivery_number: string; po_number: string | null; supplier_name: string | null; delivery_date: string; received_by: string | null; dr_number: string | null; status: string; created_at: string }

interface SalesDeliveryItem { item_name: string; unit: string; quantity: string }
interface SalesDelivery { id: string; delivery_number: string; quote_number: string | null; client_name: string | null; delivery_date: string; delivered_by: string | null; status: string; notes: string | null; created_at: string }

const emptyReturnItem = (): ReturnItem => ({ item_name: '', unit: '', quantity: '', reason: '' })
const emptyStockItem = (): StockDeliveryItem => ({ item_name: '', unit: '', quantity_ordered: '', quantity_received: '', unit_cost: '' })
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
  const [selectedPO, setSelectedPO] = useState('')
  const [pos, setPOs] = useState<PO[]>([])
  const [rrs, setRRs] = useState<RR[]>([])
  const [loading, setLoading] = useState(true)
  const [drNumber, setDrNumber] = useState('')
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0])
  const [receivedBy, setReceivedBy] = useState('')
  const [rrSaving, setRrSaving] = useState(false)

  // Returns
  const [returnFormOpen, setReturnFormOpen] = useState(false)
  const [returnType, setReturnType] = useState<'warehouse' | 'supplier'>('warehouse')
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0])
  const [returnSupplierId, setReturnSupplierId] = useState('')
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([emptyReturnItem()])
  const [returnNotes, setReturnNotes] = useState('')
  const [returnSaving, setReturnSaving] = useState(false)
  const [returns, setReturns] = useState<ItemReturn[]>([])
  const [returnsLoading, setReturnsLoading] = useState(true)

  // Shared refs
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [items, setItems] = useState<ItemOption[]>([])

  // Stock Deliveries
  const [sdOpen, setSdOpen] = useState(false)
  const [sdPO, setSdPO] = useState('')
  const [sdSupplierId, setSdSupplierId] = useState('')
  const [sdDate, setSdDate] = useState(new Date().toISOString().split('T')[0])
  const [sdDR, setSdDR] = useState('')
  const [sdReceivedBy, setSdReceivedBy] = useState('')
  const [sdNotes, setSdNotes] = useState('')
  const [sdItems, setSdItems] = useState<StockDeliveryItem[]>([emptyStockItem()])
  const [sdSaving, setSdSaving] = useState(false)
  const [stockDeliveries, setStockDeliveries] = useState<StockDelivery[]>([])
  const [sdLoading, setSdLoading] = useState(true)

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

  const selectedPOData = pos.find(p => p.po_number === selectedPO)
  const selectedSupplier = suppliers.find(s => s.id === returnSupplierId)
  const sdSupplier = suppliers.find(s => s.id === sdSupplierId)
  const salesdClient = clients.find(c => c.id === salesdClientId)

  async function loadRR() {
    setLoading(true)
    const [{ data: poData }, { data: rrData }] = await Promise.all([
      supabase.from('purchase_orders').select('id, po_number, delivery_date, status, supplier:suppliers(company_name)')
        .not('po_number', 'is', null).in('status', ['open', 'partially_delivered', 'completed']).order('created_at', { ascending: false }),
      supabase.from('receiving_reports').select('*').order('created_at', { ascending: false }),
    ])
    // A PO marked "completed" without ever being received would otherwise vanish from this
    // list, since completion and receiving are separate manual steps — so keep completed POs
    // visible here until a receiving report actually exists for them.
    const receivedPONumbers = new Set(((rrData ?? []) as RR[]).map(rr => rr.po_number))
    const pending = ((poData ?? []) as unknown as PO[]).filter(po => po.status !== 'completed' || !receivedPONumbers.has(po.po_number))
    setPOs(pending)
    setRRs((rrData ?? []) as RR[])
    setLoading(false)
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

  async function loadStockDeliveries() {
    setSdLoading(true)
    const { data } = await supabase.from('stock_deliveries').select('*').order('created_at', { ascending: false })
    setStockDeliveries((data ?? []) as StockDelivery[])
    setSdLoading(false)
  }

  async function loadSalesDeliveries() {
    setSalesdLoading(true)
    const { data } = await supabase
      .from('dr_logs')
      .select('id, dr_number, po_number, supplier_name, client_name, dr_date, status')
      .order('dr_date', { ascending: false })
    const mapped = (data ?? []).map((log: any) => ({
      id: log.id,
      delivery_number: log.dr_number,
      dr_number: log.dr_number,
      so_number: log.po_number,
      quote_number: log.po_number,
      client_name: log.client_name ?? log.supplier_name,
      delivery_date: log.dr_date,
      delivered_by: null,
      status: log.status,
      notes: null,
      created_at: '',
    }))
    setSalesDeliveries(mapped as SalesDelivery[])
    setSalesdLoading(false)
  }

  useEffect(() => {
    loadRR(); loadReturns(); loadShared(); loadStockDeliveries(); loadSalesDeliveries()
  }, [])

  function resetRRForm() { setSelectedPO(''); setDrNumber(''); setDeliveryDate(new Date().toISOString().split('T')[0]); setReceivedBy('') }
  function resetReturnForm() { setReturnType('warehouse'); setReturnDate(new Date().toISOString().split('T')[0]); setReturnSupplierId(''); setReturnItems([emptyReturnItem()]); setReturnNotes('') }
  function resetSdForm() { setSdPO(''); setSdSupplierId(''); setSdDate(new Date().toISOString().split('T')[0]); setSdDR(''); setSdReceivedBy(''); setSdNotes(''); setSdItems([emptyStockItem()]) }
  function resetSalesdForm() { setSalesdClientId(''); setSalesdQuote(''); setSalesdDate(new Date().toISOString().split('T')[0]); setSalesdBy(''); setSalesdNotes(''); setSalesdStatus('pending'); setSalesdItems([emptySalesItem()]) }

  async function handleSaveRR() {
    if (!selectedPO) { toast.error('Select a PO reference'); return }
    setRrSaving(true)
    const { error } = await supabase.from('receiving_reports').insert({
      po_number: selectedPO,
      supplier: (selectedPOData?.supplier as any)?.company_name ?? null,
      delivery_date: deliveryDate,
      received_by: receivedBy || null,
      dr_number: drNumber || null,
      status: 'completed',
    })
    if (error) { toast.error(error.message); setRrSaving(false); return }
    toast.success('Receiving report saved.')
    setRrOpen(false); resetRRForm(); loadRR()
    setRrSaving(false)
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
      notes: returnNotes || null,
      status: 'completed',
    }).select('return_number').single()
    if (error) { toast.error(error.message); setReturnSaving(false); return }
    const itemRows = validItems.map(i => ({ return_number: data.return_number, item_name: i.item_name, unit: i.unit || null, quantity: parseFloat(i.quantity), reason: i.reason || null }))
    const { error: ie } = await supabase.from('item_return_items').insert(itemRows)
    if (ie) { toast.error(ie.message); setReturnSaving(false); return }
    toast.success(`Return ${data.return_number} saved.`)
    setReturnFormOpen(false); resetReturnForm(); loadReturns()
    setReturnSaving(false)
  }

  async function handleSaveStockDelivery() {
    const validItems = sdItems.filter(i => i.item_name && parseFloat(i.quantity_received) > 0)
    if (validItems.length === 0) { toast.error('Add at least one item with quantity received'); return }
    setSdSaving(true)
    const { data, error } = await supabase.from('stock_deliveries').insert({
      po_number: sdPO || null,
      supplier_id: sdSupplierId || null,
      supplier_name: sdSupplier?.company_name ?? null,
      delivery_date: sdDate,
      dr_number: sdDR || null,
      received_by: sdReceivedBy || null,
      notes: sdNotes || null,
      status: 'completed',
    }).select('delivery_number').single()
    if (error) { toast.error(error.message); setSdSaving(false); return }
    const rows = validItems.map(i => ({
      delivery_number: data.delivery_number,
      item_name: i.item_name,
      unit: i.unit || null,
      quantity_ordered: parseFloat(i.quantity_ordered) || 0,
      quantity_received: parseFloat(i.quantity_received),
      unit_cost: parseFloat(i.unit_cost) || null,
    }))
    const { error: ie } = await supabase.from('stock_delivery_items').insert(rows)
    if (ie) { toast.error(ie.message); setSdSaving(false); return }
    toast.success(`Stock Delivery ${data.delivery_number} saved.`)
    setSdOpen(false); resetSdForm(); loadStockDeliveries()
    setSdSaving(false)
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

  function updateSdItem(idx: number, field: keyof StockDeliveryItem, value: string) {
    setSdItems(prev => prev.map((item, i) => {
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Receiving</h2>
        <p className="text-muted-foreground text-sm">Manage incoming deliveries, stock, and returns</p>
      </div>

      <Tabs defaultValue="receiving">
        <TabsList>
          <TabsTrigger value="receiving" className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5" />Receiving Reports</TabsTrigger>
          <TabsTrigger value="stock" className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" />Stock Deliveries</TabsTrigger>
          <TabsTrigger value="sales" className="flex items-center gap-1.5"><ShoppingBag className="h-3.5 w-3.5" />Sales Deliveries</TabsTrigger>
          <TabsTrigger value="returns" className="flex items-center gap-1.5"><ArrowLeftRight className="h-3.5 w-3.5" />Returns</TabsTrigger>
        </TabsList>

        {/* ── Receiving Reports ── */}
        <TabsContent value="receiving" className="space-y-6 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Receiving Reports</h3>
              <p className="text-muted-foreground text-sm">Record incoming deliveries from purchase orders</p>
            </div>
            <Button onClick={() => { resetRRForm(); setRrOpen(true) }} className="bg-red-600 hover:bg-red-700">
              <Plus className="h-4 w-4 mr-2" />New Receiving Report
            </Button>
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
                        <Button size="sm" variant="outline" onClick={() => { setSelectedPO(po.po_number); setRrOpen(true) }}>Receive</Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Receiving Report History</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>RR Number</TableHead>
                    <TableHead>PO Reference</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Delivery Date</TableHead>
                    <TableHead>Received By</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                  ) : rrs.filter(rr => filterQ(`${rr.rr_number} ${rr.po_number} ${rr.supplier} ${rr.status}`)).length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No receiving reports found.</TableCell></TableRow>
                  ) : rrs.filter(rr => filterQ(`${rr.rr_number} ${rr.po_number} ${rr.supplier} ${rr.status}`)).map(rr => (
                    <TableRow key={rr.id}>
                      <TableCell className="font-mono text-xs font-semibold text-red-600">{rr.rr_number ?? '—'}</TableCell>
                      <TableCell className="text-xs font-mono">{rr.po_number}</TableCell>
                      <TableCell className="text-sm font-medium">{rr.supplier ?? '—'}</TableCell>
                      <TableCell className="text-sm">{rr.delivery_date}</TableCell>
                      <TableCell className="text-sm">{rr.received_by ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs text-green-700 border-green-300">✓ {rr.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent">
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => toast.info(`RR: ${rr.rr_number}`)}>View Details</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Stock Deliveries ── */}
        <TabsContent value="stock" className="space-y-6 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Stock Deliveries</h3>
              <p className="text-muted-foreground text-sm">Record items received into warehouse stock</p>
            </div>
            <Button onClick={() => { resetSdForm(); setSdOpen(true) }} className="bg-red-600 hover:bg-red-700">
              <Plus className="h-4 w-4 mr-2" />New Stock Delivery
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Truck className="h-4 w-4" />Stock Delivery Records</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Delivery #</TableHead>
                    <TableHead>PO Reference</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Delivery Date</TableHead>
                    <TableHead>DR / SI #</TableHead>
                    <TableHead>Received By</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sdLoading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                  ) : stockDeliveries.filter(d => filterQ(`${d.delivery_number} ${d.po_number ?? ''} ${d.supplier_name ?? ''}`)).length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No stock deliveries yet. Click <strong>New Stock Delivery</strong> to get started.</TableCell></TableRow>
                  ) : stockDeliveries.filter(d => filterQ(`${d.delivery_number} ${d.po_number ?? ''} ${d.supplier_name ?? ''}`)).map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs font-semibold text-red-600">{d.delivery_number}</TableCell>
                      <TableCell className="text-xs font-mono">{d.po_number ?? '—'}</TableCell>
                      <TableCell className="text-sm font-medium">{d.supplier_name ?? '—'}</TableCell>
                      <TableCell className="text-sm">{d.delivery_date}</TableCell>
                      <TableCell className="text-sm">{d.dr_number ?? '—'}</TableCell>
                      <TableCell className="text-sm">{d.received_by ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs text-green-700 border-green-300">✓ {d.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent">
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => toast.info(`Delivery: ${d.delivery_number}`)}>View Details</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Sales Deliveries (synced from DR Logs) ── */}
        <TabsContent value="sales" className="space-y-6 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Sales Deliveries</h3>
              <p className="text-muted-foreground text-sm">Outgoing deliveries synced from DR Logs — record DRs linked to an SO Reference to appear here</p>
            </div>
            <Button variant="outline" size="sm" onClick={loadSalesDeliveries}>
              <Loader2 className={`h-3.5 w-3.5 mr-1.5 ${salesdLoading ? 'animate-spin' : 'hidden'}`} />Refresh
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><ShoppingBag className="h-4 w-4" />DR Log → Sales Deliveries</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Delivery #</TableHead>
                    <TableHead>DR Number</TableHead>
                    <TableHead>SO Reference</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Delivery Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesdLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                  ) : salesDeliveries.filter(d => filterQ(`${d.delivery_number} ${(d as any).dr_number ?? ''} ${(d as any).so_number ?? ''} ${d.client_name ?? ''} ${d.status}`)).length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-sm">No sales deliveries yet. Create a DR Log with an SO Reference to populate this list.</TableCell></TableRow>
                  ) : salesDeliveries.filter(d => filterQ(`${d.delivery_number} ${(d as any).dr_number ?? ''} ${(d as any).so_number ?? ''} ${d.client_name ?? ''} ${d.status}`)).map(d => {
                    const sd = d as any
                    const statusCls = sd.status === 'delivered' ? 'bg-green-100 text-green-700' : sd.status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700'
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono text-xs font-semibold text-red-600">{d.delivery_number}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{sd.dr_number ?? '—'}</TableCell>
                        <TableCell className="text-xs font-mono text-blue-600">{sd.so_number ?? '—'}</TableCell>
                        <TableCell className="text-sm font-medium">{d.client_name ?? '—'}</TableCell>
                        <TableCell className="text-sm">{d.delivery_date}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusCls}`}>{sd.status}</span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
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
                    <Button type="button" variant={returnType === 'supplier' ? 'default' : 'outline'} className={returnType === 'supplier' ? 'bg-red-600 hover:bg-red-700' : ''} onClick={() => setReturnType('supplier')}>Return to Supplier</Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Return Date</Label>
                    <Input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
                  </div>
                  {returnType === 'supplier' && (
                    <div className="space-y-1.5">
                      <Label>Supplier</Label>
                      <Select value={returnSupplierId} onValueChange={v => setReturnSupplierId(v ?? '')}>
                        <SelectTrigger>
                          {returnSupplierId ? <span className="text-sm truncate">{suppliers.find(s => s.id === returnSupplierId)?.company_name}</span> : <span className="text-muted-foreground text-sm">Select supplier</span>}
                        </SelectTrigger>
                        <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>)}</SelectContent>
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
                              <Select value={row.item_name} onValueChange={v => updateReturnItem(idx, 'item_name', v ?? '')}>
                                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select item" /></SelectTrigger>
                                <SelectContent>{items.map(it => <SelectItem key={it.item_name} value={it.item_name}>{it.item_name}</SelectItem>)}</SelectContent>
                              </Select>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Return #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Supplier / Warehouse</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {returnsLoading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                    ) : returns.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No returns yet.</TableCell></TableRow>
                    ) : returns.map(ret => (
                      <TableRow key={ret.id}>
                        <TableCell className="font-mono text-xs font-semibold text-red-600">{ret.return_number}</TableCell>
                        <TableCell className="text-sm">{ret.return_date}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs capitalize">{ret.return_type === 'supplier' ? 'To Supplier' : 'To Warehouse'}</Badge></TableCell>
                        <TableCell className="text-sm">{ret.return_type === 'supplier' ? (ret.supplier_name ?? '—') : 'Warehouse'}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs text-green-700 border-green-300">✓ {ret.status}</Badge></TableCell>
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
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create RR Dialog */}
      <Dialog open={rrOpen} onOpenChange={v => { setRrOpen(v); if (!v) resetRRForm() }}>
        <DialogContent className="w-[95vw] max-w-2xl sm:max-w-2xl">
          <DialogHeader><DialogTitle>New Receiving Report</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>PO Reference <span className="text-destructive">*</span></Label>
                <Select value={selectedPO} onValueChange={v => setSelectedPO(v ?? '')}>
                  <SelectTrigger>
                    {selectedPO ? <span className="text-sm truncate">{selectedPO}</span> : <span className="text-muted-foreground text-sm">Select PO</span>}
                  </SelectTrigger>
                  <SelectContent>{pos.map(po => <SelectItem key={po.id} value={po.po_number}>{po.po_number} — {(po.supplier as any)?.company_name ?? ''}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Delivery Date</Label>
                <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>DR / SI Number</Label>
              <Input placeholder="Delivery Receipt or SI number" value={drNumber} onChange={e => setDrNumber(e.target.value)} />
            </div>
            {selectedPOData && (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">PO Details</p>
                <div className="grid grid-cols-3 gap-4">
                  <div><span className="text-xs text-muted-foreground block">PO Number</span><span className="font-mono font-semibold text-red-600">{selectedPOData.po_number}</span></div>
                  <div><span className="text-xs text-muted-foreground block">Supplier</span><span className="font-medium">{(selectedPOData.supplier as any)?.company_name ?? '—'}</span></div>
                  <div><span className="text-xs text-muted-foreground block">Expected</span><span>{selectedPOData.delivery_date ?? '—'}</span></div>
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
              {rrSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><CheckCircle2 className="h-4 w-4 mr-2" />Save & Update Inventory</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Delivery Dialog */}
      <Dialog open={sdOpen} onOpenChange={v => { setSdOpen(v); if (!v) resetSdForm() }}>
        <DialogContent className="w-[98vw] sm:!max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Truck className="h-4 w-4" />New Stock Delivery</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Supplier</Label>
                <Select value={sdSupplierId} onValueChange={v => setSdSupplierId(v ?? '')}>
                  <SelectTrigger>
                    {sdSupplierId ? <span className="text-sm truncate">{sdSupplier?.company_name}</span> : <span className="text-muted-foreground text-sm">Select supplier</span>}
                  </SelectTrigger>
                  <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>PO Reference</Label>
                <Input placeholder="e.g. PO-2024-0001" value={sdPO} onChange={e => setSdPO(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Delivery Date</Label>
                <Input type="date" value={sdDate} onChange={e => setSdDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>DR / SI Number</Label>
                <Input placeholder="Delivery receipt #" value={sdDR} onChange={e => setSdDR(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Received By</Label>
                <Input placeholder="Name" value={sdReceivedBy} onChange={e => setSdReceivedBy(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Items Received</Label>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Item</TableHead>
                      <TableHead className="w-20">Ordered</TableHead>
                      <TableHead className="w-20">Received</TableHead>
                      <TableHead className="w-24">Unit</TableHead>
                      <TableHead className="w-24">Unit Cost</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sdItems.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="py-1.5">
                          <Select value={row.item_name} onValueChange={v => updateSdItem(idx, 'item_name', v ?? '')}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select item" /></SelectTrigger>
                            <SelectContent>{items.map(it => <SelectItem key={it.item_name} value={it.item_name}>{it.item_name}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-1.5"><Input type="number" min="0" className="h-8 text-sm" placeholder="0" value={row.quantity_ordered} onChange={e => updateSdItem(idx, 'quantity_ordered', e.target.value)} /></TableCell>
                        <TableCell className="py-1.5"><Input type="number" min="0" className="h-8 text-sm" placeholder="0" value={row.quantity_received} onChange={e => updateSdItem(idx, 'quantity_received', e.target.value)} /></TableCell>
                        <TableCell className="py-1.5"><Input className="h-8 text-sm bg-muted/30" value={row.unit} readOnly /></TableCell>
                        <TableCell className="py-1.5"><Input type="number" min="0" className="h-8 text-sm" placeholder="0.00" value={row.unit_cost} onChange={e => updateSdItem(idx, 'unit_cost', e.target.value)} /></TableCell>
                        <TableCell className="py-1.5">
                          {sdItems.length > 1 && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setSdItems(prev => prev.filter((_, i) => i !== idx))}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSdItems(prev => [...prev, emptyStockItem()])}><Plus className="h-3.5 w-3.5 mr-1.5" />Add Item</Button>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <textarea className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" placeholder="Additional notes..." value={sdNotes} onChange={e => setSdNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSdOpen(false); resetSdForm() }}>Cancel</Button>
            <Button onClick={handleSaveStockDelivery} disabled={sdSaving} className="bg-red-600 hover:bg-red-700">
              {sdSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><CheckCircle2 className="h-4 w-4 mr-2" />Save Stock Delivery</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sales Delivery Dialog */}
      <Dialog open={salesdOpen} onOpenChange={v => { setSalesdOpen(v); if (!v) resetSalesdForm() }}>
        <DialogContent className="w-[98vw] sm:!max-w-3xl max-h-[90vh] overflow-y-auto">
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
    </div>
  )
}
