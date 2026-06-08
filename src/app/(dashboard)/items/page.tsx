'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Search, MoreHorizontal, Package } from 'lucide-react'
import { toast } from 'sonner'

interface Item {
  id: string
  item_code: string
  description: string
  category_id: string | null
  unit_of_measure: string
  unit_cost: number
  reorder_point: number | null
  is_active: boolean
  category?: { name: string } | null
  stock_levels?: { quantity_on_hand: number }[]
}

interface Category { id: string; name: string }

const emptyForm = () => ({
  item_code: '', description: '', category_id: '', unit_of_measure: 'PCS',
  unit_cost: '', reorder_point: '10',
})

const UOM_OPTIONS = ['PCS', 'BOX', 'SET', 'UNIT', 'KG', 'LTR', 'MTR', 'ROLL', 'PACK', 'REAM', 'PAIR', 'DOZEN']

export default function ItemsPage() {
  const supabase = createClient()
  const [items, setItems] = useState<Item[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [{ data: itemData }, { data: catData }] = await Promise.all([
      supabase.from('items').select('*, category:categories(name), stock_levels(quantity_on_hand)').order('item_code'),
      supabase.from('categories').select('id, name').order('name'),
    ])
    setItems(itemData ?? [])
    setCategories(catData ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() =>
    items.filter(i =>
      i.item_code.toLowerCase().includes(search.toLowerCase()) ||
      i.description.toLowerCase().includes(search.toLowerCase())
    ), [items, search])

  function openAdd() {
    setEditing(null)
    setForm(emptyForm())
    setOpen(true)
  }

  function openEdit(item: Item) {
    setEditing(item)
    setForm({
      item_code: item.item_code,
      description: item.description,
      category_id: item.category_id ?? '',
      unit_of_measure: item.unit_of_measure,
      unit_cost: String(item.unit_cost),
      reorder_point: String(item.reorder_point ?? 10),
    })
    setOpen(true)
  }

  async function save() {
    if (!form.item_code.trim() || !form.description.trim()) {
      toast.error('Item code and description are required')
      return
    }
    setSaving(true)
    const payload = {
      item_code: form.item_code.trim().toUpperCase(),
      description: form.description.trim(),
      category_id: form.category_id || null,
      unit_of_measure: form.unit_of_measure,
      unit_cost: Number(form.unit_cost) || 0,
      reorder_point: Number(form.reorder_point) || null,
    }
    const { error } = editing
      ? await supabase.from('items').update(payload).eq('id', editing.id)
      : await supabase.from('items').insert(payload)
    if (error) { toast.error(error.message) } else {
      toast.success(editing ? 'Item updated' : 'Item added')
      setOpen(false)
      load()
    }
    setSaving(false)
  }

  async function toggleActive(item: Item) {
    const { error } = await supabase.from('items').update({ is_active: !item.is_active }).eq('id', item.id)
    if (error) toast.error(error.message)
    else { toast.success(item.is_active ? 'Item deactivated' : 'Item activated'); load() }
  }

  async function confirmDelete() {
    if (!deleteId) return
    const { error } = await supabase.from('items').delete().eq('id', deleteId)
    if (error) toast.error(error.message)
    else { toast.success('Item deleted'); load() }
    setDeleteId(null)
  }

  function stockStatus(item: Item) {
    const qty = item.stock_levels?.[0]?.quantity_on_hand ?? 0
    const reorder = item.reorder_point ?? 0
    if (qty === 0) return { label: 'Out of Stock', cls: 'bg-red-100 text-red-800' }
    if (qty <= reorder) return { label: 'Low Stock', cls: 'bg-yellow-100 text-yellow-800' }
    return { label: 'In Stock', cls: 'bg-green-100 text-green-800' }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Item Master</h1>
          <p className="text-muted-foreground text-sm">{items.filter(i => i.is_active).length} active items</p>
        </div>
        <Button onClick={openAdd} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="h-4 w-4 mr-2" /> Add Item
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>UOM</TableHead>
              <TableHead className="text-right">Unit Cost</TableHead>
              <TableHead className="text-right">On Hand</TableHead>
              <TableHead>Stock Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No items found</TableCell></TableRow>
            ) : filtered.map(item => {
              const stock = stockStatus(item)
              const qty = item.stock_levels?.[0]?.quantity_on_hand ?? 0
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-sm font-medium">{item.item_code}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.category?.name ?? '—'}</TableCell>
                  <TableCell className="text-sm">{item.unit_of_measure}</TableCell>
                  <TableCell className="text-right font-medium">
                    ₱{item.unit_cost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-medium">{qty.toLocaleString()}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${stock.cls}`}>{stock.label}</span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(item)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(item)}>
                          {item.is_active ? 'Deactivate' : 'Activate'}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(item.id)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-500" />
              {editing ? 'Edit Item' : 'Add Item'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Item Code <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. BOLT-M10" value={form.item_code} onChange={e => setForm(p => ({ ...p, item_code: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Unit of Measure</Label>
              <Select value={form.unit_of_measure} onValueChange={v => setForm(p => ({ ...p, unit_of_measure: v ?? 'PCS' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UOM_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Description <span className="text-destructive">*</span></Label>
              <Input placeholder="Item description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category_id} onValueChange={v => setForm(p => ({ ...p, category_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Unit Cost (₱)</Label>
              <Input type="number" min={0} step="0.01" placeholder="0.00" value={form.unit_cost} onChange={e => setForm(p => ({ ...p, unit_cost: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Reorder Point</Label>
              <Input type="number" min={0} value={form.reorder_point} onChange={e => setForm(p => ({ ...p, reorder_point: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
              {saving ? 'Saving…' : 'Save Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Item?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete this item.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
