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
import { Plus, MoreHorizontal, CheckCircle2, Package, Loader2, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

interface PO {
  id: string
  po_number: string
  supplier?: { company_name: string } | null
  delivery_date: string | null
}

interface RR {
  id: string
  rr_number: string
  po_number: string
  supplier: string
  delivery_date: string
  received_by: string
  status: string
  total_items: number
  total_received: number
}

interface Supplier { id: string; company_name: string }
interface ItemOption { item_name: string; unit_of_measure: string }

interface ReturnItem {
  item_name: string
  unit: string
  quantity: string
  reason: string
}

interface ItemReturn {
  id: string
  return_number: string
  return_type: string
  return_date: string
  supplier_name: string | null
  notes: string | null
  status: string
  created_at: string
}

const emptyReturnItem = (): ReturnItem => ({ item_name: '', unit: '', quantity: '', reason: '' })

export default function ReceivingPage() {
  const supabase = createClient()

  // Receiving Reports state
  const [rrOpen, setRrOpen] = useState(false)
  const [selectedPO, setSelectedPO] = useState('')
  const [pos, setPOs] = useState<PO[]>([])
  const [rrs, setRRs] = useState<RR[]>([])
  const [loading, setLoading] = useState(true)
  const [drNumber, setDrNumber] = useState('')
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0])
  const [receivedBy, setReceivedBy] = useState('')
  const [rrSaving, setRrSaving] = useState(false)

  // Returns state
  const [returnFormOpen, setReturnFormOpen] = useState(false)
  const [returnType, setReturnType] = useState<'warehouse' | 'supplier'>('warehouse')
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0])
  const [returnSupplierId, setReturnSupplierId] = useState('')
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([emptyReturnItem()])
  const [returnNotes, setReturnNotes] = useState('')
  const [returnSaving, setReturnSaving] = useState(false)
  const [returns, setReturns] = useState<ItemReturn[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [items, setItems] = useState<ItemOption[]>([])
  const [returnsLoading, setReturnsLoading] = useState(true)

  const selectedPOData = pos.find(p => p.po_number === selectedPO)
  const selectedSupplier = suppliers.find(s => s.id === returnSupplierId)

  async function loadRR() {
    setLoading(true)
    const [{ data: poData }, { data: rrData }] = await Promise.all([
      supabase
        .from('purchase_orders')
        .select('id, po_number, delivery_date, supplier:suppliers(company_name)')
        .not('po_number', 'is', null)
        .in('status', ['open', 'partially_delivered'])
        .order('created_at', { ascending: false }),
      supabase
        .from('receiving_reports')
        .select('*')
        .order('created_at', { ascending: false }),
    ])
    setPOs((poData ?? []) as unknown as PO[])
    setRRs((rrData ?? []) as RR[])
    setLoading(false)
  }

  async function loadReturns() {
    setReturnsLoading(true)
    const [{ data: retData }, { data: supData }, { data: itemData }] = await Promise.all([
      supabase.from('item_returns').select('*').order('created_at', { ascending: false }),
      supabase.from('suppliers').select('id, company_name').eq('is_active', true).order('company_name'),
      supabase.from('items').select('item_name, unit_of_measure').eq('status', 'active').order('item_name'),
    ])
    setReturns((retData ?? []) as ItemReturn[])
    setSuppliers(supData ?? [])
    setItems((itemData ?? []) as ItemOption[])
    setReturnsLoading(false)
  }

  useEffect(() => { loadRR(); loadReturns() }, [])

  function resetRRForm() {
    setSelectedPO('')
    setDrNumber('')
    setDeliveryDate(new Date().toISOString().split('T')[0])
    setReceivedBy('')
  }

  function resetReturnForm() {
    setReturnType('warehouse')
    setReturnDate(new Date().toISOString().split('T')[0])
    setReturnSupplierId('')
    setReturnItems([emptyReturnItem()])
    setReturnNotes('')
  }

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
    setRrOpen(false)
    resetRRForm()
    loadRR()
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

    const returnNumber = data.return_number
    const itemRows = validItems.map(i => ({
      return_number: returnNumber,
      item_name: i.item_name,
      unit: i.unit || null,
      quantity: parseFloat(i.quantity),
      reason: i.reason || null,
    }))

    const { error: itemError } = await supabase.from('item_return_items').insert(itemRows)
    if (itemError) { toast.error(itemError.message); setReturnSaving(false); return }

    toast.success(`Return ${returnNumber} saved.`)
    setReturnFormOpen(false)
    resetReturnForm()
    loadReturns()
    setReturnSaving(false)
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Receiving</h2>
        <p className="text-muted-foreground text-sm">Manage incoming deliveries and returns</p>
      </div>

      <Tabs defaultValue="receiving">
        <TabsList>
          <TabsTrigger value="receiving">Receiving Reports</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
        </TabsList>

        {/* ── Receiving Reports Tab ── */}
        <TabsContent value="receiving" className="space-y-6 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Receiving Reports</h3>
              <p className="text-muted-foreground text-sm">Record incoming deliveries and update inventory</p>
            </div>
            <Button onClick={() => { resetRRForm(); setRrOpen(true) }} className="bg-red-600 hover:bg-red-700">
              <Plus className="h-4 w-4 mr-2" />New Receiving Report
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Pending Deliveries (Open POs)</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : pos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No open purchase orders pending delivery.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pos.map(po => (
                    <div key={po.id} className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50/50 border-yellow-200">
                      <div>
                        <div className="font-mono text-sm font-semibold text-primary">{po.po_number}</div>
                        <div className="text-sm">{(po.supplier as any)?.company_name ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">Expected: {po.delivery_date ?? 'TBD'}</div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => { setSelectedPO(po.po_number); setRrOpen(true) }}>
                        Receive
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Receiving Report History</CardTitle>
            </CardHeader>
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
                    <TableRow><TableCell colSpan={7} className="text-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell></TableRow>
                  ) : rrs.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      No receiving reports yet.
                    </TableCell></TableRow>
                  ) : rrs.map(rr => (
                    <TableRow key={rr.id}>
                      <TableCell className="font-mono text-xs font-semibold text-red-600">{rr.rr_number ?? '—'}</TableCell>
                      <TableCell className="text-xs font-mono">{rr.po_number}</TableCell>
                      <TableCell className="text-sm font-medium">{rr.supplier ?? '—'}</TableCell>
                      <TableCell className="text-sm">{rr.delivery_date}</TableCell>
                      <TableCell className="text-sm">{rr.received_by ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={rr.status === 'completed' ? 'outline' : 'default'} className="text-xs">
                          {rr.status === 'completed' ? '✓ Complete' : 'Partial'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent">
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => toast.info(`RR: ${rr.rr_number} — ${rr.supplier}`)}>
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.print()}>
                              Print RR
                            </DropdownMenuItem>
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

        {/* ── Returns Tab ── */}
        <TabsContent value="returns" className="space-y-6 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Returns</h3>
              <p className="text-muted-foreground text-sm">Record items returned to warehouse or supplier</p>
            </div>
            {returnFormOpen ? (
              <Button variant="outline" onClick={() => { setReturnFormOpen(false); resetReturnForm() }}>
                <X className="h-4 w-4 mr-2" />Cancel
              </Button>
            ) : (
              <Button onClick={() => { resetReturnForm(); setReturnFormOpen(true) }} className="bg-red-600 hover:bg-red-700">
                <Plus className="h-4 w-4 mr-2" />New Return
              </Button>
            )}
          </div>

          {returnFormOpen ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">New Return</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-1.5">
                  <Label>Return Type</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={returnType === 'warehouse' ? 'default' : 'outline'}
                      className={returnType === 'warehouse' ? 'bg-red-600 hover:bg-red-700' : ''}
                      onClick={() => { setReturnType('warehouse'); setReturnSupplierId('') }}
                    >
                      Return to Warehouse
                    </Button>
                    <Button
                      type="button"
                      variant={returnType === 'supplier' ? 'default' : 'outline'}
                      className={returnType === 'supplier' ? 'bg-red-600 hover:bg-red-700' : ''}
                      onClick={() => setReturnType('supplier')}
                    >
                      Return to Supplier
                    </Button>
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
                        <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                        <SelectContent>
                          {suppliers.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>
                          ))}
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
                              <Select value={row.item_name} onValueChange={v => updateReturnItem(idx, 'item_name', v ?? '')}>
                                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select item" /></SelectTrigger>
                                <SelectContent>
                                  {items.map(it => (
                                    <SelectItem key={it.item_name} value={it.item_name}>{it.item_name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="py-1.5">
                              <Input
                                type="number"
                                min="0"
                                className="h-8 text-sm"
                                value={row.quantity}
                                onChange={e => updateReturnItem(idx, 'quantity', e.target.value)}
                              />
                            </TableCell>
                            <TableCell className="py-1.5">
                              <Input className="h-8 text-sm bg-muted/30" value={row.unit} readOnly />
                            </TableCell>
                            <TableCell className="py-1.5">
                              <Input
                                className="h-8 text-sm"
                                placeholder="Reason"
                                value={row.reason}
                                onChange={e => updateReturnItem(idx, 'reason', e.target.value)}
                              />
                            </TableCell>
                            <TableCell className="py-1.5">
                              {returnItems.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => setReturnItems(prev => prev.filter((_, i) => i !== idx))}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setReturnItems(prev => [...prev, emptyReturnItem()])}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />Add Item
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <textarea
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    placeholder="Additional notes..."
                    value={returnNotes}
                    onChange={e => setReturnNotes(e.target.value)}
                  />
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
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Return History</CardTitle>
              </CardHeader>
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
                      <TableRow><TableCell colSpan={7} className="text-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                      </TableCell></TableRow>
                    ) : returns.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                        No returns yet. Click <strong>New Return</strong> to get started.
                      </TableCell></TableRow>
                    ) : returns.map(ret => (
                      <TableRow key={ret.id}>
                        <TableCell className="font-mono text-xs font-semibold text-red-600">{ret.return_number}</TableCell>
                        <TableCell className="text-sm">{ret.return_date}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {ret.return_type === 'supplier' ? 'To Supplier' : 'To Warehouse'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{ret.return_type === 'supplier' ? (ret.supplier_name ?? '—') : 'Warehouse'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs text-green-700 border-green-300">
                            ✓ {ret.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{ret.notes ?? '—'}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent">
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => toast.info(`Return: ${ret.return_number}`)}>
                                View Details
                              </DropdownMenuItem>
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
        <DialogContent className="w-[95vw] max-w-4xl sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Receiving Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>PO Reference <span className="text-destructive">*</span></Label>
                <Select value={selectedPO} onValueChange={v => setSelectedPO(v ?? '')}>
                  <SelectTrigger><SelectValue placeholder="Select PO" /></SelectTrigger>
                  <SelectContent>
                    {pos.map(po => (
                      <SelectItem key={po.id} value={po.po_number}>
                        {po.po_number} — {(po.supplier as any)?.company_name ?? ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Delivery Date <span className="text-destructive">*</span></Label>
                <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>DR / SI Number</Label>
                <Input placeholder="Delivery Receipt or SI number" value={drNumber} onChange={e => setDrNumber(e.target.value)} />
              </div>
            </div>

            {selectedPOData && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">PO Details</p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground block">PO Number</span>
                    <span className="font-mono font-semibold text-red-600">{selectedPOData.po_number}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Supplier</span>
                    <span className="font-medium">{(selectedPOData.supplier as any)?.company_name ?? '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Expected Delivery</span>
                    <span>{selectedPOData.delivery_date ?? '—'}</span>
                  </div>
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
    </div>
  )
}
