'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface Adjustment {
  id: string
  adjustment_number: string
  warehouse_id: string
  reason: string | null
  status: string
  adjustment_date: string | null
  created_at: string
  warehouse?: { warehouse_name: string }
}

interface Warehouse { id: string; warehouse_name: string }
interface Item { id: string; item_code: string; description: string; unit_of_measure: string }
interface AdjLine { item_id: string; qty_before: number; qty_after: number }

export default function StockAdjustmentPage() {
  const supabase = createClient()
  const [adjustments, setAdjustments] = useState<Adjustment[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [warehouse_id, setWarehouseId] = useState('')
  const [reason, setReason] = useState('')
  const [lines, setLines] = useState<AdjLine[]>([{ item_id: '', qty_before: 0, qty_after: 0 }])

  async function load() {
    setLoading(true)
    const [a, w, i] = await Promise.all([
      supabase.from('stock_adjustments').select('*, warehouse:warehouses(warehouse_name)').order('created_at', { ascending: false }),
      supabase.from('warehouses').select('id, warehouse_name').eq('status', 'active'),
      supabase.from('items').select('id, item_code, description, unit_of_measure').eq('is_active', true).order('item_code'),
    ])
    setAdjustments(a.data ?? [])
    setWarehouses(w.data ?? [])
    setItems(i.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function addLine() { setLines(l => [...l, { item_id: '', qty_before: 0, qty_after: 0 }]) }
  function removeLine(i: number) { setLines(l => l.filter((_, idx) => idx !== i)) }
  function updateLine(i: number, field: keyof AdjLine, value: string | number) {
    setLines(l => l.map((line, idx) => idx === i ? { ...line, [field]: value } : line))
  }

  async function save() {
    if (!warehouse_id) { toast.error('Select a warehouse'); return }
    if (lines.some(l => !l.item_id)) { toast.error('Select item for all lines'); return }
    setSaving(true)
    const today = new Date().toISOString().split('T')[0]
    const { data: adj, error } = await supabase
      .from('stock_adjustments')
      .insert({ warehouse_id, reason: reason || null, status: 'pending', adjustment_date: today })
      .select('id').single()
    if (error) { toast.error(error.message); setSaving(false); return }
    const linePayload = lines.map(l => ({
      adjustment_id: adj.id,
      item_id: l.item_id,
      quantity_before: l.qty_before,
      quantity_after: l.qty_after,
      variance: l.qty_after - l.qty_before,
    }))
    const { error: le } = await supabase.from('stock_adjustment_items').insert(linePayload)
    if (le) { toast.error(le.message) } else {
      toast.success('Stock adjustment created')
      setOpen(false)
      setWarehouseId('')
      setReason('')
      setLines([{ item_id: '', qty_before: 0, qty_after: 0 }])
      load()
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Stock Adjustment</h1>
          <p className="text-muted-foreground text-sm">Adjust inventory quantities to match physical count</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-2" /> New Adjustment
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Adjustment #</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : adjustments.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No adjustments yet</TableCell></TableRow>
            ) : adjustments.map(a => (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-sm">{a.adjustment_number}</TableCell>
                <TableCell>{(a.warehouse as any)?.warehouse_name ?? '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.reason ?? '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {a.adjustment_date ? format(new Date(a.adjustment_date), 'MMM d, yyyy') : format(new Date(a.created_at), 'MMM d, yyyy')}
                </TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${a.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {a.status}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-red-600" /> New Stock Adjustment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Warehouse <span className="text-destructive">*</span></Label>
              <Select value={warehouse_id} onValueChange={v => setWarehouseId(v ?? '')}>
                <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.warehouse_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Items (enter actual qty after count)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}><Plus className="h-3.5 w-3.5 mr-1" />Add Item</Button>
              </div>
              <div className="grid grid-cols-[1fr_100px_100px_32px] gap-2 text-xs text-muted-foreground px-1">
                <span>Item</span><span>Qty Before</span><span>Qty After</span><span />
              </div>
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-[1fr_100px_100px_32px] gap-2 items-center">
                  <Select value={line.item_id} onValueChange={v => updateLine(i, 'item_id', v ?? '')}>
                    <SelectTrigger><SelectValue placeholder="Item" /></SelectTrigger>
                    <SelectContent>{items.map(item => <SelectItem key={item.id} value={item.id}>{item.item_code} — {item.description}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" min={0} value={line.qty_before} onChange={e => updateLine(i, 'qty_before', Number(e.target.value))} placeholder="Before" />
                  <Input type="number" min={0} value={line.qty_after} onChange={e => updateLine(i, 'qty_after', Number(e.target.value))} placeholder="After" />
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeLine(i)}>✕</Button>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Textarea placeholder="Reason for adjustment (e.g. Physical count variance)" value={reason} onChange={e => setReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? 'Saving…' : 'Create Adjustment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
