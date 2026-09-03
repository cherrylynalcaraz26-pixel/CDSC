'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { subMonths, format } from 'date-fns'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/error-message'
import {
  Store, Plus, Loader2, Pencil, Trash2, MoreHorizontal, ImagePlus, X, Package,
  LayoutGrid, List, ArrowLeft, Lightbulb, TrendingUp, MessageSquareQuote, History, Layers, ArrowUpDown,
} from 'lucide-react'
import { useSearchContext } from '@/context/search-context'
import { usePersistedState } from '@/lib/use-persisted-state'
import { uploadImageToDrive } from '@/lib/upload-image'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
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
  brand: string | null
  price: number | null
  image_url: string | null
  is_active: boolean
  created_at: string
}

interface UOMOption { id: string; code: string; name: string }

const emptyForm = () => ({ item_name: '', description: '', unit_of_measure: 'piece', attribute: '', brand: '', price: '' })
const CUSTOM_SENTINEL = '__custom__'

type SortOption = 'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc'
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'price-asc', label: 'Price (Low–High)' },
  { value: 'price-desc', label: 'Price (High–Low)' },
]

function fmt(n: number | null) {
  if (n === null || n === undefined) return '—'
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Dropdown-of-known-values-with-a-manual-typing-escape-hatch, shared by the Unit,
 *  Brand, and Attribute fields on the Add/Edit dialog. `customMode` is owned by the
 *  caller so openAdd()/openEdit() can decide up front whether to show the dropdown
 *  or the free-text field. */
function ComboField({
  value, onChange, options, label, customMode, onCustomModeChange,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  label: string
  customMode: boolean
  onCustomModeChange: (v: boolean) => void
}) {
  return customMode ? (
    <div className="flex gap-1">
      <Input
        autoFocus
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={`Type a ${label.toLowerCase()}…`}
      />
      <Button type="button" variant="outline" size="icon" className="shrink-0" title="Choose from list"
        onClick={() => { onCustomModeChange(false); onChange(options[0] ?? '') }}>
        <ArrowLeft className="h-3.5 w-3.5" />
      </Button>
    </div>
  ) : (
    <Select
      value={value}
      onValueChange={v => {
        if (v === CUSTOM_SENTINEL) { onCustomModeChange(true); onChange(''); return }
        onChange(v ?? '')
      }}
    >
      <SelectTrigger className="w-full"><SelectValue placeholder={`Select ${label.toLowerCase()}…`} /></SelectTrigger>
      <SelectContent>
        {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        <SelectItem value={CUSTOM_SENTINEL}>Type manually…</SelectItem>
      </SelectContent>
    </Select>
  )
}

// Recommendations tab types
interface OpenRequest {
  id: string
  item_name: string
  description: string | null
  unit_of_measure: string | null
  selling_price: number | null
  client_name: string | null
  created_at: string
}
interface DemandRow { item_name: string; totalQty: number; orderCount: number }
interface PastPurchasedRow { item_name: string; unit_of_measure: string | null; lastPrice: number | null; orderCount: number }

function VendorCatalogPageContent() {
  const supabase = createClient()
  const { query: search } = useSearchContext()
  const [tab, setTab] = useState<'items' | 'recommendations'>('items')
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<CatalogItem[]>([])
  const [uomList, setUomList] = useState<UOMOption[]>([])
  const [brandOptions, setBrandOptions] = useState<string[]>([])
  const [attributeOptions, setAttributeOptions] = useState<string[]>([])
  const [view, setView] = usePersistedState<'card' | 'list'>('vendor-catalog:view', 'card')
  const [sortBy, setSortBy] = usePersistedState<SortOption>('vendor-catalog:sort', 'newest')
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [unitCustomMode, setUnitCustomMode] = useState(false)
  const [brandCustomMode, setBrandCustomMode] = useState(false)
  const [attributeCustomMode, setAttributeCustomMode] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Recommendations tab state
  const [recsLoading, setRecsLoading] = useState(false)
  const [recsLoaded, setRecsLoaded] = useState(false)
  const [openRequests, setOpenRequests] = useState<OpenRequest[]>([])
  const [demandRows, setDemandRows] = useState<DemandRow[]>([])
  const [pastPurchasedRows, setPastPurchasedRows] = useState<PastPurchasedRow[]>([])
  const [addingAll, setAddingAll] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }
    const [{ data: supplierRow }, { data: uomData }, { data: brandData }, { data: attrData }] = await Promise.all([
      supabase.from('suppliers').select('id').eq('auth_user_id', session.user.id).single(),
      supabase.from('uom_list').select('id, code, name').eq('is_active', true).order('code'),
      supabase.from('brands').select('name').eq('is_active', true).order('name'),
      supabase.from('attributes').select('options').eq('is_active', true),
    ])
    setUomList((uomData ?? []) as UOMOption[])
    setBrandOptions((brandData ?? []).map((b: { name: string }) => b.name))
    const flatAttrOptions = Array.from(new Set(
      ((attrData ?? []) as { options: string[] | null }[]).flatMap(a => a.options ?? [])
    )).sort((a, b) => a.localeCompare(b))
    setAttributeOptions(flatAttrOptions)
    if (!supplierRow) { setLoading(false); return }
    setSupplierId(supplierRow.id)
    const { data } = await supabase.from('vendor_catalog_items').select('*').eq('supplier_id', supplierRow.id).order('created_at', { ascending: false })
    setItems((data ?? []) as CatalogItem[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function loadRecommendations() {
    if (!supplierId) return
    setRecsLoading(true)
    const [{ data: catalogRows }, { data: suggestions }, soItemsRows, poItemsRows] = await Promise.all([
      supabase.from('vendor_catalog_items').select('item_name').eq('supplier_id', supplierId),
      supabase.from('item_suggestions').select('id, item_name, description, unit_of_measure, selling_price, client_name, created_at').eq('status', 'pending').order('created_at', { ascending: false }),
      fetchAllRows((from, to) =>
        supabase.from('so_items')
          .select('item_name, quantity, so_id, sales_orders!inner(status, so_date, created_at)')
          .neq('sales_orders.status', 'cancelled')
          .order('id')
          .range(from, to)
      ),
      fetchAllRows((from, to) =>
        supabase.from('po_items')
          .select('item_name, unit_of_measure, unit_cost, po_id, purchase_orders!inner(supplier_id, status)')
          .eq('purchase_orders.supplier_id', supplierId)
          .order('id')
          .range(from, to)
      ),
    ])

    const myCatalogNames = new Set((catalogRows ?? []).map((r: { item_name: string }) => r.item_name.trim().toLowerCase()))

    setOpenRequests(((suggestions ?? []) as OpenRequest[]).filter(s => !myCatalogNames.has(s.item_name.trim().toLowerCase())))

    const sixMonthsAgo = subMonths(new Date(), 6).toISOString().slice(0, 10)
    const demandMap: Record<string, { qty: number; orders: Set<string> }> = {}
    for (const r of soItemsRows as any[]) {
      const so = r.sales_orders
      const date = (so?.so_date ?? so?.created_at ?? '').slice(0, 10)
      if (!date || date < sixMonthsAgo) continue
      const name = (r.item_name ?? '').trim()
      if (!name || myCatalogNames.has(name.toLowerCase())) continue
      if (!demandMap[name]) demandMap[name] = { qty: 0, orders: new Set() }
      demandMap[name].qty += Number(r.quantity) || 0
      demandMap[name].orders.add(r.so_id)
    }
    const demand = Object.entries(demandMap)
      .map(([item_name, v]) => ({ item_name, totalQty: v.qty, orderCount: v.orders.size }))
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 15)
    setDemandRows(demand)

    const pastMap: Record<string, { unit: string | null; price: number | null; orders: Set<string> }> = {}
    for (const r of poItemsRows as any[]) {
      if (r.purchase_orders?.status === 'cancelled') continue
      const name = (r.item_name ?? '').trim()
      if (!name || myCatalogNames.has(name.toLowerCase())) continue
      if (!pastMap[name]) pastMap[name] = { unit: r.unit_of_measure ?? null, price: null, orders: new Set() }
      pastMap[name].price = r.unit_cost != null ? Number(r.unit_cost) : pastMap[name].price
      pastMap[name].orders.add(r.po_id)
    }
    const pastPurchased = Object.entries(pastMap)
      .map(([item_name, v]) => ({ item_name, unit_of_measure: v.unit, lastPrice: v.price, orderCount: v.orders.size }))
      .sort((a, b) => b.orderCount - a.orderCount)
    setPastPurchasedRows(pastPurchased)

    setRecsLoading(false)
    setRecsLoaded(true)
  }

  function openTab(t: 'items' | 'recommendations') {
    setTab(t)
    if (t === 'recommendations' && !recsLoaded && !recsLoading) loadRecommendations()
  }

  function computeCustomMode(value: string, options: string[]) {
    if (!value) return false
    return !options.some(o => o.toLowerCase() === value.toLowerCase())
  }

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm())
    // Always show the dropdown first for a brand-new item — manual typing is an
    // opt-in escape hatch, not the default.
    setUnitCustomMode(false)
    setBrandCustomMode(false)
    setAttributeCustomMode(false)
    setImageFile(null)
    setImagePreview(null)
    setOpen(true)
  }

  function openAddWithPrefill(name: string, desc?: string | null, unit?: string | null, price?: number | null) {
    openAdd()
    const prefillUnit = unit || 'piece'
    setForm({
      item_name: name,
      description: desc ?? '',
      unit_of_measure: prefillUnit,
      attribute: '',
      brand: '',
      price: price ? String(price) : '',
    })
    setUnitCustomMode(computeCustomMode(prefillUnit, uomList.map(u => u.name)))
  }

  function openEdit(it: CatalogItem) {
    setEditingId(it.id)
    setForm({
      item_name: it.item_name,
      description: it.description ?? '',
      unit_of_measure: it.unit_of_measure,
      attribute: it.attribute ?? '',
      brand: it.brand ?? '',
      price: it.price != null ? String(it.price) : '',
    })
    setUnitCustomMode(computeCustomMode(it.unit_of_measure, uomList.map(u => u.name)))
    setBrandCustomMode(computeCustomMode(it.brand ?? '', brandOptions))
    setAttributeCustomMode(computeCustomMode(it.attribute ?? '', attributeOptions))
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
        brand: form.brand.trim() || null,
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
      setRecsLoaded(false)
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to save item'))
    }
    setSaving(false)
  }

  async function toggleActive(it: CatalogItem) {
    const { error } = await supabase.from('vendor_catalog_items').update({ is_active: !it.is_active }).eq('id', it.id)
    if (error) { toast.error(getErrorMessage(error)); return }
    load()
  }

  async function confirmDelete() {
    if (!deleteId) return
    const { error } = await supabase.from('vendor_catalog_items').delete().eq('id', deleteId)
    if (error) toast.error(getErrorMessage(error))
    else { toast.success('Item removed'); load() }
    setDeleteId(null)
  }

  async function addAllToCatalog(section: string, rows: { item_name: string; unit_of_measure?: string | null; price?: number | null }[]) {
    if (!supplierId || rows.length === 0) return
    setAddingAll(section)
    const payload = rows.map(r => ({
      supplier_id: supplierId,
      item_name: r.item_name,
      unit_of_measure: r.unit_of_measure || 'piece',
      price: r.price ?? null,
    }))
    const { error } = await supabase.from('vendor_catalog_items').insert(payload)
    if (error) toast.error(getErrorMessage(error))
    else {
      toast.success(`${rows.length} item${rows.length !== 1 ? 's' : ''} added to your catalog`)
      load()
      loadRecommendations()
    }
    setAddingAll(null)
  }

  const filtered = items
    .filter(it => {
      const q = search.toLowerCase()
      return !q || it.item_name.toLowerCase().includes(q) || (it.description ?? '').toLowerCase().includes(q)
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case 'name-asc': return a.item_name.localeCompare(b.item_name)
        case 'name-desc': return b.item_name.localeCompare(a.item_name)
        case 'price-asc': return (a.price ?? 0) - (b.price ?? 0)
        case 'price-desc': return (b.price ?? 0) - (a.price ?? 0)
        case 'newest':
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

  if (loading) return (
    <div className="flex justify-center py-24">
      <Loader2 className="h-7 w-7 text-red-600 animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Item Catalog</h1>
        <p className="text-sm text-gray-500 mt-0.5">Items you can supply — CDSC&apos;s purchasing team picks from here when creating a Purchase Order with you.</p>
      </div>

      {/* Tabs + toolbar, same row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-200">
        <div className="flex gap-0">
          {[
            { id: 'items' as const, label: 'My Items', icon: Store },
            { id: 'recommendations' as const, label: 'Recommendations', icon: Lightbulb },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => openTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <t.icon className="h-4 w-4" />{t.label}
            </button>
          ))}
        </div>
        {tab === 'items' && (
          <div className="flex items-center gap-2 pb-2 sm:pb-0">
            <Select value={sortBy} onValueChange={v => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[150px] h-9">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-gray-400" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button onClick={() => setView('list')} title="List view"
                className={`h-9 w-9 flex items-center justify-center transition-colors ${view === 'list' ? 'bg-red-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
                <List className="h-4 w-4" />
              </button>
              <button onClick={() => setView('card')} title="Box view"
                className={`h-9 w-9 flex items-center justify-center border-l border-gray-200 transition-colors ${view === 'card' ? 'bg-red-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
            <Button onClick={openAdd} className="bg-red-600 hover:bg-red-700">
              <Plus className="h-4 w-4 mr-2" /> Add Item
            </Button>
          </div>
        )}
      </div>

      {tab === 'items' ? (
        <>
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
                        <div className="text-xs text-gray-400">
                          {it.brand ? `${it.brand} · ` : ''}{it.unit_of_measure}{it.attribute ? ` · ${it.attribute}` : ''}
                        </div>
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
                    <TableHead className="w-10">No.</TableHead>
                    <TableHead className="w-12">Photo</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Attribute</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((it, idx) => (
                    <TableRow key={it.id} className={!it.is_active ? 'opacity-60' : ''}>
                      <TableCell className="text-sm text-muted-foreground">{idx + 1}</TableCell>
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
                      <TableCell className="text-sm text-muted-foreground">{it.brand ?? '—'}</TableCell>
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
        </>
      ) : (
        <div className="space-y-7">
          {recsLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-7 w-7 text-red-600 animate-spin" />
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 -mt-2">What CDSC&apos;s clients are asking for and buying — a guide to what&apos;s worth offering.</p>

              {/* Past purchased */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-emerald-600" />
                    <h2 className="text-sm font-semibold text-gray-900">Items You&apos;ve Supplied Before</h2>
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{pastPurchasedRows.length}</span>
                  </div>
                  {pastPurchasedRows.length > 0 && (
                    <button
                      onClick={() => addAllToCatalog('past', pastPurchasedRows.map(r => ({ item_name: r.item_name, unit_of_measure: r.unit_of_measure, price: r.lastPrice })))}
                      disabled={addingAll === 'past'}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {addingAll === 'past' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />} Add All to My Catalog
                    </button>
                  )}
                </div>
                {pastPurchasedRows.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 py-10 text-center">
                    <p className="text-sm text-gray-400">CDSC hasn&apos;t ordered anything from you yet that isn&apos;t already in your catalog.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                    {pastPurchasedRows.map(p => (
                      <div key={p.item_name} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{p.item_name}</div>
                          <div className="text-xs text-gray-400">
                            Ordered {p.orderCount} time{p.orderCount !== 1 ? 's' : ''} before
                            {p.lastPrice != null && <> · Last price {fmt(p.lastPrice)}</>}
                          </div>
                        </div>
                        <button
                          onClick={() => openAddWithPrefill(p.item_name, undefined, p.unit_of_measure, p.lastPrice)}
                          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add to My Catalog
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Client requests */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MessageSquareQuote className="h-4 w-4 text-red-600" />
                    <h2 className="text-sm font-semibold text-gray-900">Client Requests You Could Fulfill</h2>
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{openRequests.length}</span>
                  </div>
                  {openRequests.length > 0 && (
                    <button
                      onClick={() => addAllToCatalog('requests', openRequests.map(r => ({ item_name: r.item_name, unit_of_measure: r.unit_of_measure, price: r.selling_price })))}
                      disabled={addingAll === 'requests'}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {addingAll === 'requests' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />} Add All to My Catalog
                    </button>
                  )}
                </div>
                {openRequests.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 py-10 text-center">
                    <p className="text-sm text-gray-400">No open client requests right now that aren&apos;t already in your catalog.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {openRequests.map(r => (
                      <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-900 truncate" title={r.item_name}>{r.item_name}</div>
                          {r.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{r.description}</p>}
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                            {r.client_name && <span>Requested by {r.client_name}</span>}
                            <span>· {format(new Date(r.created_at), 'MMM d, yyyy')}</span>
                          </div>
                          {r.selling_price != null && (
                            <div className="text-xs font-semibold text-gray-600 mt-1">Suggested price: {fmt(r.selling_price)}</div>
                          )}
                        </div>
                        <button
                          onClick={() => openAddWithPrefill(r.item_name, r.description, r.unit_of_measure, r.selling_price)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors w-fit"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add to My Catalog
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Frequently purchased */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    <h2 className="text-sm font-semibold text-gray-900">Frequently Purchased Items You Don&apos;t Carry Yet</h2>
                  </div>
                  {demandRows.length > 0 && (
                    <button
                      onClick={() => addAllToCatalog('demand', demandRows.map(r => ({ item_name: r.item_name })))}
                      disabled={addingAll === 'demand'}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {addingAll === 'demand' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />} Add All to My Catalog
                    </button>
                  )}
                </div>
                {demandRows.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 py-10 text-center">
                    <p className="text-sm text-gray-400">No demand data available yet.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                    {demandRows.map(d => (
                      <div key={d.item_name} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{d.item_name}</div>
                          <div className="text-xs text-gray-400">{d.totalQty.toLocaleString()} units across {d.orderCount} order{d.orderCount !== 1 ? 's' : ''} in the last 6 months</div>
                        </div>
                        <button
                          onClick={() => openAddWithPrefill(d.item_name)}
                          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add to My Catalog
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="w-[95vw] max-w-2xl p-0 overflow-hidden">
          <div className="relative bg-gradient-to-r from-red-700 to-red-900 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-white text-lg font-semibold">{editingId ? 'Edit Catalog Item' : 'Add Catalog Item'}</DialogTitle>
            </DialogHeader>
            <p className="text-red-100 text-xs mt-1">Items you can supply — shown to CDSC&apos;s purchasing team.</p>
            <DialogClose className="absolute top-4 right-4 text-red-100 hover:text-white transition-colors">
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>
          <div className="space-y-4 p-6">
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Brand</Label>
                <ComboField
                  label="Brand"
                  value={form.brand}
                  onChange={v => setForm(f => ({ ...f, brand: v }))}
                  options={brandOptions}
                  customMode={brandCustomMode}
                  onCustomModeChange={setBrandCustomMode}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Attribute</Label>
                <ComboField
                  label="Attribute"
                  value={form.attribute}
                  onChange={v => setForm(f => ({ ...f, attribute: v }))}
                  options={attributeOptions}
                  customMode={attributeCustomMode}
                  onCustomModeChange={setAttributeCustomMode}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <ComboField
                  label="Unit"
                  value={form.unit_of_measure}
                  onChange={v => setForm(f => ({ ...f, unit_of_measure: v }))}
                  options={uomList.map(u => u.name)}
                  customMode={unitCustomMode}
                  onCustomModeChange={setUnitCustomMode}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Price (₱)</Label>
                <Input type="number" min={0} step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-b-2xl">
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
