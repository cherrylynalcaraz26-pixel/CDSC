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
import { Plus, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface Return {
  id: string
  return_number: string
  supplier_id: string
  reason: string | null
  status: string
  return_date: string | null
  created_at: string
  supplier?: { company_name: string }
}

interface Supplier { id: string; company_name: string }
interface Item { id: string; item_code: string; description: string; unit_of_measure: string }
interface ReturnLine { item_id: string; qty: number; unit_cost: number; item_name: string }

export default function ReturnsPage() {
  const supabase = createClient()
  const [returns, setReturns] = useState<Return[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ supplier_id: '', reason: '' })
  const [lines, setLines] = useState<ReturnLine[]>([{ item_id: '', qty: 1, unit_cost: 0, item_name: '' }])

  async function load() {
    setLoading(true)
    const [r, s, i] = await Promise.all([
      supabase.from('supplier_returns').select('*, supplier:suppliers(company_name)').order('created_at', { ascending: false }),
      supabase.from('suppliers').select('id, company_name').eq('is_active', true).order('company_name'),
      supabase.from('items').select('id, item_code, description, unit_of_measure').eq('is_active', true).order('item_code'),
    ])
    setReturns(r.data ?? [])
    setSuppliers(s.data ?? [])
    setItems(i.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function addLine() { setLines(l => [...l, { item_id: '', qty: 1, unit_cost: 0, item_name: '' }]) }
  function removeLine(i: number) { setLines(l => l.filter((_, idx) => idx !== i)) }
  function updateLine(i: number, field: keyof ReturnLine, value: string | number) {
    const updated = [...lines]
    if (field === 'item_id') {
      const found = items.find(it => it.id === value)
      updated[i] = { ...updated[i], item_id: String(value), item_name: found ? `${found.item_code} — ${found.description}` : '' }
    } else {
      updated[i] = { ...updated[i], [field]: value }
    }
    setLines(updated)
  }

  async function save() {
    if (!form.supplier_id) { toast.error('Select a supplier'); return }
    if (lines.some(l => !l.item_id || l.qty <= 0)) { toast.error('Fill all line items'); return }
    setSaving(true)
    const today = new Date().toISOString().split('T')[0]
    const { data: ret, error } = await supabase
      .from('supplier_returns')
      .insert({ supplier_id: form.supplier_id, reason: form.reason || null, status: 'draft', return_date: today })
      .select('id').single()
    if (error) { toast.error(error.message); setSaving(false); return }
    const linePayload = lines.map(l => ({
      return_id: ret.id,
      item_id: l.item_id,
      item_name: l.item_name,
      quantity: l.qty,
      unit_cost: l.unit_cost,
    }))
    const { error: le } = await supabase.from('return_items').insert(linePayload)
    if (le) { toast.error(le.message) } else {
      toast.success('Return created')
      setOpen(false)
      setForm({ supplier_id: '', reason: '' })
      setLines([{ item_id: '', qty: 1, unit_cost: 0, item_name: '' }])
      load()
    }
    setSaving(false)
  }

  const statusColor: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Returns to Supplier</h1>
          <p className="text-muted-foreground text-sm">Manage items returned to suppliers</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-2" /> New Return
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Return #</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : returns.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No returns yet</TableCell></TableRow>
            ) : returns.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-sm">{r.return_number}</TableCell>
                <TableCell>{(r.supplier as any)?.company_name ?? '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.reason ?? '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.return_date ? format(new Date(r.return_date), 'MMM d, yyyy') : format(new Date(r.created_at), 'MMM d, yyyy')}
                </TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${statusColor[r.status] ?? 'bg-gray-100 text-gray-800'}`}>
                    {r.status}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-red-600" /> New Return to Supplier
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Supplier <span className="text-destructive">*</span></Label>
                <Select value={form.supplier_id} onValueChange={v => setForm(f => ({ ...f, supplier_id: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Reason for Return</Label>
                <Input placeholder="e.g. Defective, Wrong item, Overage" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Items to Return</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}><Plus className="h-3.5 w-3.5 mr-1" />Add Item</Button>
              </div>
              <div className="grid grid-cols-[1fr_80px_100px_32px] gap-2 text-xs text-muted-foreground px-1">
                <span>Item</span><span>Qty</span><span>Unit Cost</span><span />
              </div>
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_100px_32px] gap-2 items-center">
                  <Select value={line.item_id} onValueChange={v => updateLine(i, 'item_id', v ?? '')}>
                    <SelectTrigger><SelectValue placeholder="Item" /></SelectTrigger>
                    <SelectContent>{items.map(item => <SelectItem key={item.id} value={item.id}>{item.item_code} — {item.description}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" min={1} value={line.qty || ''} onChange={e => updateLine(i, 'qty', Number(e.target.value))} placeholder="Qty" />
                  <Input type="number" min={0} step="0.01" value={line.unit_cost || ''} onChange={e => updateLine(i, 'unit_cost', Number(e.target.value))} placeholder="Cost" />
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeLine(i)}>✕</Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? 'Saving…' : 'Create Return'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
