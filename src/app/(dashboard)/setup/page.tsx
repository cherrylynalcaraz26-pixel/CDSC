'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Pencil, Trash2, X, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'

/* ─── UOM ─────────────────────────────────────────────── */
interface UOM { id: string; code: string; name: string; description: string | null; is_active: boolean }

function UOMTab() {
  const supabase = createClient()
  const [rows, setRows] = useState<UOM[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<UOM | null>(null)
  const [form, setForm] = useState({ code: '', name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('uom_list').select('*').order('code')
    setRows(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openAdd() { setEditing(null); setForm({ code: '', name: '', description: '' }); setOpen(true) }
  function openEdit(r: UOM) { setEditing(r); setForm({ code: r.code, name: r.name, description: r.description ?? '' }); setOpen(true) }

  async function save() {
    if (!form.code.trim() || !form.name.trim()) { toast.error('Code and name required'); return }
    setSaving(true)
    const payload = { code: form.code.trim().toUpperCase(), name: form.name.trim(), description: form.description || null }
    const { error } = editing
      ? await supabase.from('uom_list').update(payload).eq('id', editing.id)
      : await supabase.from('uom_list').insert(payload)
    if (error) toast.error(error.message)
    else { toast.success(editing ? 'UOM updated' : 'UOM added'); setOpen(false); load() }
    setSaving(false)
  }

  async function toggleActive(r: UOM) {
    await supabase.from('uom_list').update({ is_active: !r.is_active }).eq('id', r.id)
    load()
  }

  async function del() {
    if (!deleteId) return
    const { error } = await supabase.from('uom_list').delete().eq('id', deleteId)
    if (error) toast.error(error.message)
    else { toast.success('Deleted'); load() }
    setDeleteId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openAdd} size="sm" className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-1" /> Add UOM
        </Button>
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-mono font-medium">{r.code}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.description ?? '—'}</TableCell>
                <TableCell>
                  <button onClick={() => toggleActive(r)}>
                    <Badge className={r.is_active ? 'bg-green-100 text-green-800 cursor-pointer' : 'bg-gray-100 text-gray-600 cursor-pointer'}>
                      {r.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit UOM' : 'Add UOM'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Code <span className="text-destructive">*</span></Label>
                <Input placeholder="e.g. PCS" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Name <span className="text-destructive">*</span></Label>
                <Input placeholder="e.g. Pieces" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input placeholder="Optional" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete UOM?</DialogTitle></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={del}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ─── Brands ──────────────────────────────────────────── */
interface Brand { id: string; name: string; description: string | null; is_active: boolean }

function BrandsTab() {
  const supabase = createClient()
  const [rows, setRows] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Brand | null>(null)
  const [form, setForm] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('brands').select('*').order('name')
    setRows(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openAdd() { setEditing(null); setForm({ name: '', description: '' }); setOpen(true) }
  function openEdit(r: Brand) { setEditing(r); setForm({ name: r.name, description: r.description ?? '' }); setOpen(true) }

  async function save() {
    if (!form.name.trim()) { toast.error('Name required'); return }
    setSaving(true)
    const payload = { name: form.name.trim(), description: form.description || null }
    const { error } = editing
      ? await supabase.from('brands').update(payload).eq('id', editing.id)
      : await supabase.from('brands').insert(payload)
    if (error) toast.error(error.message)
    else { toast.success(editing ? 'Brand updated' : 'Brand added'); setOpen(false); load() }
    setSaving(false)
  }

  async function toggleActive(r: Brand) {
    await supabase.from('brands').update({ is_active: !r.is_active }).eq('id', r.id)
    load()
  }

  async function del() {
    if (!deleteId) return
    const { error } = await supabase.from('brands').delete().eq('id', deleteId)
    if (error) toast.error(error.message)
    else { toast.success('Deleted'); load() }
    setDeleteId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openAdd} size="sm" className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-1" /> Add Brand
        </Button>
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Brand Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No brands yet</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.description ?? '—'}</TableCell>
                <TableCell>
                  <button onClick={() => toggleActive(r)}>
                    <Badge className={r.is_active ? 'bg-green-100 text-green-800 cursor-pointer' : 'bg-gray-100 text-gray-600 cursor-pointer'}>
                      {r.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Brand' : 'Add Brand'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Brand Name <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. Samsung" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={2} placeholder="Optional" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Brand?</DialogTitle></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={del}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ─── Attributes ──────────────────────────────────────── */
interface Attribute { id: string; name: string; data_type: string; options: string[] | null; is_active: boolean }

function AttributesTab() {
  const supabase = createClient()
  const [rows, setRows] = useState<Attribute[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Attribute | null>(null)
  const [form, setForm] = useState({ name: '', data_type: 'text' })
  const [optionInput, setOptionInput] = useState('')
  const [options, setOptions] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('attributes').select('*').order('name')
    setRows(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openAdd() {
    setEditing(null)
    setForm({ name: '', data_type: 'text' })
    setOptions([])
    setOptionInput('')
    setOpen(true)
  }

  function openEdit(r: Attribute) {
    setEditing(r)
    setForm({ name: r.name, data_type: r.data_type })
    setOptions(r.options ?? [])
    setOptionInput('')
    setOpen(true)
  }

  function addOption() {
    const v = optionInput.trim()
    if (!v || options.includes(v)) return
    setOptions(o => [...o, v])
    setOptionInput('')
  }

  function removeOption(opt: string) {
    setOptions(o => o.filter(x => x !== opt))
  }

  async function save() {
    if (!form.name.trim()) { toast.error('Name required'); return }
    if (form.data_type === 'select' && options.length === 0) { toast.error('Add at least one option'); return }
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      data_type: form.data_type,
      options: form.data_type === 'select' ? options : null,
    }
    const { error } = editing
      ? await supabase.from('attributes').update(payload).eq('id', editing.id)
      : await supabase.from('attributes').insert(payload)
    if (error) toast.error(error.message)
    else { toast.success(editing ? 'Attribute updated' : 'Attribute added'); setOpen(false); load() }
    setSaving(false)
  }

  async function toggleActive(r: Attribute) {
    await supabase.from('attributes').update({ is_active: !r.is_active }).eq('id', r.id)
    load()
  }

  async function del() {
    if (!deleteId) return
    const { error } = await supabase.from('attributes').delete().eq('id', deleteId)
    if (error) toast.error(error.message)
    else { toast.success('Deleted'); load() }
    setDeleteId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openAdd} size="sm" className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-1" /> Add Attribute
        </Button>
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Attribute Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Options</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No attributes yet</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs capitalize">{r.data_type}</Badge>
                </TableCell>
                <TableCell>
                  {r.options?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {r.options.map(o => <span key={o} className="text-xs bg-muted px-1.5 py-0.5 rounded">{o}</span>)}
                    </div>
                  ) : '—'}
                </TableCell>
                <TableCell>
                  <button onClick={() => toggleActive(r)}>
                    <Badge className={r.is_active ? 'bg-green-100 text-green-800 cursor-pointer' : 'bg-gray-100 text-gray-600 cursor-pointer'}>
                      {r.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Attribute' : 'Add Attribute'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Attribute Name <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. Color, Size, Voltage" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Data Type</Label>
              <Select value={form.data_type} onValueChange={v => setForm(p => ({ ...p, data_type: v ?? 'text' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text (free input)</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="select">Select (dropdown)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.data_type === 'select' && (
              <div className="space-y-2">
                <Label>Options <span className="text-destructive">*</span></Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add option…"
                    value={optionInput}
                    onChange={e => setOptionInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addOption()}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addOption}>Add</Button>
                </div>
                {options.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {options.map(opt => (
                      <span key={opt} className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full">
                        {opt}
                        <button onClick={() => removeOption(opt)} className="text-muted-foreground hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Attribute?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will remove the attribute from all items.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={del}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ─── Categories ──────────────────────────────────────── */
interface Category { id: string; category_code: string | null; category_name: string; status: string }

function CategoriesTab() {
  const supabase = createClient()
  const [rows, setRows] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState({ category_name: '', category_code: '' })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('categories').select('*').order('category_name')
    setRows(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openAdd() { setEditing(null); setForm({ category_name: '', category_code: '' }); setOpen(true) }
  function openEdit(r: Category) { setEditing(r); setForm({ category_name: r.category_name, category_code: r.category_code ?? '' }); setOpen(true) }

  async function save() {
    if (!form.category_name.trim()) { toast.error('Name required'); return }
    setSaving(true)
    const payload = { category_name: form.category_name.trim(), category_code: form.category_code || null }
    const { error } = editing
      ? await supabase.from('categories').update(payload).eq('id', editing.id)
      : await supabase.from('categories').insert({ ...payload, status: 'active' })
    if (error) toast.error(error.message)
    else { toast.success(editing ? 'Category updated' : 'Category added'); setOpen(false); load() }
    setSaving(false)
  }

  async function toggleStatus(r: Category) {
    const newStatus = r.status === 'active' ? 'inactive' : 'active'
    await supabase.from('categories').update({ status: newStatus }).eq('id', r.id)
    load()
  }

  async function del() {
    if (!deleteId) return
    const { error } = await supabase.from('categories').delete().eq('id', deleteId)
    if (error) toast.error(error.message)
    else { toast.success('Deleted'); load() }
    setDeleteId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openAdd} size="sm" className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-1" /> Add Category
        </Button>
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No categories yet</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-sm">{r.category_code ?? '—'}</TableCell>
                <TableCell className="font-medium">{r.category_name}</TableCell>
                <TableCell>
                  <button onClick={() => toggleStatus(r)}>
                    <Badge className={r.status === 'active' ? 'bg-green-100 text-green-800 cursor-pointer' : 'bg-gray-100 text-gray-600 cursor-pointer'}>
                      {r.status}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Category' : 'Add Category'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Code</Label>
                <Input placeholder="e.g. ELEC" value={form.category_code} onChange={e => setForm(p => ({ ...p, category_code: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Name <span className="text-destructive">*</span></Label>
                <Input placeholder="e.g. Electronics" value={form.category_name} onChange={e => setForm(p => ({ ...p, category_name: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Category?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Items in this category will become uncategorized.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={del}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ─── Supplier Categories (dropdown options) ──────────── */
const SUPPLIER_CATEGORIES = [
  'Electrical Supplies', 'Plumbing Supplies', 'Hardware & Fasteners',
  'Safety Equipment', 'Office Supplies', 'Construction Materials',
  'Industrial Equipment', 'Tools & Machinery', 'Chemical Supplies',
  'Consumables', 'Packaging Materials', 'IT & Electronics',
  'Janitorial Supplies', 'General Merchandise',
]

/* ─── Suppliers ───────────────────────────────────────── */
interface Supplier {
  id: string; supplier_code: string; company_name: string
  contact_person: string | null; mobile_number: string | null; email: string | null
  address: string | null; tin: string | null; vat_registered: boolean
  vat_classification: string | null; supplier_category: string | null
  payment_terms: string | null; lead_time_days: number | null
  atc_code: string | null; ewt_rate: number | null; is_active: boolean
}
const emptySupplierForm = () => ({
  company_name: '', contact_person: '', mobile_number: '', email: '',
  address: '', tin: '', vat_registered: 'true', supplier_category: '',
  payment_terms: '30 days', lead_time_days: '7', atc_code: '', ewt_rate: '2',
  vat_classification: 'vatable',
})

function SuppliersTab() {
  const supabase = createClient()
  const [rows, setRows] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState(emptySupplierForm())
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('suppliers').select('*').order('company_name')
    setRows(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = rows.filter(s =>
    s.company_name.toLowerCase().includes(search.toLowerCase()) ||
    (s.supplier_code ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function openAdd() { setEditing(null); setForm(emptySupplierForm()); setOpen(true) }
  function openEdit(s: Supplier) {
    setEditing(s)
    setForm({
      company_name: s.company_name, contact_person: s.contact_person ?? '',
      mobile_number: s.mobile_number ?? '', email: s.email ?? '',
      address: s.address ?? '', tin: s.tin ?? '',
      vat_registered: s.vat_registered ? 'true' : 'false',
      supplier_category: s.supplier_category ?? '',
      payment_terms: s.payment_terms ?? '30 days',
      lead_time_days: String(s.lead_time_days ?? 7),
      atc_code: s.atc_code ?? '', ewt_rate: String(s.ewt_rate ?? 2),
      vat_classification: s.vat_classification ?? 'vatable',
    })
    setOpen(true)
  }

  const sf = (field: string) => (v: string | null) => setForm(p => ({ ...p, [field]: v ?? p[field as keyof typeof p] }))

  async function save() {
    if (!form.company_name.trim()) { toast.error('Company name required'); return }
    setSaving(true)
    const payload = {
      company_name: form.company_name.trim(),
      contact_person: form.contact_person || null,
      mobile_number: form.mobile_number || null,
      email: form.email || null,
      address: form.address || null,
      tin: form.tin || null,
      vat_registered: form.vat_registered === 'true',
      vat_classification: form.vat_classification || null,
      supplier_category: form.supplier_category || null,
      payment_terms: form.payment_terms || null,
      lead_time_days: Number(form.lead_time_days) || null,
      atc_code: form.atc_code || null,
      ewt_rate: Number(form.ewt_rate) || null,
    }
    const { error } = editing
      ? await supabase.from('suppliers').update(payload).eq('id', editing.id)
      : await supabase.from('suppliers').insert(payload)
    if (error) toast.error(error.message)
    else { toast.success(editing ? 'Supplier updated' : 'Supplier added'); setOpen(false); load() }
    setSaving(false)
  }

  async function toggleActive(s: Supplier) {
    await supabase.from('suppliers').update({ is_active: !s.is_active }).eq('id', s.id)
    load()
  }

  async function del() {
    if (!deleteId) return
    const { error } = await supabase.from('suppliers').delete().eq('id', deleteId)
    if (error) toast.error(error.message)
    else { toast.success('Deleted'); load() }
    setDeleteId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Input placeholder="Search suppliers…" value={search} onChange={e => setSearch(e.target.value)} className="pl-3" />
        </div>
        <Button onClick={openAdd} size="sm" className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-1" />Add Supplier
        </Button>
      </div>
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>TIN</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No suppliers found</TableCell></TableRow>
            ) : filtered.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-sm">{s.supplier_code}</TableCell>
                <TableCell>
                  <div className="font-medium text-sm">{s.company_name}</div>
                  {s.email && <div className="text-xs text-muted-foreground">{s.email}</div>}
                </TableCell>
                <TableCell className="text-sm">{s.contact_person ?? '—'}</TableCell>
                <TableCell className="font-mono text-sm">{s.tin ?? '—'}</TableCell>
                <TableCell className="text-sm">{s.supplier_category ?? '—'}</TableCell>
                <TableCell>
                  <button onClick={() => toggleActive(s)}>
                    <Badge className={s.is_active ? 'bg-green-100 text-green-800 cursor-pointer' : 'bg-gray-100 text-gray-600 cursor-pointer'}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Company Name <span className="text-destructive">*</span></Label>
              <Input value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5"><Label>Contact Person</Label>
              <Input value={form.contact_person} onChange={e => setForm(p => ({ ...p, contact_person: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Mobile Number</Label>
              <Input value={form.mobile_number} onChange={e => setForm(p => ({ ...p, mobile_number: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>TIN</Label>
              <Input placeholder="000-000-000-000" value={form.tin} onChange={e => setForm(p => ({ ...p, tin: e.target.value }))} /></div>
            <div className="col-span-2 space-y-1.5"><Label>Address</Label>
              <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.supplier_category} onValueChange={sf('supplier_category')}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— None —</SelectItem>
                  {SUPPLIER_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>VAT Status</Label>
              <Select value={form.vat_registered} onValueChange={sf('vat_registered')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">VAT Registered</SelectItem>
                  <SelectItem value="false">Non-VAT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>VAT Classification</Label>
              <Select value={form.vat_classification} onValueChange={sf('vat_classification')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vatable">VATable (12%)</SelectItem>
                  <SelectItem value="vat_exempt">VAT Exempt</SelectItem>
                  <SelectItem value="zero_rated">Zero-Rated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Terms</Label>
              <Select value={form.payment_terms} onValueChange={sf('payment_terms')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['COD','7 days','15 days','30 days','45 days','60 days'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>ATC Code (BIR)</Label>
              <Select value={form.atc_code} onValueChange={sf('atc_code')}>
                <SelectTrigger><SelectValue placeholder="Select ATC" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WI010">WI010 – Goods (2%)</SelectItem>
                  <SelectItem value="WI020">WI020 – Services (2%)</SelectItem>
                  <SelectItem value="WI030">WI030 – Rent (5%)</SelectItem>
                  <SelectItem value="WC160">WC160 – Professional (10%)</SelectItem>
                  <SelectItem value="WC158">WC158 – Professional (15%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>EWT Rate (%)</Label>
              <Select value={form.ewt_rate} onValueChange={sf('ewt_rate')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['1','2','5','10','15'].map(r => <SelectItem key={r} value={r}>{r}%</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Lead Time (days)</Label>
              <Input type="number" min={0} value={form.lead_time_days} onChange={e => setForm(p => ({ ...p, lead_time_days: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? 'Saving…' : 'Save Supplier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Supplier?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete this supplier.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={del}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ─── Clients ─────────────────────────────────────────── */
interface Client {
  id: string; client_code: string | null; company_name: string
  contact_person: string | null; mobile_number: string | null; email: string | null
  address: string | null; tin: string | null; client_type: string
  credit_limit: number | null; payment_terms: string | null
  discount_rate: number | null; status: string
}
const emptyClientForm = () => ({
  company_name: '', contact_person: '', mobile_number: '', email: '',
  address: '', tin: '', client_type: 'corporate',
  credit_limit: '0', payment_terms: '30 days',
})

function ClientsTab() {
  const supabase = createClient()
  const [rows, setRows] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState(emptyClientForm())
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('clients').select('*').order('company_name')
    setRows(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = rows.filter(c =>
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.client_code ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function openAdd() { setEditing(null); setForm(emptyClientForm()); setOpen(true) }
  function openEdit(c: Client) {
    setEditing(c)
    setForm({
      company_name: c.company_name, contact_person: c.contact_person ?? '',
      mobile_number: c.mobile_number ?? '', email: c.email ?? '',
      address: c.address ?? '', tin: c.tin ?? '',
      client_type: c.client_type ?? 'corporate',
      credit_limit: String(c.credit_limit ?? 0),
      payment_terms: c.payment_terms ?? '30 days',
    })
    setOpen(true)
  }

  const cf = (field: string) => (v: string | null) => setForm(p => ({ ...p, [field]: v ?? p[field as keyof typeof p] }))

  async function save() {
    if (!form.company_name.trim()) { toast.error('Company name required'); return }
    setSaving(true)
    const payload = {
      company_name: form.company_name.trim(),
      contact_person: form.contact_person || null,
      mobile_number: form.mobile_number || null,
      email: form.email || null,
      address: form.address || null,
      tin: form.tin || null,
      client_type: form.client_type,
      credit_limit: Number(form.credit_limit) || 0,
      payment_terms: form.payment_terms || null,
    }
    const { error } = editing
      ? await supabase.from('clients').update(payload).eq('id', editing.id)
      : await supabase.from('clients').insert(payload)
    if (error) toast.error(error.message)
    else { toast.success(editing ? 'Client updated' : 'Client added'); setOpen(false); load() }
    setSaving(false)
  }

  async function toggleStatus(c: Client) {
    const newStatus = c.status === 'active' ? 'inactive' : 'active'
    await supabase.from('clients').update({ status: newStatus }).eq('id', c.id)
    load()
  }

  async function del() {
    if (!deleteId) return
    const { error } = await supabase.from('clients').delete().eq('id', deleteId)
    if (error) toast.error(error.message)
    else { toast.success('Deleted'); load() }
    setDeleteId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input placeholder="Search clients…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
        <Button onClick={openAdd} size="sm" className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-1" />Add Client
        </Button>
      </div>
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Credit Limit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">No clients yet</TableCell></TableRow>
            ) : filtered.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-sm">{c.client_code ?? '—'}</TableCell>
                <TableCell>
                  <div className="font-medium text-sm">{c.company_name}</div>
                  {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                </TableCell>
                <TableCell className="text-sm">{c.contact_person ?? '—'}</TableCell>
                <TableCell>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize">{c.client_type}</span>
                </TableCell>
                <TableCell className="text-sm">₱{(c.credit_limit ?? 0).toLocaleString('en-PH')}</TableCell>
                <TableCell>
                  <button onClick={() => toggleStatus(c)}>
                    <Badge className={c.status === 'active' ? 'bg-green-100 text-green-800 cursor-pointer' : 'bg-gray-100 text-gray-600 cursor-pointer'}>
                      {c.status}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Client' : 'Add Client'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Company Name <span className="text-destructive">*</span></Label>
              <Input value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5"><Label>Contact Person</Label>
              <Input value={form.contact_person} onChange={e => setForm(p => ({ ...p, contact_person: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Mobile</Label>
              <Input value={form.mobile_number} onChange={e => setForm(p => ({ ...p, mobile_number: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>TIN</Label>
              <Input placeholder="000-000-000-000" value={form.tin} onChange={e => setForm(p => ({ ...p, tin: e.target.value }))} /></div>
            <div className="col-span-2 space-y-1.5"><Label>Address</Label>
              <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Client Type</Label>
              <Select value={form.client_type} onValueChange={cf('client_type')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="corporate">Corporate</SelectItem>
                  <SelectItem value="government">Government</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="walk_in">Walk-in</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Terms</Label>
              <Select value={form.payment_terms} onValueChange={cf('payment_terms')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['COD','7 days','15 days','30 days','45 days','60 days'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Credit Limit (₱)</Label>
              <Input type="number" min={0} value={form.credit_limit} onChange={e => setForm(p => ({ ...p, credit_limit: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? 'Saving…' : 'Save Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Client?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete this client.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={del}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ─── Item List Tab ───────────────────────────────────── */
interface ItemRow {
  id: string; item_code: string; item_name: string
  brand: string | null; unit_of_measure: string; cost: number
  selling_price: number | null; attribute: string | null; status: string
}
interface UOMOption { id: string; code: string; name: string }
interface BrandOption { id: string; name: string }
interface AttributeOption { id: string; name: string }

function ItemListTab() {
  const supabase = createClient()
  const [rows, setRows] = useState<ItemRow[]>([])
  const [uomList, setUomList] = useState<UOMOption[]>([])
  const [brandList, setBrandList] = useState<BrandOption[]>([])
  const [attributeList, setAttributeList] = useState<AttributeOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ItemRow | null>(null)
  const [form, setForm] = useState({ item_code: '', item_name: '', brand: '', unit_of_measure: '', cost: '', selling_price: '', attribute: '' })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [{ data: itemData }, { data: uomData }, { data: brandData }, { data: attrData }] = await Promise.all([
      supabase.from('items').select('id, item_code, item_name, brand, unit_of_measure, cost, selling_price, attribute, status').order('item_name'),
      supabase.from('uom_list').select('id, code, name').eq('is_active', true).order('code'),
      supabase.from('brands').select('id, name').eq('is_active', true).order('name'),
      supabase.from('attributes').select('id, name').eq('is_active', true).order('name'),
    ])
    setRows(itemData ?? [])
    setUomList(uomData ?? [])
    setBrandList(brandData ?? [])
    setAttributeList(attrData ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = rows.filter(r =>
    r.item_name.toLowerCase().includes(search.toLowerCase()) ||
    r.item_code.toLowerCase().includes(search.toLowerCase()) ||
    (r.brand ?? '').toLowerCase().includes(search.toLowerCase())
  )

  async function openAdd() {
    setEditing(null)
    // Auto-generate next item code
    const { data: last } = await supabase
      .from('items')
      .select('item_code')
      .like('item_code', 'ITM-%')
      .order('item_code', { ascending: false })
      .limit(1)
      .single()
    let nextCode = 'ITM-001'
    if (last?.item_code) {
      const num = parseInt(last.item_code.replace('ITM-', ''), 10)
      if (!isNaN(num)) nextCode = 'ITM-' + String(num + 1).padStart(3, '0')
    }
    setForm({ item_code: nextCode, item_name: '', brand: '', unit_of_measure: '', cost: '', selling_price: '', attribute: '' })
    setOpen(true)
  }
  function openEdit(r: ItemRow) {
    setEditing(r)
    setForm({ item_code: r.item_code, item_name: r.item_name, brand: r.brand ?? '', unit_of_measure: r.unit_of_measure, cost: String(r.cost), selling_price: r.selling_price !== null ? String(r.selling_price) : '', attribute: r.attribute ?? '' })
    setOpen(true)
  }

  async function save() {
    if (!form.item_name.trim()) { toast.error('Item name required'); return }
    setSaving(true)
    const payload = {
      item_code: form.item_code.trim() || undefined,
      item_name: form.item_name.trim(),
      brand: form.brand.trim() || null,
      unit_of_measure: form.unit_of_measure.trim(),
      cost: parseFloat(form.cost) || 0,
      selling_price: form.selling_price.trim() ? parseFloat(form.selling_price) : null,
      attribute: form.attribute.trim() || null,
    }
    const { error } = editing
      ? await supabase.from('items').update(payload).eq('id', editing.id)
      : await supabase.from('items').insert({ ...payload, status: 'active' })
    if (error) toast.error(error.message)
    else { toast.success(editing ? 'Item updated' : 'Item added'); setOpen(false); load() }
    setSaving(false)
  }

  async function toggleStatus(r: ItemRow) {
    await supabase.from('items').update({ status: r.status === 'active' ? 'inactive' : 'active' }).eq('id', r.id)
    load()
  }

  async function del() {
    if (!deleteId) return
    const { error } = await supabase.from('items').delete().eq('id', deleteId)
    if (error) toast.error(error.message)
    else { toast.success('Deleted'); load() }
    setDeleteId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
        <Button onClick={openAdd} className="bg-red-600 hover:bg-red-700 gap-1.5 ml-auto">
          <Plus className="h-4 w-4" />Add New Item
        </Button>
      </div>
      <div className="text-xs text-muted-foreground">{filtered.length} items</div>
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Attribute</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Unit Cost</TableHead>
              <TableHead className="text-right">Selling Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">No items found</TableCell></TableRow>
            ) : filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-sm">{r.item_code}</TableCell>
                <TableCell className="font-medium text-sm">{r.item_name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.brand ?? '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.attribute ?? '—'}</TableCell>
                <TableCell className="text-sm">{r.unit_of_measure}</TableCell>
                <TableCell className="text-right text-sm">₱{r.cost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-right text-sm">
                  {r.selling_price !== null
                    ? `₱${r.selling_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                    : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <button onClick={() => toggleStatus(r)}>
                    <Badge className={r.status === 'active' ? 'bg-green-100 text-green-800 cursor-pointer' : 'bg-gray-100 text-gray-600 cursor-pointer'}>
                      {r.status}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5 mr-2" />Edit</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(r.id)}><Trash2 className="h-3.5 w-3.5 mr-2" />Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Item' : 'Add Item'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  Item Code
                  {!editing && <span className="text-[10px] text-muted-foreground font-normal">auto-generated</span>}
                </Label>
                <Input
                  placeholder="ITM-001"
                  value={form.item_code}
                  onChange={e => setForm(p => ({ ...p, item_code: e.target.value }))}
                  className={!editing ? 'bg-muted/50 font-mono' : 'font-mono'}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unit of Measure</Label>
                <Select value={form.unit_of_measure} onValueChange={v => setForm(p => ({ ...p, unit_of_measure: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select UOM…" /></SelectTrigger>
                  <SelectContent>
                    {uomList.map(u => (
                      <SelectItem key={u.id} value={u.code}>{u.code} – {u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Item Name <span className="text-destructive">*</span></Label>
              <Input placeholder="Item name" value={form.item_name} onChange={e => setForm(p => ({ ...p, item_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Brand</Label>
                <Select value={form.brand} onValueChange={v => setForm(p => ({ ...p, brand: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select brand…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— None —</SelectItem>
                    {brandList.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Attribute</Label>
                <Select value={form.attribute} onValueChange={v => setForm(p => ({ ...p, attribute: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select attribute…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— None —</SelectItem>
                    {attributeList.map(a => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Unit Cost (₱)</Label>
                <Input type="number" min={0} step="0.01" placeholder="0.00" value={form.cost} onChange={e => setForm(p => ({ ...p, cost: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Selling Price (₱)</Label>
                <Input type="number" min={0} step="0.01" placeholder="0.00" value={form.selling_price} onChange={e => setForm(p => ({ ...p, selling_price: e.target.value }))} />
                <p className="text-[11px] text-muted-foreground">Won't affect past records</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700 gap-1.5">
              {saving ? 'Saving…' : (editing ? 'Update Item' : 'Add New Item')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Item?</DialogTitle></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={del}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ─── Portal Settings ─────────────────────────────────── */
function PortalTab() {
  const supabase = createClient()
  const [portalUrl, setPortalUrl] = useState('')
  const [portalStatus, setPortalStatus] = useState('active')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('company_settings')
        .select('portal_url, portal_status')
        .limit(1)
        .single()
      if (data) {
        setPortalUrl((data as any).portal_url ?? '')
        setPortalStatus((data as any).portal_status ?? 'active')
      }
      setLoading(false)
    }
    load()
  }, [])

  async function save() {
    setSaving(true)
    const { error } = await supabase
      .from('company_settings')
      .update({ portal_url: portalUrl || null, portal_status: portalStatus } as any)
      .not('id', 'is', null)
    if (error) toast.error(error.message)
    else toast.success('Portal settings saved')
    setSaving(false)
  }

  if (loading) return <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>

  return (
    <div className="space-y-6 max-w-lg">
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold">Client Portal Configuration</h3>
        <div className="space-y-1.5">
          <Label>Portal URL</Label>
          <Input
            placeholder="e.g. https://yoursite.com/portal"
            value={portalUrl}
            onChange={e => setPortalUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">The URL where clients access the portal. Share this with your clients.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Portal Status</Label>
          <Select value={portalStatus} onValueChange={v => setPortalStatus(v ?? 'active')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active — clients can log in</SelectItem>
              <SelectItem value="maintenance">Maintenance — temporarily offline</SelectItem>
              <SelectItem value="disabled">Disabled — portal closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {portalUrl && (
          <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            Current portal link:{' '}
            <a href={portalUrl} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline break-all">
              {portalUrl}
            </a>
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">
          {saving ? 'Saving…' : 'Save Portal Settings'}
        </Button>
      </div>
    </div>
  )
}

/* ─── Page ────────────────────────────────────────────── */
const CONFIG_TABS = [
  { key: 'suppliers',  label: 'Suppliers' },
  { key: 'clients',    label: 'Clients' },
  { key: 'items',      label: 'Item List' },
  { key: 'categories', label: 'Categories' },
  { key: 'uom',        label: 'Units of Measure' },
  { key: 'brands',     label: 'Brands' },
  { key: 'attributes', label: 'Attributes' },
  { key: 'portal',     label: 'Portal Settings' },
]

export default function SetupPage() {
  const [active, setActive] = useState('suppliers')
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    const supabase = createClient()
    async function loadCounts() {
      const [suppliers, clients, items, categories, uom, brands] = await Promise.all([
        supabase.from('suppliers').select('id', { count: 'exact', head: true }),
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('items').select('id', { count: 'exact', head: true }),
        supabase.from('categories').select('id', { count: 'exact', head: true }),
        supabase.from('uom_list').select('id', { count: 'exact', head: true }),
        supabase.from('brands').select('id', { count: 'exact', head: true }),
      ])
      setCounts({
        suppliers: suppliers.count ?? 0,
        clients: clients.count ?? 0,
        items: items.count ?? 0,
        categories: categories.count ?? 0,
        uom: uom.count ?? 0,
        brands: brands.count ?? 0,
      })
    }
    loadCounts()
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Configuration</h1>
        <p className="text-muted-foreground text-sm">Manage items, suppliers, clients, categories, and system settings</p>
      </div>

      <div className="flex gap-6 items-start">
        {/* Vertical nav */}
        <nav className="w-48 shrink-0 rounded-xl border bg-card shadow-sm overflow-hidden">
          {CONFIG_TABS.map((tab, i) => (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className={cn(
                'w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors',
                i < CONFIG_TABS.length - 1 && 'border-b border-border/60',
                active === tab.key
                  ? 'bg-red-600 text-white'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <span>{tab.label}</span>
              {counts[tab.key] !== undefined && (
                <span className={cn(
                  'text-xs rounded-full px-2 py-0.5 font-semibold',
                  active === tab.key ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                )}>
                  {counts[tab.key].toLocaleString()}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {active === 'suppliers'  && <SuppliersTab />}
          {active === 'clients'    && <ClientsTab />}
          {active === 'items'      && <ItemListTab />}
          {active === 'categories' && <CategoriesTab />}
          {active === 'uom'        && <UOMTab />}
          {active === 'brands'     && <BrandsTab />}
          {active === 'attributes' && <AttributesTab />}
          {active === 'portal'     && <PortalTab />}
        </div>
      </div>
    </div>
  )
}
