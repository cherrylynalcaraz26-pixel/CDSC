'use client'

// Settings → Payees: who CDSC pays through Cash Disbursements, with the details
// needed for the voucher and BIR (address, TIN, VAT status), the kind of
// disbursement, and the services they provide. Columns from migration 044.

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchContext } from '@/context/search-context'
import { getErrorMessage } from '@/lib/error-message'
import { deleteWithUndo } from '@/lib/delete-with-undo'
import { emptyAddress, joinAddress, addressFromRow, addressColumns, type Address } from '@/lib/person-address'
import { AddressFields } from '@/components/forms/person-address-fields'
import { FilterBar, FILTER_TRIGGER } from '@/components/ui/filter-bar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export const VAT_STATUS: Record<string, { label: string; cls: string }> = {
  vatable: { label: 'VAT-registered (12%)', cls: 'bg-blue-100 text-blue-700' },
  non_vat: { label: 'Non-VAT', cls: 'bg-slate-100 text-slate-600' },
  vat_exempt: { label: 'VAT-exempt', cls: 'bg-amber-100 text-amber-800' },
  zero_rated: { label: 'Zero-rated', cls: 'bg-teal-100 text-teal-700' },
}

export const DISBURSEMENT_TYPES = [
  'Purchases of Goods', 'Services', 'Professional Fees', 'Rent', 'Utilities', 'Salaries & Wages',
  'Transportation & Delivery', 'Repairs & Maintenance', 'Office Supplies', 'Taxes & Licenses',
  'Government Contributions', 'Loans & Financing', 'Others',
]

interface Payee {
  id: string; name: string; created_at: string
  tin: string | null; vat_status: string | null; disbursement_type: string | null; services: string | null
  contact_person: string | null; contact_number: string | null; email: string | null; address: string | null; remarks: string | null
  [k: string]: unknown
}
const blank = { name: '', tin: '', vat_status: 'vatable', disbursement_type: '', services: '', contact_person: '', contact_number: '', email: '', remarks: '' }
type Form = typeof blank

export function PayeesSettings() {
  const supabase = createClient()
  const { query } = useSearchContext()
  const [rows, setRows] = useState<Payee[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [vatFilter, setVatFilter] = useState('all')
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(blank)
  const [addr, setAddr] = useState<Address>(emptyAddress())
  const [saving, setSaving] = useState(false)

  function fetchRows() {
    return supabase.from('payees').select('*').order('name').then(({ data }) => { setRows((data ?? []) as Payee[]); setLoading(false) })
  }
  useEffect(() => { fetchRows() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => rows.filter(r => {
    if (typeFilter !== 'all' && r.disbursement_type !== typeFilter) return false
    if (vatFilter !== 'all' && (r.vat_status ?? 'vatable') !== vatFilter) return false
    const q = query.trim().toLowerCase()
    return !q || [r.name, r.tin, r.services, r.address, r.contact_person].some(v => (v ?? '').toLowerCase().includes(q))
  }), [rows, typeFilter, vatFilter, query])

  function openAdd() { setEditingId(null); setForm(blank); setAddr(emptyAddress()); setOpen(true) }
  function openEdit(r: Payee) {
    setEditingId(r.id)
    const f = { ...blank }
    for (const k of Object.keys(blank) as (keyof Form)[]) f[k] = String(r[k] ?? '')
    if (!f.vat_status) f.vat_status = 'vatable'
    setForm(f); setAddr(addressFromRow(r)); setOpen(true)
  }
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function save() {
    if (!form.name.trim()) { toast.error('Payee name is required'); return }
    setSaving(true)
    const payload: Record<string, unknown> = { ...addressColumns(addr), address: joinAddress(addr) || null }
    for (const k of Object.keys(blank) as (keyof Form)[]) payload[k] = form[k].trim() || null
    payload.vat_status = form.vat_status || 'vatable'
    payload.name = form.name.trim()
    const { error } = editingId
      ? await supabase.from('payees').update(payload).eq('id', editingId)
      : await supabase.from('payees').insert(payload)
    if (error) toast.error(/column/.test(error.message) ? 'Run database migration 044 first, then save again.' : getErrorMessage(error))
    else { toast.success(editingId ? 'Payee updated' : 'Payee added'); setOpen(false); fetchRows() }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <FilterBar actions={<>
        <span className="text-xs text-muted-foreground">{shown.length} payee{shown.length === 1 ? '' : 's'}</span>
        <Button onClick={openAdd} className="h-9 bg-red-600 hover:bg-red-700"><Plus className="mr-1.5 h-4 w-4" />Add Payee</Button>
      </>}>
        <Select value={typeFilter} onValueChange={v => setTypeFilter(v ?? 'all')}>
          <SelectTrigger className={`${FILTER_TRIGGER} w-56`}><span>{typeFilter === 'all' ? 'All disbursement types' : typeFilter}</span></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All disbursement types</SelectItem>
            {DISBURSEMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={vatFilter} onValueChange={v => setVatFilter(v ?? 'all')}>
          <SelectTrigger className={`${FILTER_TRIGGER} w-48`}><span>{vatFilter === 'all' ? 'All VAT status' : VAT_STATUS[vatFilter]?.label}</span></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All VAT status</SelectItem>
            {Object.entries(VAT_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterBar>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Payee</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>TIN</TableHead>
            <TableHead>VAT</TableHead>
            <TableHead>Disbursement type</TableHead>
            <TableHead>Services</TableHead>
            <TableHead className="w-20" />
          </TableRow></TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></TableCell></TableRow>
            ) : shown.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">{rows.length ? 'No payees match the filters.' : 'No payees yet.'}</TableCell></TableRow>
            ) : shown.map(r => {
              const vat = VAT_STATUS[r.vat_status ?? 'vatable']
              return (
                <TableRow key={r.id} className="cursor-pointer hover:bg-red-50/40" onClick={() => openEdit(r)}>
                  <TableCell>
                    <p className="font-medium">{r.name}</p>
                    {(r.contact_person || r.contact_number) && <p className="text-xs text-muted-foreground">{[r.contact_person, r.contact_number].filter(Boolean).join(' · ')}</p>}
                  </TableCell>
                  <TableCell className="max-w-64 text-xs text-muted-foreground">{r.address || '—'}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">{r.tin || '—'}</TableCell>
                  <TableCell><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${vat?.cls ?? ''}`}>{vat?.label ?? r.vat_status}</span></TableCell>
                  <TableCell className="text-sm">{r.disbursement_type || '—'}</TableCell>
                  <TableCell className="max-w-56 truncate text-xs text-muted-foreground" title={r.services ?? ''}>{r.services || '—'}</TableCell>
                  <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Edit" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" title="Delete"
                      onClick={() => deleteWithUndo(supabase, { table: 'payees', id: r.id, label: `payee ${r.name}`, onChange: () => { fetchRows() } })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader><DialogTitle>{editingId ? 'Edit Payee' : 'Add Payee'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2"><Label>Payee name <span className="text-destructive">*</span></Label><Input value={form.name} onChange={set('name')} placeholder="Registered / business name" /></div>
              <div className="space-y-1"><Label className="text-xs">TIN</Label><Input value={form.tin} onChange={set('tin')} placeholder="000-000-000-000" /></div>
              <div className="space-y-1">
                <Label className="text-xs">VAT status</Label>
                <Select value={form.vat_status} onValueChange={v => setForm(f => ({ ...f, vat_status: v ?? 'vatable' }))}>
                  <SelectTrigger className="h-9"><span>{VAT_STATUS[form.vat_status]?.label}</span></SelectTrigger>
                  <SelectContent>{Object.entries(VAT_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Kind of cash disbursement</Label>
                <Select value={form.disbursement_type || '_'} onValueChange={v => setForm(f => ({ ...f, disbursement_type: !v || v === '_' ? '' : v }))}>
                  <SelectTrigger className="h-9"><span className={form.disbursement_type ? '' : 'text-muted-foreground'}>{form.disbursement_type || 'Select…'}</span></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">—</SelectItem>
                    {DISBURSEMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Contact person</Label><Input value={form.contact_person} onChange={set('contact_person')} /></div>
              <div className="space-y-1"><Label className="text-xs">Contact number</Label><Input value={form.contact_number} onChange={set('contact_number')} /></div>
              <div className="space-y-1"><Label className="text-xs">Email</Label><Input type="email" value={form.email} onChange={set('email')} /></div>
            </div>
            <AddressFields value={addr} onChange={setAddr} />
            <div className="space-y-1"><Label className="text-xs">Services / goods provided</Label><Textarea rows={2} value={form.services} onChange={set('services')} placeholder="e.g. Trucking and delivery, aircon repair, office supplies" /></div>
            <div className="space-y-1"><Label className="text-xs">Remarks</Label><Textarea rows={2} value={form.remarks} onChange={set('remarks')} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">{saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
