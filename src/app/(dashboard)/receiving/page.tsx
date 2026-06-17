'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, MoreHorizontal, CheckCircle2, Package } from 'lucide-react'
import { toast } from 'sonner'

const mockRRs: never[] = []
const mockPendingPOs: never[] = []
const rrItems = [
  { item: '', qty_ordered: 0, qty_received: 0, qty_rejected: 0 },
]

export default function ReceivingPage() {
  const [open, setOpen] = useState(false)
  const [selectedPO, setSelectedPO] = useState('')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Receiving Reports</h2>
          <p className="text-muted-foreground text-sm">Record incoming deliveries and update inventory</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />New Receiving Report</Button>
      </div>

      {/* Pending Deliveries */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Pending Deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mockPendingPOs.map(po => (
              <div key={po.id} className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50/50 border-yellow-200">
                <div>
                  <div className="font-mono text-sm font-semibold text-primary">{po.po_number}</div>
                  <div className="text-sm">{po.supplier}</div>
                  <div className="text-xs text-muted-foreground">Expected: {po.expected_date} • {po.items} items</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => { setSelectedPO(po.po_number); setOpen(true) }}>
                  Receive
                </Button>
              </div>
            ))}
          </div>
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
                <TableHead>Warehouse</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockRRs.map(rr => (
                <TableRow key={rr.id}>
                  <TableCell className="font-mono text-xs font-semibold text-primary">{rr.rr_number}</TableCell>
                  <TableCell className="text-xs font-mono">{rr.po_number}</TableCell>
                  <TableCell className="text-sm font-medium">{rr.supplier}</TableCell>
                  <TableCell className="text-sm">{rr.delivery_date}</TableCell>
                  <TableCell className="text-sm">{rr.received_by}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{rr.warehouse}</Badge></TableCell>
                  <TableCell className="text-sm">{rr.total_received}/{rr.total_items}</TableCell>
                  <TableCell>
                    <Badge variant={rr.status === 'completed' ? 'outline' : 'default'} className="text-xs">
                      {rr.status === 'completed' ? '✓ Complete' : 'Partial'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => toast.info(`RR: ${rr.rr_number} — ${rr.supplier} | Received ${rr.total_received}/${rr.total_items} items`)}>
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.print()}>
                          Print RR
                        </DropdownMenuItem>
                        {rr.status === 'partial' && (
                          <DropdownMenuItem onClick={() => { setSelectedPO(rr.po_number); setOpen(true) }}>
                            Add Remaining Items
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => toast.info(`Inventory updated for ${rr.rr_number}: ${rr.total_received} items added to stock`)}>
                          View Inventory Update
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Receiving Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>PO Reference *</Label>
                <Select value={selectedPO} onValueChange={v => setSelectedPO(v ?? '')}>
                  <SelectTrigger><SelectValue placeholder="Select PO" /></SelectTrigger>
                  <SelectContent>
                    {mockPendingPOs.map(po => <SelectItem key={po.id} value={po.po_number}>{po.po_number} — {po.supplier}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Delivery Date *</Label>
                <Input type="date" defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="space-y-1">
                <Label>Warehouse *</Label>
                <Select><SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wh-main">Main Warehouse</SelectItem>
                    <SelectItem value="wh-it">IT Storage Room</SelectItem>
                    <SelectItem value="wh-supply">Office Supply Room</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>DR / SI Number</Label>
                <Input placeholder="Delivery Receipt or SI number" />
              </div>
            </div>

            {/* Items Table */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Received Items</Label>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Item</TableHead>
                      <TableHead className="text-xs w-28 text-right">Qty Ordered</TableHead>
                      <TableHead className="text-xs w-28 text-right">Qty Received</TableHead>
                      <TableHead className="text-xs w-28 text-right">Qty Rejected</TableHead>
                      <TableHead className="text-xs">Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rrItems.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm font-medium">{item.item}</TableCell>
                        <TableCell className="text-right text-sm">{item.qty_ordered}</TableCell>
                        <TableCell className="p-1">
                          <Input type="number" defaultValue={item.qty_received} className="h-8 text-sm text-right" />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input type="number" defaultValue={item.qty_rejected} className="h-8 text-sm text-right" />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input placeholder="Defective, wrong item..." className="h-8 text-sm" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => { toast.success('Receiving report saved. Inventory updated.'); setOpen(false) }}>
              <CheckCircle2 className="h-4 w-4 mr-2" />Save & Update Inventory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
