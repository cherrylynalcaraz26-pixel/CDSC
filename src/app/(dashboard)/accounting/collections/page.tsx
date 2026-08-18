'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, MoreHorizontal, Printer, Eye, Loader2, Receipt, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface Collection {
  id: string
  or_number: string | null
  collection_date: string | null
  client_name: string | null
  amount: number
  form_2307: number | null
  payment_mode: string
  reference_number: string | null
  remarks: string | null
  status: string
  created_at: string
}

interface Client { id: string; company_name: string }

const PAYMENT_MODES = ['Cash', 'Check', 'Bank Transfer', 'GCash', 'Maya', 'Credit Card', 'Online Banking']

const STATUS_CLS: Record<string, string> = {
  posted:   'bg-green-100 text-green-700',
  voided:   'bg-red-100 text-red-700',
  pending:  'bg-yellow-100 text-yellow-700',
}

export default function CollectionsPage() {
  const supabase = createClient()
  const [records, setRecords] = useState<Collection[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    client_id: '', client_name: '', amount: '',
    payment_mode: 'Cash', reference_number: '', collection_date: '',
    remarks: '',
  })

  async function load() {
    setLoading(true)
    const [{ data: colData }, { data: cliData }] = await Promise.all([
      supabase.from('collections').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, company_name').eq('status', 'active').order('company_name'),
    ])
    setRecords((colData ?? []) as Collection[])
    setClients(cliData ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function resetForm() {
    setForm({ client_id: '', client_name: '', amount: '', payment_mode: 'Cash', reference_number: '', collection_date: '', remarks: '' })
  }

  async function save() {
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Enter a valid amount'); return }
    const clientName = form.client_id
      ? clients.find(c => c.id === form.client_id)?.company_name ?? form.client_name
      : form.client_name
    if (!clientName.trim()) { toast.error('Client name required'); return }
    setSaving(true)
    const { error } = await supabase.from('collections').insert({
      client_id: form.client_id || null,
      client_name: clientName.trim(),
      amount: Number(form.amount),
      payment_mode: form.payment_mode.toLowerCase().replace(' ', '_'),
      reference_number: form.reference_number || null,
      collection_date: form.collection_date || new Date().toISOString().split('T')[0],
      remarks: form.remarks || null,
      status: 'posted',
    })
    if (error) toast.error(error.message)
    else { toast.success('Collection recorded'); setOpen(false); resetForm(); load() }
    setSaving(false)
  }

  async function voidRecord(id: string) {
    const { error } = await supabase.from('collections').update({ status: 'voided' }).eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Collection voided'); load() }
  }

  async function deleteRecord(id: string) {
    const { error } = await supabase.from('collections').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Deleted'); load() }
  }

  const totalPosted = records.filter(r => r.status === 'posted').reduce((s, r) => s + (r.amount ?? 0) - (r.form_2307 ?? 0), 0)
  const countPosted = records.filter(r => r.status === 'posted').length
  const countVoided = records.filter(r => r.status === 'voided').length

  const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Collections (OR/CR)</h2>
          <p className="text-muted-foreground text-sm">Official Receipts and Collection Receipts management</p>
        </div>
        <Button onClick={() => { resetForm(); setOpen(true) }} className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-2" />New Collection
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold text-green-600">{loading ? '—' : fmt(totalPosted)}</div>
          <div className="text-sm text-muted-foreground">Total Collections</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold">{loading ? '—' : countPosted}</div>
          <div className="text-sm text-muted-foreground">Posted Records</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold text-red-600">{loading ? '—' : countVoided}</div>
          <div className="text-sm text-muted-foreground">Voided</div>
        </CardContent></Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-red-600" />Collection Records
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>OR Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Payment Mode</TableHead>
                <TableHead className="text-right">Gross Amount</TableHead>
                <TableHead className="text-right">Form 2307</TableHead>
                <TableHead className="text-right">Net Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell></TableRow>
              ) : records.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  No collections yet. Click <strong>New Collection</strong> to record one.
                </TableCell></TableRow>
              ) : records.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs font-semibold text-red-600">{r.or_number ?? '—'}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {r.collection_date ? format(new Date(r.collection_date), 'MMM d, yyyy') : '—'}
                  </TableCell>
                  <TableCell className="font-medium text-sm">{r.client_name ?? '—'}</TableCell>
                  <TableCell>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize">
                      {(r.payment_mode ?? '').replace('_', ' ')}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{fmt(r.amount ?? 0)}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">{r.form_2307 ? fmt(r.form_2307) : '—'}</TableCell>
                  <TableCell className="text-right font-semibold text-green-700">{fmt((r.amount ?? 0) - (r.form_2307 ?? 0))}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_CLS[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {r.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => toast.info(`OR: ${r.or_number}`)}>
                          <Eye className="mr-2 h-4 w-4" />View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.print()}>
                          <Printer className="mr-2 h-4 w-4" />Print OR
                        </DropdownMenuItem>
                        {r.status === 'posted' && (
                          <DropdownMenuItem onClick={() => voidRecord(r.id)} className="text-destructive">
                            <Receipt className="mr-2 h-4 w-4" />Void
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => deleteRecord(r.id)} className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* New Collection Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New Collection (OR)</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>OR Number</Label>
                <Input value="" disabled className="bg-muted text-muted-foreground" placeholder="Auto-generated" />
              </div>
              <div className="space-y-1.5">
                <Label>Collection Date</Label>
                <Input type="date" value={form.collection_date} onChange={e => setForm(p => ({ ...p, collection_date: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Client</Label>
              <Select value={form.client_id} onValueChange={v => setForm(p => ({ ...p, client_id: v ?? '', client_name: '' }))}>
                <SelectTrigger><SelectValue placeholder="Select existing client" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Enter manually —</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
              {!form.client_id && (
                <Input
                  placeholder="Or type client name manually"
                  value={form.client_name}
                  onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Amount (₱) <span className="text-destructive">*</span></Label>
                <Input type="number" min={0} step="0.01" placeholder="0.00" value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Payment Mode</Label>
                <Select value={form.payment_mode} onValueChange={v => setForm(p => ({ ...p, payment_mode: v ?? 'Cash' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Reference Number</Label>
              <Input placeholder="Check #, bank ref, transaction ID…" value={form.reference_number}
                onChange={e => setForm(p => ({ ...p, reference_number: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label>Remarks</Label>
              <Textarea rows={2} placeholder="Optional notes…" value={form.remarks}
                onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Post Collection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
