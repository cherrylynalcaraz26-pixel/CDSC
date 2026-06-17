'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import {
  Plus, MoreHorizontal, Eye, Printer, Loader2,
  Trash2, CheckCircle2, XCircle, ArrowRightLeft, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface ItemOption { item_code: string; item_name: string; unit_of_measure: string }

type POStatus = 'open' | 'partially_delivered' | 'completed' | 'cancelled'

const STATUS_CFG: Record<POStatus, { label: string; cls: string }> = {
  open:                 { label: 'Open',             cls: 'bg-blue-100 text-blue-700' },
  partially_delivered:  { label: 'Partial Delivery', cls: 'bg-yellow-100 text-yellow-700' },
  completed:            { label: 'Completed',        cls: 'bg-green-100 text-green-700' },
  cancelled:            { label: 'Cancelled',        cls: 'bg-red-100 text-red-700' },
}

interface PO {
  id: string
  po_number: string | null
  po_date: string | null
  delivery_date: string | null
  status: POStatus
  subtotal: number
  vat_amount: number
  ewt_amount: number
  net_payable: number
  total_amount: number
  payment_terms: string | null
  remarks: string | null
  supplier?: { company_name: string } | null
  pr?: { pr_number: string } | null
}

interface Supplier { id: string; company_name: string; payment_terms: string | null; ewt_rate: number | null }
interface Client { id: string; company_name: string; payment_terms: string | null }
interface POLine { item_name: string; quantity: string; unit: string; unit_price: string }
const emptyLine = (): POLine => ({ item_name: '', quantity: '', unit: 'piece', unit_price: '' })

export default function PurchaseOrdersPage() {
  const supabase = createClient()
  const [pos, setPOs] = useState<PO[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [items, setItems] = useState<ItemOption[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form')

  // Form state
  const [supplierId, setSupplierId] = useState('')
  const [clientId, setClientId] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('30 days')
  const [remarks, setRemarks] = useState('')
  const [lines, setLines] = useState<POLine[]>([emptyLine()])

  async function load() {
    setLoading(true)
    const [{ data: poData }, { data: supData }, { data: itemData }, { data: clientData }] = await Promise.all([
      supabase
        .from('purchase_orders')
        .select('*, supplier:suppliers(company_name), pr:purchase_requests(pr_number)')
        .order('created_at', { ascending: false }),
      supabase.from('suppliers').select('id, company_name, payment_terms, ewt_rate').eq('is_active', true).order('company_name'),
      supabase.from('items').select('item_code, item_name, unit_of_measure').eq('status', 'active').order('item_name'),
      supabase.from('clients').select('id, company_name, payment_terms').eq('status', 'active').order('company_name'),
    ])
    setPOs((poData ?? []) as PO[])
    setSuppliers(supData ?? [])
    setItems((itemData ?? []) as ItemOption[])
    setClients(clientData ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Computed totals
  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.unit_price) || 0) * (parseFloat(l.quantity) || 0), 0)
  const vatAmount = subtotal * 0.12
  const selectedSupplier = suppliers.find(s => s.id === supplierId)
  const ewtRate = (selectedSupplier?.ewt_rate ?? 2) / 100
  const ewtAmount = (subtotal / 1.12) * ewtRate   // EWT on VAT-exclusive amount
  const totalAmount = subtotal + vatAmount
  const netPayable = totalAmount - ewtAmount

  function resetForm() {
    setSupplierId(''); setClientId(''); setPoNumber(''); setDeliveryDate(''); setPaymentTerms('30 days'); setRemarks(''); setLines([emptyLine()]); setActiveTab('form')
  }

  async function submitPO() {
    if (!supplierId && !clientId) { toast.error('Select a supplier or client'); return }
    setSaving(true)
    const { data, error } = await supabase.from('purchase_orders').insert({
      po_number: poNumber || null,   // if blank, trigger auto-generates
      supplier_id: supplierId || null,
      client_id: clientId || null,
      delivery_date: deliveryDate || null,
      payment_terms: paymentTerms || null,
      remarks: remarks || null,
      status: 'open',
      subtotal,
      vat_amount: vatAmount,
      ewt_amount: ewtAmount,
      total_amount: totalAmount,
      net_payable: netPayable,
    }).select('id').single()
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Purchase Order created')
    resetForm()
    setOpen(false)
    load()
    setSaving(false)
  }

  async function updateStatus(id: string, status: POStatus) {
    const { error } = await supabase.from('purchase_orders').update({ status }).eq('id', id)
    if (error) { toast.error(error.message); return }

    // When completed (received from supplier) → update stock levels
    if (status === 'completed') {
      toast.success('PO completed — stock will be updated on receiving')
    } else {
      toast.success(`Status → ${STATUS_CFG[status].label}`)
    }
    load()
  }

  async function deletePO(id: string) {
    const { data: saved } = await supabase.from('purchase_orders').select('*').eq('id', id).single()
    const { error } = await supabase.from('purchase_orders').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    load()
    toast.success('PO deleted', {
      action: {
        label: 'Undo',
        onClick: async () => {
          if (saved) {
            const { id: _id, po_number: _po, created_at: _ca, ...rest } = saved as any
            await supabase.from('purchase_orders').insert(rest)
            load()
          }
        },
      },
    })
  }

  const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

  const counts = {
    open: pos.filter(p => p.status === 'open').length,
    partial: pos.filter(p => p.status === 'partially_delivered').length,
    completed: pos.filter(p => p.status === 'completed').length,
    total: pos.reduce((s, p) => s + (p.total_amount ?? 0), 0),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Purchase Orders</h2>
          <p className="text-muted-foreground text-sm">Manage supplier purchase orders, track deliveries and payments</p>
        </div>
        {open ? (
          <Button variant="outline" onClick={() => { setOpen(false); resetForm() }}>
            <X className="h-4 w-4 mr-2" />Cancel
          </Button>
        ) : (
          <Button onClick={() => { resetForm(); setOpen(true) }} className="bg-red-600 hover:bg-red-700">
            <Plus className="h-4 w-4 mr-2" />Create PO
          </Button>
        )}
      </div>

      {open ? null : (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold">{loading ? '—' : fmt(counts.total)}</div>
          <div className="text-sm text-muted-foreground">Total PO Value</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold text-blue-600">{loading ? '—' : counts.open}</div>
          <div className="text-sm text-muted-foreground">Open Orders</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold text-yellow-600">{loading ? '—' : counts.partial}</div>
          <div className="text-sm text-muted-foreground">Partial Delivery</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold text-green-600">{loading ? '—' : counts.completed}</div>
          <div className="text-sm text-muted-foreground">Completed</div>
        </CardContent></Card>
      </div>
      )}

      {/* PO List */}
      {!open && (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Purchase Order List</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>PR Ref</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>PO Date</TableHead>
                <TableHead>Delivery Date</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">VAT 12%</TableHead>
                <TableHead className="text-right">EWT</TableHead>
                <TableHead className="text-right">Net Payable</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : pos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                    No purchase orders yet. Click <strong>Create PO</strong> to get started.
                  </TableCell>
                </TableRow>
              ) : pos.map(po => {
                const sCfg = STATUS_CFG[po.status] ?? STATUS_CFG.open
                return (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono text-xs font-semibold text-red-600">{po.po_number ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{(po.pr as any)?.pr_number ?? '—'}</TableCell>
                    <TableCell className="font-medium text-sm">{(po.supplier as any)?.company_name ?? '—'}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {po.po_date ? format(new Date(po.po_date), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {po.delivery_date ? format(new Date(po.delivery_date), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">{fmt(po.subtotal ?? 0)}</TableCell>
                    <TableCell className="text-right text-sm text-blue-600">{fmt(po.vat_amount ?? 0)}</TableCell>
                    <TableCell className="text-right text-sm text-red-700">{fmt(po.ewt_amount ?? 0)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(po.net_payable ?? 0)}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sCfg.cls}`}>{sCfg.label}</span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => toast.info(`PO: ${po.po_number}`)}>
                            <Eye className="mr-2 h-4 w-4" />View PO
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.print()}>
                            <Printer className="mr-2 h-4 w-4" />Print PO
                          </DropdownMenuItem>
                          {po.status === 'open' && (
                            <DropdownMenuItem onClick={() => updateStatus(po.id, 'partially_delivered')} className="text-yellow-600">
                              <ArrowRightLeft className="mr-2 h-4 w-4" />Mark Partial Delivery
                            </DropdownMenuItem>
                          )}
                          {(po.status === 'open' || po.status === 'partially_delivered') && (
                            <DropdownMenuItem onClick={() => updateStatus(po.id, 'completed')} className="text-green-600">
                              <CheckCircle2 className="mr-2 h-4 w-4" />Mark Completed
                            </DropdownMenuItem>
                          )}
                          {po.status !== 'cancelled' && po.status !== 'completed' && (
                            <DropdownMenuItem onClick={() => updateStatus(po.id, 'cancelled')} className="text-destructive">
                              <XCircle className="mr-2 h-4 w-4" />Cancel PO
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => deletePO(po.id)} className="text-destructive">
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
      )}

      {/* ── Inline Create PO Form ── */}
      {open && (
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">New Purchase Order</CardTitle>
          <div className="flex rounded-md border overflow-hidden w-fit lg:hidden">
            <button
              onClick={() => setActiveTab('form')}
              className={`px-4 py-1.5 text-sm font-medium ${activeTab === 'form' ? 'bg-red-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted'}`}
            >
              Form
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-4 py-1.5 text-sm font-medium border-l ${activeTab === 'preview' ? 'bg-red-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted'}`}
            >
              Preview
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: existing form */}
            <div className={`space-y-5 ${activeTab === 'preview' ? 'hidden lg:block' : 'block'}`}>
            {/* Header */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">PO Details</p>
              {/* Row 1 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>PO Number</Label>
                  <Input placeholder="Enter PO number" value={poNumber} onChange={e => setPoNumber(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Delivery Date</Label>
                  <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
                </div>
              </div>
              {/* Row 2: Supplier | Client — mutually exclusive */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className={clientId ? 'text-muted-foreground' : ''}>
                    Supplier {!clientId && <span className="text-destructive">*</span>}
                    {clientId && <span className="text-xs text-muted-foreground ml-1">(clear client first)</span>}
                  </Label>
                  <Select
                    value={supplierId}
                    onValueChange={v => {
                      setSupplierId(v ?? '')
                      setClientId('')
                      const sup = suppliers.find(s => s.id === v)
                      if (sup?.payment_terms) setPaymentTerms(sup.payment_terms)
                    }}
                    disabled={!!clientId}
                  >
                    <SelectTrigger className={clientId ? 'opacity-50' : ''}>
                      <SelectValue placeholder="Select supplier…">
                        {supplierId ? suppliers.find(s => s.id === supplierId)?.company_name : 'Select supplier…'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className={supplierId ? 'text-muted-foreground' : ''}>
                    Client {!supplierId && <span className="text-destructive">*</span>}
                    {supplierId && <span className="text-xs text-muted-foreground ml-1">(clear supplier first)</span>}
                  </Label>
                  <Select
                    value={clientId}
                    onValueChange={v => {
                      setClientId(v ?? '')
                      setSupplierId('')
                      const cli = clients.find(c => c.id === v)
                      if (cli?.payment_terms) setPaymentTerms(cli.payment_terms)
                    }}
                    disabled={!!supplierId}
                  >
                    <SelectTrigger className={supplierId ? 'opacity-50' : ''}>
                      <SelectValue placeholder="Select client…">
                        {clientId ? clients.find(c => c.id === clientId)?.company_name : 'Select client…'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Row 3 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Payment Terms</Label>
                  <Select value={paymentTerms} onValueChange={v => setPaymentTerms(v ?? '30 days')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['COD','7 days','15 days','30 days','45 days','60 days'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Remarks</Label>
                  <Input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional notes…" />
                </div>
              </div>
            </div>

            {/* Line items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pb-1">Items Ordered</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setLines(p => [...p, emptyLine()])}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add Row
                </Button>
              </div>
              <div className="border rounded-lg">
                <div className="grid grid-cols-[1fr_80px_90px_130px_110px_36px] gap-2 px-3 py-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground">
                  <span>Item / Description</span>
                  <span>Qty</span>
                  <span>Unit</span>
                  <span>Unit Price (₱)</span>
                  <span className="text-right">Line Total</span>
                  <span />
                </div>
                <div className="divide-y">
                  {lines.map((line, i) => {
                    const lineTotal = (parseFloat(line.unit_price) || 0) * (parseFloat(line.quantity) || 0)
                    return (
                      <div key={i} className="grid grid-cols-[1fr_80px_90px_130px_110px_36px] gap-2 items-center px-3 py-2">
                        <Select
                          value={line.item_name}
                          onValueChange={val => {
                            const selected = items.find(it => it.item_name === val)
                            setLines(p => p.map((l, idx) => idx === i
                              ? { ...l, item_name: val ?? '', unit: selected?.unit_of_measure || l.unit }
                              : l))
                          }}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Select item…" />
                          </SelectTrigger>
                          <SelectContent>
                            {items.map(it => (
                              <SelectItem key={it.item_code} value={it.item_name}>
                                {it.item_name} <span className="text-xs text-muted-foreground ml-1">({it.unit_of_measure})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input type="number" min={1} className="h-8 text-sm" placeholder="1" value={line.quantity}
                          onChange={e => setLines(p => p.map((l, idx) => idx === i ? { ...l, quantity: e.target.value } : l))} />
                        <div className="h-8 flex items-center px-2 text-sm bg-muted/30 rounded border text-muted-foreground truncate">
                          {line.unit || '—'}
                        </div>
                        <Input type="number" min={0} step="0.01" className="h-8 text-sm" placeholder="0.00" value={line.unit_price}
                          onChange={e => setLines(p => p.map((l, idx) => idx === i ? { ...l, unit_price: e.target.value } : l))} />
                        <div className="text-right text-sm font-medium pr-1 tabular-nums">
                          ₱{lineTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => setLines(p => p.filter((_, idx) => idx !== i))} disabled={lines.length === 1}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Tax summary */}
              <div className="flex justify-end">
                <div className="space-y-1 text-sm min-w-[240px]">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal (VAT-inc.)</span><span>{fmt(subtotal)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Input VAT (12%)</span><span className="text-blue-600">{fmt(vatAmount)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">EWT ({selectedSupplier?.ewt_rate ?? 2}%)</span><span className="text-red-700">− {fmt(ewtAmount)}</span></div>
                  <div className="flex justify-between border-t pt-1 font-semibold"><span>Net Payable</span><span className="text-red-600">{fmt(netPayable)}</span></div>
                </div>
              </div>
            </div>
            </div>

            {/* RIGHT: live preview */}
            <div className={`${activeTab === 'form' ? 'hidden lg:block' : 'block'}`}>
              <div className="sticky top-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Live Preview</p>
                <div className="border rounded-lg bg-white text-[11px] p-4 shadow-sm space-y-3 font-sans">
                  {/* Header */}
                  <div className="flex justify-between items-start border-b pb-2">
                    <div className="flex items-center gap-2">
                      <img src="/cdsc-logo.jpg" alt="CDSC" className="h-10 w-10 rounded object-cover" />
                      <div>
                        <div className="text-base font-bold text-red-700">CDSC INDUSTRIAL</div>
                        <div className="text-[10px] text-gray-500">PURCHASE ORDER</div>
                      </div>
                    </div>
                    <div className="text-right space-y-0.5">
                      <div><span className="text-gray-500">PO No: </span><span className="font-mono font-bold">{poNumber || '—'}</span></div>
                      <div><span className="text-gray-500">Date: </span><span>{new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
                      {deliveryDate && <div><span className="text-gray-500">Delivery: </span><span>{new Date(deliveryDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>}
                    </div>
                  </div>

                  {/* Party info */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-0.5">
                      <div className="text-[9px] font-semibold uppercase text-gray-400">{supplierId ? 'Supplier' : clientId ? 'Client' : 'Supplier / Client'}</div>
                      <div className="font-semibold text-gray-800">
                        {supplierId
                          ? suppliers.find(s => s.id === supplierId)?.company_name || '—'
                          : clientId
                          ? clients.find(c => c.id === clientId)?.company_name || '—'
                          : <span className="text-gray-400 italic">Not selected</span>}
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-[9px] font-semibold uppercase text-gray-400">Payment Terms</div>
                      <div className="font-semibold text-gray-800">{paymentTerms || '—'}</div>
                    </div>
                  </div>

                  {/* Items table */}
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-red-700 text-white">
                        <th className="text-left px-1.5 py-1">#</th>
                        <th className="text-left px-1.5 py-1">Item Description</th>
                        <th className="text-right px-1.5 py-1">Qty</th>
                        <th className="text-left px-1.5 py-1">Unit</th>
                        <th className="text-right px-1.5 py-1">Unit Price</th>
                        <th className="text-right px-1.5 py-1">Total</th>
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
                    <div className="w-48 space-y-0.5">
                      <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>₱{subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">VAT (12%)</span><span className="text-blue-600">₱{vatAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">EWT</span><span className="text-red-700">−₱{ewtAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between border-t pt-0.5 font-bold"><span>Net Payable</span><span className="text-red-700">₱{netPayable.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
                    </div>
                  </div>

                  {/* Remarks */}
                  {remarks && (
                    <div className="border-t pt-2 text-[10px]">
                      <span className="text-gray-400 font-semibold">Remarks: </span>{remarks}
                    </div>
                  )}

                  {/* Signatures */}
                  <div className="grid grid-cols-2 gap-4 border-t pt-3 mt-2">
                    <div className="text-center">
                      <div className="border-b border-gray-400 mb-1 h-6" />
                      <div className="text-[9px] text-gray-400 uppercase">Prepared By</div>
                    </div>
                    <div className="text-center">
                      <div className="border-b border-gray-400 mb-1 h-6" />
                      <div className="text-[9px] text-gray-400 uppercase">Approved By</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t mt-2">
            <Button variant="outline" onClick={() => { setOpen(false); resetForm() }}>Cancel</Button>
            <Button onClick={submitPO} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</> : 'Create Purchase Order'}
            </Button>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  )
}
