'use client'

import { useState, useEffect, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, X, Search, MoreHorizontal, Loader2, FileText, LayoutGrid, List, ChevronDown, ChevronRight, Package, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { useSearchContext } from '@/context/search-context'

interface ItemOption { item_name: string; unit_of_measure: string }

interface CSIRecord {
  id: number
  si_date: string
  si_number: string
  po_number: string | null
  client_name: string | null
  item_name: string
  unit: string | null
  quantity: number
  unit_price: number
  amount: number
  dr_number: string | null
  created_at: string
}

interface CSIItem {
  item_name: string
  unit: string
  quantity: string
  unit_price: string
}

const emptyItem = (): CSIItem => ({ item_name: '', unit: '', quantity: '', unit_price: '' })

const emptyHeader = () => ({
  si_date: new Date().toISOString().split('T')[0],
  si_number: '',
  po_number: '',
  client_name: '',
  dr_number: '',
})

function formatPeso(val: number) {
  if (!val) return '—'
  return '₱' + val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function CSIMonitoringPage() {
  const supabase = createClient()
  const { query: search } = useSearchContext()
  const [records, setRecords] = useState<CSIRecord[]>([])
  const [itemOptions, setItemOptions] = useState<ItemOption[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editingSiNumber, setEditingSiNumber] = useState<string | null>(null)
  const [header, setHeader] = useState(emptyHeader())
  const [items, setItems] = useState<CSIItem[]>([emptyItem()])
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'by-si' | 'all-items'>('by-si')
  const [expandedSIs, setExpandedSIs] = useState<Set<string>>(new Set())
  const [inventoryItem, setInventoryItem] = useState<string>('')
  const [inventoryOpen, setInventoryOpen] = useState(false)

  async function load() {
    setLoading(true)
    const [{ data: itemOptData }] = await Promise.all([
      supabase.from('items').select('item_name, unit_of_measure').order('item_name'),
    ])
    setItemOptions((itemOptData ?? []) as ItemOption[])
    const allFetched: CSIRecord[] = []
    const PAGE = 1000
    let from = 0
    while (true) {
      const { data } = await supabase
        .from('csi_records')
        .select('*')
        .order('si_date', { ascending: false })
        .order('si_number')
        .range(from, from + PAGE - 1)
      if (!data || data.length === 0) break
      allFetched.push(...data)
      if (data.length < PAGE) break
      from += PAGE
    }
    setRecords(allFetched)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = records.filter(r => {
    const q = search.toLowerCase()
    return (
      r.si_number.toLowerCase().includes(q) ||
      (r.client_name ?? '').toLowerCase().includes(q) ||
      r.item_name.toLowerCase().includes(q) ||
      (r.dr_number ?? '').toLowerCase().includes(q)
    )
  })

  const totalAmount = filtered.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const uniqueSIs = new Set(filtered.map(r => r.si_number)).size

  const siGroups: { si_number: string; date: string; client: string; po: string | null; dr: string | null; items: CSIRecord[]; total: number }[] = []
  const siSeen = new Set<string>()
  for (const rec of filtered) {
    if (!siSeen.has(rec.si_number)) {
      siSeen.add(rec.si_number)
      const siItems = filtered.filter(r => r.si_number === rec.si_number)
      siGroups.push({
        si_number: rec.si_number,
        date: rec.si_date,
        client: rec.client_name ?? '—',
        po: rec.po_number,
        dr: rec.dr_number,
        items: siItems,
        total: siItems.reduce((s, r) => s + (Number(r.amount) || 0), 0),
      })
    }
  }

  function toggleSI(si: string) {
    setExpandedSIs(prev => {
      const next = new Set(prev)
      if (next.has(si)) next.delete(si)
      else next.add(si)
      return next
    })
  }

  function openAdd() {
    setEditingSiNumber(null)
    setHeader(emptyHeader())
    setItems([emptyItem()])
    setOpen(true)
  }

  function openEdit(siNumber: string) {
    const siRecords = records.filter(r => r.si_number === siNumber)
    if (siRecords.length === 0) return
    const first = siRecords[0]
    setEditingSiNumber(siNumber)
    setHeader({
      si_date: first.si_date,
      si_number: first.si_number,
      po_number: first.po_number ?? '',
      client_name: first.client_name ?? '',
      dr_number: first.dr_number ?? '',
    })
    setItems(siRecords.map(r => ({
      item_name: r.item_name,
      unit: r.unit ?? '',
      quantity: String(r.quantity ?? ''),
      unit_price: String(r.unit_price ?? ''),
    })))
    setOpen(true)
  }

  async function save() {
    if (!header.si_number.trim()) { toast.error('SI Number is required'); return }
    if (!header.si_date) { toast.error('Date is required'); return }
    const validItems = items.filter(it => it.item_name.trim())
    if (validItems.length === 0) { toast.error('At least one item is required'); return }
    setSaving(true)

    // Delete existing records for this SI number if editing
    if (editingSiNumber) {
      await supabase.from('csi_records').delete().eq('si_number', editingSiNumber)
    }

    const rows = validItems.map(it => ({
      si_date: header.si_date,
      si_number: header.si_number.trim(),
      po_number: header.po_number || null,
      client_name: header.client_name || null,
      item_name: it.item_name.trim(),
      unit: it.unit || null,
      quantity: Number(it.quantity) || 0,
      unit_price: Number(it.unit_price) || 0,
      amount: (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
      dr_number: header.dr_number || null,
    }))

    const { error } = await supabase.from('csi_records').insert(rows)
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success(editingSiNumber ? 'Record updated' : 'Record added')
    setOpen(false)
    load()
    setSaving(false)
  }

  async function confirmDelete() {
    if (deleteId === null) return
    const { error } = await supabase.from('csi_records').delete().eq('id', deleteId)
    if (error) { toast.error(error.message); setDeleteId(null); return }
    setDeleteId(null)
    load()
    toast.success('Record deleted')
  }

  const totalItems = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">CSI Monitoring</h1>
          <p className="text-muted-foreground text-sm">Charge Sales Invoice records</p>
        </div>
        {open ? (
          <Button variant="outline" onClick={() => { setOpen(false); setHeader(emptyHeader()); setItems([emptyItem()]); setEditingSiNumber(null) }}>
            <X className="h-4 w-4 mr-2" />Cancel
          </Button>
        ) : (
          <Button onClick={openAdd} className="bg-red-600 hover:bg-red-700">
            <Plus className="h-4 w-4 mr-2" /> New Record
          </Button>
        )}
      </div>

      {open && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-red-600" />
              {editingSiNumber ? 'Edit CSI Record' : 'New CSI Record'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Header fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date <span className="text-destructive">*</span></Label>
                <Input type="date" value={header.si_date}
                  onChange={e => setHeader(h => ({ ...h, si_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>SI Number <span className="text-destructive">*</span></Label>
                <Input placeholder="e.g. 00001" value={header.si_number}
                  onChange={e => setHeader(h => ({ ...h, si_number: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Client</Label>
                <Input placeholder="Client name" value={header.client_name}
                  onChange={e => setHeader(h => ({ ...h, client_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>DR Number</Label>
                <Input placeholder="e.g. 00001" value={header.dr_number}
                  onChange={e => setHeader(h => ({ ...h, dr_number: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>PO Number</Label>
              <Input placeholder="e.g. PO-2025-00001" value={header.po_number}
                onChange={e => setHeader(h => ({ ...h, po_number: e.target.value }))} />
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Items <span className="text-destructive">*</span></Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setItems(prev => [...prev, emptyItem()])}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add Item
                </Button>
              </div>
              <div className="border rounded-lg">
                <div className="grid grid-cols-[32px_1fr_80px_100px_110px_110px_36px] gap-2 px-3 py-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground">
                  <span />
                  <span>Item Name</span>
                  <span>Unit</span>
                  <span>Qty</span>
                  <span>Unit Price (₱)</span>
                  <span className="text-right">Amount</span>
                  <span />
                </div>
                <div className="divide-y">
                  {items.map((item, i) => {
                    const amt = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0)
                    return (
                      <div key={i} className="grid grid-cols-[32px_1fr_80px_100px_110px_110px_36px] gap-2 items-center px-3 py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-blue-600"
                          title="View inventory"
                          onClick={() => { setInventoryItem(item.item_name); setInventoryOpen(true) }}
                        >
                          <Package className="h-3.5 w-3.5" />
                        </Button>
                        <Select
                          value={item.item_name}
                          onValueChange={val => {
                            const opt = itemOptions.find(o => o.item_name === (val ?? ''))
                            setItems(prev => prev.map((it, idx) => idx === i
                              ? { ...it, item_name: val ?? '', unit: opt?.unit_of_measure ?? it.unit }
                              : it))
                          }}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Select item…" />
                          </SelectTrigger>
                          <SelectContent>
                            {itemOptions.map(opt => (
                              <SelectItem key={opt.item_name} value={opt.item_name}>
                                {opt.item_name} <span className="text-xs text-muted-foreground ml-1">({opt.unit_of_measure})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="h-8 flex items-center px-2 text-sm bg-muted/30 rounded border text-muted-foreground truncate">
                          {item.unit || '—'}
                        </div>
                        <Input type="number" min={0} className="h-8 text-sm" placeholder="0" value={item.quantity}
                          onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: e.target.value } : it))} />
                        <Input type="number" min={0} step="0.01" className="h-8 text-sm" placeholder="0.00" value={item.unit_price}
                          onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, unit_price: e.target.value } : it))} />
                        <div className="text-right text-sm font-medium pr-1 tabular-nums">
                          ₱{amt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))} disabled={items.length === 1}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-end px-3 py-2 bg-muted/20 border-t text-sm font-semibold">
                  Total: ₱{totalItems.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setOpen(false); setHeader(emptyHeader()); setItems([emptyItem()]); setEditingSiNumber(null) }}>Cancel</Button>
              <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : editingSiNumber ? 'Update' : 'Save'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!open && (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{loading ? '—' : uniqueSIs}</div>
            <div className="text-xs text-muted-foreground">Total SI Numbers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{loading ? '—' : filtered.length}</div>
            <div className="text-xs text-muted-foreground">Line Items</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-green-600">{loading ? '—' : formatPeso(totalAmount)}</div>
            <div className="text-xs text-muted-foreground">Total Amount</div>
          </CardContent>
        </Card>
      </div>
      )}

      {!open && <div className="flex gap-3 items-center">
        <div className="flex border rounded-md overflow-hidden">
          <button
            onClick={() => setViewMode('by-si')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${viewMode === 'by-si' ? 'bg-red-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted'}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> By SI
          </button>
          <button
            onClick={() => setViewMode('all-items')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border-l ${viewMode === 'all-items' ? 'bg-red-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted'}`}
          >
            <List className="h-3.5 w-3.5" /> All Items
          </button>
        </div>
      </div>}

      {!open && <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-red-600" /> Charge Sales Invoice Log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {viewMode === 'by-si' ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Date</TableHead>
                    <TableHead>SI Number</TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>DR Number</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : siGroups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                        No records found. Click <strong>New Record</strong> to add one.
                      </TableCell>
                    </TableRow>
                  ) : siGroups.map(group => (
                    <Fragment key={group.si_number}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleSI(group.si_number)}
                      >
                        <TableCell className="text-muted-foreground">
                          {expandedSIs.has(group.si_number)
                            ? <ChevronDown className="h-4 w-4" />
                            : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {format(parseISO(group.date), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="font-mono text-sm font-semibold text-red-600">{group.si_number}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{group.po ?? '—'}</TableCell>
                        <TableCell className="text-sm">{group.client}</TableCell>
                        <TableCell className="text-sm font-mono">{group.dr ?? '—'}</TableCell>
                        <TableCell className="text-right text-sm">{group.items.length}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{formatPeso(group.total)}</TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent">
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(group.si_number)}>Edit</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(group.items[0].id)}>Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      {expandedSIs.has(group.si_number) && (
                        <TableRow key={`${group.si_number}-items`}>
                          <TableCell colSpan={9} className="p-0 bg-muted/20">
                            <div className="px-8 py-2">
                              <Table>
                                <TableHeader>
                                  <TableRow className="border-0">
                                    <TableHead className="text-xs h-8">Item/s</TableHead>
                                    <TableHead className="text-xs h-8 text-right">QTY</TableHead>
                                    <TableHead className="text-xs h-8">Unit</TableHead>
                                    <TableHead className="text-xs h-8 text-right">Unit Price</TableHead>
                                    <TableHead className="text-xs h-8 text-right">Amount</TableHead>
                                    <TableHead className="w-10 h-8" />
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.items.map(item => (
                                    <TableRow key={item.id} className="border-0">
                                      <TableCell className="text-sm py-1.5">{item.item_name}</TableCell>
                                      <TableCell className="text-right text-sm py-1.5 font-medium">{Number(item.quantity)}</TableCell>
                                      <TableCell className="text-sm py-1.5 text-muted-foreground">{item.unit ?? '—'}</TableCell>
                                      <TableCell className="text-right text-sm py-1.5">{item.unit_price ? formatPeso(Number(item.unit_price)) : '—'}</TableCell>
                                      <TableCell className="text-right text-sm py-1.5 font-medium">{item.amount ? formatPeso(Number(item.amount)) : '—'}</TableCell>
                                      <TableCell className="py-1.5">
                                        <DropdownMenu>
                                          <DropdownMenuTrigger className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent">
                                            <MoreHorizontal className="h-4 w-4" />
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => openEdit(item.si_number)}>Edit SI</DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(item.id)}>Delete Item</DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>SI Number</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Item/s</TableHead>
                    <TableHead className="text-right">QTY</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                        No records found. Click <strong>New Record</strong> to add one.
                      </TableCell>
                    </TableRow>
                  ) : filtered.map(rec => (
                    <TableRow key={rec.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(parseISO(rec.si_date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="font-mono text-sm font-semibold text-red-600">{rec.si_number}</TableCell>
                      <TableCell className="text-sm">{rec.client_name ?? '—'}</TableCell>
                      <TableCell className="text-sm">{rec.item_name}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{Number(rec.quantity)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{rec.unit ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm">{rec.unit_price ? formatPeso(Number(rec.unit_price)) : '—'}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{rec.amount ? formatPeso(Number(rec.amount)) : '—'}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent">
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(rec.si_number)}>Edit SI</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(rec.id)}>Delete Item</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
      }

      {/* Inventory Lookup Modal */}
      <Dialog open={inventoryOpen} onOpenChange={setInventoryOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Inventory Stock — {inventoryItem || 'All Items'}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SI Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records
                  .filter(r => !inventoryItem || r.item_name === inventoryItem)
                  .slice(0, 50)
                  .map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs text-red-600">{r.si_number}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{format(parseISO(r.si_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="text-sm">{r.client_name ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm">{r.quantity}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.unit ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm">{r.unit_price ? formatPeso(Number(r.unit_price)) : '—'}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{r.amount ? formatPeso(Number(r.amount)) : '—'}</TableCell>
                    </TableRow>
                  ))}
                {records.filter(r => !inventoryItem || r.item_name === inventoryItem).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No CSI records found for this item.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInventoryOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Record?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete this CSI record.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
