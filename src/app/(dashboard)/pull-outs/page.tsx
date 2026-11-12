'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { NameFields, AddressFields } from '@/components/forms/person-address-fields'
import {
  emptyName, emptyAddress, joinName, joinAddress, nameFromRow, nameColumns, addressFromRow, addressColumns,
  type PersonName, type Address,
} from '@/lib/person-address'
import { getErrorMessage } from '@/lib/error-message'
import { useSearchContext } from '@/context/search-context'
import { KpiCard } from '@/components/ui/kpi-card'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Plus, Trash2, Loader2, PackageOpen, CalendarClock, Truck, PackageCheck, MapPin, Phone, Pencil, Printer,
  FileSignature, List, Boxes,
} from 'lucide-react'
import { PullOutLetterDialog } from '@/components/pull-outs/pull-out-letter'
import { confirmRemoveLine } from '@/components/ui/confirm'
import { deleteWithUndo } from '@/lib/delete-with-undo'

type Status = 'pending' | 'scheduled' | 'picked_up' | 'received' | 'cancelled'
type SourceType = 'client' | 'supplier' | 'other'
type Reason = 'return' | 'replacement' | 'repair' | 'consignment' | 'purchase' | 'other'

const STATUS: Record<Status, { label: string; cls: string }> = {
  pending:   { label: 'Pending',      cls: 'bg-slate-100 text-slate-700' },
  scheduled: { label: 'Scheduled',    cls: 'bg-blue-100 text-blue-700' },
  picked_up: { label: 'Picked Up',    cls: 'bg-amber-100 text-amber-800' },
  received:  { label: 'At Warehouse', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled',    cls: 'bg-red-100 text-red-700' },
}
const STATUS_FLOW: Status[] = ['pending', 'scheduled', 'picked_up', 'received']

const REASONS: Record<Reason, string> = {
  return: 'Return / Defective',
  replacement: 'For Replacement',
  repair: 'For Repair',
  consignment: 'Consignment Pull-out',
  purchase: 'Purchased Item Pickup',
  other: 'Other',
}

interface PullOut {
  id: string
  pull_out_number: string | null
  source_type: SourceType
  client_id: string | null
  supplier_id: string | null
  location_name: string
  pickup_address: string | null
  contact_person: string | null
  contact_number: string | null
  reason: Reason
  reference_no: string | null
  scheduled_date: string | null
  picked_up_date: string | null
  assigned_to: string | null
  vehicle: string | null
  status: Status
  remarks: string | null
  created_at: string
  items?: { id: string; item_name: string; quantity: number; unit: string | null; condition: string | null; quantity_received: number | null; remarks: string | null }[]
  [k: string]: unknown
}

interface Line { item_name: string; quantity: string; unit: string; condition: string }
const emptyLine = (): Line => ({ item_name: '', quantity: '1', unit: 'piece', condition: '' })

const blank = {
  source_type: 'client' as SourceType,
  party_id: '',
  location_name: '',
  contact_number: '',
  reason: 'return' as Reason,
  reference_no: '',
  scheduled_date: '',
  assigned_to: '',
  vehicle: '',
  remarks: '',
}

export default function PullOutsPage() {
  const supabase = createClient()
  const { query } = useSearchContext()
  const [rows, setRows] = useState<PullOut[]>([])
  const [clients, setClients] = useState<{ id: string; company_name: string; [k: string]: unknown }[]>([])
  const [suppliers, setSuppliers] = useState<{ id: string; company_name: string; [k: string]: unknown }[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<Status | 'all' | 'open'>('open')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(blank)
  const [contact, setContact] = useState<PersonName>(emptyName())
  const [addr, setAddr] = useState<Address>(emptyAddress())
  const [lines, setLines] = useState<Line[]>([emptyLine()])
  const [letterFor, setLetterFor] = useState<PullOut | null>(null)
  const [view, setView] = useState<'pullouts' | 'items'>('pullouts')
  const [catalog, setCatalog] = useState<{ item_name: string; unit_of_measure: string | null }[]>([])

  // `loading` starts true; later reloads (after save/status change) refresh in place.
  function fetchAll() {
    return Promise.all([
      supabase.from('pull_outs').select('*, items:pull_out_items(id, item_name, quantity, unit, condition, quantity_received, remarks)').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').eq('status', 'active').order('company_name'),
      supabase.from('suppliers').select('*').eq('is_active', true).order('company_name'),
      supabase.from('items').select('item_name, unit_of_measure').order('item_name').limit(1000),
    ]).then(([po, cl, su, it]) => {
      if (po.error) toast.error(getErrorMessage(po.error, 'Could not load pull outs — has migration 037 been applied?'))
      setRows((po.data ?? []) as PullOut[])
      setClients(cl.data ?? [])
      setSuppliers(su.data ?? [])
      setCatalog((it.data ?? []) as typeof catalog)
      setLoading(false)
    })
  }
  const load = () => { fetchAll() }

  useEffect(() => { fetchAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => ({
    pending: rows.filter(r => r.status === 'pending').length,
    scheduled: rows.filter(r => r.status === 'scheduled').length,
    picked_up: rows.filter(r => r.status === 'picked_up').length,
    received: rows.filter(r => r.status === 'received').length,
  }), [rows])

  const shown = rows.filter(r => {
    if (statusFilter === 'open' && (r.status === 'received' || r.status === 'cancelled')) return false
    if (statusFilter !== 'open' && statusFilter !== 'all' && r.status !== statusFilter) return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    return [r.pull_out_number, r.location_name, r.contact_person, r.reference_no, r.assigned_to]
      .some(v => (v ?? '').toLowerCase().includes(q))
      || (r.items ?? []).some(i => i.item_name.toLowerCase().includes(q))
  })

  function openNew() {
    setEditingId(null)
    setForm(blank)
    setContact(emptyName())
    setAddr(emptyAddress())
    setLines([emptyLine()])
    setOpen(true)
  }

  function openEdit(r: PullOut) {
    setEditingId(r.id)
    setForm({
      source_type: r.source_type,
      party_id: r.client_id ?? r.supplier_id ?? '',
      location_name: r.location_name,
      contact_number: r.contact_number ?? '',
      reason: r.reason,
      reference_no: r.reference_no ?? '',
      scheduled_date: r.scheduled_date ?? '',
      assigned_to: r.assigned_to ?? '',
      vehicle: r.vehicle ?? '',
      remarks: r.remarks ?? '',
    })
    setContact(nameFromRow(r, 'contact_', 'contact_person'))
    setAddr(addressFromRow(r, 'pickup_address'))
    setLines((r.items ?? []).length
      ? (r.items ?? []).map(i => ({ item_name: i.item_name, quantity: String(i.quantity), unit: i.unit ?? '', condition: i.condition ?? '' }))
      : [emptyLine()])
    setOpen(true)
  }

  // Picking a client/supplier pre-fills location, contact and address from its record.
  function pickParty(id: string) {
    const list = form.source_type === 'client' ? clients : suppliers
    const p = list.find(x => x.id === id)
    setForm(f => ({
      ...f,
      party_id: id,
      location_name: p?.company_name ?? f.location_name,
      contact_number: String(p?.mobile ?? p?.mobile_number ?? p?.phone ?? f.contact_number ?? ''),
    }))
    if (p) {
      setContact(nameFromRow(p, 'contact_', 'contact_person'))
      setAddr(addressFromRow(p))
    }
  }

  async function save() {
    if (!form.location_name.trim()) { toast.error('Enter where the item will be picked up'); return }
    const valid = lines.filter(l => l.item_name.trim())
    if (valid.length === 0) { toast.error('Add at least one item to pick up'); return }
    if (valid.some(l => !(parseFloat(l.quantity) > 0))) { toast.error('Quantities must be greater than zero'); return }
    setSaving(true)
    const payload = {
      source_type: form.source_type,
      client_id: form.source_type === 'client' ? form.party_id || null : null,
      supplier_id: form.source_type === 'supplier' ? form.party_id || null : null,
      location_name: form.location_name.trim(),
      ...addressColumns(addr),
      pickup_address: joinAddress(addr) || null,
      ...nameColumns(contact, 'contact_'),
      contact_person: joinName(contact) || null,
      contact_number: form.contact_number.trim() || null,
      reason: form.reason,
      reference_no: form.reference_no.trim() || null,
      scheduled_date: form.scheduled_date || null,
      assigned_to: form.assigned_to.trim() || null,
      vehicle: form.vehicle.trim() || null,
      remarks: form.remarks.trim() || null,
    }
    let id = editingId
    if (editingId) {
      const { error } = await supabase.from('pull_outs').update(payload).eq('id', editingId)
      if (error) { toast.error(getErrorMessage(error)); setSaving(false); return }
      await supabase.from('pull_out_items').delete().eq('pull_out_id', editingId)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase.from('pull_outs')
        .insert({ ...payload, status: form.scheduled_date ? 'scheduled' : 'pending', created_by: user?.id ?? null })
        .select('id').single()
      if (error) { toast.error(getErrorMessage(error)); setSaving(false); return }
      id = data.id
    }
    const { error: itemErr } = await supabase.from('pull_out_items').insert(valid.map(l => ({
      pull_out_id: id,
      item_name: l.item_name.trim(),
      quantity: parseFloat(l.quantity),
      unit: l.unit.trim() || null,
      condition: l.condition.trim() || null,
    })))
    if (itemErr) toast.error(getErrorMessage(itemErr))
    else toast.success(editingId ? 'Pull out updated' : 'Pull out created')
    setSaving(false)
    setOpen(false)
    load()
  }

  async function setStatus(r: PullOut, status: Status) {
    const patch: Record<string, unknown> = { status }
    if (status === 'picked_up' && !r.picked_up_date) patch.picked_up_date = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('pull_outs').update(patch).eq('id', r.id)
    if (error) toast.error(getErrorMessage(error))
    else { toast.success(`${r.pull_out_number ?? 'Pull out'} → ${STATUS[status].label}`); load() }
  }

  async function remove(r: PullOut) {
    await deleteWithUndo(supabase, {
      table: 'pull_outs', id: r.id, label: `pull out ${r.pull_out_number ?? ''}`.trim(),
      children: [{ table: 'pull_out_items', fk: 'pull_out_id' }],
      onChange: load,
    })
  }

  function printSlip(r: PullOut) {
    const win = window.open('', '_blank', 'width=800,height=700')
    if (!win) return
    const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
    const items = (r.items ?? []).map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.item_name)}</td><td style="text-align:center">${esc(i.quantity)}</td><td>${esc(i.unit)}</td><td>${esc(i.condition)}</td></tr>`).join('')
    win.document.write(`<!DOCTYPE html><html><head><title>${esc(r.pull_out_number)}</title><style>
      body{font-family:Arial,sans-serif;font-size:12px;padding:28px;color:#111}h1{font-size:18px;margin:0 0 4px;color:#dc2626}
      table{width:100%;border-collapse:collapse;margin-top:14px}td,th{padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:left}
      th{background:#dc2626;color:#fff}.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin-top:12px}
      .k{color:#6b7280;font-size:10px;text-transform:uppercase}.sig{display:grid;grid-template-columns:1fr 1fr 1fr;gap:28px;margin-top:48px;text-align:center}
      .sig div{border-top:1px solid #111;padding-top:4px;font-size:10px}</style></head><body>
      <h1>PULL OUT SLIP</h1><div><b>${esc(r.pull_out_number)}</b> · ${esc(REASONS[r.reason])}</div>
      <div class="grid">
        <div><div class="k">Pick up from</div>${esc(r.location_name)}</div>
        <div><div class="k">Scheduled</div>${esc(r.scheduled_date ?? '—')}</div>
        <div><div class="k">Address</div>${esc(r.pickup_address ?? '—')}</div>
        <div><div class="k">Contact</div>${esc(r.contact_person ?? '—')} ${esc(r.contact_number ?? '')}</div>
        <div><div class="k">Assigned to</div>${esc(r.assigned_to ?? '—')} ${r.vehicle ? '· ' + esc(r.vehicle) : ''}</div>
        <div><div class="k">Reference</div>${esc(r.reference_no ?? '—')}</div>
      </div>
      <table><thead><tr><th>#</th><th>Item</th><th style="text-align:center">Qty</th><th>Unit</th><th>Condition</th></tr></thead><tbody>${items}</tbody></table>
      ${r.remarks ? `<p><span class="k">Remarks</span><br/>${esc(r.remarks)}</p>` : ''}
      <div class="sig"><div>Released by (site)</div><div>Picked up by (CDSC)</div><div>Received at warehouse</div></div>
      </body></html>`)
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 400)
  }

  // "Items" view: every item across the pull outs matching the status filter / search.
  const itemRows = shown.flatMap(r => (r.items ?? []).map(i => ({ ...i, po: r })))

  const partyList = form.source_type === 'client' ? clients : form.source_type === 'supplier' ? suppliers : []

  return (
    <div className="space-y-6">
      {/* Title is shown in the top header bar */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {([
          { key: 'pending', label: 'Pending', icon: PackageOpen, tone: 'slate' },
          { key: 'scheduled', label: 'Scheduled', icon: CalendarClock, tone: 'blue' },
          { key: 'picked_up', label: 'Picked Up / In Transit', icon: Truck, tone: 'amber' },
          { key: 'received', label: 'At Warehouse', icon: PackageCheck, tone: 'green' },
        ] as const).map(c => (
          <KpiCard key={c.key} label={c.label} value={loading ? '—' : counts[c.key]} icon={c.icon} tone={c.tone}
            active={statusFilter === c.key} onClick={() => setStatusFilter(c.key)} />
        ))}
      </div>

      <Card className="overflow-visible">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">{view === 'pullouts' ? 'Pull Out List' : 'List of Items'}</CardTitle>
            <div className="flex rounded-lg bg-muted p-0.5">
              {([['pullouts', 'Pull Outs', List], ['items', 'Items', Boxes]] as const).map(([v, label, Icon]) => (
                <button key={v} type="button" onClick={() => setView(v)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${view === v ? 'bg-white text-[#E8112D] shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={v => setStatusFilter((v ?? 'open') as typeof statusFilter)}>
              <SelectTrigger className="h-9 w-[170px]">
                <span className="text-sm">
                  {statusFilter === 'open' ? 'Open (not yet received)' : statusFilter === 'all' ? 'All' : STATUS[statusFilter].label}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open (not yet received)</SelectItem>
                <SelectItem value="all">All</SelectItem>
                {(Object.keys(STATUS) as Status[]).map(s => <SelectItem key={s} value={s}>{STATUS[s].label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={openNew} className="bg-red-600 hover:bg-red-700">
              <Plus className="mr-2 h-4 w-4" />New Pull Out
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {view === 'items' ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead>Pull Out No.</TableHead>
                <TableHead>Pick Up From</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></TableCell></TableRow>
              ) : itemRows.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="py-12 text-center text-muted-foreground">No items to pick up here.</TableCell></TableRow>
              ) : itemRows.map((x, n) => (
                <TableRow key={x.id}>
                  <TableCell className="text-xs text-muted-foreground">{n + 1}</TableCell>
                  <TableCell className="text-sm font-medium">{x.item_name}{x.remarks && <div className="text-xs font-normal text-muted-foreground">{x.remarks}</div>}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(x.quantity).toLocaleString('en-PH')}</TableCell>
                  <TableCell className="text-xs">{x.unit ?? '—'}</TableCell>
                  <TableCell className="text-xs">{x.condition || '—'}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{Number(x.quantity_received ?? 0) > 0 ? Number(x.quantity_received).toLocaleString('en-PH') : '—'}</TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-[#E8112D]">{x.po.pull_out_number ?? '—'}</TableCell>
                  <TableCell className="text-xs">{x.po.location_name}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{x.po.scheduled_date ? format(new Date(x.po.scheduled_date + 'T00:00:00'), 'MMM d, yyyy') : '—'}</TableCell>
                  <TableCell><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[x.po.status].cls}`}>{STATUS[x.po.status].label}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pull Out No.</TableHead>
                <TableHead>Pick Up From</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[220px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></TableCell></TableRow>
              ) : shown.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                  No pull outs here. Click <strong>New Pull Out</strong> to log an item CDSC needs to pick up.
                </TableCell></TableRow>
              ) : shown.map(r => {
                const idx = STATUS_FLOW.indexOf(r.status)
                const next = idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs font-semibold text-red-600">{r.pull_out_number ?? '—'}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{r.location_name}</div>
                      {r.pickup_address && <div className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{r.pickup_address}</div>}
                      {(r.contact_person || r.contact_number) && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{[r.contact_person, r.contact_number].filter(Boolean).join(' · ')}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {(r.items ?? []).slice(0, 3).map(i => <div key={i.id}>{i.quantity} {i.unit} — {i.item_name}</div>)}
                      {(r.items ?? []).length > 3 && <div className="text-muted-foreground">+{(r.items ?? []).length - 3} more</div>}
                    </TableCell>
                    <TableCell className="text-xs">{REASONS[r.reason] ?? r.reason}{r.reference_no && <div className="text-muted-foreground">Ref: {r.reference_no}</div>}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {r.scheduled_date ? format(new Date(r.scheduled_date + 'T00:00:00'), 'MMM d, yyyy') : '—'}
                      {r.picked_up_date && <div className="text-muted-foreground">Picked up {format(new Date(r.picked_up_date + 'T00:00:00'), 'MMM d')}</div>}
                    </TableCell>
                    <TableCell className="text-xs">{r.assigned_to ?? '—'}{r.vehicle && <div className="text-muted-foreground">{r.vehicle}</div>}</TableCell>
                    <TableCell><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {next && (
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setStatus(r, next)}>
                            Mark {STATUS[next].label}
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-[#E8112D]" title="Authorization letter" onClick={() => setLetterFor(r)}><FileSignature className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Print slip" onClick={() => printSlip(r)}><Printer className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Edit" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        {r.status !== 'cancelled' && r.status !== 'received' && (
                          <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={() => setStatus(r, 'cancelled')}>Cancel</Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Delete" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      {letterFor && (
        <PullOutLetterDialog
          key={letterFor.id}
          pullOut={{ ...letterFor, reasonLabel: REASONS[letterFor.reason] ?? letterFor.reason }}
          onClose={() => setLetterFor(null)}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="landscape">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageOpen className="h-5 w-5 text-red-600" />{editingId ? 'Edit Pull Out' : 'New Pull Out'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Left: where & who */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Pick Up From</Label>
                  <Select value={form.source_type} onValueChange={v => setForm(f => ({ ...f, source_type: (v ?? 'client') as SourceType, party_id: '' }))}>
                    <SelectTrigger className="w-full"><span className="text-sm capitalize">{form.source_type}</span></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="supplier">Supplier</SelectItem>
                      <SelectItem value="other">Other location</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.source_type !== 'other' && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="capitalize">{form.source_type}</Label>
                    <Select value={form.party_id} onValueChange={v => pickParty(v ?? '')}>
                      <SelectTrigger className="w-full">
                        <span className="truncate text-sm">
                          {partyList.find(p => p.id === form.party_id)?.company_name ?? <span className="text-muted-foreground">Select…</span>}
                        </span>
                      </SelectTrigger>
                      <SelectContent>{partyList.map(p => <SelectItem key={p.id} value={p.id}>{p.company_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Location / Site Name <span className="text-destructive">*</span></Label>
                <Input placeholder="e.g. KEPI" value={form.location_name} onChange={e => setForm(f => ({ ...f, location_name: e.target.value }))} />
              </div>
              <AddressFields label="Pick-up Address" value={addr} onChange={setAddr} />
              <NameFields label="Contact Person at Site" value={contact} onChange={setContact} />
              <div className="space-y-1.5">
                <Label>Contact Number</Label>
                <Input placeholder="09xx xxx xxxx" value={form.contact_number} onChange={e => setForm(f => ({ ...f, contact_number: e.target.value }))} />
              </div>
            </div>

            {/* Right: what & when */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Reason</Label>
                  <Select value={form.reason} onValueChange={v => setForm(f => ({ ...f, reason: (v ?? 'return') as Reason }))}>
                    <SelectTrigger className="w-full"><span className="text-sm">{REASONS[form.reason]}</span></SelectTrigger>
                    <SelectContent>{(Object.keys(REASONS) as Reason[]).map(k => <SelectItem key={k} value={k}>{REASONS[k]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Reference No. (PO / SO / DR)</Label>
                  <Input placeholder="e.g. SO-2026-11-0012" value={form.reference_no} onChange={e => setForm(f => ({ ...f, reference_no: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Scheduled Pick-up Date</Label>
                  <Input type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Assigned To (driver / staff)</Label>
                  <Input value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Vehicle</Label>
                  <Input placeholder="e.g. L300 — ABC 1234" value={form.vehicle} onChange={e => setForm(f => ({ ...f, vehicle: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Items to Pick Up</Label>
                <div className="space-y-2 rounded-xl bg-muted/40 p-3">
                  {lines.map((l, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2">
                      <Input className="col-span-5" placeholder="Item name (type or pick from inventory)" value={l.item_name} list="pull-out-item-master"
                        onChange={e => {
                          const name = e.target.value
                          const hit = catalog.find(c => c.item_name === name)
                          setLines(p => p.map((x, j) => j === i ? { ...x, item_name: name, unit: hit?.unit_of_measure || x.unit } : x))
                        }} />
                      <Input className="col-span-2" type="number" min={0} placeholder="Qty" value={l.quantity}
                        onChange={e => setLines(p => p.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} />
                      <Input className="col-span-2" placeholder="Unit" value={l.unit}
                        onChange={e => setLines(p => p.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))} />
                      <Input className="col-span-2" placeholder="Condition" value={l.condition}
                        onChange={e => setLines(p => p.map((x, j) => j === i ? { ...x, condition: e.target.value } : x))} />
                      <Button type="button" variant="ghost" size="icon" className="col-span-1 h-8 w-8 text-muted-foreground hover:text-destructive"
                        disabled={lines.length === 1} onClick={async () => { if (await confirmRemoveLine(l)) setLines(p => p.filter((_, j) => j !== i)) }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <datalist id="pull-out-item-master">{catalog.map((c, k) => <option key={k} value={c.item_name} />)}</datalist>
                  <Button type="button" variant="outline" size="sm" onClick={() => setLines(p => [...p, emptyLine()])}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />Add Item
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Remarks</Label>
                <Textarea rows={2} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingId ? 'Save Changes' : 'Create Pull Out'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
