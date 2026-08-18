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
import { Plus, ArrowRightLeft } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface Transfer {
  id: string
  transfer_number: string
  from_warehouse_id: string
  to_warehouse_id: string
  status: string
  remarks: string | null
  transfer_date: string | null
  created_at: string
  from_warehouse?: { warehouse_name: string }
  to_warehouse?: { warehouse_name: string }
}

interface Warehouse { id: string; warehouse_name: string; warehouse_code: string }
interface Item { id: string; item_code: string; description: string; unit_of_measure: string }
interface TransferLine { item_id: string; qty: number }

export default function StockTransferPage() {
  const supabase = createClient()
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ from_warehouse_id: '', to_warehouse_id: '', remarks: '' })
  const [lines, setLines] = useState<TransferLine[]>([{ item_id: '', qty: 1 }])

  async function load() {
    setLoading(true)
    const [t, w, i] = await Promise.all([
      supabase.from('stock_transfers')
        .select('*, from_warehouse:warehouses!from_warehouse_id(warehouse_name), to_warehouse:warehouses!to_warehouse_id(warehouse_name)')
        .order('created_at', { ascending: false }),
      supabase.from('warehouses').select('id, warehouse_name, warehouse_code').eq('status', 'active'),
      supabase.from('items').select('id, item_code, description, unit_of_measure').eq('is_active', true).order('item_code'),
    ])
    setTransfers(t.data ?? [])
    setWarehouses(w.data ?? [])
    setItems(i.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function addLine() { setLines(l => [...l, { item_id: '', qty: 1 }]) }
  function removeLine(i: number) { setLines(l => l.filter((_, idx) => idx !== i)) }
  function updateLine(i: number, field: keyof TransferLine, value: string | number) {
    setLines(l => l.map((line, idx) => idx === i ? { ...line, [field]: value } : line))
  }

  async function save() {
    if (!form.from_warehouse_id || !form.to_warehouse_id) { toast.error('Select both warehouses'); return }
    if (form.from_warehouse_id === form.to_warehouse_id) { toast.error('Warehouses must be different'); return }
    if (lines.some(l => !l.item_id || l.qty <= 0)) { toast.error('Fill all line items'); return }
    setSaving(true)
    const today = new Date().toISOString().split('T')[0]
    const { data: transfer, error } = await supabase
      .from('stock_transfers')
      .insert({
        from_warehouse_id: form.from_warehouse_id,
        to_warehouse_id: form.to_warehouse_id,
        remarks: form.remarks || null,
        status: 'pending',
        transfer_date: today,
      })
      .select('id').single()
    if (error) { toast.error(error.message); setSaving(false); return }
    const linePayload = lines.map(l => ({ transfer_id: transfer.id, item_id: l.item_id, quantity: l.qty }))
    const { error: le } = await supabase.from('stock_transfer_items').insert(linePayload)
    if (le) { toast.error(le.message) } else {
      toast.success('Stock transfer created')
      setOpen(false)
      setForm({ from_warehouse_id: '', to_warehouse_id: '', remarks: '' })
      setLines([{ item_id: '', qty: 1 }])
      load()
    }
    setSaving(false)
  }

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Stock Transfer</h1>
          <p className="text-muted-foreground text-sm">Transfer inventory between warehouses</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-2" /> New Transfer
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transfer #</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : transfers.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No transfers yet</TableCell></TableRow>
            ) : transfers.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-sm">{t.transfer_number}</TableCell>
                <TableCell>{(t.from_warehouse as any)?.warehouse_name ?? '—'}</TableCell>
                <TableCell>{(t.to_warehouse as any)?.warehouse_name ?? '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {t.transfer_date ? format(new Date(t.transfer_date), 'MMM d, yyyy') : format(new Date(t.created_at), 'MMM d, yyyy')}
                </TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${statusColor[t.status] ?? 'bg-gray-100 text-gray-800'}`}>
                    {t.status}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-red-600" /> New Stock Transfer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>From Warehouse <span className="text-destructive">*</span></Label>
                <Select value={form.from_warehouse_id} onValueChange={v => setForm(f => ({ ...f, from_warehouse_id: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                  <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.warehouse_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>To Warehouse <span className="text-destructive">*</span></Label>
                <Select value={form.to_warehouse_id} onValueChange={v => setForm(f => ({ ...f, to_warehouse_id: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                  <SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={w.id}>{w.warehouse_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}><Plus className="h-3.5 w-3.5 mr-1" />Add Item</Button>
              </div>
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-[1fr_100px_32px] gap-2 items-center">
                  <Select value={line.item_id} onValueChange={v => updateLine(i, 'item_id', v ?? '')}>
                    <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                    <SelectContent>{items.map(item => <SelectItem key={item.id} value={item.id}>{item.item_code} — {item.description}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" min={1} value={line.qty} onChange={e => updateLine(i, 'qty', Number(e.target.value))} placeholder="Qty" />
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeLine(i)}>✕</Button>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label>Remarks</Label>
              <Textarea placeholder="Optional remarks" value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? 'Saving…' : 'Create Transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
