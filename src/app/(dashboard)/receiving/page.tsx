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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, MoreHorizontal, CheckCircle2, Package, Loader2 } from 'lucide-react'
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

export default function ReceivingPage() {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [selectedPO, setSelectedPO] = useState('')
  const [pos, setPOs] = useState<PO[]>([])
  const [rrs, setRRs] = useState<RR[]>([])
  const [loading, setLoading] = useState(true)
  const [drNumber, setDrNumber] = useState('')
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0])
  const [receivedBy, setReceivedBy] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedPOData = pos.find(p => p.po_number === selectedPO)

  async function load() {
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
    setPOs((poData ?? []) as PO[])
    setRRs((rrData ?? []) as RR[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function resetForm() {
    setSelectedPO('')
    setDrNumber('')
    setDeliveryDate(new Date().toISOString().split('T')[0])
    setReceivedBy('')
  }

  async function handleSave() {
    if (!selectedPO) { toast.error('Select a PO reference'); return }
    setSaving(true)
    const { error } = await supabase.from('receiving_reports').insert({
      po_number: selectedPO,
      supplier: (selectedPOData?.supplier as any)?.company_name ?? null,
      delivery_date: deliveryDate,
      received_by: receivedBy || null,
      dr_number: drNumber || null,
      status: 'completed',
    })
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Receiving report saved.')
    setOpen(false)
    resetForm()
    load()
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Receiving Reports</h2>
          <p className="text-muted-foreground text-sm">Record incoming deliveries and update inventory</p>
        </div>
        <Button onClick={() => { resetForm(); setOpen(true) }} className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-2" />New Receiving Report
        </Button>
      </div>

      {/* Pending Deliveries */}
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
                    <div className="text-xs text-muted-foreground">
                      Expected: {po.delivery_date ?? 'TBD'}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setSelectedPO(po.po_number); setOpen(true) }}>
                    Receive
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
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

      {/* Create RR Dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm() }}>
        <DialogContent className="w-[95vw] max-w-4xl sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Receiving Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Header fields */}
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

            {/* PO Details summary (shown when PO is selected) */}
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
            <Button variant="outline" onClick={() => { setOpen(false); resetForm() }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><CheckCircle2 className="h-4 w-4 mr-2" />Save & Update Inventory</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
