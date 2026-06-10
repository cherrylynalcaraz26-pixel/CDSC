'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Plus, Search, MoreHorizontal, FileText, Loader2, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface Supplier { id: string; company_name: string }

interface DRLog {
  id: string
  dr_number: string
  dr_date: string
  supplier_id: string | null
  supplier_name: string | null
  po_number: string | null
  rr_number: string | null
  total_amount: number
  remarks: string | null
  status: string
  received_by_name: string | null
  created_at: string
}

interface DRForm {
  dr_number: string
  dr_date: string
  supplier_id: string
  supplier_name: string
  po_number: string
  rr_number: string
  total_amount: string
  remarks: string
  status: string
  received_by_name: string
}

const emptyForm = (): DRForm => ({
  dr_number: '',
  dr_date: new Date().toISOString().split('T')[0],
  supplier_id: '',
  supplier_name: '',
  po_number: '',
  rr_number: '',
  total_amount: '',
  remarks: '',
  status: 'received',
  received_by_name: '',
})

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  received: { label: 'Received', cls: 'bg-green-100 text-green-700' },
  partial:  { label: 'Partial',  cls: 'bg-yellow-100 text-yellow-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
  returned: { label: 'Returned', cls: 'bg-gray-100 text-gray-600' },
}

export default function DRLogsPage() {
  const supabase = createClient()
  const [logs, setLogs] = useState<DRLog[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<DRLog | null>(null)
  const [form, setForm] = useState<DRForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [viewLog, setViewLog] = useState<DRLog | null>(null)

  async function load() {
    setLoading(true)
    const [{ data: drData }, { data: supData }] = await Promise.all([
      supabase.from('dr_logs').select('*').order('dr_date', { ascending: false }),
      supabase.from('suppliers').select('id, company_name').order('company_name'),
    ])
    setLogs(drData ?? [])
    setSuppliers(supData ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = logs.filter(l => {
    const matchSearch =
      l.dr_number.toLowerCase().includes(search.toLowerCase()) ||
      (l.supplier_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (l.po_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (l.rr_number ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || l.status === statusFilter
    return matchSearch && matchStatus
  })

  function openAdd() {
    setEditing(null)
    setForm(emptyForm())
    setOpen(true)
  }

  function openEdit(log: DRLog) {
    setEditing(log)
    setForm({
      dr_number: log.dr_number,
      dr_date: log.dr_date,
      supplier_id: log.supplier_id ?? '',
      supplier_name: log.supplier_name ?? '',
      po_number: log.po_number ?? '',
      rr_number: log.rr_number ?? '',
      total_amount: String(log.total_amount ?? ''),
      remarks: log.remarks ?? '',
      status: log.status,
      received_by_name: log.received_by_name ?? '',
    })
    setOpen(true)
  }

  function handleSupplierChange(supplierId: string) {
    const sup = suppliers.find(s => s.id === supplierId)
    setForm(f => ({ ...f, supplier_id: supplierId, supplier_name: sup?.company_name ?? '' }))
  }

  async function save() {
    if (!form.dr_number.trim()) { toast.error('DR Number is required'); return }
    if (!form.dr_date) { toast.error('DR Date is required'); return }
    setSaving(true)
    const payload = {
      dr_number: form.dr_number.trim().toUpperCase(),
      dr_date: form.dr_date,
      supplier_id: form.supplier_id || null,
      supplier_name: form.supplier_name || null,
      po_number: form.po_number || null,
      rr_number: form.rr_number || null,
      total_amount: Number(form.total_amount) || 0,
      remarks: form.remarks || null,
      status: form.status,
      received_by_name: form.received_by_name || null,
      updated_at: new Date().toISOString(),
    }
    if (editing) {
      const { error } = await supabase.from('dr_logs').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('DR Log updated')
    } else {
      const { error } = await supabase.from('dr_logs').insert(payload)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('DR Log recorded')
    }
    setOpen(false)
    load()
    setSaving(false)
  }

  async function confirmDelete() {
    if (!deleteId) return
    const { error } = await supabase.from('dr_logs').delete().eq('id', deleteId)
    if (error) toast.error(error.message)
    else { toast.success('DR Log deleted'); load() }
    setDeleteId(null)
  }

  const counts = {
    total:    logs.length,
    received: logs.filter(l => l.status === 'received').length,
    partial:  logs.filter(l => l.status === 'partial').length,
    rejected: logs.filter(l => l.status === 'rejected').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">DR Logs</h1>
          <p className="text-muted-foreground text-sm">Delivery Receipt log — track all incoming supplier DRs</p>
        </div>
        <Button onClick={openAdd} className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-2" /> New DR Log
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total DRs', count: counts.total,    color: 'text-foreground' },
          { label: 'Received',  count: counts.received, color: 'text-green-600' },
          { label: 'Partial',   count: counts.partial,  color: 'text-yellow-600' },
          { label: 'Rejected',  count: counts.rejected, color: 'text-red-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <div className={`text-2xl font-bold ${s.color}`}>{loading ? '—' : s.count}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search DR#, supplier, PO…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'all')}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="returned">Returned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4 text-red-600" /> Delivery Receipt Log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>DR Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>PO Ref</TableHead>
                  <TableHead>RR Ref</TableHead>
                  <TableHead className="text-right">Amount (₱)</TableHead>
                  <TableHead>Received By</TableHead>
                  <TableHead>Status</TableHead>
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
                      No DR logs found. Click <strong>New DR Log</strong> to add one.
                    </TableCell>
                  </TableRow>
                ) : filtered.map(log => {
                  const sc = STATUS_CFG[log.status] ?? STATUS_CFG.received
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm font-semibold text-red-600">{log.dr_number}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(log.dr_date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{log.supplier_name ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{log.po_number ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{log.rr_number ?? '—'}</TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        {(log.total_amount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-sm">{log.received_by_name ?? '—'}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.cls}`}>{sc.label}</span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent">
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewLog(log)}>
                              <FileText className="mr-2 h-4 w-4" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(log)}>Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(log.id)}>Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-red-600" />
              {editing ? 'Edit DR Log' : 'New DR Log'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">DR Details</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>DR Number <span className="text-destructive">*</span></Label>
                  <Input placeholder="e.g. DR-2025-00001" value={form.dr_number}
                    onChange={e => setForm(f => ({ ...f, dr_number: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>DR Date <span className="text-destructive">*</span></Label>
                  <Input type="date" value={form.dr_date}
                    onChange={e => setForm(f => ({ ...f, dr_date: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Supplier</Label>
                <Select value={form.supplier_id} onValueChange={handleSupplierChange}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— No supplier —</SelectItem>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>PO Reference</Label>
                  <Input placeholder="e.g. PO-2025-00045" value={form.po_number}
                    onChange={e => setForm(f => ({ ...f, po_number: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>RR Reference</Label>
                  <Input placeholder="e.g. RR-2025-00032" value={form.rr_number}
                    onChange={e => setForm(f => ({ ...f, rr_number: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Total Amount (₱)</Label>
                  <Input type="number" min={0} step="0.01" placeholder="0.00" value={form.total_amount}
                    onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v ?? 'received' }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="received">Received</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="returned">Returned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Received By</Label>
                <Input placeholder="Name of person who received" value={form.received_by_name}
                  onChange={e => setForm(f => ({ ...f, received_by_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Remarks</Label>
                <Textarea rows={2} placeholder="Notes, discrepancies, condition of goods…" value={form.remarks}
                  onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : editing ? 'Update DR Log' : 'Save DR Log'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={!!viewLog} onOpenChange={() => setViewLog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-red-600" /> DR Log Details
            </DialogTitle>
          </DialogHeader>
          {viewLog && (
            <div className="space-y-3 py-2 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div><span className="text-muted-foreground">DR Number:</span><div className="font-mono font-semibold text-red-600">{viewLog.dr_number}</div></div>
                <div><span className="text-muted-foreground">Date:</span><div>{format(new Date(viewLog.dr_date), 'MMMM d, yyyy')}</div></div>
                <div><span className="text-muted-foreground">Supplier:</span><div className="font-medium">{viewLog.supplier_name ?? '—'}</div></div>
                <div><span className="text-muted-foreground">Status:</span><div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${(STATUS_CFG[viewLog.status] ?? STATUS_CFG.received).cls}`}>
                    {(STATUS_CFG[viewLog.status] ?? STATUS_CFG.received).label}
                  </span>
                </div></div>
                <div><span className="text-muted-foreground">PO Reference:</span><div className="font-mono">{viewLog.po_number ?? '—'}</div></div>
                <div><span className="text-muted-foreground">RR Reference:</span><div className="font-mono">{viewLog.rr_number ?? '—'}</div></div>
                <div><span className="text-muted-foreground">Total Amount:</span><div className="font-semibold">₱{(viewLog.total_amount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div></div>
                <div><span className="text-muted-foreground">Received By:</span><div>{viewLog.received_by_name ?? '—'}</div></div>
              </div>
              {viewLog.remarks && (
                <div>
                  <span className="text-muted-foreground">Remarks:</span>
                  <div className="mt-1 p-2 bg-muted rounded text-sm">{viewLog.remarks}</div>
                </div>
              )}
              <div className="text-xs text-muted-foreground pt-1">
                Logged: {format(new Date(viewLog.created_at), 'MMM d, yyyy h:mm a')}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewLog(null)}>Close</Button>
            {viewLog && <Button onClick={() => { setViewLog(null); openEdit(viewLog) }} className="bg-red-600 hover:bg-red-700">Edit</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete DR Log?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete this delivery receipt log.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
