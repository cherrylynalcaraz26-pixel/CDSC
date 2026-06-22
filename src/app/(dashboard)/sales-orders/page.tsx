'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Plus, MoreHorizontal, Eye, Printer, Trash2, CheckCircle2, XCircle,
  Loader2, X, FileText, Package, Search, Mail, ChevronDown, ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useSearchContext } from '@/context/search-context'

type SOStatus = 'draft' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

const STATUS_CFG: Record<SOStatus, { label: string; cls: string }> = {
  draft:      { label: 'Draft',      cls: 'bg-gray-100 text-gray-600' },
  confirmed:  { label: 'Confirmed',  cls: 'bg-blue-100 text-blue-700' },
  processing: { label: 'Processing', cls: 'bg-yellow-100 text-yellow-700' },
  shipped:    { label: 'Shipped',    cls: 'bg-purple-100 text-purple-700' },
  delivered:  { label: 'Delivered',  cls: 'bg-green-100 text-green-700' },
  cancelled:  { label: 'Cancelled',  cls: 'bg-red-100 text-red-700' },
}

interface SO {
  id: string; so_number: string | null; so_date: string | null; created_at: string
  client_name: string | null; client_po_number: string | null
  status: SOStatus; total_amount: number; remarks: string | null
}

interface SOLine { item_name: string; quantity: string; unit: string; unit_price: string; selling_price: string }
interface ItemOption { item_code: string; item_name: string; unit_of_measure: string; cost: number | null; selling_price: number | null }
interface ClientOption { id: string; company_name: string; payment_terms?: string | null }
interface SystemSettings { company_name: string; address: string; phone: string; email: string; tin: string }

const emptyLine = (): SOLine => ({ item_name: '', quantity: '', unit: '', unit_price: '', selling_price: '' })
const today = () => new Date().toISOString().split('T')[0]

export default function SalesOrdersPage() {
  const supabase = createClient()
  const printRef = useRef<HTMLDivElement>(null)
  const [sos, setSOs] = useState<SO[]>([])
  const [items, setItems] = useState<ItemOption[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [companyInfo, setCompanyInfo] = useState<SystemSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form')
  const [itemSearchIdx, setItemSearchIdx] = useState<number | null>(null)
  const [itemQuery, setItemQuery] = useState('')

  // Pipeline
  const [pipelineOpen, setPipelineOpen] = useState(true)
  const [collectedClients, setCollectedClients] = useState<Set<string>>(new Set())

  // Form
  const [soNumber, setSoNumber] = useState('')
  const [soDate, setSoDate] = useState(today())
  const [clientId, setClientId] = useState('')
  const [clientPONumber, setClientPONumber] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [remarks, setRemarks] = useState('')
  const [lines, setLines] = useState<SOLine[]>([emptyLine()])

  const selectedClient = clients.find(c => c.id === clientId)
  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.selling_price) || parseFloat(l.unit_price) || 0) * (parseFloat(l.quantity) || 0), 0)
  const costTotal = lines.reduce((s, l) => s + (parseFloat(l.unit_price) || 0) * (parseFloat(l.quantity) || 0), 0)
  const estimatedProfit = subtotal - costTotal
  const profitMarginPct = subtotal > 0 ? (estimatedProfit / subtotal) * 100 : 0
  const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

  const filteredSearchItems = itemQuery.trim()
    ? items.filter(it => it.item_name.toLowerCase().includes(itemQuery.toLowerCase()))
    : items

  async function load() {
    setLoading(true)
    const [{ data: soData }, { data: itemData }, { data: cliData }, { data: sysData }] = await Promise.all([
      supabase.from('sales_orders').select('id,so_number,so_date,created_at,client_name,client_po_number,status,total_amount,remarks').order('created_at', { ascending: false }),
      supabase.from('items').select('item_code,item_name,unit_of_measure,cost,selling_price').eq('status', 'active').order('item_name'),
      supabase.from('clients').select('id,company_name,payment_terms').eq('status', 'active').order('company_name'),
      supabase.from('system_settings').select('company_name, address, phone, email, tin').single(),
    ])
    setSOs((soData ?? []) as SO[])
    setItems((itemData ?? []) as ItemOption[])
    setClients((cliData ?? []) as ClientOption[])
    if (sysData) setCompanyInfo(sysData as SystemSettings)

    const { data: colData } = await supabase.from('collections').select('client_name')
    setCollectedClients(new Set((colData ?? []).map((r: any) => (r.client_name ?? '').trim()).filter(Boolean)))

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function resetForm() {
    setSoNumber(''); setSoDate(today()); setClientId(''); setClientPONumber('')
    setDeliveryDate(''); setRemarks(''); setLines([emptyLine()]); setMobileTab('form')
  }

  async function submitSO() {
    if (!clientId) { toast.error('Client is required'); return }
    setSaving(true)
    const { error } = await supabase.from('sales_orders').insert({
      so_number: soNumber.trim() || null,
      so_date: soDate,
      client_id: clientId,
      client_name: selectedClient?.company_name ?? '',
      client_po_number: clientPONumber || null,
      delivery_date: deliveryDate || null,
      remarks: remarks || null,
      status: 'draft',
      total_amount: subtotal,
    })
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Sales Order created')
    setOpen(false); resetForm(); load()
    setSaving(false)
  }

  async function updateStatus(id: string, status: SOStatus) {
    const { error } = await supabase.from('sales_orders').update({ status }).eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success(`Status → ${STATUS_CFG[status].label}`); load() }
  }

  async function deleteSO(id: string) {
    const { data: saved } = await supabase.from('sales_orders').select('*').eq('id', id).single()
    const { error } = await supabase.from('sales_orders').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    load()
    toast.success('Sales Order deleted', {
      action: { label: 'Undo', onClick: async () => {
        if (saved) { const { id: _id, so_number: _so, created_at: _ca, ...rest } = saved as any; await supabase.from('sales_orders').insert(rest); load() }
      }},
    })
  }

  function handlePrint() {
    const el = printRef.current
    if (!el) return
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><title>Sales Order</title>
      <script src="https://cdn.tailwindcss.com"><\/script>
      <style>body{font-family:Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@media print{body{margin:0;padding:16px;}}</style>
    </head><body class="p-6 text-[11px]">${el.innerHTML}</body></html>`)
    win.document.close()
    setTimeout(() => { win.focus(); win.print(); win.close() }, 800)
  }

  const { query } = useSearchContext()
  const displayedSOs = query.trim()
    ? sos.filter(s => {
        const q = query.toLowerCase()
        return (s.so_number ?? '').toLowerCase().includes(q) ||
          (s.client_name ?? '').toLowerCase().includes(q) ||
          (s.client_po_number ?? '').toLowerCase().includes(q) ||
          (s.status ?? '').toLowerCase().includes(q)
      })
    : sos

  const counts = {
    draft:     sos.filter(s => s.status === 'draft').length,
    active:    sos.filter(s => ['confirmed', 'processing', 'shipped'].includes(s.status)).length,
    delivered: sos.filter(s => s.status === 'delivered').length,
    total:     sos.reduce((s, o) => s + (o.total_amount ?? 0), 0),
  }

  const todayStr = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
  const deliveryStr = deliveryDate ? new Date(deliveryDate + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : ''

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sales Orders</h2>
          <p className="text-muted-foreground text-sm">Create and manage client sales orders</p>
        </div>
        {open ? (
          <Button variant="outline" onClick={() => { setOpen(false); resetForm() }}>
            <X className="h-4 w-4 mr-2" />Cancel
          </Button>
        ) : (
          <Button onClick={() => { resetForm(); setOpen(true) }} className="bg-red-600 hover:bg-red-700">
            <Plus className="h-4 w-4 mr-2" />New Sales Order
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold">{loading ? '—' : fmt(counts.total)}</div>
          <div className="text-sm text-muted-foreground">Total SO Value</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold text-gray-600">{loading ? '—' : counts.draft}</div>
          <div className="text-sm text-muted-foreground">Drafts</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold text-blue-600">{loading ? '—' : counts.active}</div>
          <div className="text-sm text-muted-foreground">Active Orders</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold text-green-600">{loading ? '—' : counts.delivered}</div>
          <div className="text-sm text-muted-foreground">Delivered</div>
        </CardContent></Card>
      </div>

      {/* ── Inline New SO Form ── */}
      {open && (
        <>
          {/* Mobile tab toggle */}
          <div className="flex lg:hidden gap-2 border-b pb-3">
            <Button size="sm" variant={mobileTab === 'form' ? 'default' : 'outline'} className={mobileTab === 'form' ? 'bg-red-600 hover:bg-red-700' : ''} onClick={() => setMobileTab('form')}>Form</Button>
            <Button size="sm" variant={mobileTab === 'preview' ? 'default' : 'outline'} className={mobileTab === 'preview' ? 'bg-red-600 hover:bg-red-700' : ''} onClick={() => setMobileTab('preview')}>Preview</Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: Form */}
            <div className={mobileTab === 'preview' ? 'hidden lg:block' : 'block'}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />Sales Order Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>SO Number</Label>
                      <Input placeholder="Auto-generated" value={soNumber} onChange={e => setSoNumber(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>SO Date</Label>
                      <Input type="date" value={soDate} onChange={e => setSoDate(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Client <span className="text-destructive">*</span></Label>
                    <div className="flex gap-1">
                      <Select value={clientId} onValueChange={v => setClientId(v ?? '')}>
                        <SelectTrigger className="flex-1">
                          {clientId
                            ? <span className="truncate text-sm">{selectedClient?.company_name}</span>
                            : <span className="text-muted-foreground text-sm">Select client…</span>}
                        </SelectTrigger>
                        <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
                      </Select>
                      {clientId && (
                        <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setClientId('')}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Client PO Number</Label>
                      <Input placeholder="e.g. PO-2024-0001" value={clientPONumber} onChange={e => setClientPONumber(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Delivery Date</Label>
                      <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="space-y-2">
                    <Label>Line Items</Label>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="min-w-[160px]">Item Description</TableHead>
                            <TableHead className="w-16">Qty</TableHead>
                            <TableHead className="w-20">Unit</TableHead>
                            <TableHead className="w-28">Cost Price</TableHead>
                            <TableHead className="w-28">Selling Price</TableHead>
                            <TableHead className="w-24 text-right">Amount</TableHead>
                            <TableHead className="w-8"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lines.map((line, i) => {
                            const lineTotal = (parseFloat(line.unit_price) || 0) * (parseFloat(line.quantity) || 0)
                            return (
                              <TableRow key={i}>
                                <TableCell className="py-1.5">
                                  <div className="flex gap-1 min-w-0">
                                    <Select value={line.item_name} onValueChange={val => {
                                      const selected = items.find(it => it.item_name === val)
                                      setLines(p => p.map((l, idx) => idx === i ? {
                                        ...l, item_name: val ?? '',
                                        unit: selected?.unit_of_measure || l.unit,
                                        unit_price: selected?.cost !== null && selected?.cost !== undefined ? String(selected.cost) : l.unit_price,
                                        selling_price: selected?.selling_price !== null && selected?.selling_price !== undefined ? String(selected.selling_price) : l.selling_price,
                                        quantity: l.quantity || '1',
                                      } : l))
                                    }}>
                                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Select item…" /></SelectTrigger>
                                      <SelectContent>{items.map(it => <SelectItem key={it.item_code} value={it.item_name}>{it.item_name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" title="Search inventory"
                                      onClick={() => { setItemSearchIdx(i); setItemQuery('') }}>
                                      <Package className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <Input type="number" min={1} className="h-8 text-xs w-full min-w-[64px]" placeholder="1" value={line.quantity}
                                    onChange={e => setLines(p => p.map((l, idx) => idx === i ? { ...l, quantity: e.target.value } : l))} />
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <div className="h-8 flex items-center px-2 text-xs bg-muted/40 rounded border text-muted-foreground">{line.unit || '—'}</div>
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <Input type="number" min={0} step="0.01" className="h-8 text-xs w-full" placeholder="0.00" value={line.unit_price}
                                    onChange={e => setLines(p => p.map((l, idx) => idx === i ? { ...l, unit_price: e.target.value } : l))} />
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <Input type="number" min={0} step="0.01" className="h-8 text-xs w-full" placeholder="0.00" value={line.selling_price}
                                    onChange={e => setLines(p => p.map((l, idx) => idx === i ? { ...l, selling_price: e.target.value } : l))} />
                                </TableCell>
                                <TableCell className="py-1.5 text-right text-xs font-medium">{fmt((parseFloat(line.selling_price) || parseFloat(line.unit_price) || 0) * (parseFloat(line.quantity) || 0))}</TableCell>
                                <TableCell className="py-1.5">
                                  {lines.length > 1 && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                      onClick={() => setLines(p => p.filter((_, idx) => idx !== i))}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setLines(p => [...p, emptyLine()])}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" />Add Item
                    </Button>
                  </div>

                  {/* Remarks */}
                  <div className="space-y-1.5">
                    <Label>Remarks</Label>
                    <textarea
                      className="w-full min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                      placeholder="Optional notes…"
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                    />
                  </div>

                  {/* Totals */}
                  <div className="rounded-lg bg-muted/30 p-4 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Cost Total</span><span>{fmt(costTotal)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Selling Total</span><span>{fmt(subtotal)}</span></div>
                    <div className="h-px bg-border my-1" />
                    <div className="flex justify-between font-bold"><span>Total</span><span className="text-red-600">{fmt(subtotal)}</span></div>
                    <div className="h-px bg-border my-1" />
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Estimated Profit</span>
                      <span className={estimatedProfit >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{fmt(estimatedProfit)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Profit Margin</span>
                      <span className={profitMarginPct >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{profitMarginPct.toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => { setOpen(false); resetForm() }}>Cancel</Button>
                    <Button type="button" variant="outline" className="gap-1.5" onClick={handlePrint}>
                      <Printer className="h-4 w-4" />Print
                    </Button>
                    <Button onClick={submitSO} disabled={saving} className="bg-red-600 hover:bg-red-700">
                      {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</> : 'Create Sales Order'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* RIGHT: Live Preview */}
            <div className={mobileTab === 'form' ? 'hidden lg:block' : 'block'}>
              <div className="sticky top-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live Preview</p>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handlePrint}>
                    <Printer className="h-3.5 w-3.5" />Print
                  </Button>
                </div>

                <div ref={printRef} className="border rounded-lg bg-white text-[11px] p-5 shadow-sm space-y-3 font-sans">
                  {/* Header */}
                  <div className="flex justify-between items-start border-b pb-3">
                    <div className="flex items-center gap-2.5">
                      <img src="/cdsc-logo.jpg" alt="CDSC" className="h-12 w-12 rounded object-cover shrink-0" />
                      <div className="text-[13px] font-bold text-red-700 leading-tight">
                        {companyInfo?.company_name || 'CDSC INDUSTRIAL'}
                      </div>
                    </div>
                    <div className="text-right text-[9px] text-gray-500 space-y-0.5">
                      {companyInfo?.address && <div>{companyInfo.address}</div>}
                      {(companyInfo?.phone || companyInfo?.email) && (
                        <div>{companyInfo.phone}{companyInfo.phone && companyInfo.email ? ' | ' : ''}{companyInfo.email}</div>
                      )}
                      {companyInfo?.tin && <div>TIN: {companyInfo.tin}</div>}
                    </div>
                  </div>

                  {/* Party row */}
                  <div className="grid grid-cols-3 gap-3 border-b pb-3">
                    <div className="space-y-0.5">
                      <div className="text-[9px] font-semibold uppercase text-gray-400">Bill To</div>
                      <div className="font-semibold text-gray-800 text-[11px]">
                        {selectedClient?.company_name ?? <span className="text-gray-400 italic font-normal">Not selected</span>}
                      </div>
                      {clientPONumber && (
                        <div className="mt-1.5">
                          <div className="text-[9px] font-semibold uppercase text-gray-400">Client PO #</div>
                          <div className="text-gray-700">{clientPONumber}</div>
                        </div>
                      )}
                      {remarks && (
                        <div className="mt-1.5">
                          <div className="text-[9px] font-semibold uppercase text-gray-400">Remarks</div>
                          <div className="text-gray-700 text-[10px]">{remarks}</div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-center">
                      <div className="text-[16px] font-extrabold text-red-700 uppercase tracking-widest text-center leading-tight">
                        Sales<br />Order
                      </div>
                    </div>
                    <div className="space-y-0.5 text-right">
                      <div className="text-[9px] font-semibold uppercase text-gray-400">SO Number</div>
                      <div className="font-mono font-bold text-gray-800">{soNumber || 'Auto-generated'}</div>
                      <div className="text-[9px] font-semibold uppercase text-gray-400 mt-1.5">Date</div>
                      <div className="text-gray-700">{todayStr}</div>
                      {deliveryStr && (
                        <>
                          <div className="text-[9px] font-semibold uppercase text-gray-400 mt-1.5">Delivery Date</div>
                          <div className="text-gray-700">{deliveryStr}</div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Items */}
                  <table className="w-full border-collapse text-[10px]">
                    <thead>
                      <tr className="bg-red-700 text-white">
                        <th className="text-left px-1.5 py-1 w-6">#</th>
                        <th className="text-left px-1.5 py-1">Item Description</th>
                        <th className="text-right px-1.5 py-1 w-12">Qty</th>
                        <th className="text-left px-1.5 py-1 w-16">Unit</th>
                        <th className="text-right px-1.5 py-1 w-20">Unit Price</th>
                        <th className="text-right px-1.5 py-1 w-20">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, i) => {
                        const total = (parseFloat(line.unit_price) || 0) * (parseFloat(line.quantity) || 0)
                        return (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-1.5 py-1 text-gray-400">{i + 1}</td>
                            <td className="px-1.5 py-1">{line.item_name || <span className="text-gray-300 italic">—</span>}</td>
                            <td className="px-1.5 py-1 text-right">{line.quantity || '—'}</td>
                            <td className="px-1.5 py-1 text-gray-500">{line.unit || '—'}</td>
                            <td className="px-1.5 py-1 text-right">₱{(parseFloat(line.unit_price) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                            <td className="px-1.5 py-1 text-right font-medium">₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {/* Totals */}
                  <div className="flex justify-end">
                    <div className="w-52 space-y-0.5 text-[10px]">
                      <div className="flex justify-between border-t pt-0.5 font-bold text-[11px]"><span>Total</span><span className="text-red-700">₱{subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
                    </div>
                  </div>

                  {/* Signatures */}
                  <div className="grid grid-cols-2 gap-6 border-t pt-4 mt-1">
                    <div className="text-center">
                      <div className="border-b border-gray-400 mb-1 h-8" />
                      <div className="text-[9px] text-gray-400 uppercase tracking-wider">Prepared By</div>
                    </div>
                    <div className="text-center">
                      <div className="border-b border-gray-400 mb-1 h-8" />
                      <div className="text-[9px] text-gray-400 uppercase tracking-wider">Received By</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* SO Pipeline */}
      {!open && (
        <Card>
          <CardHeader className="pb-0 pt-4 px-4">
            <button className="flex items-center justify-between w-full text-left" onClick={() => setPipelineOpen(o => !o)}>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Sales Order Pipeline — Next Actions
              </CardTitle>
              {pipelineOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CardHeader>
          {pipelineOpen && (
            <CardContent className="p-0 mt-3">
              <div className="grid grid-cols-5 text-center text-[10px] font-semibold uppercase tracking-wider border-b border-t">
                {[
                  { label: 'SO Created',  color: 'text-blue-600 bg-blue-50' },
                  { label: 'Confirmed',   color: 'text-indigo-600 bg-indigo-50' },
                  { label: 'Processing',  color: 'text-yellow-600 bg-yellow-50' },
                  { label: 'Shipped',     color: 'text-orange-600 bg-orange-50' },
                  { label: 'Collected',   color: 'text-green-600 bg-green-50' },
                ].map(s => (
                  <div key={s.label} className={`py-2 ${s.color}`}>{s.label}</div>
                ))}
              </div>
              {loading ? (
                <div className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>
              ) : sos.filter(s => !['cancelled', 'delivered'].includes(s.status)).length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">No active sales orders</div>
              ) : (
                <div className="divide-y max-h-64 overflow-y-auto">
                  {sos.filter(s => !['cancelled', 'delivered'].includes(s.status)).map(so => {
                    const statusOrder = ['draft', 'confirmed', 'processing', 'shipped', 'delivered']
                    const stageIdx = statusOrder.indexOf(so.status)
                    const clientName = (so.client_name ?? '').trim()
                    const hasOr = collectedClients.has(clientName)
                    const stages = [
                      { done: true,          label: so.so_number ?? '—',           sub: so.client_name ?? '' },
                      { done: stageIdx >= 1, label: stageIdx >= 1 ? 'Confirmed'  : 'Pending' },
                      { done: stageIdx >= 2, label: stageIdx >= 2 ? 'Processing' : 'Pending' },
                      { done: stageIdx >= 3, label: stageIdx >= 3 ? 'Shipped'    : 'Pending' },
                      { done: hasOr,         label: hasOr          ? 'Collected'  : 'Pending' },
                    ]
                    return (
                      <div key={so.id} className="grid grid-cols-5 text-center text-xs">
                        {stages.map((s, i) => (
                          <div key={i} className={`py-2.5 px-1 border-r last:border-r-0 ${s.done ? '' : 'opacity-40'}`}>
                            <div className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold mx-auto mb-0.5 ${s.done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                              {s.done ? '✓' : (i + 1)}
                            </div>
                            <div className="font-medium truncate px-1">{s.label}</div>
                            {s.sub && <div className="text-[10px] text-muted-foreground truncate px-1">{s.sub}</div>}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Sales Order List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sales Order List</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SO Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Client PO #</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell></TableRow>
              ) : displayedSOs.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No sales orders match your search.
                </TableCell></TableRow>
              ) : displayedSOs.map(so => {
                const sCfg = STATUS_CFG[so.status] ?? STATUS_CFG.draft
                return (
                  <TableRow key={so.id}>
                    <TableCell className="font-mono text-xs font-semibold text-red-600">{so.so_number ?? '—'}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {(so.so_date ?? so.created_at) ? format(new Date(so.so_date ?? so.created_at), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{so.client_name ?? '—'}</TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">{so.client_po_number ?? '—'}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(so.total_amount ?? 0)}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sCfg.cls}`}>{sCfg.label}</span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => toast.info(`SO: ${so.so_number ?? so.id}`)}>
                            <Eye className="mr-2 h-4 w-4" />View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.print()}>
                            <Printer className="mr-2 h-4 w-4" />Print SO
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {so.status === 'draft' && (
                            <DropdownMenuItem onClick={() => updateStatus(so.id, 'confirmed')} className="text-blue-600">
                              <CheckCircle2 className="mr-2 h-4 w-4" />Confirm Order
                            </DropdownMenuItem>
                          )}
                          {so.status === 'confirmed' && (
                            <DropdownMenuItem onClick={() => updateStatus(so.id, 'processing')} className="text-yellow-600">
                              <CheckCircle2 className="mr-2 h-4 w-4" />Mark Processing
                            </DropdownMenuItem>
                          )}
                          {so.status === 'processing' && (
                            <DropdownMenuItem onClick={() => updateStatus(so.id, 'shipped')} className="text-purple-600">
                              <CheckCircle2 className="mr-2 h-4 w-4" />Mark Shipped
                            </DropdownMenuItem>
                          )}
                          {so.status === 'shipped' && (
                            <DropdownMenuItem onClick={() => updateStatus(so.id, 'delivered')} className="text-green-600">
                              <CheckCircle2 className="mr-2 h-4 w-4" />Mark Delivered
                            </DropdownMenuItem>
                          )}
                          {!['delivered', 'cancelled'].includes(so.status) && (
                            <DropdownMenuItem onClick={() => updateStatus(so.id, 'cancelled')} className="text-destructive">
                              <XCircle className="mr-2 h-4 w-4" />Cancel
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => deleteSO(so.id)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Item Search Dialog */}
      <Dialog open={itemSearchIdx !== null} onOpenChange={o => { if (!o) setItemSearchIdx(null) }}>
        <DialogContent className="w-[98vw] sm:!max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Package className="h-4 w-4" />Item Inventory</DialogTitle>
          </DialogHeader>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input autoFocus placeholder="Search by item name…" className="pl-9" value={itemQuery} onChange={e => setItemQuery(e.target.value)} />
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-auto border rounded-lg">
            <table className="w-full text-sm min-w-[500px]">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-[45%]">Item Name</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-[10%]">Unit</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground w-[20%]">Cost</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground w-[25%]">Selling Price</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredSearchItems.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-sm">No items found.</td></tr>
                ) : filteredSearchItems.map(it => (
                  <tr key={it.item_name} className="hover:bg-muted/40 cursor-pointer" onClick={() => {
                    if (itemSearchIdx === null) return
                    setLines(p => p.map((l, i) => i === itemSearchIdx ? {
                      ...l,
                      item_name: it.item_name,
                      unit: it.unit_of_measure || l.unit,
                      unit_price: it.cost !== null && it.cost !== undefined ? String(it.cost) : l.unit_price,
                      selling_price: it.selling_price !== null && it.selling_price !== undefined ? String(it.selling_price) : l.selling_price,
                      quantity: l.quantity || '1',
                    } : l))
                    setItemSearchIdx(null)
                  }}>
                    <td className="px-3 py-2 font-medium">{it.item_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{it.unit_of_measure || '—'}</td>
                    <td className="px-3 py-2 text-right">{it.cost != null ? `₱${it.cost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}</td>
                    <td className="px-3 py-2 text-right font-medium text-green-700">{it.selling_price != null ? `₱${it.selling_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
