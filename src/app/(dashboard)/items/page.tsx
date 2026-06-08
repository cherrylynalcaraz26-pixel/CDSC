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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Search, MoreHorizontal, Package, X } from 'lucide-react'
import { toast } from 'sonner'

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
}

interface AttrValue { attribute_id: string; value: string }

const emptyForm = (): ItemForm => ({
  item_code: '', item_name: '', description: '', brand: '',
  category_id: '', unit_of_measure: 'PCS', cost: '', selling_price: '', reorder_level: '10', barcode: '',
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
    })
    setAttrValues(item.item_attribute_values?.map(v => ({ attribute_id: v.attribute_id, value: v.value })) ?? [])
    setOpen(true)
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
        <Button onClick={openAdd} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="h-4 w-4 mr-2" /> Add Item
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search items, brand…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>UOM</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">On Hand</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No items found</TableCell></TableRow>
            ) : filtered.map(item => {
              const stock = stockStatus(item)
              const qty = item.stock_levels?.reduce((s, l) => s + (l.quantity_on_hand ?? 0), 0) ?? 0
              const attrs = item.item_attribute_values ?? []
              return (
                <TableRow key={item.id}>
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

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-500" />
              {editing ? 'Edit Item' : 'Add Item'}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="basic">
            <TabsList className="w-full">
              <TabsTrigger value="basic" className="flex-1">Basic Info</TabsTrigger>
              <TabsTrigger value="pricing" className="flex-1">Pricing & Stock</TabsTrigger>
              <TabsTrigger value="attributes" className="flex-1">Attributes</TabsTrigger>
            </TabsList>

            {/* Basic Info Tab */}
            <TabsContent value="basic" className="space-y-4 pt-4">
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
            </TabsContent>

            {/* Pricing & Stock Tab */}
            <TabsContent value="pricing" className="space-y-4 pt-4">
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
                <p className="text-xs text-muted-foreground">Trigger low-stock alert when on-hand qty falls to or below this number</p>
              </div>
            </TabsContent>

            {/* Attributes Tab */}
            <TabsContent value="attributes" className="space-y-3 pt-4">
              {attributes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No attributes defined yet. Go to <strong>Setup → Attributes</strong> to add some.
                </p>
              ) : attributes.map(attr => (
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
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
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
