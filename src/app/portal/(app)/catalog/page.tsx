'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Store, Plus, Loader2, Pencil, Trash2, MoreHorizontal, ImagePlus, X, Package,
  LayoutGrid, List, ArrowLeft,
} from 'lucide-react'
import { useSearchContext } from '@/context/search-context'
import { usePersistedState } from '@/lib/use-persisted-state'
import { uploadImageToDrive } from '@/lib/upload-image'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface CatalogItem {
  id: string
  item_name: string
  description: string | null
  unit_of_measure: string
  attribute: string | null
  price: number | null
  image_url: string | null
  is_active: boolean
  created_at: string
}

interface UOMOption { id: string; code: string; name: string }

const emptyForm = () => ({ item_name: '', description: '', unit_of_measure: 'piece', attribute: '', price: '' })
const CUSTOM_UNIT_SENTINEL = '__custom__'

function fmt(n: number | null) {
  if (n === null || n === undefined) return '—'
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function VendorCatalogPageContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const { query: search } = useSearchContext()
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<CatalogItem[]>([])
  const [uomList, setUomList] = useState<UOMOption[]>([])
  const [view, setView] = usePersistedState<'card' | 'list'>('vendor-catalog:view', 'card')
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [unitCustomMode, setUnitCustomMode] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }
    const [{ data: supplierRow }, { data: uomData }] = await Promise.all([
      supabase.from('suppliers').select('id').eq('auth_user_id', session.user.id).single(),
      supabase.from('uom_list').select('id, code, name').eq('is_active', true).order('code'),
    ])
    setUomList((uomData ?? []) as UOMOption[])
    if (!supplierRow) { setLoading(false); return }
    setSupplierId(supplierRow.id)
    const { data } = await supabase.from('vendor_catalog_items').select('*').eq('supplier_id', supplierRow.id).order('created_at', { ascending: false })
    setItems((data ?? []) as CatalogItem[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // A "Add to My Catalog" link from the Recommendations page can prefill this
  // form via query params so the vendor doesn't have to retype what's already known.
  useEffect(() => {
    const name = searchParams.get('prefill_name')
    if (!name || loading) return
    openAdd()
    const prefillUnit = searchParams.get('prefill_unit') ?? 'piece'
    setForm({
      item_name: name,
      description: searchParams.get('prefill_desc') ?? '',
      unit_of_measure: prefillUnit,
      attribute: '',
      price: searchParams.get('prefill_price') ?? '',
    })
    setUnitCustomMode(!uomList.some(u => u.name.toLowerCase() === prefillUnit.toLowerCase()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm())
    setUnitCustomMode(!uomList.some(u => u.name.toLowerCase() === 'piece'))
    setImageFile(null)
    setImagePreview(null)
    setOpen(true)
  }

  function openEdit(it: CatalogItem) {
    setEditingId(it.id)
    setForm({
      item_name: it.item_name,
      description: it.description ?? '',
      unit_of_measure: it.unit_of_measure,
      attribute: it.attribute ?? '',
      price: it.price != null ? String(it.price) : '',
    })
    setUnitCustomMode(!uomList.some(u => u.name.toLowerCase() === it.unit_of_measure.toLowerCase()))
    setImageFile(null)
    setImagePreview(it.image_url)
    setOpen(true)
  }

  function handleImageSelect(file: File) {
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function save() {
    if (!supplierId) return
    if (!form.item_name.trim()) { toast.error('Item name is required'); return }
    setSaving(true)
    try {
      let imageUrl = imageFile ? null : imagePreview
      if (imageFile) {
        imageUrl = await uploadImageToDrive(imageFile, { displayName: form.item_name.trim(), folder: 'Vendor Catalog' })
      }
      const payload = {
        supplier_id: supplierId,
        item_name: form.item_name.trim(),
        description: form.description.trim() || null,
        unit_of_measure: form.unit_of_measure.trim() || 'piece',
        attribute: form.attribute.trim() || null,
        price: form.price.trim() ? Number(form.price) : null,
        image_url: imageUrl,
      }
      const { error } = editingId
        ? await supabase.from('vendor_catalog_items').update(payload).eq('id', editingId)
        : await supabase.from('vendor_catalog_items').insert(payload)
      if (error) throw error
      toast.success(editingId ? 'Item updated' : 'Item added to your catalog')
      setOpen(false)
      load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save item')
    }
    setSaving(false)
  }

  async function toggleActive(it: CatalogItem) {
    const { error } = await supabase.from('vendor_catalog_items').update({ is_active: !it.is_active }).eq('id', it.id)
    if (error) { toast.error(error.message); return }
    load()
  }

  async function confirmDelete() {
    if (!deleteId) return
    const { error } = await supabase.from('vendor_catalog_items').delete().eq('id', deleteId)
    if (error) toast.error(error.message)
    else { toast.success('Item removed'); load() }
    setDeleteId(null)
  }

  const filtered = items.filter(it => {
    const q = search.toLowerCase()
    return !q || it.item_name.toLowerCase().includes(q) || (it.description ?? '').toLowerCase().includes(q)
  })

  if (loading) return (
    <div className="flex justify-center py-24">
      <Loader2 className="h-7 w-7 text-red-600 animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Catalog</h1>
          <p className="text-sm text-gray-500 mt-0.5">Items you can supply — CDSC&apos;s purchasing team picks from here when creating a Purchase Order with you.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={() => setView('card')} title="Card view"
              className={`h-9 w-9 flex items-center justify-center transition-colors ${view === 'card' ? 'bg-red-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button onClick={() => setView('list')} title="List view"
              className={`h-9 w-9 flex items-center justify-center border-l border-gray-200 transition-colors ${view === 'list' ? 'bg-red-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
              <List className="h-4 w-4" />
            </button>
          </div>
          <Button onClick={openAdd} className="bg-red-600 hover:bg-red-700">
            <Plus className="h-4 w-4 mr-2" /> Add Item
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <Store className="h-8 w-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">{items.length === 0 ? 'Your catalog is empty. Add the items you can supply.' : 'No items match your search.'}</p>
          {items.length === 0 && (
            <Button onClick={openAdd} className="mt-4 bg-red-600 hover:bg-red-700">
              <Plus className="h-4 w-4 mr-2" /> Add Your First Item
            </Button>
          )}
        </div>
      ) : view === 'card' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(it => (
            <div key={it.id} className={`bg-white rounded-xl border overflow-hidden ${it.is_active ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
              <div className="h-32 bg-gray-50 flex items-center justify-center overflow-hidden">
                {it.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image_url} alt={it.item_name} className="h-full w-full object-contain p-2" />
                ) : (
                  <Package className="h-8 w-8 text-gray-200" />
                )}
              </div>
              <div className="p-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate" title={it.item_name}>{it.item_name}</div>
                    <div className="text-xs text-gray-400">{it.unit_of_measure}{it.attribute ? ` · ${it.attribute}` : ''}</div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="h-7 w-7 shrink-0 flex items-center justify-center rounded hover:bg-gray-100">
                      <MoreHorizontal className="h-4 w-4 text-gray-500" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(it)}><Pencil className="h-3.5 w-3.5 mr-2" />Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleActive(it)}>{it.is_active ? 'Mark Unavailable' : 'Mark Available'}</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(it.id)}><Trash2 className="h-3.5 w-3.5 mr-2" />Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {it.description && <p className="text-xs text-gray-500 line-clamp-2">{it.description}</p>}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-bold text-red-600">{fmt(it.price)}</span>
                  {!it.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Unavailable</span>}
                </div>
                <div className="text-[10px] text-gray-300">Added {format(new Date(it.created_at), 'MMM d, yyyy')}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Photo</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead>Attribute</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(it => (
                <TableRow key={it.id} className={!it.is_active ? 'opacity-60' : ''}>
                  <TableCell>
                    <div className="h-9 w-9 rounded border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
                      {it.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.image_url} alt={it.item_name} className="h-full w-full object-contain p-0.5" />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground/30" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{it.item_name}</div>
                    {it.description && <div className="text-xs text-muted-foreground line-clamp-1">{it.description}</div>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{it.attribute ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{it.unit_of_measure}</TableCell>
                  <TableCell className="text-right text-sm font-semibold text-red-600">{fmt(it.price)}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${it.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {it.is_active ? 'Available' : 'Unavailable'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(it)}><Pencil className="h-3.5 w-3.5 mr-2" />Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(it)}>{it.is_active ? 'Mark Unavailable' : 'Mark Available'}</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(it.id)}><Trash2 className="h-3.5 w-3.5 mr-2" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Catalog Item' : 'Add Catalog Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-4">
              <label className="h-20 w-20 shrink-0 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-red-400 transition-colors relative">
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagePreview} alt="Preview" className="h-full w-full object-contain p-1" />
                ) : (
                  <ImagePlus className="h-6 w-6 text-gray-300" />
                )}
                <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageSelect(f) }} />
              </label>
              {imagePreview && (
                <button type="button" onClick={() => { setImageFile(null); setImagePreview(null) }} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1">
                  <X className="h-3 w-3" /> Remove photo
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Item Name <span className="text-destructive">*</span></Label>
              <Input value={form.item_name} onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))} placeholder="e.g. Portland Cement 40kg" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brand, specs, notes…" />
            </div>
            <div className="space-y-1.5">
              <Label>Attribute</Label>
              <Input value={form.attribute} onChange={e => setForm(f => ({ ...f, attribute: e.target.value }))} placeholder="e.g. Red, 10mm, Large…" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Unit</Label>
                {unitCustomMode ? (
                  <div className="flex gap-1">
                    <Input
                      autoFocus
                      value={form.unit_of_measure}
                      onChange={e => setForm(f => ({ ...f, unit_of_measure: e.target.value }))}
                      placeholder="Type a unit…"
                    />
                    <Button type="button" variant="outline" size="icon" className="shrink-0" title="Choose from list"
                      onClick={() => { setUnitCustomMode(false); setForm(f => ({ ...f, unit_of_measure: uomList[0]?.name ?? '' })) }}>
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Select
                    value={form.unit_of_measure}
                    onValueChange={v => {
                      if (v === CUSTOM_UNIT_SENTINEL) { setUnitCustomMode(true); setForm(f => ({ ...f, unit_of_measure: '' })); return }
                      setForm(f => ({ ...f, unit_of_measure: v ?? '' }))
                    }}
                  >
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select unit…" /></SelectTrigger>
                    <SelectContent>
                      {uomList.map(u => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}
                      <SelectItem value={CUSTOM_UNIT_SENTINEL}>Type manually…</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Price (₱)</Label>
                <Input type="number" min={0} step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingId ? 'Save Changes' : 'Add to Catalog'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remove this item?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This removes it from your catalog. It won&apos;t affect any existing Purchase Orders.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function VendorCatalogPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-24"><Loader2 className="h-7 w-7 text-red-600 animate-spin" /></div>}>
      <VendorCatalogPageContent />
    </Suspense>
  )
}
