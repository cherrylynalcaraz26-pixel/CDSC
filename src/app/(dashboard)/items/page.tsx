'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Plus, Search, MoreHorizontal, Package, LayoutGrid, List, ImagePlus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { uploadImageToDrive } from '@/lib/upload-image'

interface Category { id: string; category_name: string }
interface Brand { id: string; name: string }
interface UOM { id: string; code: string; name: string }
interface Attribute { id: string; name: string; data_type: string; options: string[] | null }

interface Item {
  id: string
  item_code: string
  item_name: string
  description: string | null
  brand: string | null
  category_id: string | null
  unit_of_measure: string
  cost: number
  selling_price: number | null
  reorder_level: number | null
  status: string
  image_url: string | null
  category?: { category_name: string } | null
  stock_levels?: { quantity_on_hand: number }[]
  item_attribute_values?: { attribute_id: string; value: string; attribute?: { name: string } }[]
}

interface ItemForm {
  item_code: string
  item_name: string
  description: string
  brand: string
  category_id: string
  unit_of_measure: string
  cost: string
  selling_price: string
  reorder_level: string
  barcode: string
  attribute: string
  image_url: string
}

interface AttrValue { attribute_id: string; value: string }

const emptyForm = (): ItemForm => ({
  item_code: '', item_name: '', description: '', brand: '',
  category_id: '', unit_of_measure: 'PCS', cost: '', selling_price: '', reorder_level: '10', barcode: '', attribute: '',
  image_url: '',
})

export default function ItemsPage() {
  const supabase = createClient()
  const [items, setItems] = useState<Item[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [uoms, setUoms] = useState<UOM[]>([])
  const [attributes, setAttributes] = useState<Attribute[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [form, setForm] = useState<ItemForm>(emptyForm())
  const [attrValues, setAttrValues] = useState<AttrValue[]>([])
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'box'>('list')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  async function load() {
    setLoading(true)
    const [{ data: itemData }, { data: catData }, { data: brandData }, { data: uomData }, { data: attrData }] = await Promise.all([
      supabase.from('items').select('*, category:categories(category_name), stock_levels(quantity_on_hand), item_attribute_values(attribute_id, value, attribute:attributes(name))').order('item_code'),
      supabase.from('categories').select('id, category_name').order('category_name'),
      supabase.from('brands').select('id, name').eq('is_active', true).order('name'),
      supabase.from('uom_list').select('id, code, name').eq('is_active', true).order('code'),
      supabase.from('attributes').select('id, name, data_type, options').eq('is_active', true).order('name'),
    ])
    setItems(itemData ?? [])
    setCategories(catData ?? [])
    setBrands(brandData ?? [])
    setUoms(uomData ?? [])
    setAttributes(attrData ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() =>
    items.filter(i =>
      i.item_code.toLowerCase().includes(search.toLowerCase()) ||
      i.item_name.toLowerCase().includes(search.toLowerCase()) ||
      (i.brand ?? '').toLowerCase().includes(search.toLowerCase())
    ), [items, search])

  function openAdd() {
    setEditing(null)
    setForm(emptyForm())
    setAttrValues([])
    setImageFile(null)
    setImagePreview(null)
    setOpen(true)
  }

  function openEdit(item: Item) {
    setEditing(item)
    setForm({
      item_code: item.item_code,
      item_name: item.item_name,
      description: item.description ?? '',
      brand: item.brand ?? '',
      category_id: item.category_id ?? '',
      unit_of_measure: item.unit_of_measure,
      cost: String(item.cost),
      selling_price: String(item.selling_price ?? ''),
      reorder_level: String(item.reorder_level ?? 10),
      barcode: '',
      attribute: (item as any).attribute ?? '',
      image_url: item.image_url ?? '',
    })
    setAttrValues(item.item_attribute_values?.map(v => ({ attribute_id: v.attribute_id, value: v.value })) ?? [])
    setImageFile(null)
    setImagePreview(item.image_url ?? null)
    setOpen(true)
  }

  function handleImageSelect(file: File) {
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function setAttrValue(attribute_id: string, value: string) {
    setAttrValues(prev => {
      const exists = prev.find(v => v.attribute_id === attribute_id)
      if (exists) return prev.map(v => v.attribute_id === attribute_id ? { ...v, value } : v)
      return [...prev, { attribute_id, value }]
    })
  }

  function getAttrValue(attribute_id: string) {
    return attrValues.find(v => v.attribute_id === attribute_id)?.value ?? ''
  }

  async function save() {
    if (!form.item_code.trim() || !form.item_name.trim()) {
      toast.error('Item code and name are required')
      return
    }
    setSaving(true)

    let imageUrl = form.image_url || null
    if (imageFile) {
      setUploadingImage(true)
      try {
        imageUrl = await uploadImageToDrive(imageFile, { displayName: form.item_name.trim(), folder: 'Items' })
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to upload image')
        setUploadingImage(false)
        setSaving(false)
        return
      }
      setUploadingImage(false)
    }

    const payload = {
      item_code: form.item_code.trim().toUpperCase(),
      item_name: form.item_name.trim(),
      description: form.description || null,
      brand: form.brand || null,
      category_id: form.category_id || null,
      unit_of_measure: form.unit_of_measure,
      cost: Number(form.cost) || 0,
      selling_price: form.selling_price ? Number(form.selling_price) : null,
      reorder_level: Number(form.reorder_level) || null,
      barcode: form.barcode || null,
      attribute: form.attribute || null,
      image_url: imageUrl,
      status: 'active',
    }

    let itemId = editing?.id
    if (editing) {
      const { error } = await supabase.from('items').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); setSaving(false); return }
    } else {
      const { data, error } = await supabase.from('items').insert(payload).select('id').single()
      if (error) { toast.error(error.message); setSaving(false); return }
      itemId = data.id
    }

    // Save attributes
    if (itemId) {
      const filledAttrs = attrValues.filter(v => v.value.trim())
      if (filledAttrs.length > 0) {
        await supabase.from('item_attribute_values').delete().eq('item_id', itemId)
        await supabase.from('item_attribute_values').insert(
          filledAttrs.map(v => ({ item_id: itemId!, attribute_id: v.attribute_id, value: v.value }))
        )
      }
    }

    toast.success(editing ? 'Item updated' : 'Item added')
    setOpen(false)
    load()
    setSaving(false)
  }

  async function toggleStatus(item: Item) {
    const newStatus = item.status === 'active' ? 'inactive' : 'active'
    const { error } = await supabase.from('items').update({ status: newStatus }).eq('id', item.id)
    if (error) toast.error(error.message)
    else { toast.success(`Item ${newStatus}`); load() }
  }

  async function confirmDelete() {
    if (!deleteId) return
    const { error } = await supabase.from('items').delete().eq('id', deleteId)
    if (error) toast.error(error.message)
    else { toast.success('Item deleted'); load() }
    setDeleteId(null)
  }

  function stockStatus(item: Item) {
    const qty = item.stock_levels?.reduce((s, l) => s + (l.quantity_on_hand ?? 0), 0) ?? 0
    const reorder = item.reorder_level ?? 0
    if (qty === 0) return { label: 'Out of Stock', cls: 'bg-red-100 text-red-800' }
    if (qty <= reorder) return { label: 'Low Stock', cls: 'bg-yellow-100 text-yellow-800' }
    return { label: 'In Stock', cls: 'bg-green-100 text-green-800' }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Item Master</h1>
          <p className="text-muted-foreground text-sm">{items.filter(i => i.status === 'active').length} active items</p>
        </div>
        <Button onClick={openAdd} className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-2" /> Add Item
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search items, brand…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex border rounded-md overflow-hidden shrink-0">
          <button onClick={() => setViewMode('list')}
            className={`h-9 w-9 flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-red-600 text-white' : 'bg-background text-muted-foreground hover:bg-accent'}`}>
            <List className="h-4 w-4" />
          </button>
          <button onClick={() => setViewMode('box')}
            className={`h-9 w-9 flex items-center justify-center border-l transition-colors ${viewMode === 'box' ? 'bg-red-600 text-white' : 'bg-background text-muted-foreground hover:bg-accent'}`}>
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {viewMode === 'box' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">No items found</div>
          ) : filtered.map(item => {
            const stock = stockStatus(item)
            const qty = item.stock_levels?.reduce((s, l) => s + (l.quantity_on_hand ?? 0), 0) ?? 0
            return (
              <div key={item.id} className="rounded-lg border bg-card overflow-hidden flex flex-col">
                <div className="h-32 bg-muted/40 flex items-center justify-center overflow-hidden">
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image_url} alt={item.item_name} className="h-full w-full object-contain p-2" />
                  ) : (
                    <Package className="h-8 w-8 text-muted-foreground/30" />
                  )}
                </div>
                <div className="p-3 flex-1 flex flex-col gap-1">
                  <div className="font-mono text-xs text-muted-foreground">{item.item_code}</div>
                  <div className="font-medium text-sm leading-tight line-clamp-2">{item.item_name}</div>
                  <div className="text-xs text-muted-foreground">{item.brand ?? '—'}</div>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="font-semibold text-sm">₱{(item.cost ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${stock.cls}`}>{stock.label}</span>
                  </div>
                </div>
                <div className="border-t px-3 py-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{qty.toLocaleString()} on hand</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(item)}>Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleStatus(item)}>
                        {item.status === 'active' ? 'Deactivate' : 'Activate'}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(item.id)}>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">Image</TableHead>
              <TableHead>Item Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>UOM</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Selling Price</TableHead>
              <TableHead className="text-right">On Hand</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No items found</TableCell></TableRow>
            ) : filtered.map(item => {
              const stock = stockStatus(item)
              const qty = item.stock_levels?.reduce((s, l) => s + (l.quantity_on_hand ?? 0), 0) ?? 0
              const attrs = item.item_attribute_values ?? []
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="h-9 w-9 rounded border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
                      {item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image_url} alt={item.item_name} className="h-full w-full object-contain p-0.5" />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground/30" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm font-medium">{item.item_code}</TableCell>
                  <TableCell>
                    <div className="font-medium">{item.item_name}</div>
                    {attrs.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {attrs.map(a => (
                          <span key={a.attribute_id} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {(a.attribute as any)?.name}: {a.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{item.brand ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{(item.category as any)?.category_name ?? '—'}</TableCell>
                  <TableCell className="text-sm">{item.unit_of_measure}</TableCell>
                  <TableCell className="text-right font-medium">₱{(item.cost ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right font-medium">
                    {item.selling_price != null ? `₱${item.selling_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : <span className="text-muted-foreground/40">—</span>}
                  </TableCell>
                  <TableCell className="text-right font-medium">{qty.toLocaleString()}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stock.cls}`}>{stock.label}</span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(item)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleStatus(item)}>
                          {item.status === 'active' ? 'Deactivate' : 'Activate'}
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
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-red-600" />
              {editing ? 'Edit Item' : 'Add Item'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* ── Basic Info ── */}
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">Basic Info</p>
              <div className="space-y-1.5">
                <Label>Picture</Label>
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 rounded-lg border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
                    {imagePreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imagePreview} alt="Item preview" className="h-full w-full object-contain p-1" />
                    ) : (
                      <Package className="h-6 w-6 text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={uploadingImage} onClick={() => document.getElementById('item-picture-input')?.click()}>
                      {uploadingImage ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5 mr-1.5" />}
                      {imagePreview ? 'Change Picture' : 'Upload Picture'}
                    </Button>
                    {imagePreview && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setImageFile(null); setImagePreview(null); setForm(p => ({ ...p, image_url: '' })) }}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <input
                      id="item-picture-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleImageSelect(f); e.target.value = '' }}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Item Code <span className="text-destructive">*</span></Label>
                  <Input placeholder="e.g. BOLT-M10" value={form.item_code} onChange={e => setForm(p => ({ ...p, item_code: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Barcode</Label>
                  <Input placeholder="Scan or enter barcode" value={form.barcode} onChange={e => setForm(p => ({ ...p, barcode: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Item Name <span className="text-destructive">*</span></Label>
                <Input placeholder="Full item name" value={form.item_name} onChange={e => setForm(p => ({ ...p, item_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea rows={2} placeholder="Optional detailed description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Brand</Label>
                  <Select value={form.brand} onValueChange={v => setForm(p => ({ ...p, brand: v ?? '' }))}>
                    <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— No brand —</SelectItem>
                      {brands.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={form.category_id} onValueChange={v => setForm(p => ({ ...p, category_id: v ?? '' }))}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— No category —</SelectItem>
                      {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.category_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Unit of Measure</Label>
                <Select value={form.unit_of_measure} onValueChange={v => setForm(p => ({ ...p, unit_of_measure: v ?? 'PCS' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {uoms.length > 0
                      ? uoms.map(u => <SelectItem key={u.id} value={u.code}>{u.code} — {u.name}</SelectItem>)
                      : ['PCS','BOX','SET','UNIT','KG','LTR','MTR'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)
                    }
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Attribute</Label>
                <Select value={form.attribute} onValueChange={v => setForm(p => ({ ...p, attribute: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select attribute / variant" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— None —</SelectItem>
                    {attributes.map(attr => (
                      <div key={attr.id}>
                        <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{attr.name}</div>
                        {(attr.options ?? []).map(opt => (
                          <SelectItem key={`${attr.id}-${opt}`} value={opt}>{opt}</SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Pricing & Stock ── */}
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">Pricing & Stock</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Cost Price (₱)</Label>
                  <Input type="number" min={0} step="0.01" placeholder="0.00" value={form.cost} onChange={e => setForm(p => ({ ...p, cost: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Selling Price (₱)</Label>
                  <Input type="number" min={0} step="0.01" placeholder="0.00" value={form.selling_price} onChange={e => setForm(p => ({ ...p, selling_price: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Reorder Level</Label>
                <Input type="number" min={0} value={form.reorder_level} onChange={e => setForm(p => ({ ...p, reorder_level: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Alert triggers when on-hand qty falls to or below this number</p>
              </div>
            </div>

            {/* ── Attributes ── */}
            {attributes.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">Attributes</p>
                <div className="grid grid-cols-2 gap-4">
                  {attributes.map(attr => (
                    <div key={attr.id} className="space-y-1.5">
                      <Label>{attr.name}</Label>
                      {attr.data_type === 'select' && attr.options ? (
                        <Select value={getAttrValue(attr.id)} onValueChange={v => setAttrValue(attr.id, v ?? '')}>
                          <SelectTrigger><SelectValue placeholder={`Select ${attr.name}`} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">— None —</SelectItem>
                            {attr.options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type={attr.data_type === 'number' ? 'number' : 'text'}
                          placeholder={`Enter ${attr.name}`}
                          value={getAttrValue(attr.id)}
                          onChange={e => setAttrValue(attr.id, e.target.value)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? 'Saving…' : editing ? 'Update Item' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Item?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete this item and all its data.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
