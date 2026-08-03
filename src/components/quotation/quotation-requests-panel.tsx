'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  Loader2, ClipboardList, ChevronLeft, Trash2, Plus, Package,
  CheckCircle2, XCircle, Clock, Eye, ShoppingCart,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSearchContext } from '@/context/search-context'

interface ItemOption { item_name: string; unit_of_measure: string; cost: number | null; selling_price: number | null }

interface RequestItemRow {
  id: string
  item_name: string
  quantity: number
  unit: string | null
  unit_price: number | null
  remarks: string | null
}

interface QuotationRequest {
  id: string
  request_number: string
  client_id: string
  client_name: string
  subject: string
  notes: string | null
  status: string
  sales_order_id: string | null
  so_number: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  quotation_request_items: RequestItemRow[]
}

interface EditLine {
  item_name: string
  quantity: string
  unit: string
  unit_price: string
  remarks: string
}

const STATUS_CFG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending:   { label: 'Pending Review', cls: 'bg-yellow-100 text-yellow-700', icon: <Clock className="h-3.5 w-3.5" /> },
  reviewing: { label: 'Reviewing',      cls: 'bg-blue-100 text-blue-700',     icon: <Eye className="h-3.5 w-3.5" /> },
  accepted:  { label: 'Accepted',       cls: 'bg-green-100 text-green-700',   icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  declined:  { label: 'Declined',       cls: 'bg-red-100 text-red-700',       icon: <XCircle className="h-3.5 w-3.5" /> },
}

const emptyLine = (): EditLine => ({ item_name: '', quantity: '1', unit: '', unit_price: '', remarks: '' })

export default function QuotationRequestsPanel({ onAccepted }: { onAccepted?: () => void }) {
  const supabase = createClient()
  const { query } = useSearchContext()
  const [requests, setRequests] = useState<QuotationRequest[]>([])
  const [items, setItems] = useState<ItemOption[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [editLines, setEditLines] = useState<EditLine[]>([])
  const [saving, setSaving] = useState(false)
  const [staffName, setStaffName] = useState('')

  async function load() {
    setLoading(true)
    const [{ data }, { data: itemData }, { data: { user } }] = await Promise.all([
      supabase
        .from('quotation_requests')
        .select('id, request_number, client_id, client_name, subject, notes, status, sales_order_id, so_number, reviewed_by, reviewed_at, created_at, quotation_request_items(id, item_name, quantity, unit, unit_price, remarks)')
        .order('created_at', { ascending: false }),
      supabase.from('items').select('item_name, unit_of_measure, cost, selling_price').eq('status', 'active').order('item_name'),
      supabase.auth.getUser(),
    ])
    setRequests((data ?? []) as unknown as QuotationRequest[])
    setItems((itemData ?? []) as ItemOption[])
    setStaffName(user?.email ?? '')
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const reviewing = requests.find(r => r.id === reviewingId) ?? null

  function openReview(r: QuotationRequest) {
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

  async function updateStatus(id: string, status: 'reviewing' | 'declined') {
    setSaving(true)
    const { error } = await supabase.from('quotation_requests').update({
      status,
      reviewed_by: staffName || null,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success(status === 'reviewing' ? 'Marked as reviewing' : 'Request declined')
    if (status === 'declined') setReviewingId(null)
    await load()
    setSaving(false)
  }

  async function acceptToPurchaseOrder() {
    if (!reviewing) return
    const validLines = editLines.filter(l => l.item_name.trim())
    if (validLines.length === 0) { toast.error('Add at least one item'); return }
    setSaving(true)
    try {
      // Persist the reviewed line items back onto the request first.
      await supabase.from('quotation_request_items').delete().eq('request_id', reviewing.id)
      await supabase.from('quotation_request_items').insert(validLines.map(l => ({
        request_id: reviewing.id,
        item_name: l.item_name,
        quantity: parseFloat(l.quantity) || 1,
        unit: l.unit || null,
        unit_price: l.unit_price ? parseFloat(l.unit_price) : null,
        remarks: l.remarks || null,
      })))

      const totalAmount = validLines.reduce((s, l) => s + (parseFloat(l.unit_price) || 0) * (parseFloat(l.quantity) || 1), 0)
      const today = new Date().toISOString().split('T')[0]

      const { data: soData, error: soErr } = await supabase
        .from('sales_orders')
        .insert({
          so_date: today,
          client_id: reviewing.client_id,
          client_name: reviewing.client_name,
          client_po_number: reviewing.subject,
          remarks: reviewing.notes,
          status: 'confirmed',
          total_amount: totalAmount,
        })
        .select('id, so_number')
        .single()
      if (soErr) throw soErr

      await supabase.from('so_items').insert(validLines.map(l => ({
        so_id: soData.id,
        item_name: l.item_name,
        quantity: parseFloat(l.quantity) || 1,
        unit: l.unit || null,
        unit_price: parseFloat(l.unit_price) || 0,
        selling_price: parseFloat(l.unit_price) || null,
        total_amount: (parseFloat(l.unit_price) || 0) * (parseFloat(l.quantity) || 1),
      })))

      const { error: updErr } = await supabase.from('quotation_requests').update({
        status: 'accepted',
        sales_order_id: soData.id,
        so_number: soData.so_number,
        reviewed_by: staffName || null,
        reviewed_at: new Date().toISOString(),
      }).eq('id', reviewing.id)
      if (updErr) throw updErr

      toast.success(`Accepted — Purchase Order ${soData.so_number ?? ''} created`)
      setReviewingId(null)
      await load()
      onAccepted?.()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create purchase order')
    }
    setSaving(false)
  }

  const displayed = requests.filter(r => {
    const s = query.toLowerCase()
    const matchSearch = !s ||
      r.request_number.toLowerCase().includes(s) ||
      r.client_name.toLowerCase().includes(s) ||
      r.subject.toLowerCase().includes(s) ||
      (STATUS_CFG[r.status]?.label ?? r.status).toLowerCase().includes(s)
    const matchFilter = !filterStatus || r.status === filterStatus
    return matchSearch && matchFilter
  })

  const counts = {
    pending: requests.filter(r => r.status === 'pending').length,
    reviewing: requests.filter(r => r.status === 'reviewing').length,
    accepted: requests.filter(r => r.status === 'accepted').length,
    declined: requests.filter(r => r.status === 'declined').length,
  }

  const total = editLines.reduce((s, l) => s + (parseFloat(l.unit_price) || 0) * (parseFloat(l.quantity) || 0), 0)
  const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

  if (reviewing) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => setReviewingId(null)}>
          <ChevronLeft className="h-4 w-4 mr-1.5" />Back to Requests
        </Button>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />{reviewing.request_number}
              </CardTitle>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CFG[reviewing.status]?.cls ?? 'bg-gray-100 text-gray-700'}`}>
                {STATUS_CFG[reviewing.status]?.icon}{STATUS_CFG[reviewing.status]?.label ?? reviewing.status}
              </span>
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Requested Items <span className="text-muted-foreground font-normal">(fill in pricing before accepting)</span></Label>
              </div>
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
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editLines.map((line, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="py-1.5">
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
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input type="number" min="0" className="h-8 text-xs w-14" value={line.quantity} onChange={e => updateLine(idx, 'quantity', e.target.value)} />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input className="h-8 text-xs w-full" value={line.unit} onChange={e => updateLine(idx, 'unit', e.target.value)} />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input type="number" min="0" step="0.01" className="h-8 text-xs w-full" value={line.unit_price} onChange={e => updateLine(idx, 'unit_price', e.target.value)} />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input className="h-8 text-xs w-full" value={line.remarks} onChange={e => updateLine(idx, 'remarks', e.target.value)} />
                        </TableCell>
                        <TableCell className="py-1.5 text-right text-xs font-medium">
                          {fmt((parseFloat(line.quantity) || 0) * (parseFloat(line.unit_price) || 0))}
                        </TableCell>
                        <TableCell className="py-1.5">
                          {editLines.length > 1 && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => setEditLines(prev => prev.filter((_, i) => i !== idx))}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditLines(prev => [...prev, emptyLine()])}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />Add Item
              </Button>
            </div>

            <div className="rounded-lg bg-muted/30 p-4 flex justify-between text-sm font-bold">
              <span>Total</span><span className="text-red-600">{fmt(total)}</span>
            </div>

            {reviewing.status === 'accepted' ? (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <CheckCircle2 className="h-4 w-4" />
                Accepted — Purchase Order <span className="font-mono font-semibold">{reviewing.so_number}</span> created.
              </div>
            ) : reviewing.status === 'declined' ? (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <XCircle className="h-4 w-4" />This request was declined.
              </div>
            ) : (
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                {reviewing.status === 'pending' && (
                  <Button variant="outline" disabled={saving} onClick={() => updateStatus(reviewing.id, 'reviewing')}>
                    <Eye className="h-4 w-4 mr-1.5" />Mark Reviewing
                  </Button>
                )}
                <Button variant="outline" disabled={saving} className="text-destructive hover:text-destructive" onClick={() => updateStatus(reviewing.id, 'declined')}>
                  <XCircle className="h-4 w-4 mr-1.5" />Decline
                </Button>
                <Button disabled={saving} className="bg-red-600 hover:bg-red-700" onClick={acceptToPurchaseOrder}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-1.5" />}
                  Accept → Create Purchase Order
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          ['pending', 'Pending'], ['reviewing', 'Reviewing'], ['accepted', 'Accepted'], ['declined', 'Declined'],
        ] as const).map(([key, label]) => (
          <Card key={key} className="cursor-pointer" onClick={() => setFilterStatus(prev => prev === key ? '' : key)}>
            <CardContent className="pt-5 pb-4">
              <div className="text-2xl font-bold">{loading ? '—' : counts[key]}</div>
              <div className="text-sm text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

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
                <TableHead>Status</TableHead>
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
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.subject}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Package className="h-3 w-3" />{r.quotation_request_items?.length ?? 0}</span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CFG[r.status]?.cls ?? 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_CFG[r.status]?.icon}{STATUS_CFG[r.status]?.label ?? r.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{format(new Date(r.created_at), 'MMM d, yyyy')}</TableCell>
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
