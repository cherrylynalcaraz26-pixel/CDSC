'use client'

import { useState, useEffect } from 'react'
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
import { Plus, Search, MoreHorizontal, Loader2, FileText, LayoutGrid, List, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'

interface Supplier { id: string; company_name: string }

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

interface CSIForm {
  si_date: string
  si_number: string
  po_number: string
  client_name: string
  item_name: string
  unit: string
  quantity: string
  unit_price: string
  amount: string
  dr_number: string
}

const emptyForm = (): CSIForm => ({
  si_date: new Date().toISOString().split('T')[0],
  si_number: '',
  po_number: '',
  client_name: '',
  item_name: '',
  unit: '',
  quantity: '',
  unit_price: '',
  amount: '',
  dr_number: '',
})

function formatPeso(val: number) {
  if (!val) return '—'
  return '₱' + val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function CSIMonitoringPage() {
  const supabase = createClient()
  const [records, setRecords] = useState<CSIRecord[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CSIRecord | null>(null)
  const [form, setForm] = useState<CSIForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'by-si' | 'all-items'>('by-si')
  const [expandedSIs, setExpandedSIs] = useState<Set<string>>(new Set())

  async function load() {
    setLoading(true)
    const [{ data: recData }, { data: supData }] = await Promise.all([
      supabase.from('csi_records').select('*').order('si_date', { ascending: false }).order('si_number'),
      supabase.from('suppliers').select('id, company_name').order('company_name'),
    ])
    setRecords(recData ?? [])
    setSuppliers(supData ?? [])
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

  // Group by SI number for "By SI" view
  const siGroups: { si_number: string; date: string; client: string; po: string | null; dr: string | null; items: CSIRecord[]; total: number }[] = []
  const siSeen = new Set<string>()
  for (const rec of filtered) {
    if (!siSeen.has(rec.si_number)) {
      siSeen.add(rec.si_number)
      const items = filtered.filter(r => r.si_number === rec.si_number)
      siGroups.push({
        si_number: rec.si_number,
        date: rec.si_date,
        client: rec.client_name ?? '—',
        po: rec.po_number,
        dr: rec.dr_number,
        items,
        total: items.reduce((s, r) => s + (Number(r.amount) || 0), 0),
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
    setEditing(null)
    setForm(emptyForm())
    setOpen(true)
  }

  function openEdit(rec: CSIRecord) {
    setEditing(rec)
    setForm({
      si_date: rec.si_date,
      si_number: rec.si_number,
      po_number: rec.po_number ?? '',
      client_name: rec.client_name ?? '',
      item_name: rec.item_name,
      unit: rec.unit ?? '',
      quantity: String(rec.quantity ?? ''),
      unit_price: String(rec.unit_price ?? ''),
      amount: String(rec.amount ?? ''),
      dr_number: rec.dr_number ?? '',
    })
    setOpen(true)
  }

  async function save() {
    if (!form.si_number.trim()) { toast.error('SI Number is required'); return }
    if (!form.si_date)          { toast.error('Date is required'); return }
    if (!form.item_name.trim()) { toast.error('Item is required'); return }
    setSaving(true)
    const payload = {
      si_date:     form.si_date,
      si_number:   form.si_number.trim(),
      po_number:   form.po_number || null,
      client_name: form.client_name || null,
      item_name:   form.item_name.trim(),
      unit:        form.unit || null,
      quantity:    Number(form.quantity) || 0,
      unit_price:  Number(form.unit_price) || 0,
      amount:      Number(form.amount) || 0,
      dr_number:   form.dr_number || null,
    }
    if (editing) {
      const { error } = await supabase.from('csi_records').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('csi_records').insert(payload)
      if (error) { toast.error(error.message); setSaving(false); return }
    }
    toast.success(editing ? 'Record updated' : 'Record added')
    setOpen(false)
    load()
    setSaving(false)
  }

  async function confirmDelete() {
    if (deleteId === null) return
    const { error } = await supabase.from('csi_records').delete().eq('id', deleteId)
    if (error) toast.error(error.message)
    else { toast.success('Record deleted'); load() }
    setDeleteId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">CSI Monitoring</h1>
          <p className="text-muted-foreground text-sm">Charge Sales Invoice records</p>
        </div>
        <Button onClick={openAdd} className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-2" /> New Record
        </Button>
      </div>

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

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search SI#, client, item, DR#…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
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
      </div>

      <Card>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : siGroups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        No records found. Click <strong>New Record</strong> to add one.
                      </TableCell>
                    </TableRow>
                  ) : siGroups.map(group => (
                    <>
                      <TableRow
                        key={group.si_number}
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
                      </TableRow>
                      {expandedSIs.has(group.si_number) && (
                        <TableRow key={`${group.si_number}-items`}>
                          <TableCell colSpan={8} className="p-0 bg-muted/20">
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
                                            <DropdownMenuItem onClick={() => openEdit(item)}>Edit</DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(item.id)}>Delete</DropdownMenuItem>
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
                    </>
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
                            <DropdownMenuItem onClick={() => openEdit(rec)}>Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(rec.id)}>Delete</DropdownMenuItem>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-red-600" />
              {editing ? 'Edit CSI Record' : 'New CSI Record'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.si_date}
                  onChange={e => setForm(f => ({ ...f, si_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>SI Number <span className="text-destructive">*</span></Label>
                <Input placeholder="e.g. 00001" value={form.si_number}
                  onChange={e => setForm(f => ({ ...f, si_number: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Client</Label>
                <Select value={form.client_name} onValueChange={v => setForm(f => ({ ...f, client_name: v ?? '' }))}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— None —</SelectItem>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.company_name}>{s.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>DR Number</Label>
                <Input placeholder="e.g. 00001" value={form.dr_number}
                  onChange={e => setForm(f => ({ ...f, dr_number: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>PO Number</Label>
              <Input placeholder="e.g. PO-2025-00001" value={form.po_number}
                onChange={e => setForm(f => ({ ...f, po_number: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Item/s <span className="text-destructive">*</span></Label>
              <Input placeholder="Item name / description" value={form.item_name}
                onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>QTY</Label>
                <Input type="number" min={0} placeholder="0" value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Input placeholder="e.g. Piece/s" value={form.unit}
                  onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Unit Price</Label>
                <Input type="number" min={0} step="0.01" placeholder="0.00" value={form.unit_price}
                  onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" min={0} step="0.01" placeholder="0.00" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : editing ? 'Update' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
