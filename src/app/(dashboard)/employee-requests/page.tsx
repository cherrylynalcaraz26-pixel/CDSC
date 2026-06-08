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
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, UserCheck } from 'lucide-react'
import { toast } from 'sonner'

const mockERs = [
  { id: '1', er_number: 'ER-2025-00034', request_type: 'office_supplies', purpose: 'Monthly supplies', status: 'submitted', date: '2025-06-07', items: 5 },
  { id: '2', er_number: 'ER-2025-00033', request_type: 'it_equipment', purpose: 'Laptop charger replacement', status: 'approved', date: '2025-06-05', items: 1 },
  { id: '3', er_number: 'ER-2025-00032', request_type: 'uniforms', purpose: 'Q3 uniform distribution', status: 'released', date: '2025-05-30', items: 3 },
]

const TYPE_LABELS = { office_supplies: 'Office Supplies', it_equipment: 'IT Equipment', uniforms: 'Uniforms', consumables: 'Consumables' }
const STATUS_COLORS = { draft: 'secondary', submitted: 'default', approved: 'default', rejected: 'destructive', released: 'outline' } as const

export default function EmployeeRequestsPage() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([{ item: '', qty: '1', unit: 'piece' }])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Requests</h2>
          <p className="text-muted-foreground text-sm">Request office supplies, IT equipment, uniforms and consumables</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />New Request</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { type: 'Office Supplies', count: 12, color: 'text-blue-600' },
          { type: 'IT Equipment', count: 5, color: 'text-purple-600' },
          { type: 'Uniforms', count: 3, color: 'text-green-600' },
          { type: 'Consumables', count: 8, color: 'text-orange-600' },
        ].map(c => (
          <Card key={c.type}><CardContent className="pt-4 pb-3">
            <div className={`text-2xl font-bold ${c.color}`}>{c.count}</div>
            <div className="text-xs text-muted-foreground">{c.type} Requests</div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><UserCheck className="h-4 w-4" />Request History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ER Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockERs.map(er => (
                <TableRow key={er.id}>
                  <TableCell className="font-mono text-xs text-primary">{er.er_number}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{TYPE_LABELS[er.request_type as keyof typeof TYPE_LABELS]}</Badge></TableCell>
                  <TableCell className="text-sm">{er.purpose}</TableCell>
                  <TableCell className="text-sm">{er.items} items</TableCell>
                  <TableCell className="text-sm">{er.date}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_COLORS[er.status as keyof typeof STATUS_COLORS]} className="text-xs">
                      {er.status === 'released' ? '✓ Released' : er.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New Supply / Equipment Request</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Request Type *</Label>
                <Select><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="office_supplies">Office Supplies</SelectItem>
                    <SelectItem value="it_equipment">IT Equipment</SelectItem>
                    <SelectItem value="uniforms">Uniforms</SelectItem>
                    <SelectItem value="consumables">Consumables</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Needed By</Label>
                <Input type="date" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Purpose *</Label>
              <Textarea placeholder="Describe what these items are for..." rows={2} />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Requested Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setItems(p => [...p, { item: '', qty: '1', unit: 'piece' }])}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add
                </Button>
              </div>
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input placeholder="Item name" value={it.item} onChange={e => setItems(p => p.map((x, idx) => idx === i ? { ...x, item: e.target.value } : x))} className="flex-1 h-8 text-sm" />
                    <Input type="number" placeholder="Qty" value={it.qty} className="w-20 h-8 text-sm" onChange={e => setItems(p => p.map((x, idx) => idx === i ? { ...x, qty: e.target.value } : x))} />
                    <Select value={it.unit} onValueChange={v => setItems(p => p.map((x, idx) => idx === i ? { ...x, unit: v } : x))}>
                      <SelectTrigger className="w-24 h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{['piece', 'box', 'set', 'pack'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setItems(p => p.filter((_, idx) => idx !== i))} disabled={items.length === 1}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => { toast.success('Request submitted for approval'); setOpen(false) }}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
