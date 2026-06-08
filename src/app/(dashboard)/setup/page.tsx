'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil, Trash2, X } from 'lucide-react'
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
        <DialogContent>
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
        <DialogContent>
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
        <DialogContent className="max-w-md">
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
        <DialogContent>
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

/* ─── Page ────────────────────────────────────────────── */
export default function SetupPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Setup</h1>
        <p className="text-muted-foreground text-sm">Manage categories, units of measure, brands, and item attributes</p>
      </div>

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="uom">Units of Measure</TabsTrigger>
          <TabsTrigger value="brands">Brands</TabsTrigger>
          <TabsTrigger value="attributes">Attributes</TabsTrigger>
        </TabsList>
        <TabsContent value="categories" className="mt-4"><CategoriesTab /></TabsContent>
        <TabsContent value="uom" className="mt-4"><UOMTab /></TabsContent>
        <TabsContent value="brands" className="mt-4"><BrandsTab /></TabsContent>
        <TabsContent value="attributes" className="mt-4"><AttributesTab /></TabsContent>
      </Tabs>
    </div>
  )
}
