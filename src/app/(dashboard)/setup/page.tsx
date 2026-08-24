'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
import { Plus, Pencil, Trash2, X, MoreHorizontal, LayoutGrid, List, ImagePlus, Loader2, Package, Building2, Sparkles, Check, ChevronDown, ChevronUp, KeyRound, Copy, ShieldCheck, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { uploadImageToDrive } from '@/lib/upload-image'
import { useSearchContext } from '@/context/search-context'

/* ─── UOM ─────────────────────────────────────────────── */
interface UOM { id: string; code: string; name: string; description: string | null; is_active: boolean }

function UOMTab({ configSelector }: { configSelector: React.ReactNode }) {
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
      <div className="flex items-center gap-3">
        {configSelector}
        <Button onClick={openAdd} size="sm" className="bg-red-600 hover:bg-red-700 ml-auto">
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
              <TableHead className="w-24">Actions</TableHead>
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
        <DialogContent className="max-w-2xl">
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

function BrandsTab({ configSelector }: { configSelector: React.ReactNode }) {
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
      <div className="flex items-center gap-3">
        {configSelector}
        <Button onClick={openAdd} size="sm" className="bg-red-600 hover:bg-red-700 ml-auto">
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
              <TableHead className="w-24">Actions</TableHead>
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
        <DialogContent className="max-w-2xl">
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

function AttributesTab({ configSelector }: { configSelector: React.ReactNode }) {
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
      <div className="flex items-center gap-3">
        {configSelector}
        <Button onClick={openAdd} size="sm" className="bg-red-600 hover:bg-red-700 ml-auto">
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
              <TableHead className="w-24">Actions</TableHead>
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
        <DialogContent className="max-w-2xl">
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

function CategoriesTab({ configSelector }: { configSelector: React.ReactNode }) {
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
      <div className="flex items-center gap-3">
        {configSelector}
        <Button onClick={openAdd} size="sm" className="bg-red-600 hover:bg-red-700 ml-auto">
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
              <TableHead className="w-24">Actions</TableHead>
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
                <TableCell className="font-medium uppercase">{r.category_name}</TableCell>
                <TableCell>
                  <button onClick={() => toggleStatus(r)}>
                    <Badge className={`capitalize ${r.status === 'active' ? 'bg-green-100 text-green-800 cursor-pointer' : 'bg-gray-100 text-gray-600 cursor-pointer'}`}>
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
        <DialogContent className="max-w-2xl">
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
  logo_url: string | null
  auth_user_id: string | null; portal_access: boolean | null
}
const emptySupplierForm = () => ({
  company_name: '', contact_person: '', mobile_number: '', email: '',
  address: '', tin: '', vat_registered: 'true', supplier_category: '',
  payment_terms: '30 days', lead_time_days: '7', atc_code: '', ewt_rate: '2',
  vat_classification: 'vatable',
})

function SuppliersTab({ configSelector }: { configSelector: React.ReactNode }) {
  const supabase = createClient()
  const { query: search } = useSearchContext()
  const [rows, setRows] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState(emptySupplierForm())
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [inviteSupplier, setInviteSupplier] = useState<Supplier | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePassword, setInvitePassword] = useState('')
  const [showInvitePw, setShowInvitePw] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ email: string } | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('suppliers').select('*').order('company_name')
    setRows(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openInvite(s: Supplier) {
    setInviteSupplier(s)
    setInviteEmail(s.email ?? '')
    setInvitePassword('')
    setShowInvitePw(false)
    setInviteResult(null)
    setInviting(false)
  }

  async function handleInvite() {
    if (!inviteSupplier || !inviteEmail.trim()) { toast.error('Email is required'); return }
    if (!invitePassword.trim()) { toast.error('Password is required'); return }
    if (invitePassword.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setInviting(true)
    try {
      // Created via the service-role admin API (email_confirm: true) rather than
      // client-side signUp, so the account can log in immediately instead of
      // bouncing off "Your account email has not been confirmed" until the
      // project's confirmation email is sent and clicked.
      const res = await fetch('/api/create-portal-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          password: invitePassword,
          full_name: inviteSupplier.contact_person || inviteSupplier.company_name,
          company: inviteSupplier.company_name,
          role: 'vendor',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to create portal account')
      await supabase.from('suppliers').update({
        auth_user_id: json.userId ?? null,
        portal_access: true,
        email: inviteEmail.trim().toLowerCase(),
      }).eq('id', inviteSupplier.id)
      setInviteResult({ email: inviteEmail.trim().toLowerCase() })
      load()
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create portal account')
    }
    setInviting(false)
  }

  const filtered = rows.filter(s =>
    s.company_name.toLowerCase().includes(search.toLowerCase()) ||
    (s.supplier_code ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function openAdd() {
    setEditing(null); setForm(emptySupplierForm())
    setLogoFile(null); setLogoPreview(null)
    setOpen(true)
  }
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
    setLogoFile(null); setLogoPreview(s.logo_url ?? null)
    setOpen(true)
  }

  function handleLogoSelect(file: File) {
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const sf = (field: string) => (v: string | null) => setForm(p => ({ ...p, [field]: v ?? p[field as keyof typeof p] }))

  async function save() {
    if (!form.company_name.trim()) { toast.error('Company name required'); return }
    setSaving(true)

    let logoUrl = logoFile ? null : logoPreview
    if (logoFile) {
      setUploadingLogo(true)
      try {
        logoUrl = await uploadImageToDrive(logoFile, { displayName: form.company_name.trim(), folder: 'Suppliers' })
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to upload logo')
        setUploadingLogo(false)
        setSaving(false)
        return
      }
      setUploadingLogo(false)
    }

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
      logo_url: logoUrl,
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
        {configSelector}
        <Button onClick={openAdd} size="sm" className="bg-red-600 hover:bg-red-700 ml-auto">
          <Plus className="h-4 w-4 mr-1" />Add Supplier
        </Button>
      </div>
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Logo</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>TIN</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">No suppliers found</TableCell></TableRow>
            ) : filtered.map(s => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="h-9 w-9 rounded border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
                    {s.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.logo_url} alt={s.company_name} className="h-full w-full object-contain p-0.5" />
                    ) : (
                      <Building2 className="h-4 w-4 text-muted-foreground/30" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">{s.supplier_code}</TableCell>
                <TableCell>
                  <div className="font-medium text-sm">{s.company_name}</div>
                  {s.email && <div className="text-xs text-muted-foreground">{s.email}</div>}
                </TableCell>
                <TableCell className="text-sm">{s.contact_person ?? '—'}</TableCell>
                <TableCell className="font-mono text-sm">{s.tin ?? '—'}</TableCell>
                <TableCell className="text-sm">{s.supplier_category ?? '—'}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1 items-start">
                    <button onClick={() => toggleActive(s)}>
                      <Badge className={s.is_active ? 'bg-green-100 text-green-800 cursor-pointer' : 'bg-gray-100 text-gray-600 cursor-pointer'}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </button>
                    {s.portal_access && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700 flex items-center gap-1 w-fit">
                        <ShieldCheck className="h-3 w-3" /> Portal
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5 mr-2" />Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openInvite(s)}>
                        <KeyRound className="h-3.5 w-3.5 mr-2" />{s.portal_access ? 'Reset Portal Access' : 'Invite to Portal'}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(s.id)}><Trash2 className="h-3.5 w-3.5 mr-2" />Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Logo</Label>
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 rounded-lg border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreview} alt="Supplier logo preview" className="h-full w-full object-contain p-1" />
                  ) : (
                    <Building2 className="h-6 w-6 text-muted-foreground/30" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={uploadingLogo} onClick={() => document.getElementById('config-supplier-logo-input')?.click()}>
                    {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5 mr-1.5" />}
                    {logoPreview ? 'Change Logo' : 'Upload Logo'}
                  </Button>
                  {logoPreview && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setLogoFile(null); setLogoPreview(null) }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <input
                    id="config-supplier-logo-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoSelect(f); e.target.value = '' }}
                  />
                </div>
              </div>
            </div>
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

      {/* Invite to Vendor Portal Dialog */}
      <Dialog open={!!inviteSupplier} onOpenChange={o => { if (!o) { setInviteSupplier(null); setInviteResult(null) } }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {inviteResult ? 'Portal Account Created' : 'Create Vendor Portal Account'}
            </DialogTitle>
          </DialogHeader>

          {!inviteResult ? (
            <>
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">
                  Set the login credentials for <span className="font-semibold text-foreground">{inviteSupplier?.company_name}</span>.
                  They will use these to access the Vendor Portal.
                </p>
                <div className="space-y-1.5">
                  <Label>Email Address</Label>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="vendor@company.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Password</Label>
                  <div className="relative">
                    <Input
                      type={showInvitePw ? 'text' : 'password'}
                      value={invitePassword}
                      onChange={e => setInvitePassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowInvitePw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showInvitePw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Must be at least 8 characters.</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteSupplier(null)}>Cancel</Button>
                <Button onClick={handleInvite} disabled={inviting} className="bg-emerald-600 hover:bg-emerald-700">
                  {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
                  Create Account
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-2 text-green-600 font-medium text-sm">
                  <CheckCircle2 className="h-5 w-5" /> Account created successfully
                </div>
                <p className="text-sm text-muted-foreground">
                  The vendor can now log in to the portal using the credentials you set.
                </p>
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Portal URL</div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono flex-1">{typeof window !== 'undefined' ? window.location.origin : ''}/portal/login</code>
                      <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/portal/login`); toast.success('Copied') }}><Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" /></button>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Email</div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono flex-1">{inviteResult.email}</code>
                      <button onClick={() => { navigator.clipboard.writeText(inviteResult!.email); toast.success('Copied') }}><Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" /></button>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => { setInviteSupplier(null); setInviteResult(null) }}>Done</Button>
              </DialogFooter>
            </>
          )}
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

/* ─── Item List Tab ───────────────────────────────────── */
interface ItemRow {
  id: string; item_code: string; item_name: string; description: string | null
  brand: string | null; unit_of_measure: string; cost: number
  selling_price: number | null; attribute: string | null; status: string
  image_url: string | null
  image_urls: string[] | null
}
interface ItemImage { url?: string; file?: File; preview: string }
function itemImageUrls(r: Pick<ItemRow, 'image_url' | 'image_urls'>): string[] {
  return r.image_urls?.length ? r.image_urls : (r.image_url ? [r.image_url] : [])
}
interface UOMOption { id: string; code: string; name: string }
interface BrandOption { id: string; name: string }
interface AttributeOption { id: string; name: string; data_type: string; options: string[] | null }
interface ItemSuggestion {
  id: string; client_name: string; item_name: string; description: string | null
  brand: string | null; unit_of_measure: string | null; attribute: string | null
  selling_price: number | null; image_urls: string[]; notes: string | null; created_at: string
}

// Windowed page list — always shows first/last, current ±1, with '…' gaps —
// so pagination stays compact even with dozens of pages.
function paginationRange(current: number, total: number): (number | '…')[] {
  const pages = new Set([1, total, current, current - 1, current + 1])
  const sorted = [...pages].filter(p => p >= 1 && p <= total).sort((a, b) => a - b)
  const result: (number | '…')[] = []
  let prev = 0
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push('…')
    result.push(p)
    prev = p
  }
  return result
}

const ITEM_LIST_PAGE_SIZE = 24

// Derives a short letters-only prefix from an item name (e.g. "Laptop Stand" -> "LAP")
// so generated codes read as related to the item instead of a plain running number.
function deriveCodePrefix(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z]/g, '').toUpperCase()
  return cleaned.slice(0, 3) || 'ITM'
}

function ItemListTab({ configSelector }: { configSelector: React.ReactNode }) {
  const supabase = createClient()
  const { query: search } = useSearchContext()
  const [rows, setRows] = useState<ItemRow[]>([])
  const [uomList, setUomList] = useState<UOMOption[]>([])
  const [brandList, setBrandList] = useState<BrandOption[]>([])
  const [attributeList, setAttributeList] = useState<AttributeOption[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ItemRow | null>(null)
  const [form, setForm] = useState({ item_code: '', item_name: '', description: '', brand: '', unit_of_measure: '', cost: '', selling_price: '', attribute: '' })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'box'>('list')
  const [images, setImages] = useState<ItemImage[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [codeAutoGenerated, setCodeAutoGenerated] = useState(true)
  const [attributeTypeId, setAttributeTypeId] = useState('')
  const [suggestions, setSuggestions] = useState<ItemSuggestion[]>([])
  const [pendingSuggestionId, setPendingSuggestionId] = useState<string | null>(null)
  const [suggestionsOpen, setSuggestionsOpen] = useState(true)
  const [addingBrand, setAddingBrand] = useState(false)
  const [newBrandName, setNewBrandName] = useState('')
  const [addingAttribute, setAddingAttribute] = useState(false)
  const [newAttributeName, setNewAttributeName] = useState('')
  const [addingAttrValue, setAddingAttrValue] = useState(false)
  const [newAttrValue, setNewAttrValue] = useState('')

  const selectedAttrType = attributeList.find(a => a.id === attributeTypeId) ?? null
  const attrIsSelectType = selectedAttrType?.data_type === 'select'

  function handleAttributeTypeChange(id: string) {
    setAttributeTypeId(id)
    setForm(p => ({ ...p, attribute: '' }))
  }

  // Quick-add so common lookups can be created without leaving the Add Item dialog.
  async function quickAddBrand() {
    const name = newBrandName.trim()
    if (!name) return
    const { data, error } = await supabase.from('brands').insert({ name, is_active: true }).select('id, name').single()
    if (error) { toast.error(error.message); return }
    setBrandList(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setForm(p => ({ ...p, brand: data.name }))
    setNewBrandName('')
    setAddingBrand(false)
    toast.success('Brand added')
  }

  async function quickAddAttribute() {
    const name = newAttributeName.trim()
    if (!name) return
    const { data, error } = await supabase.from('attributes').insert({ name, data_type: 'select', options: [], is_active: true }).select('id, name, data_type, options').single()
    if (error) { toast.error(error.message); return }
    const created = data as AttributeOption
    setAttributeList(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
    setAttributeTypeId(created.id)
    setForm(p => ({ ...p, attribute: '' }))
    setNewAttributeName('')
    setAddingAttribute(false)
    toast.success('Attribute added — add its values below')
  }

  async function quickAddAttrValue() {
    if (!selectedAttrType) return
    const value = newAttrValue.trim()
    if (!value || selectedAttrType.options?.includes(value)) return
    const updatedOptions = [...(selectedAttrType.options ?? []), value]
    const { error } = await supabase.from('attributes').update({ options: updatedOptions, data_type: 'select' }).eq('id', selectedAttrType.id)
    if (error) { toast.error(error.message); return }
    setAttributeList(prev => prev.map(a => a.id === selectedAttrType.id ? { ...a, options: updatedOptions, data_type: 'select' } : a))
    setForm(p => ({ ...p, attribute: value }))
    setNewAttrValue('')
    setAddingAttrValue(false)
    toast.success('Value added')
  }

  // Generates a code related to the item name (e.g. "Laptop Stand" -> "LAP-001"),
  // scoped per-prefix so unrelated items don't compete for the same sequence.
  async function generateCodeForName(name: string): Promise<string> {
    const prefix = deriveCodePrefix(name)
    const { data: last } = await supabase
      .from('items')
      .select('item_code')
      .like('item_code', `${prefix}-%`)
      .order('item_code', { ascending: false })
      .limit(1)
      .single()
    let next = 1
    if (last?.item_code) {
      const num = parseInt(last.item_code.replace(`${prefix}-`, ''), 10)
      if (!isNaN(num)) next = num + 1
    }
    return `${prefix}-${String(next).padStart(3, '0')}`
  }

  async function handleItemNameBlur() {
    if (editing || !codeAutoGenerated) return
    const name = form.item_name.trim()
    if (!name) return
    const code = await generateCodeForName(name)
    setForm(p => ({ ...p, item_code: code }))
  }

  async function load() {
    setLoading(true)
    const [{ data: itemData }, { data: uomData }, { data: brandData }, { data: attrData }, { data: suggData }] = await Promise.all([
      supabase.from('items').select('id, item_code, item_name, description, brand, unit_of_measure, cost, selling_price, attribute, status, image_url, image_urls').order('item_name'),
      supabase.from('uom_list').select('id, code, name').eq('is_active', true).order('code'),
      supabase.from('brands').select('id, name').eq('is_active', true).order('name'),
      supabase.from('attributes').select('id, name, data_type, options').eq('is_active', true).order('name'),
      supabase.from('item_suggestions').select('id, client_name, item_name, description, brand, unit_of_measure, attribute, selling_price, image_urls, notes, created_at').eq('status', 'pending').order('created_at'),
    ])
    setRows(itemData ?? [])
    setUomList(uomData ?? [])
    setBrandList(brandData ?? [])
    setAttributeList((attrData ?? []) as AttributeOption[])
    setSuggestions((suggData ?? []) as ItemSuggestion[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = rows.filter(r =>
    r.item_name.toLowerCase().includes(search.toLowerCase()) ||
    r.item_code.toLowerCase().includes(search.toLowerCase()) ||
    (r.brand ?? '').toLowerCase().includes(search.toLowerCase())
  )
  useEffect(() => { setPage(1) }, [search, viewMode])
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEM_LIST_PAGE_SIZE))
  const paged = filtered.slice((page - 1) * ITEM_LIST_PAGE_SIZE, page * ITEM_LIST_PAGE_SIZE)

  function openAdd() {
    setEditing(null)
    setPendingSuggestionId(null)
    setCodeAutoGenerated(true)
    setAttributeTypeId('')
    setForm({ item_code: '', item_name: '', description: '', brand: '', unit_of_measure: '', cost: '', selling_price: '', attribute: '' })
    setImages([])
    setOpen(true)
  }
  function openEdit(r: ItemRow) {
    setEditing(r)
    setPendingSuggestionId(null)
    setCodeAutoGenerated(false)
    // Older rows may have been saved before attributes had defined choices —
    // only pre-select a type if the stored value matches one of its options.
    const matchedType = attributeList.find(a => a.options?.includes(r.attribute ?? ''))
    setAttributeTypeId(matchedType?.id ?? '')
    setForm({ item_code: r.item_code, item_name: r.item_name, description: r.description ?? '', brand: r.brand ?? '', unit_of_measure: r.unit_of_measure, cost: String(r.cost), selling_price: r.selling_price !== null ? String(r.selling_price) : '', attribute: r.attribute ?? '' })
    setImages(itemImageUrls(r).map(url => ({ url, preview: url })))
    setOpen(true)
  }

  function acceptSuggestion(s: ItemSuggestion) {
    setEditing(null)
    setPendingSuggestionId(s.id)
    setCodeAutoGenerated(true)
    const matchedType = attributeList.find(a => a.options?.includes(s.attribute ?? ''))
    setAttributeTypeId(matchedType?.id ?? '')
    setForm({
      item_code: '', item_name: s.item_name, description: s.description ?? '', brand: s.brand ?? '',
      unit_of_measure: s.unit_of_measure ?? '', cost: '', selling_price: s.selling_price != null ? String(s.selling_price) : '',
      attribute: s.attribute ?? '',
    })
    setImages(s.image_urls.map(url => ({ url, preview: url })))
    setOpen(true)
  }

  async function rejectSuggestion(id: string) {
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('item_suggestions').update({
      status: 'rejected', reviewed_by: user?.email ?? null, reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Suggestion declined')
    load()
  }

  function handleImagesSelect(files: File[]) {
    setImages(prev => [...prev, ...files.map(file => ({ file, preview: URL.createObjectURL(file) }))])
  }
  function removeImage(index: number) {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  async function save() {
    if (!form.item_name.trim()) { toast.error('Item name required'); return }
    setSaving(true)

    // Safety net in case the item name was never blurred (e.g. Save clicked via mouse).
    let itemCode = form.item_code.trim()
    if (!itemCode && !editing) {
      itemCode = await generateCodeForName(form.item_name.trim())
      setForm(p => ({ ...p, item_code: itemCode }))
    }

    const imageUrls: string[] = []
    if (images.some(img => img.file)) setUploadingImage(true)
    try {
      for (const img of images) {
        if (img.url) { imageUrls.push(img.url); continue }
        if (img.file) {
          const uploaded = await uploadImageToDrive(img.file, { displayName: `${form.item_name.trim()}-${imageUrls.length + 1}`, folder: 'Items' })
          imageUrls.push(uploaded)
        }
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload image')
      setUploadingImage(false)
      setSaving(false)
      return
    }
    setUploadingImage(false)

    const payload = {
      item_code: itemCode || undefined,
      item_name: form.item_name.trim(),
      description: form.description.trim() || null,
      brand: form.brand.trim() || null,
      unit_of_measure: form.unit_of_measure.trim(),
      cost: parseFloat(form.cost) || 0,
      selling_price: form.selling_price.trim() ? parseFloat(form.selling_price) : null,
      attribute: form.attribute.trim() || null,
      image_urls: imageUrls,
      image_url: imageUrls[0] ?? null,
    }
    let error
    let newItemId: string | null = null
    if (editing) {
      ;({ error } = await supabase.from('items').update(payload).eq('id', editing.id))
    } else {
      const { data: inserted, error: insErr } = await supabase.from('items').insert({ ...payload, status: 'active' }).select('id').single()
      error = insErr
      newItemId = inserted?.id ?? null
    }
    if (error) { toast.error(error.message); setSaving(false); return }

    if (pendingSuggestionId && newItemId) {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('item_suggestions').update({
        status: 'accepted',
        linked_item_id: newItemId,
        reviewed_by: user?.email ?? null,
        reviewed_at: new Date().toISOString(),
      }).eq('id', pendingSuggestionId)
      setPendingSuggestionId(null)
    }

    toast.success(editing ? 'Item updated' : 'Item added')
    setOpen(false)
    load()
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
        {configSelector}
        <div className="flex border rounded-md overflow-hidden shrink-0 ml-auto">
          <button onClick={() => setViewMode('list')}
            className={`h-9 w-9 flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-red-600 text-white' : 'bg-background text-muted-foreground hover:bg-accent'}`}>
            <List className="h-4 w-4" />
          </button>
          <button onClick={() => setViewMode('box')}
            className={`h-9 w-9 flex items-center justify-center border-l transition-colors ${viewMode === 'box' ? 'bg-red-600 text-white' : 'bg-background text-muted-foreground hover:bg-accent'}`}>
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
        <Button onClick={openAdd} className="bg-red-600 hover:bg-red-700 gap-1.5">
          <Plus className="h-4 w-4" />Add New Item
        </Button>
      </div>

      {suggestions.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 overflow-hidden">
          <button type="button" onClick={() => setSuggestionsOpen(o => !o)}
            className="w-full flex items-center gap-2 px-4 py-3 text-left">
            <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-sm font-semibold text-amber-900">Item Suggestions from Clients</span>
            <span className="text-xs font-bold bg-amber-600 text-white px-1.5 py-0.5 rounded-full">{suggestions.length}</span>
            {suggestionsOpen ? <ChevronUp className="h-4 w-4 text-amber-600 ml-auto" /> : <ChevronDown className="h-4 w-4 text-amber-600 ml-auto" />}
          </button>
          {suggestionsOpen && (
            <div className="divide-y divide-amber-100 border-t border-amber-200">
              {suggestions.map(s => {
                const img = s.image_urls[0]
                return (
                  <div key={s.id} className="flex items-start gap-3 px-4 py-3 bg-white/60">
                    <div className="h-12 w-12 rounded-lg border bg-white flex items-center justify-center overflow-hidden shrink-0">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={s.item_name} className="h-full w-full object-contain p-1" />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground/30" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{s.item_name}</span>
                        {s.brand && <span className="text-xs text-muted-foreground">{s.brand}</span>}
                        {s.unit_of_measure && <Badge variant="secondary" className="text-[10px]">{s.unit_of_measure}</Badge>}
                        {s.attribute && <Badge variant="secondary" className="text-[10px]">{s.attribute}</Badge>}
                        {s.selling_price != null && (
                          <span className="text-xs font-semibold text-green-700">₱{s.selling_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                        )}
                      </div>
                      {s.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.description}</p>}
                      {s.notes && <p className="text-xs text-amber-700 mt-0.5 italic line-clamp-2">&ldquo;{s.notes}&rdquo;</p>}
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {s.client_name} · {format(new Date(s.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => rejectSuggestion(s.id)}>
                        <X className="h-3 w-3 mr-1" />Decline
                      </Button>
                      <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => acceptSuggestion(s)}>
                        <Check className="h-3 w-3 mr-1" />Accept
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className="text-xs text-muted-foreground">{filtered.length} items</div>
      {viewMode === 'box' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-6 text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full text-center py-6 text-muted-foreground">No items found</div>
          ) : paged.map(r => {
            const imgs = itemImageUrls(r)
            return (
            <div key={r.id} className="rounded-lg border bg-card overflow-hidden flex flex-col">
              <div className="h-28 bg-muted/40 flex items-center justify-center overflow-hidden relative">
                {imgs[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imgs[0]} alt={r.item_name} className="h-full w-full object-contain p-2" />
                ) : (
                  <Package className="h-7 w-7 text-muted-foreground/30" />
                )}
                {imgs.length > 1 && (
                  <span className="absolute bottom-1 right-1 text-[10px] leading-none bg-black/60 text-white rounded-full px-1.5 py-1">+{imgs.length - 1}</span>
                )}
              </div>
              <div className="p-3 flex-1 flex flex-col gap-1">
                <div className="font-mono text-xs text-muted-foreground">{r.item_code}</div>
                <div className="font-medium text-sm leading-tight line-clamp-2">{r.item_name}</div>
                {r.description && <div className="text-xs text-muted-foreground line-clamp-2">{r.description}</div>}
                <div className="text-xs text-muted-foreground">{r.brand ?? '—'}</div>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="font-semibold text-sm">₱{r.cost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                  <button onClick={() => toggleStatus(r)}>
                    <Badge className={`capitalize ${r.status === 'active' ? 'bg-green-100 text-green-800 cursor-pointer' : 'bg-gray-100 text-gray-600 cursor-pointer'}`}>
                      {r.status}
                    </Badge>
                  </button>
                </div>
              </div>
              <div className="border-t px-3 py-2 flex items-center justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent">
                    <MoreHorizontal className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5 mr-2" />Edit</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(r.id)}><Trash2 className="h-3.5 w-3.5 mr-2" />Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )})}
        </div>
      ) : (
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Image</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Attribute</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Unit Cost</TableHead>
              <TableHead className="text-right">Selling Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={11} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center py-6 text-muted-foreground">No items found</TableCell></TableRow>
            ) : paged.map(r => {
              const imgs = itemImageUrls(r)
              return (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="h-9 w-9 rounded border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0 relative">
                    {imgs[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imgs[0]} alt={r.item_name} className="h-full w-full object-contain p-0.5" />
                    ) : (
                      <Package className="h-4 w-4 text-muted-foreground/30" />
                    )}
                    {imgs.length > 1 && (
                      <span className="absolute bottom-0 right-0 text-[8px] leading-none bg-black/60 text-white rounded-full px-1 py-0.5">+{imgs.length - 1}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">{r.item_code}</TableCell>
                <TableCell className="font-medium text-sm">{r.item_name}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[220px] truncate" title={r.description ?? undefined}>{r.description ?? '—'}</TableCell>
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
                    <Badge className={`capitalize ${r.status === 'active' ? 'bg-green-100 text-green-800 cursor-pointer' : 'bg-gray-100 text-gray-600 cursor-pointer'}`}>
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
            )})}
          </TableBody>
        </Table>
      </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Showing {((page - 1) * ITEM_LIST_PAGE_SIZE) + 1}–{Math.min(page * ITEM_LIST_PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-md border text-sm font-medium disabled:opacity-40 hover:bg-muted transition-colors"
            >← Prev</button>
            {paginationRange(page, totalPages).map((p, i) => p === '…' ? (
              <span key={`gap-${i}`} className="w-8 h-8 flex items-center justify-center text-sm text-muted-foreground">…</span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-md text-sm font-medium transition-colors ${p === page ? 'bg-red-600 text-white' : 'border hover:bg-muted'}`}
              >{p}</button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-md border text-sm font-medium disabled:opacity-40 hover:bg-muted transition-colors"
            >Next →</button>
          </div>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[98vw] sm:!max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Item' : 'Add Item'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-2">
            {/* LEFT column */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Pictures</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {images.map((img, i) => (
                    <div key={i} className="relative h-16 w-16 rounded-lg border bg-muted/40 overflow-hidden shrink-0 group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.preview} alt={`Item picture ${i + 1}`} className="h-full w-full object-contain p-1" />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={uploadingImage}
                    onClick={() => document.getElementById('config-item-picture-input')?.click()}
                    className="h-16 w-16 rounded-lg border border-dashed flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors shrink-0 disabled:opacity-50"
                  >
                    {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  </button>
                  <input
                    id="config-item-picture-input"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) handleImagesSelect(files); e.target.value = '' }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    Item Code
                    {!editing && codeAutoGenerated && <span className="text-[10px] text-muted-foreground font-normal">auto</span>}
                  </Label>
                  <Input
                    placeholder={!editing ? 'From item name…' : 'ITM-001'}
                    value={form.item_code}
                    onChange={e => { setCodeAutoGenerated(false); setForm(p => ({ ...p, item_code: e.target.value })) }}
                    className={!editing && codeAutoGenerated ? 'bg-muted/50 font-mono' : 'font-mono'}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Unit of Measure</Label>
                  <Select value={form.unit_of_measure} onValueChange={v => setForm(p => ({ ...p, unit_of_measure: v ?? '' }))}>
                    <SelectTrigger className="w-full">
                      {form.unit_of_measure
                        ? <span className="truncate text-sm">{form.unit_of_measure}</span>
                        : <span className="text-muted-foreground text-sm">Select UOM…</span>}
                    </SelectTrigger>
                    <SelectContent>
                      {uomList.map(u => (
                        <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Item Name <span className="text-destructive">*</span></Label>
                <Input placeholder="Item name" value={form.item_name} onChange={e => setForm(p => ({ ...p, item_name: e.target.value }))} onBlur={handleItemNameBlur} />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea rows={3} placeholder="Additional details about this item…" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
            </div>

            {/* RIGHT column */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Brand</Label>
                  <button type="button" onClick={() => setAddingBrand(v => !v)} className="text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-0.5">
                    <Plus className="h-3 w-3" />Add New
                  </button>
                </div>
                {addingBrand && (
                  <div className="flex gap-1.5">
                    <Input autoFocus placeholder="New brand name" value={newBrandName} onChange={e => setNewBrandName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); quickAddBrand() } }} className="h-8 text-sm" />
                    <Button type="button" size="icon" className="h-8 w-8 shrink-0 bg-red-600 hover:bg-red-700" onClick={quickAddBrand}><Check className="h-3.5 w-3.5" /></Button>
                    <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => { setAddingBrand(false); setNewBrandName('') }}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
                <Select value={form.brand} onValueChange={v => setForm(p => ({ ...p, brand: v ?? '' }))}>
                  <SelectTrigger className="w-full">
                    {form.brand
                      ? <span className="truncate text-sm">{form.brand}</span>
                      : <span className="text-muted-foreground text-sm">Select brand…</span>}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— None —</SelectItem>
                    {brandList.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Attribute</Label>
                  <button type="button" onClick={() => setAddingAttribute(v => !v)} className="text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-0.5">
                    <Plus className="h-3 w-3" />Add New
                  </button>
                </div>
                {addingAttribute && (
                  <div className="flex gap-1.5">
                    <Input autoFocus placeholder="New attribute name (e.g. Color)" value={newAttributeName} onChange={e => setNewAttributeName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); quickAddAttribute() } }} className="h-8 text-sm" />
                    <Button type="button" size="icon" className="h-8 w-8 shrink-0 bg-red-600 hover:bg-red-700" onClick={quickAddAttribute}><Check className="h-3.5 w-3.5" /></Button>
                    <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => { setAddingAttribute(false); setNewAttributeName('') }}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
                <Select value={attributeTypeId} onValueChange={v => handleAttributeTypeChange(v ?? '')}>
                  <SelectTrigger className="w-full">
                    {attributeTypeId
                      ? <span className="truncate text-sm">{selectedAttrType?.name}</span>
                      : <span className="text-muted-foreground text-sm">Select attribute…</span>}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— None —</SelectItem>
                    {attributeList.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {attributeTypeId && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>{selectedAttrType?.name} Value</Label>
                    {attrIsSelectType && (
                      <button type="button" onClick={() => setAddingAttrValue(v => !v)} className="text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-0.5">
                        <Plus className="h-3 w-3" />Add New
                      </button>
                    )}
                  </div>
                  {addingAttrValue && (
                    <div className="flex gap-1.5">
                      <Input autoFocus placeholder={`New ${selectedAttrType?.name} value`} value={newAttrValue} onChange={e => setNewAttrValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); quickAddAttrValue() } }} className="h-8 text-sm" />
                      <Button type="button" size="icon" className="h-8 w-8 shrink-0 bg-red-600 hover:bg-red-700" onClick={quickAddAttrValue}><Check className="h-3.5 w-3.5" /></Button>
                      <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={() => { setAddingAttrValue(false); setNewAttrValue('') }}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                  {attrIsSelectType ? (
                    <Select value={form.attribute} onValueChange={v => setForm(p => ({ ...p, attribute: v ?? '' }))}>
                      <SelectTrigger className="w-full">
                        {form.attribute
                          ? <span className="truncate text-sm">{form.attribute}</span>
                          : <span className="text-muted-foreground text-sm">{selectedAttrType?.options?.length ? `Select ${selectedAttrType?.name}…` : 'No values yet — add one above'}</span>}
                      </SelectTrigger>
                      <SelectContent>
                        {selectedAttrType?.options?.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input placeholder={`Enter ${selectedAttrType?.name ?? 'value'}…`} value={form.attribute} onChange={e => setForm(p => ({ ...p, attribute: e.target.value }))} />
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Unit Cost (₱)</Label>
                  <Input type="number" min={0} step="0.01" placeholder="0.00" value={form.cost} onChange={e => setForm(p => ({ ...p, cost: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Selling Price (₱)</Label>
                  <Input type="number" min={0} step="0.01" placeholder="0.00" value={form.selling_price} onChange={e => setForm(p => ({ ...p, selling_price: e.target.value }))} />
                  <p className="text-[11px] text-muted-foreground">Won&apos;t affect past records</p>
                </div>
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

/* ─── Page ────────────────────────────────────────────── */
const CONFIG_TABS = [
  { key: 'suppliers',  label: 'Suppliers' },
  { key: 'items',      label: 'Item List' },
  { key: 'categories', label: 'Categories' },
  { key: 'uom',        label: 'Units of Measure' },
  { key: 'brands',     label: 'Brands' },
  { key: 'attributes', label: 'Attributes' },
]

function SetupPageContent() {
  const searchParams = useSearchParams()
  const [active, setActive] = useState(() => {
    const tab = searchParams.get('tab')
    return tab && CONFIG_TABS.some(t => t.key === tab) ? tab : 'suppliers'
  })
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    const supabase = createClient()
    async function loadCounts() {
      const [suppliers, items, categories, uom, brands] = await Promise.all([
        supabase.from('suppliers').select('id', { count: 'exact', head: true }),
        supabase.from('items').select('id', { count: 'exact', head: true }),
        supabase.from('categories').select('id', { count: 'exact', head: true }),
        supabase.from('uom_list').select('id', { count: 'exact', head: true }),
        supabase.from('brands').select('id', { count: 'exact', head: true }),
      ])
      setCounts({
        suppliers: suppliers.count ?? 0,
        items: items.count ?? 0,
        categories: categories.count ?? 0,
        uom: uom.count ?? 0,
        brands: brands.count ?? 0,
      })
    }
    loadCounts()
  }, [])

  const configSelector = (
    <Select value={active} onValueChange={v => setActive(v ?? 'suppliers')}>
      <SelectTrigger className="w-56 shrink-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CONFIG_TABS.map(tab => (
          <SelectItem key={tab.key} value={tab.key}>
            {tab.label}{counts[tab.key] !== undefined ? ` (${counts[tab.key].toLocaleString()})` : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Configuration</h1>
        <p className="text-muted-foreground text-sm">Manage items, suppliers, categories, and system settings</p>
      </div>

      <div className="min-w-0">
        {active === 'suppliers'  && <SuppliersTab configSelector={configSelector} />}
        {active === 'items'      && <ItemListTab configSelector={configSelector} />}
        {active === 'categories' && <CategoriesTab configSelector={configSelector} />}
        {active === 'uom'        && <UOMTab configSelector={configSelector} />}
        {active === 'brands'     && <BrandsTab configSelector={configSelector} />}
        {active === 'attributes' && <AttributesTab configSelector={configSelector} />}
      </div>
    </div>
  )
}

export default function SetupPage() {
  return (
    <Suspense fallback={null}>
      <SetupPageContent />
    </Suspense>
  )
}
