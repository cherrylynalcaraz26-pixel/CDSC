'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { undoToast } from '@/lib/undo-toast'
import {
  Loader2, ClipboardList, ChevronLeft, Trash2, Plus, Package,
  XCircle, ShoppingCart, Star, Truck, Globe2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSearchContext } from '@/context/search-context'
import { RfqFlowStepper } from '@/components/quotation/rfq-flow'

interface ItemOption { item_name: string; unit_of_measure: string; cost: number | null; selling_price: number | null }
interface SupplierOption { id: string; company_name: string; payment_terms: string | null; lead_time_days: number | null }

interface RequestItemRow {
  id: string
  item_name: string
  quantity: number
  unit: string | null
  unit_price: number | null
  remarks: string | null
}

interface SupplierComparisonRow {
  id: string
  supplier_id: string | null
  supplier_name: string
  terms_of_payment: string | null
  delivery_time: string | null
  origin: string | null
  response_speed: string | null
  estimated_income: number | null
  notes: string | null
  is_selected: boolean
}

interface QuotationRequest {
  id: string
  request_number: string
  client_id: string
  client_name: string
  subject: string
  notes: string | null
  status: string
  quotation_id: string | null
  quote_number: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  quotation_request_items: RequestItemRow[]
  quotation_request_suppliers: SupplierComparisonRow[]
}

interface EditLine {
  item_name: string
  quantity: string
  unit: string
  unit_price: string
  remarks: string
}

interface SupplierColumn {
  supplier_id: string | null
  supplier_name: string
  terms_of_payment: string
  delivery_time: string
  origin: '' | 'local' | 'overseas'
  response_speed: '' | 'fast' | 'average' | 'slow'
  estimated_income: string
  notes: string
  is_selected: boolean
}

const FLOW_STAGES = [
  { value: 'pending', label: 'Request' },
  { value: 'processing', label: 'Processing' },
  { value: 'quoted', label: 'Sending Quotation' },
  { value: 'done', label: 'Done' },
] as const

const emptyLine = (): EditLine => ({ item_name: '', quantity: '1', unit: '', unit_price: '', remarks: '' })
const emptySupplier = (): SupplierColumn => ({
  supplier_id: null, supplier_name: '', terms_of_payment: '', delivery_time: '',
  origin: '', response_speed: '', estimated_income: '', notes: '', is_selected: false,
})

export default function QuotationRequestsPanel({ onQuotationCreated }: { onQuotationCreated?: (quotationId: string) => void }) {
  const supabase = createClient()
  const { query } = useSearchContext()
  const [requests, setRequests] = useState<QuotationRequest[]>([])
  const [items, setItems] = useState<ItemOption[]>([])
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [editLines, setEditLines] = useState<EditLine[]>([])
  const [supplierCols, setSupplierCols] = useState<SupplierColumn[]>([])
  const [saving, setSaving] = useState(false)
  const [savingComparison, setSavingComparison] = useState(false)
  const [staffName, setStaffName] = useState('')

  async function load() {
    setLoading(true)
    const [{ data }, { data: itemData }, { data: supplierData }, { data: { user } }] = await Promise.all([
      supabase
        .from('quotation_requests')
        .select('id, request_number, client_id, client_name, subject, notes, status, quotation_id, quote_number, reviewed_by, reviewed_at, created_at, quotation_request_items(id, item_name, quantity, unit, unit_price, remarks), quotation_request_suppliers(id, supplier_id, supplier_name, terms_of_payment, delivery_time, origin, response_speed, estimated_income, notes, is_selected)')
        .order('created_at', { ascending: false }),
      supabase.from('items').select('item_name, unit_of_measure, cost, selling_price').eq('status', 'active').order('item_name'),
      supabase.from('suppliers').select('id, company_name, payment_terms, lead_time_days').eq('is_active', true).order('company_name'),
      supabase.auth.getUser(),
    ])
    setRequests((data ?? []) as unknown as QuotationRequest[])
    setItems((itemData ?? []) as ItemOption[])
    setSuppliers((supplierData ?? []) as SupplierOption[])
    setStaffName(user?.email ?? '')
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const reviewing = requests.find(r => r.id === reviewingId) ?? null

  async function openReview(r: QuotationRequest) {
    setReviewingId(r.id)
    setEditLines(
      r.quotation_request_items.length > 0
        ? r.quotation_request_items.map(i => ({
            item_name: i.item_name,
            quantity: String(i.quantity ?? 1),
            unit: i.unit ?? '',
            unit_price: i.unit_price != null ? String(i.unit_price) : '',
            remarks: i.remarks ?? '',
          }))
        : [emptyLine()]
    )
    setSupplierCols(
      r.quotation_request_suppliers.length > 0
        ? r.quotation_request_suppliers.map(c => ({
            supplier_id: c.supplier_id,
            supplier_name: c.supplier_name,
            terms_of_payment: c.terms_of_payment ?? '',
            delivery_time: c.delivery_time ?? '',
            origin: (c.origin as SupplierColumn['origin']) ?? '',
            response_speed: (c.response_speed as SupplierColumn['response_speed']) ?? '',
            estimated_income: c.estimated_income != null ? String(c.estimated_income) : '',
            notes: c.notes ?? '',
            is_selected: c.is_selected,
          }))
        : [emptySupplier()]
    )
    // Opening a request for review is the moment it moves from "Request" to "Processing".
    if (r.status === 'pending') {
      const { error } = await supabase.from('quotation_requests').update({ status: 'processing' }).eq('id', r.id)
      if (!error) {
        setRequests(prev => prev.map(x => x.id === r.id ? { ...x, status: 'processing' } : x))
      }
    }
  }

  function updateLine(idx: number, field: keyof EditLine, value: string) {
    setEditLines(prev => prev.map((line, i) => {
      if (i !== idx) return line
      if (field === 'item_name') {
        const found = items.find(it => it.item_name === value)
        return {
          ...line,
          item_name: value,
          unit: found?.unit_of_measure ?? line.unit,
          unit_price: line.unit_price || (found?.selling_price != null ? String(found.selling_price) : line.unit_price),
        }
      }
      return { ...line, [field]: value }
    }))
  }

  function updateSupplierCol(idx: number, patch: Partial<SupplierColumn>) {
    setSupplierCols(prev => prev.map((c, i) => {
      if (i !== idx) return c
      if (patch.supplier_id !== undefined) {
        const found = suppliers.find(s => s.id === patch.supplier_id)
        return {
          ...c, ...patch,
          supplier_name: found?.company_name ?? c.supplier_name,
          terms_of_payment: c.terms_of_payment || found?.payment_terms || '',
          delivery_time: c.delivery_time || (found?.lead_time_days != null ? `${found.lead_time_days} days` : ''),
        }
      }
      return { ...c, ...patch }
    }))
  }

  async function markDeclined() {
    if (!reviewing) return
    const prevStatus = reviewing.status
    setSaving(true)
    const { error } = await supabase.from('quotation_requests').update({
      status: 'declined', reviewed_by: staffName || null, reviewed_at: new Date().toISOString(),
    }).eq('id', reviewing.id)
    if (error) { toast.error(error.message); setSaving(false); return }
    undoToast('Request declined', async () => {
      await supabase.from('quotation_requests').update({ status: prevStatus }).eq('id', reviewing.id)
      await load()
    })
    setReviewingId(null)
    await load()
    setSaving(false)
  }

  async function saveSupplierComparison() {
    if (!reviewing) return
    const prevRows = reviewing.quotation_request_suppliers
    const valid = supplierCols.filter(c => c.supplier_name.trim())
    setSavingComparison(true)
    const { error: delErr } = await supabase.from('quotation_request_suppliers').delete().eq('request_id', reviewing.id)
    if (delErr) { toast.error(delErr.message); setSavingComparison(false); return }
    if (valid.length > 0) {
      const { error: insErr } = await supabase.from('quotation_request_suppliers').insert(valid.map(c => ({
        request_id: reviewing.id,
        supplier_id: c.supplier_id,
        supplier_name: c.supplier_name,
        terms_of_payment: c.terms_of_payment || null,
        delivery_time: c.delivery_time || null,
        origin: c.origin || null,
        response_speed: c.response_speed || null,
        estimated_income: c.estimated_income ? parseFloat(c.estimated_income) : null,
        notes: c.notes || null,
        is_selected: c.is_selected,
      })))
      if (insErr) { toast.error(insErr.message); setSavingComparison(false); return }
    }
    undoToast('Supplier comparison saved', async () => {
      await supabase.from('quotation_request_suppliers').delete().eq('request_id', reviewing.id)
      if (prevRows.length > 0) {
        await supabase.from('quotation_request_suppliers').insert(prevRows.map(c => ({
          request_id: reviewing.id, supplier_id: c.supplier_id, supplier_name: c.supplier_name,
          terms_of_payment: c.terms_of_payment, delivery_time: c.delivery_time, origin: c.origin,
          response_speed: c.response_speed, estimated_income: c.estimated_income, notes: c.notes,
          is_selected: c.is_selected,
        })))
      }
      await load()
    })
    await load()
    setSavingComparison(false)
  }

  async function handleSendToQuotation() {
    if (!reviewing) return
    const validLines = editLines.filter(l => l.item_name.trim())
    if (validLines.length === 0) { toast.error('Add at least one item'); return }
    setSaving(true)
    const prevItems = reviewing.quotation_request_items
    const prevStatus = reviewing.status
    try {
      await supabase.from('quotation_request_items').delete().eq('request_id', reviewing.id)
      await supabase.from('quotation_request_items').insert(validLines.map(l => ({
        request_id: reviewing.id,
        item_name: l.item_name,
        quantity: parseFloat(l.quantity) || 1,
        unit: l.unit || null,
        unit_price: l.unit_price ? parseFloat(l.unit_price) : null,
        remarks: l.remarks || null,
      })))

      const subtotal = validLines.reduce((s, l) => s + (parseFloat(l.unit_price) || 0) * (parseFloat(l.quantity) || 1), 0)
      const vatAmount = subtotal * 0.12
      const totalAmount = subtotal + vatAmount
      const quoteNumber = `QT-${Date.now().toString().slice(-8)}`
      const today = new Date().toISOString().split('T')[0]

      const { data: quoData, error: quoErr } = await supabase
        .from('quotations')
        .insert({
          quote_number: quoteNumber,
          quote_date: today,
          client_id: reviewing.client_id,
          client_name: reviewing.client_name,
          subject: reviewing.subject,
          subtotal,
          vat_type: 'exclusive',
          vat_amount: vatAmount,
          ewt_amount: 0,
          total_amount: totalAmount,
          notes: reviewing.notes,
          prepared_by: staffName || null,
          status: 'draft',
        })
        .select('id')
        .single()
      if (quoErr) throw quoErr

      await supabase.from('quotation_items').insert(validLines.map(l => ({
        quotation_id: quoData.id,
        item_name: l.item_name,
        quantity: parseFloat(l.quantity) || 1,
        unit: l.unit || null,
        unit_price: parseFloat(l.unit_price) || 0,
        selling_price: parseFloat(l.unit_price) || null,
        total_amount: (parseFloat(l.unit_price) || 0) * (parseFloat(l.quantity) || 1),
      })))

      const { error: updErr } = await supabase.from('quotation_requests').update({
        status: 'quoted',
        quotation_id: quoData.id,
        quote_number: quoteNumber,
        reviewed_by: staffName || null,
        reviewed_at: new Date().toISOString(),
      }).eq('id', reviewing.id)
      if (updErr) throw updErr

      undoToast(`Quotation ${quoteNumber} created`, async () => {
        await supabase.from('quotation_items').delete().eq('quotation_id', quoData.id)
        await supabase.from('quotations').delete().eq('id', quoData.id)
        await supabase.from('quotation_requests').update({
          status: prevStatus, quotation_id: null, quote_number: null,
        }).eq('id', reviewing.id)
        await supabase.from('quotation_request_items').delete().eq('request_id', reviewing.id)
        if (prevItems.length > 0) {
          await supabase.from('quotation_request_items').insert(prevItems.map(i => ({
            request_id: reviewing.id, item_name: i.item_name, quantity: i.quantity,
            unit: i.unit, unit_price: i.unit_price, remarks: i.remarks,
          })))
        }
        await load()
      })

      setReviewingId(null)
      await load()
      onQuotationCreated?.(quoData.id)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create quotation')
    }
    setSaving(false)
  }

  const displayed = requests.filter(r => {
    const s = query.toLowerCase()
    const matchSearch = !s ||
      r.request_number.toLowerCase().includes(s) ||
      r.client_name.toLowerCase().includes(s) ||
      r.subject.toLowerCase().includes(s)
    const matchFilter = !filterStatus || r.status === filterStatus
    return matchSearch && matchFilter
  })

  const stageCounts = FLOW_STAGES.reduce((acc, s) => {
    acc[s.value] = requests.filter(r => r.status === s.value).length
    return acc
  }, {} as Record<string, number>)
  const declinedCount = requests.filter(r => r.status === 'declined').length

  const total = editLines.reduce((s, l) => s + (parseFloat(l.unit_price) || 0) * (parseFloat(l.quantity) || 0), 0)
  const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

  if (reviewing) {
    const isOpenForEditing = reviewing.status === 'pending' || reviewing.status === 'processing'
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => setReviewingId(null)}>
          <ChevronLeft className="h-4 w-4 mr-1.5" />Back to Requests
        </Button>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />{reviewing.request_number}
              </CardTitle>
              <RfqFlowStepper status={reviewing.status} variant="admin" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Client</div>
                <div className="font-medium">{reviewing.client_name}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Submitted</div>
                <div className="font-medium">{format(new Date(reviewing.created_at), 'MMM d, yyyy')}</div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">Subject</div>
                <div className="font-medium">{reviewing.subject}</div>
              </div>
              {reviewing.notes && (
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Client Notes</div>
                  <div className="text-muted-foreground">{reviewing.notes}</div>
                </div>
              )}
            </div>

            {isOpenForEditing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Label className="flex items-center gap-1.5">Supplier Comparison
                    <span className="text-muted-foreground font-normal">(compare up to 3 suppliers before quoting)</span>
                  </Label>
                  {supplierCols.length < 3 && (
                    <Button variant="outline" size="sm" onClick={() => setSupplierCols(prev => [...prev, emptySupplier()])}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" />Add Supplier
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {supplierCols.map((col, idx) => (
                    <div key={idx} className={`rounded-lg border p-3 space-y-2 ${col.is_selected ? 'border-green-400 bg-green-50/50' : 'border-input'}`}>
                      <div className="flex items-center gap-1.5">
                        <Select value={col.supplier_id ?? ''} onValueChange={v => updateSupplierCol(idx, { supplier_id: v || null })}>
                          <SelectTrigger className="h-8 text-xs flex-1">
                            {col.supplier_id
                              ? <span className="truncate">{suppliers.find(s => s.id === col.supplier_id)?.company_name}</span>
                              : <span className="text-muted-foreground">Select supplier…</span>}
                          </SelectTrigger>
                          <SelectContent>
                            {suppliers.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {supplierCols.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => setSupplierCols(prev => prev.filter((_, i) => i !== idx))}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <Input className="h-8 text-xs" placeholder="Or type a custom supplier name…" value={col.supplier_name}
                        onChange={e => updateSupplierCol(idx, { supplier_id: null, supplier_name: e.target.value })} />

                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground uppercase">Terms of Payment</Label>
                        <Input className="h-8 text-xs" placeholder="e.g. 30 days" value={col.terms_of_payment}
                          onChange={e => updateSupplierCol(idx, { terms_of_payment: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground uppercase flex items-center gap-1"><Truck className="h-3 w-3" />Delivery Time</Label>
                        <Input className="h-8 text-xs" placeholder="e.g. 5 days" value={col.delivery_time}
                          onChange={e => updateSupplierCol(idx, { delivery_time: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground uppercase flex items-center gap-1"><Globe2 className="h-3 w-3" />Local / Overseas</Label>
                        <Select value={col.origin || undefined} onValueChange={v => updateSupplierCol(idx, { origin: (v as SupplierColumn['origin']) ?? '' })}>
                          <SelectTrigger className="h-8 text-xs w-full">
                            {col.origin
                              ? <span>{col.origin === 'local' ? 'Local' : 'Overseas'}</span>
                              : <span className="text-muted-foreground">Select…</span>}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="local">Local</SelectItem>
                            <SelectItem value="overseas">Overseas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground uppercase">Response Speed</Label>
                        <Select value={col.response_speed || undefined} onValueChange={v => updateSupplierCol(idx, { response_speed: (v as SupplierColumn['response_speed']) ?? '' })}>
                          <SelectTrigger className="h-8 text-xs w-full">
                            {col.response_speed
                              ? <span className="capitalize">{col.response_speed}</span>
                              : <span className="text-muted-foreground">Select…</span>}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fast">Fast</SelectItem>
                            <SelectItem value="average">Average</SelectItem>
                            <SelectItem value="slow">Slow</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground uppercase">Estimated Income</Label>
                        <Input type="number" min="0" step="0.01" className="h-8 text-xs" placeholder="₱ estimated profit"
                          value={col.estimated_income} onChange={e => updateSupplierCol(idx, { estimated_income: e.target.value })} />
                      </div>
                      <Button
                        variant={col.is_selected ? 'default' : 'outline'}
                        size="sm"
                        className={`w-full h-7 text-xs ${col.is_selected ? 'bg-green-600 hover:bg-green-700' : ''}`}
                        onClick={() => setSupplierCols(prev => prev.map((c, i) => ({ ...c, is_selected: i === idx ? !c.is_selected : false })))}
                      >
                        <Star className="h-3.5 w-3.5 mr-1.5" />{col.is_selected ? 'Recommended' : 'Mark as Recommended'}
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" disabled={savingComparison} onClick={saveSupplierComparison}>
                    {savingComparison ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                    Save Comparison
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Requested Items {isOpenForEditing && <span className="text-muted-foreground font-normal">(fill in pricing before sending the quotation)</span>}</Label>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="min-w-[160px]">Item Description</TableHead>
                      <TableHead className="w-16">Qty</TableHead>
                      <TableHead className="w-20">Unit</TableHead>
                      <TableHead className="w-28">Unit Price</TableHead>
                      <TableHead className="min-w-[120px]">Remarks</TableHead>
                      <TableHead className="w-28 text-right">Amount</TableHead>
                      {isOpenForEditing && <TableHead className="w-10"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editLines.map((line, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="py-1.5">
                          {isOpenForEditing ? (
                            <>
                              <Select value={line.item_name} onValueChange={v => updateLine(idx, 'item_name', v ?? '')}>
                                <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Select item…" /></SelectTrigger>
                                <SelectContent>
                                  {items.map(it => (
                                    <SelectItem key={it.item_name} value={it.item_name}>{it.item_name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                className="h-7 text-xs mt-1"
                                placeholder="Or type a custom item name…"
                                value={line.item_name}
                                onChange={e => updateLine(idx, 'item_name', e.target.value)}
                              />
                            </>
                          ) : (
                            <span className="text-sm">{line.item_name}</span>
                          )}
                        </TableCell>
                        <TableCell className="py-1.5">
                          {isOpenForEditing
                            ? <Input type="number" min="0" className="h-8 text-xs w-14" value={line.quantity} onChange={e => updateLine(idx, 'quantity', e.target.value)} />
                            : <span className="text-sm">{line.quantity}</span>}
                        </TableCell>
                        <TableCell className="py-1.5">
                          {isOpenForEditing
                            ? <Input className="h-8 text-xs w-full" value={line.unit} onChange={e => updateLine(idx, 'unit', e.target.value)} />
                            : <span className="text-sm text-muted-foreground">{line.unit || '—'}</span>}
                        </TableCell>
                        <TableCell className="py-1.5">
                          {isOpenForEditing
                            ? <Input type="number" min="0" step="0.01" className="h-8 text-xs w-full" value={line.unit_price} onChange={e => updateLine(idx, 'unit_price', e.target.value)} />
                            : <span className="text-sm">{line.unit_price ? fmt(parseFloat(line.unit_price)) : '—'}</span>}
                        </TableCell>
                        <TableCell className="py-1.5">
                          {isOpenForEditing
                            ? <Input className="h-8 text-xs w-full" value={line.remarks} onChange={e => updateLine(idx, 'remarks', e.target.value)} />
                            : <span className="text-sm text-muted-foreground">{line.remarks || '—'}</span>}
                        </TableCell>
                        <TableCell className="py-1.5 text-right text-xs font-medium">
                          {fmt((parseFloat(line.quantity) || 0) * (parseFloat(line.unit_price) || 0))}
                        </TableCell>
                        {isOpenForEditing && (
                          <TableCell className="py-1.5">
                            {editLines.length > 1 && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => setEditLines(prev => prev.filter((_, i) => i !== idx))}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {isOpenForEditing && (
                <Button variant="outline" size="sm" onClick={() => setEditLines(prev => [...prev, emptyLine()])}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />Add Item
                </Button>
              )}
            </div>

            <div className="rounded-lg bg-muted/30 p-4 flex justify-between text-sm font-bold">
              <span>Total (VAT-exclusive subtotal)</span><span className="text-red-600">{fmt(total)}</span>
            </div>

            {reviewing.status === 'quoted' && (
              <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                <ShoppingCart className="h-4 w-4" />
                Sent as Quotation <span className="font-mono font-semibold">{reviewing.quote_number}</span> — finish and send it from the Quotations tab. Awaiting client response.
              </div>
            )}
            {reviewing.status === 'done' && (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <ShoppingCart className="h-4 w-4" />
                Done — Quotation <span className="font-mono font-semibold">{reviewing.quote_number}</span> was accepted by the client.
              </div>
            )}
            {reviewing.status === 'declined' && (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <XCircle className="h-4 w-4" />This request was declined.
              </div>
            )}

            {isOpenForEditing && (
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button variant="outline" disabled={saving} className="text-destructive hover:text-destructive" onClick={markDeclined}>
                  <XCircle className="h-4 w-4 mr-1.5" />Decline
                </Button>
                <Button disabled={saving} className="bg-red-600 hover:bg-red-700" onClick={handleSendToQuotation}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-1.5" />}
                  Send Quotation →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center flex-wrap gap-1">
              {FLOW_STAGES.map((stage, i) => (
                <div key={stage.value} className="flex items-center">
                  <button
                    onClick={() => setFilterStatus(prev => prev === stage.value ? '' : stage.value)}
                    className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${filterStatus === stage.value ? 'bg-red-50 ring-1 ring-red-200' : 'hover:bg-muted/60'}`}
                  >
                    <span className="text-2xl font-bold">{loading ? '—' : stageCounts[stage.value] ?? 0}</span>
                    <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">{stage.label}</span>
                  </button>
                  {i < FLOW_STAGES.length - 1 && <div className="w-6 sm:w-10 h-0.5 bg-gray-200 mx-1" />}
                </div>
              ))}
            </div>
            <button
              onClick={() => setFilterStatus(prev => prev === 'declined' ? '' : 'declined')}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${filterStatus === 'declined' ? 'bg-red-50 ring-1 ring-red-200' : 'hover:bg-muted/60'}`}
            >
              <span className="text-2xl font-bold text-red-600">{loading ? '—' : declinedCount}</span>
              <span className="text-[11px] font-medium text-muted-foreground">Declined</span>
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Requests for Quotation</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Flow</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell></TableRow>
              ) : displayed.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No requests for quotation{filterStatus ? ' with this status' : ''}.
                </TableCell></TableRow>
              ) : displayed.map(r => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => openReview(r)}>
                  <TableCell className="font-mono text-xs font-semibold text-red-600">{r.request_number}</TableCell>
                  <TableCell className="text-sm font-medium">{r.client_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">{r.subject}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Package className="h-3 w-3" />{r.quotation_request_items?.length ?? 0}</span>
                  </TableCell>
                  <TableCell><RfqFlowStepper status={r.status} variant="admin" compact /></TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{format(new Date(r.created_at), 'MMM d, yyyy')}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); openReview(r) }}>Review</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
