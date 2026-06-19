'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Plus, Trash2, Loader2, FileText, Package,
  ArrowLeftRight, Receipt,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Client {
  id: string
  name: string
}

interface Item {
  id: string
  name: string
  unit?: string
}

interface PullOutItem {
  item_id: string
  item_name: string
  qty: number
  unit: string
}

interface PullOutRecord {
  id: string
  pr_number: string
  date: string
  client_name: string
  items: PullOutItem[]
  reason: string
  status: 'pending' | 'approved' | 'completed' | 'cancelled'
}

interface BillingLineItem {
  description: string
  qty: number
  unit_price: number
  total: number
}

interface BillingRecord {
  id: string
  invoice_number: string
  date: string
  client_name: string
  amount: number
  due_date: string
  status: 'draft' | 'sent' | 'paid' | 'overdue'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function peso(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const pullOutStatusColor: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved:  'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
}

const billingStatusColor: Record<string, string> = {
  draft:    'bg-gray-100 text-gray-600 border-gray-200',
  sent:     'bg-blue-100 text-blue-800 border-blue-200',
  paid:     'bg-green-100 text-green-800 border-green-200',
  overdue:  'bg-red-100 text-red-700 border-red-200',
}

// ─── Pull Out Tab ─────────────────────────────────────────────────────────────

function PullOutTab() {
  const supabase = createClient()
  const [records, setRecords] = useState<PullOutRecord[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [clientId, setClientId] = useState('')
  const [clientName, setClientName] = useState('')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [reason, setReason] = useState('')
  const [status, setStatus] = useState<'pending' | 'approved' | 'completed' | 'cancelled'>('pending')
  const [lineItems, setLineItems] = useState<PullOutItem[]>([
    { item_id: '', item_name: '', qty: 1, unit: '' },
  ])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: rows } = await supabase
        .from('pull_out_requests')
        .select('*')
        .order('created_at', { ascending: false })
      if (rows) setRecords(rows as PullOutRecord[])

      const { data: cls } = await supabase.from('clients').select('id, name').order('name')
      if (cls) setClients(cls)

      const { data: itms } = await supabase.from('items').select('id, name, unit').order('name')
      if (itms) setItems(itms)

      setLoading(false)
    }
    load()
  }, [])

  function resetForm() {
    setClientId('')
    setClientName('')
    setDate(format(new Date(), 'yyyy-MM-dd'))
    setReason('')
    setStatus('pending')
    setLineItems([{ item_id: '', item_name: '', qty: 1, unit: '' }])
  }

  function addLine() {
    setLineItems(prev => [...prev, { item_id: '', item_name: '', qty: 1, unit: '' }])
  }

  function removeLine(idx: number) {
    setLineItems(prev => prev.filter((_, i) => i !== idx))
  }

  function updateLine(idx: number, field: keyof PullOutItem, value: string | number) {
    setLineItems(prev => {
      const next = [...prev]
      if (field === 'item_id') {
        const found = items.find(i => i.id === value)
        next[idx] = {
          ...next[idx],
          item_id: value as string,
          item_name: found?.name ?? '',
          unit: found?.unit ?? '',
        }
      } else {
        next[idx] = { ...next[idx], [field]: value }
      }
      return next
    })
  }

  async function handleSave() {
    if (!clientId) { toast.error('Please select a client'); return }
    if (!reason.trim()) { toast.error('Please enter a reason'); return }
    if (lineItems.some(l => !l.item_id)) { toast.error('Please select items for all rows'); return }

    setSaving(true)
    const prNumber = 'PR-' + Date.now().toString().slice(-6)
    const payload = {
      pr_number: prNumber,
      date,
      client_id: clientId,
      client_name: clientName,
      items: lineItems,
      reason,
      status,
    }
    const { error } = await supabase.from('pull_out_requests').insert(payload)
    setSaving(false)

    if (error) {
      toast.error('Failed to save pull out: ' + error.message)
      return
    }
    toast.success('Pull out request saved!')
    setRecords(prev => [{
      id: crypto.randomUUID(),
      ...payload,
    }, ...prev])
    setShowForm(false)
    resetForm()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pull Out Requests</h2>
          <p className="text-sm text-muted-foreground">Items returned by clients or pulled for redelivery</p>
        </div>
        <Button
          className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
          onClick={() => { setShowForm(s => !s); if (showForm) resetForm() }}
        >
          <Plus className="h-4 w-4" />
          New Pull Out
        </Button>
      </div>

      {showForm && (
        <Card className="border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-red-600" />
              New Pull Out Request
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Client</Label>
                <Select value={clientId} onValueChange={v => {
                  setClientId(v)
                  setClientName(clients.find(c => c.id === v)?.name ?? '')
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client…" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.length === 0 && (
                      <SelectItem value="_none" disabled>No clients found</SelectItem>
                    )}
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={v => setStatus(v as typeof status)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Reason</Label>
              <textarea
                className="w-full min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                placeholder="Describe the reason for pull out…"
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Items</Label>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground w-1/2">Item</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground w-20">Qty</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground w-24">Unit</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((line, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-2 py-1.5">
                          <Select value={line.item_id} onValueChange={v => updateLine(idx, 'item_id', v)}>
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select item…" />
                            </SelectTrigger>
                            <SelectContent>
                              {items.length === 0 && (
                                <SelectItem value="_none" disabled>No items found</SelectItem>
                              )}
                              {items.map(it => (
                                <SelectItem key={it.id} value={it.id}>{it.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="number"
                            min={1}
                            className="h-8 w-20"
                            value={line.qty}
                            onChange={e => updateLine(idx, 'qty', Number(e.target.value))}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input className="h-8 w-24" value={line.unit} readOnly placeholder="auto" />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button
                            onClick={() => removeLine(idx)}
                            disabled={lineItems.length === 1}
                            className="text-muted-foreground hover:text-red-600 disabled:opacity-30 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button variant="outline" size="sm" onClick={addLine} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add Item
              </Button>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                Save Pull Out
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); resetForm() }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PR#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground text-sm">
                      No pull out records yet. Click &quot;New Pull Out&quot; to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm font-medium">{r.pr_number}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.date ? format(new Date(r.date), 'MMM d, yyyy') : '—'}
                      </TableCell>
                      <TableCell className="font-medium">{r.client_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {Array.isArray(r.items)
                          ? r.items.map((it: PullOutItem) => `${it.item_name} ×${it.qty}`).join(', ')
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{r.reason}</TableCell>
                      <TableCell>
                        <Badge className={`text-xs border ${pullOutStatusColor[r.status] ?? ''}`} variant="outline">
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Billing Tab ──────────────────────────────────────────────────────────────

function BillingTab() {
  const supabase = createClient()
  const [records, setRecords] = useState<BillingRecord[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [clientId, setClientId] = useState('')
  const [clientName, setClientName] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [billingStatus, setBillingStatus] = useState<'draft' | 'sent' | 'paid' | 'overdue'>('draft')
  const [lineItems, setLineItems] = useState<BillingLineItem[]>([
    { description: '', qty: 1, unit_price: 0, total: 0 },
  ])

  const subtotal = lineItems.reduce((s, l) => s + l.total, 0)
  const vat = subtotal * 0.12
  const total = subtotal + vat

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: rows } = await supabase
        .from('billing_invoices')
        .select('*')
        .order('created_at', { ascending: false })
      if (rows) setRecords(rows as BillingRecord[])

      const { data: cls } = await supabase.from('clients').select('id, name').order('name')
      if (cls) setClients(cls)

      setLoading(false)
    }
    load()
  }, [])

  function resetForm() {
    setClientId('')
    setClientName('')
    setInvoiceDate(format(new Date(), 'yyyy-MM-dd'))
    setDueDate('')
    setNotes('')
    setBillingStatus('draft')
    setLineItems([{ description: '', qty: 1, unit_price: 0, total: 0 }])
  }

  function addLine() {
    setLineItems(prev => [...prev, { description: '', qty: 1, unit_price: 0, total: 0 }])
  }

  function removeLine(idx: number) {
    setLineItems(prev => prev.filter((_, i) => i !== idx))
  }

  function updateLine(idx: number, field: keyof BillingLineItem, value: string | number) {
    setLineItems(prev => {
      const next = [...prev]
      const row = { ...next[idx], [field]: value }
      if (field === 'qty' || field === 'unit_price') {
        row.total = Number(row.qty) * Number(row.unit_price)
      }
      next[idx] = row
      return next
    })
  }

  async function handleSave() {
    if (!clientId) { toast.error('Please select a client'); return }
    if (!dueDate) { toast.error('Please set a due date'); return }
    if (lineItems.some(l => !l.description.trim())) { toast.error('Please fill in all item descriptions'); return }

    setSaving(true)
    const invoiceNumber = 'INV-' + Date.now().toString().slice(-6)
    const payload = {
      invoice_number: invoiceNumber,
      date: invoiceDate,
      client_id: clientId,
      client_name: clientName,
      items: lineItems,
      subtotal,
      vat,
      amount: total,
      due_date: dueDate,
      notes,
      status: billingStatus,
    }
    const { error } = await supabase.from('billing_invoices').insert(payload)
    setSaving(false)

    if (error) {
      toast.error('Failed to save invoice: ' + error.message)
      return
    }
    toast.success('Invoice saved!')
    setRecords(prev => [{
      id: crypto.randomUUID(),
      invoice_number: invoiceNumber,
      date: invoiceDate,
      client_name: clientName,
      amount: total,
      due_date: dueDate,
      status: billingStatus,
    }, ...prev])
    setShowForm(false)
    resetForm()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Billing &amp; Invoices</h2>
          <p className="text-sm text-muted-foreground">Generate and track client invoices</p>
        </div>
        <Button
          className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
          onClick={() => { setShowForm(s => !s); if (showForm) resetForm() }}
        >
          <Plus className="h-4 w-4" />
          New Invoice
        </Button>
      </div>

      {showForm && (
        <Card className="border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-red-600" />
              New Invoice
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label>Client</Label>
                <Select value={clientId} onValueChange={v => {
                  setClientId(v)
                  setClientName(clients.find(c => c.id === v)?.name ?? '')
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client…" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.length === 0 && (
                      <SelectItem value="_none" disabled>No clients found</SelectItem>
                    )}
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Invoice Date</Label>
                <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={billingStatus} onValueChange={v => setBillingStatus(v as typeof billingStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Items / Services</Label>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground w-20">Qty</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground w-32">Unit Price</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground w-32">Total</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((line, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-2 py-1.5">
                          <Input
                            className="h-8"
                            placeholder="Item or service description"
                            value={line.description}
                            onChange={e => updateLine(idx, 'description', e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="number"
                            min={1}
                            className="h-8 w-20"
                            value={line.qty}
                            onChange={e => updateLine(idx, 'qty', Number(e.target.value))}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            className="h-8 w-32"
                            value={line.unit_price}
                            onChange={e => updateLine(idx, 'unit_price', Number(e.target.value))}
                          />
                        </td>
                        <td className="px-3 py-1.5 text-sm font-medium text-right">
                          {peso(line.total)}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button
                            onClick={() => removeLine(idx)}
                            disabled={lineItems.length === 1}
                            className="text-muted-foreground hover:text-red-600 disabled:opacity-30 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button variant="outline" size="sm" onClick={addLine} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add Line
              </Button>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{peso(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAT (12%)</span>
                  <span>{peso(vat)}</span>
                </div>
                <div className="flex justify-between font-semibold text-base border-t pt-1.5">
                  <span>Total</span>
                  <span className="text-red-600">{peso(total)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <textarea
                className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                placeholder="Additional notes or payment instructions…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                Save Invoice
              </Button>
              <Button variant="outline" onClick={() => { setShowForm(false); resetForm() }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground text-sm">
                      No invoices yet. Click &quot;New Invoice&quot; to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm font-medium">{r.invoice_number}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.date ? format(new Date(r.date), 'MMM d, yyyy') : '—'}
                      </TableCell>
                      <TableCell className="font-medium">{r.client_name}</TableCell>
                      <TableCell className="text-right font-medium">{peso(r.amount ?? 0)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.due_date ? format(new Date(r.due_date), 'MMM d, yyyy') : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs border ${billingStatusColor[r.status] ?? ''}`} variant="outline">
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PullOutBillingPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6 text-red-600" />
            Pull Out &amp; Billing
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage item pull outs and generate client invoices
          </p>
        </div>
      </div>

      <Tabs defaultValue="pull-out">
        <TabsList>
          <TabsTrigger value="pull-out" className="gap-1.5">
            <Package className="h-4 w-4" />
            Pull Out
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Billing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pull-out" className="mt-4">
          <PullOutTab />
        </TabsContent>

        <TabsContent value="billing" className="mt-4">
          <BillingTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
