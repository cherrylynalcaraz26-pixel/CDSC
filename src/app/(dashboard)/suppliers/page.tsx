'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Search, MoreHorizontal, Building2 } from 'lucide-react'
import { toast } from 'sonner'

interface Supplier {
  id: string
  supplier_code: string
  company_name: string
  contact_person: string | null
  mobile_number: string | null
  email: string | null
  address: string | null
  tin: string | null
  vat_registered: boolean
  vat_classification: string | null
  supplier_category: string | null
  payment_terms: string | null
  lead_time_days: number | null
  atc_code: string | null
  ewt_rate: number | null
  is_active: boolean
  rating: number | null
}

const emptyForm = () => ({
  company_name: '', contact_person: '', mobile_number: '', email: '',
  address: '', tin: '', vat_registered: 'true', supplier_category: '',
  payment_terms: '30 days', lead_time_days: '7', atc_code: '', ewt_rate: '2',
  vat_classification: 'vatable',
})

export default function SuppliersPage() {
  const supabase = createClient()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('suppliers').select('*').order('company_name')
    if (error) toast.error(error.message)
    else setSuppliers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() =>
    suppliers.filter(s =>
      s.company_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.contact_person ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (s.supplier_code ?? '').toLowerCase().includes(search.toLowerCase())
    ), [suppliers, search])

  function openAdd() {
    setEditing(null)
    setForm(emptyForm())
    setOpen(true)
  }

  function openEdit(s: Supplier) {
    setEditing(s)
    setForm({
      company_name: s.company_name,
      contact_person: s.contact_person ?? '',
      mobile_number: s.mobile_number ?? '',
      email: s.email ?? '',
      address: s.address ?? '',
      tin: s.tin ?? '',
      vat_registered: s.vat_registered ? 'true' : 'false',
      supplier_category: s.supplier_category ?? '',
      payment_terms: s.payment_terms ?? '30 days',
      lead_time_days: String(s.lead_time_days ?? 7),
      atc_code: s.atc_code ?? '',
      ewt_rate: String(s.ewt_rate ?? 2),
      vat_classification: s.vat_classification ?? 'vatable',
    })
    setOpen(true)
  }

  async function save() {
    if (!form.company_name.trim()) { toast.error('Company name is required'); return }
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
    if (error) { toast.error(error.message) } else {
      toast.success(editing ? 'Supplier updated' : 'Supplier added')
      setOpen(false)
      load()
    }
    setSaving(false)
  }

  async function toggleActive(s: Supplier) {
    const { error } = await supabase.from('suppliers').update({ is_active: !s.is_active }).eq('id', s.id)
    if (error) toast.error(error.message)
    else { toast.success(s.is_active ? 'Supplier deactivated' : 'Supplier activated'); load() }
  }

  async function confirmDelete() {
    if (!deleteId) return
    const { error } = await supabase.from('suppliers').delete().eq('id', deleteId)
    if (error) toast.error(error.message)
    else { toast.success('Supplier deleted'); load() }
    setDeleteId(null)
  }

  const f = (field: string) => (v: string | null) => setForm(prev => ({ ...prev, [field]: v ?? prev[field as keyof typeof prev] }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Suppliers</h1>
          <p className="text-muted-foreground text-sm">{suppliers.filter(s => s.is_active).length} active suppliers</p>
        </div>
        <Button onClick={openAdd} className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-2" /> Add Supplier
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search suppliers…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>TIN</TableHead>
              <TableHead>VAT</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No suppliers found</TableCell></TableRow>
            ) : filtered.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-sm">{s.supplier_code}</TableCell>
                <TableCell>
                  <div className="font-medium">{s.company_name}</div>
                  {s.email && <div className="text-xs text-muted-foreground">{s.email}</div>}
                </TableCell>
                <TableCell>
                  <div className="text-sm">{s.contact_person ?? '—'}</div>
                  {s.mobile_number && <div className="text-xs text-muted-foreground">{s.mobile_number}</div>}
                </TableCell>
                <TableCell className="font-mono text-sm">{s.tin ?? '—'}</TableCell>
                <TableCell>
                  {s.vat_registered
                    ? <Badge className="bg-blue-100 text-blue-800 text-xs">VAT</Badge>
                    : <Badge variant="secondary" className="text-xs">Non-VAT</Badge>}
                </TableCell>
                <TableCell className="text-sm">{s.supplier_category ?? '—'}</TableCell>
                <TableCell>
                  {s.is_active
                    ? <Badge className="bg-green-100 text-green-800 text-xs">Active</Badge>
                    : <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(s)}>Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleActive(s)}>
                        {s.is_active ? 'Deactivate' : 'Activate'}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(s.id)}>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-red-600" />
              {editing ? 'Edit Supplier' : 'Add Supplier'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Company Name <span className="text-destructive">*</span></Label>
              <Input value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Contact Person</Label>
              <Input value={form.contact_person} onChange={e => setForm(p => ({ ...p, contact_person: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Mobile Number</Label>
              <Input value={form.mobile_number} onChange={e => setForm(p => ({ ...p, mobile_number: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>TIN</Label>
              <Input placeholder="000-000-000-000" value={form.tin} onChange={e => setForm(p => ({ ...p, tin: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Address</Label>
              <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>VAT Status</Label>
              <Select value={form.vat_registered} onValueChange={f('vatable')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">VAT Registered</SelectItem>
                  <SelectItem value="false">Non-VAT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>VAT Classification</Label>
              <Select value={form.vat_classification} onValueChange={f('vat_classification')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vatable">VATable (12%)</SelectItem>
                  <SelectItem value="vat_exempt">VAT Exempt</SelectItem>
                  <SelectItem value="zero_rated">Zero-Rated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>ATC Code (BIR)</Label>
              <Select value={form.atc_code} onValueChange={f('atc_code')}>
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
              <Select value={form.ewt_rate} onValueChange={f('ewt_rate')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1%</SelectItem>
                  <SelectItem value="2">2%</SelectItem>
                  <SelectItem value="5">5%</SelectItem>
                  <SelectItem value="10">10%</SelectItem>
                  <SelectItem value="15">15%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input placeholder="e.g. Office Supplies" value={form.supplier_category} onChange={e => setForm(p => ({ ...p, supplier_category: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Terms</Label>
              <Select value={form.payment_terms} onValueChange={f('payment_terms')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="COD">COD</SelectItem>
                  <SelectItem value="7 days">7 days</SelectItem>
                  <SelectItem value="15 days">15 days</SelectItem>
                  <SelectItem value="30 days">30 days</SelectItem>
                  <SelectItem value="45 days">45 days</SelectItem>
                  <SelectItem value="60 days">60 days</SelectItem>
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

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Supplier?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete this supplier and cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
