'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, MoreHorizontal, Eye, Printer, Trash2, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

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
  id: string
  so_number: string | null
  so_date: string | null
  created_at: string
  client_name: string | null
  client_po_number: string | null
  status: SOStatus
  total_amount: number
  remarks: string | null
}

interface SOLine { item_name: string; quantity: string; unit: string; unit_price: string }
interface ItemOption { item_code: string; item_name: string; unit_of_measure: string }
interface ClientOption { id: string; company_name: string }

const emptyLine = (): SOLine => ({ item_name: '', quantity: '', unit: '', unit_price: '' })

export default function SalesOrdersPage() {
  const supabase = createClient()
  const [sos, setSOs] = useState<SO[]>([])
  const [items, setItems] = useState<ItemOption[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [poNumbers, setPoNumbers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [soNumber, setSoNumber] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientPONumber, setClientPONumber] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [remarks, setRemarks] = useState('')
  const [lines, setLines] = useState<SOLine[]>([emptyLine()])

  async function load() {
    setLoading(true)
    const [{ data: soData }, { data: itemData }, { data: cliData }, { data: poData }] = await Promise.all([
      supabase.from('sales_orders').select('id,so_number,so_date,created_at,client_name,client_po_number,status,total_amount,remarks').order('created_at', { ascending: false }),
      supabase.from('items').select('item_code,item_name,unit_of_measure').eq('status','active').order('item_name'),
      supabase.from('clients').select('id,company_name').eq('status','active').order('company_name'),
      supabase.from('purchase_orders').select('po_number').not('po_number', 'is', null).order('created_at', { ascending: false }),
    ])
    setSOs((soData ?? []) as SO[])
    setItems((itemData ?? []) as ItemOption[])
    setClients((cliData ?? []) as ClientOption[])
    setPoNumbers((poData ?? []).map((p: any) => p.po_number).filter(Boolean))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.unit_price) || 0) * (parseFloat(l.quantity) || 0), 0)
  const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

  function resetForm() {
    setSoNumber(''); setClientId(''); setClientPONumber('')
    setDeliveryDate(''); setRemarks(''); setLines([emptyLine()])
  }

  async function submitSO() {
    if (!clientId) { toast.error('Client is required'); return }
    const found = clients.find(c => c.id === clientId)
    setSaving(true)
    const { error } = await supabase.from('sales_orders').insert({
      so_number: soNumber.trim() || null,
      client_id: clientId,
      client_name: found?.company_name ?? '',
      client_po_number: clientPONumber || null,
      delivery_date: deliveryDate || null,
      remarks: remarks || null,
      status: 'draft',
      total_amount: subtotal,
    })
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Sales Order created')
    setOpen(false)
    resetForm()
    load()
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
      action: {
        label: 'Undo',
        onClick: async () => {
          if (saved) {
            const { id: _id, so_number: _so, created_at: _ca, ...rest } = saved as any
            await supabase.from('sales_orders').insert(rest)
            load()
          }
        },
      },
    })
  }

  const counts = {
    draft:     sos.filter(s => s.status === 'draft').length,
    active:    sos.filter(s => ['confirmed','processing','shipped'].includes(s.status)).length,
    delivered: sos.filter(s => s.status === 'delivered').length,
    total:     sos.reduce((s, o) => s + (o.total_amount ?? 0), 0),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sales Orders</h2>
          <p className="text-muted-foreground text-sm">Create and manage client sales orders</p>
        </div>
        <Button onClick={() => { resetForm(); setOpen(true) }} className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-2" />New Sales Order
        </Button>
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
              ) : sos.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No sales orders yet. Click <strong>New Sales Order</strong> to create one.
                </TableCell></TableRow>
              ) : sos.map(so => {
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
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => toast.info(`SO: ${so.so_number ?? so.id}`)}>
                            <Eye className="mr-2 h-4 w-4" />View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.print()}>
                            <Printer className="mr-2 h-4 w-4" />Print SO
                          </DropdownMenuItem>
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
                          {!['delivered','cancelled'].includes(so.status) && (
                            <DropdownMenuItem onClick={() => updateStatus(so.id, 'cancelled')} className="text-destructive">
                              <XCircle className="mr-2 h-4 w-4" />Cancel
                            </DropdownMenuItem>
                          )}
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

      {/* ── New SO Dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] max-w-3xl sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">New Sales Order</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">Order Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>SO Number</Label>
                  <Input placeholder="Enter SO number" value={soNumber} onChange={e => setSoNumber(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Delivery Date</Label>
                  <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Client <span className="text-destructive">*</span></Label>
                <Select value={clientId} onValueChange={v => setClientId(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client…">
                      {clientId ? clients.find(c => c.id === clientId)?.company_name : 'Select client…'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Client PO Number</Label>
                <Select value={clientPONumber} onValueChange={v => setClientPONumber(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select PO number…">
                      {clientPONumber || 'Select PO number…'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {poNumbers.map(po => <SelectItem key={po} value={po}>{po}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Remarks</Label>
                <Textarea rows={2} placeholder="Optional notes…" value={remarks} onChange={e => setRemarks(e.target.value)} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pb-1">Items Ordered</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setLines(p => [...p, emptyLine()])}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add Row
                </Button>
              </div>
              <div className="border rounded-lg overflow-x-auto">
                <div className="min-w-[540px]">
                  <div className="grid grid-cols-[minmax(160px,2fr)_60px_72px_100px_90px_32px] gap-1.5 px-2 py-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground">
                    <span>Item / Description</span><span>Qty</span><span>Unit</span><span>Unit Price (₱)</span>
                    <span className="text-right">Line Total</span><span />
                  </div>
                  <div className="divide-y">
                    {lines.map((line, i) => {
                      const lineTotal = (parseFloat(line.unit_price) || 0) * (parseFloat(line.quantity) || 0)
                      return (
                        <div key={i} className="grid grid-cols-[minmax(160px,2fr)_60px_72px_100px_90px_32px] gap-1.5 items-center px-2 py-1.5">
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
                          <Input type="number" min={1} placeholder="1" className="h-8 text-sm" value={line.quantity}
                            onChange={e => setLines(p => p.map((l, idx) => idx === i ? { ...l, quantity: e.target.value } : l))} />
                          <div className="h-8 flex items-center px-2 text-sm bg-muted/30 rounded border text-muted-foreground truncate">
                            {line.unit || '—'}
                          </div>
                          <Input type="number" min={0} step="0.01" placeholder="0.00" className="h-8 text-sm" value={line.unit_price}
                            onChange={e => setLines(p => p.map((l, idx) => idx === i ? { ...l, unit_price: e.target.value } : l))} />
                          <div className="text-right text-sm font-medium pr-1 tabular-nums">₱{lineTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                            onClick={() => setLines(p => p.filter((_, idx) => idx !== i))} disabled={lines.length === 1}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="flex justify-end text-sm font-semibold">
                Total:&nbsp;<span className="text-red-600 ml-1">₱{subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submitSO} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</> : 'Create Sales Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
