'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, MoreHorizontal, CheckCircle2, XCircle, ArrowRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

type PRStatus = 'draft' | 'submitted' | 'dept_approved' | 'purchasing_approved' | 'rejected' | 'converted_to_po'

const mockPRs = [
  { id: '1', pr_number: 'PR-2025-00012', date: '2025-06-08', requestor: 'Juan Dela Cruz', department: 'IT', priority: 'high', purpose: 'New office laptops for incoming staff', status: 'submitted' as PRStatus, total: 85000, items: 2 },
  { id: '2', pr_number: 'PR-2025-00011', date: '2025-06-07', requestor: 'Maria Santos', department: 'Admin', priority: 'normal', purpose: 'Monthly office supplies replenishment', status: 'dept_approved' as PRStatus, total: 12500, items: 8 },
  { id: '3', pr_number: 'PR-2025-00010', date: '2025-06-05', requestor: 'Pedro Reyes', department: 'Finance', priority: 'urgent', purpose: 'Printer replacement — unit broken', status: 'purchasing_approved' as PRStatus, total: 38000, items: 1 },
  { id: '4', pr_number: 'PR-2025-00009', date: '2025-06-04', requestor: 'Ana Lopez', department: 'HR', priority: 'normal', purpose: 'Uniform distribution Q3', status: 'converted_to_po' as PRStatus, total: 45000, items: 5 },
  { id: '5', pr_number: 'PR-2025-00008', date: '2025-06-01', requestor: 'Ben Torres', department: 'Operations', priority: 'low', purpose: 'Cleaning supplies', status: 'rejected' as PRStatus, total: 3200, items: 4 },
]

const STATUS_CONFIG: Record<PRStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'secondary' },
  submitted: { label: 'Submitted', color: 'default' },
  dept_approved: { label: 'Dept Approved', color: 'default' },
  purchasing_approved: { label: 'Purch Approved', color: 'default' },
  rejected: { label: 'Rejected', color: 'destructive' },
  converted_to_po: { label: 'Converted to PO', color: 'outline' },
}

const WORKFLOW_STEPS = ['Draft', 'Submitted', 'Dept. Approved', 'Admin Approved', 'Purchasing', 'Convert to PO']

interface PRItem {
  item_name: string
  quantity: string
  unit: string
  estimated_cost: string
}

export default function PurchaseRequestsPage() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<PRItem[]>([{ item_name: '', quantity: '', unit: 'piece', estimated_cost: '' }])

  function addItem() {
    setItems(prev => [...prev, { item_name: '', quantity: '', unit: 'piece', estimated_cost: '' }])
  }

  function removeItem(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i))
  }

  function handleSubmit() {
    toast.success('Purchase Request submitted for approval')
    setOpen(false)
  }

  const totalEstimated = items.reduce((sum, i) => sum + (parseFloat(i.estimated_cost) || 0) * (parseFloat(i.quantity) || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Purchase Requests</h2>
          <p className="text-muted-foreground text-sm">Create and track purchase requests through the approval workflow</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />New Request</Button>
      </div>

      {/* Workflow Visualization */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-1">
            {WORKFLOW_STEPS.map((step, i) => (
              <div key={step} className="flex items-center gap-1 flex-1">
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">{i + 1}</div>
                  <span className="text-xs text-center text-muted-foreground leading-tight">{step}</span>
                </div>
                {i < WORKFLOW_STEPS.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mb-4" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Draft', count: 2, color: 'text-muted-foreground' },
          { label: 'Pending Approval', count: 4, color: 'text-yellow-600' },
          { label: 'Approved', count: 3, color: 'text-blue-600' },
          { label: 'Converted to PO', count: 12, color: 'text-green-600' },
          { label: 'Rejected', count: 1, color: 'text-red-600' },
        ].map(s => (
          <Card key={s.label}><CardContent className="pt-4 pb-3">
            <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Purchase Request List</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PR Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Requestor</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="text-right">Est. Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockPRs.map(pr => (
                <TableRow key={pr.id}>
                  <TableCell className="font-mono text-xs font-medium text-primary">{pr.pr_number}</TableCell>
                  <TableCell className="text-sm">{pr.date}</TableCell>
                  <TableCell className="font-medium text-sm">{pr.requestor}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{pr.department}</Badge></TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{pr.purpose}</TableCell>
                  <TableCell>
                    <Badge variant={pr.priority === 'urgent' ? 'destructive' : pr.priority === 'high' ? 'default' : 'secondary'} className="text-xs">
                      {pr.priority}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">₱{pr.total.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_CONFIG[pr.status].color as 'default' | 'secondary' | 'destructive' | 'outline'} className="text-xs">
                      {STATUS_CONFIG[pr.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        {pr.status === 'submitted' && <><DropdownMenuItem className="text-green-600"><CheckCircle2 className="mr-2 h-4 w-4" />Approve</DropdownMenuItem><DropdownMenuItem className="text-destructive"><XCircle className="mr-2 h-4 w-4" />Reject</DropdownMenuItem></>}
                        {pr.status === 'purchasing_approved' && <DropdownMenuItem className="text-blue-600"><ArrowRight className="mr-2 h-4 w-4" />Convert to PO</DropdownMenuItem>}
                        <DropdownMenuItem>Print PR</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create PR Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Purchase Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>PR Number</Label>
                <Input value="Auto-generated" disabled className="bg-muted" />
              </div>
              <div className="space-y-1">
                <Label>Department *</Label>
                <Select><SelectTrigger><SelectValue placeholder="Select dept" /></SelectTrigger>
                  <SelectContent>
                    {['Administration', 'IT', 'Finance', 'HR', 'Operations', 'Purchasing'].map(d =>
                      <SelectItem key={d} value={d.toLowerCase()}>{d}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Priority *</Label>
                <Select defaultValue="normal"><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Purpose / Justification *</Label>
              <Textarea placeholder="Describe the purpose and reason for this purchase request..." rows={3} />
            </div>

            {/* Items Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Requested Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add Item
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Item / Description</TableHead>
                      <TableHead className="text-xs w-24">Qty</TableHead>
                      <TableHead className="text-xs w-28">Unit</TableHead>
                      <TableHead className="text-xs w-32">Est. Unit Cost</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="p-1">
                          <Input placeholder="Item name or description" className="h-8 text-sm" value={item.item_name} onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, item_name: e.target.value } : it))} />
                        </TableCell>
                        <TableCell className="p-1">
                          <Input type="number" placeholder="1" className="h-8 text-sm" value={item.quantity} onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: e.target.value } : it))} />
                        </TableCell>
                        <TableCell className="p-1">
                          <Select value={item.unit} onValueChange={v => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, unit: v } : it))}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {['piece', 'box', 'ream', 'set', 'unit', 'pack'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="p-1">
                          <Input type="number" placeholder="0.00" className="h-8 text-sm" value={item.estimated_cost} onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, estimated_cost: e.target.value } : it))} />
                        </TableCell>
                        <TableCell className="p-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(i)} disabled={items.length === 1}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end mt-2 text-sm font-semibold">
                Total Estimated: ₱{totalEstimated.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="secondary" onClick={() => { toast.success('Saved as draft'); setOpen(false) }}>Save as Draft</Button>
            <Button onClick={handleSubmit}>Submit for Approval</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
