'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, MoreHorizontal, Loader2, Trash2, X, FileText, Printer, Mail, Send, Package, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useSearchContext } from '@/context/search-context'
import { sendEmailWithGmail, preloadGsi } from '@/lib/gmail-send'
import Image from 'next/image'

interface Client { id: string; company_name: string }
interface ItemOption { item_name: string; unit_of_measure: string; cost: number | null; selling_price: number | null }
interface SystemSettings {
  company_name: string
  address: string
  phone: string
  email: string
  tin: string
}

interface QuoteLine {
  item_name: string
  quantity: string
  unit: string
  unit_price: string
}

interface Quotation {
  id: string
  quote_number: string
  quote_date: string
  valid_until: string | null
  client_name: string | null
  subject: string | null
  subtotal: number
  vat_amount: number
  ewt_amount: number
  total_amount: number
  notes: string | null
  status: string
  created_at: string
}

const emptyLine = (): QuoteLine => ({ item_name: '', quantity: '', unit: '', unit_price: '' })
const today = () => new Date().toISOString().split('T')[0]

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  draft:    { label: 'Draft',    cls: 'bg-gray-100 text-gray-700' },
  sent:     { label: 'Sent',     cls: 'bg-blue-100 text-blue-700' },
  accepted: { label: 'Accepted', cls: 'bg-green-100 text-green-700' },
  declined: { label: 'Declined', cls: 'bg-red-100 text-red-700' },
  expired:  { label: 'Expired',  cls: 'bg-yellow-100 text-yellow-700' },
}

export default function QuotationPage() {
  const supabase = createClient()
  const { query } = useSearchContext()
  const printRef = useRef<HTMLDivElement>(null)
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [items, setItems] = useState<ItemOption[]>([])
  const [companyInfo, setCompanyInfo] = useState<SystemSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form')
  const [showEmailQ, setShowEmailQ] = useState(false)
  const [emailToQ, setEmailToQ] = useState('')
  const [emailSubjectQ, setEmailSubjectQ] = useState('')
  const [emailBodyQ, setEmailBodyQ] = useState('')
  const [itemSearchIdx, setItemSearchIdx] = useState<number | null>(null)
  const [itemQuery, setItemQuery] = useState('')

  // Form state
  const [quoteNumber, setQuoteNumber] = useState('')
  const [quoteDate, setQuoteDate] = useState(today())
  const [validUntil, setValidUntil] = useState('')
  const [clientId, setClientId] = useState('')
  const [subject, setSubject] = useState('')
  const [lines, setLines] = useState<QuoteLine[]>([emptyLine()])
  const [notes, setNotes] = useState('')
  const [vatEnabled, setVatEnabled] = useState(true)
  const [ewtEnabled, setEwtEnabled] = useState(false)

  const selectedClient = clients.find(c => c.id === clientId)
  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.unit_price) || 0) * (parseFloat(l.quantity) || 0), 0)
  const vatAmount = vatEnabled ? subtotal * 0.12 : 0
  const ewtAmount = ewtEnabled ? (subtotal / 1.12) * 0.02 : 0
  const totalAmount = subtotal + vatAmount - ewtAmount

  const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

  function handlePrint() {
    const el = printRef.current
    if (!el) return
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><title>Quotation</title>
      <script src="https://cdn.tailwindcss.com"><\/script>
      <style>
        body { font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print { body { margin: 0; padding: 16px; } }
      </style>
    </head><body class="p-6 text-[11px]">${el.innerHTML}</body></html>`)
    win.document.close()
    setTimeout(() => { win.focus(); win.print(); win.close() }, 800)
  }

  async function load() {
    setLoading(true)
    const [{ data: quoData }, { data: clientData }, { data: itemData }, { data: sysData }] = await Promise.all([
      supabase.from('quotations').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, company_name').eq('status', 'active').order('company_name'),
      supabase.from('items').select('item_name, unit_of_measure, cost, selling_price').eq('status', 'active').order('item_name'),
      supabase.from('system_settings').select('company_name, address, phone, email, tin').single(),
    ])
    setQuotations((quoData ?? []) as Quotation[])
    setClients(clientData ?? [])
    setItems((itemData ?? []) as ItemOption[])
    if (sysData) setCompanyInfo(sysData as SystemSettings)
    setLoading(false)
  }

  useEffect(() => { load(); preloadGsi() }, [])

  function resetForm() {
    setQuoteNumber(''); setQuoteDate(today()); setValidUntil(''); setClientId('')
    setSubject(''); setLines([emptyLine()]); setNotes(''); setVatEnabled(true); setEwtEnabled(false)
    setMobileTab('form')
  }

  function updateLine(idx: number, field: keyof QuoteLine, value: string) {
    setLines(prev => prev.map((line, i) => {
      if (i !== idx) return line
      if (field === 'item_name') {
        const found = items.find(it => it.item_name === value)
        const autoPrice = found?.selling_price ?? found?.cost ?? null
        return {
          ...line,
          item_name: value,
          unit: found?.unit_of_measure ?? line.unit,
          unit_price: autoPrice !== null ? String(autoPrice) : line.unit_price,
        }
      }
      return { ...line, [field]: value }
    }))
  }

  const filteredSearchItems = itemQuery.trim()
    ? items.filter(it => it.item_name.toLowerCase().includes(itemQuery.toLowerCase()))
    : items

  async function handleSave() {
    if (!clientId) { toast.error('Select a client'); return }
    setSaving(true)
    const { error } = await supabase.from('quotations').insert({
      quote_number: quoteNumber || null,
      quote_date: quoteDate,
      valid_until: validUntil || null,
      client_id: clientId,
      client_name: selectedClient?.company_name ?? null,
      subject: subject || null,
      subtotal,
      vat_amount: vatAmount,
      ewt_amount: ewtAmount,
      total_amount: totalAmount,
      notes: notes || null,
      status: 'draft',
    })
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Quotation saved.')
    resetForm()
    setOpen(false)
    load()
    setSaving(false)
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from('quotations').update({ status }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success(`Status updated to ${STATUS_CFG[status]?.label ?? status}`)
    load()
  }

  const displayedQuotations = query.trim()
    ? quotations.filter(q => {
        const s = query.toLowerCase()
        return (q.quote_number ?? '').toLowerCase().includes(s) ||
          (q.client_name ?? '').toLowerCase().includes(s) ||
          (q.subject ?? '').toLowerCase().includes(s) ||
          (q.status ?? '').toLowerCase().includes(s)
      })
    : quotations

  const counts = {
    total: quotations.length,
    draft: quotations.filter(q => q.status === 'draft').length,
    sent: quotations.filter(q => q.status === 'sent').length,
    accepted: quotations.filter(q => q.status === 'accepted').length,
  }

  const PreviewDoc = () => (
    <div ref={printRef} className="border rounded-lg bg-white text-[11px] p-5 shadow-sm space-y-3 font-sans">
      {/* Header: Logo + Company Name | Address / Phone / TIN */}
      <div className="flex justify-between items-start border-b pb-3">
        <div className="flex items-center gap-2.5">
          <img src="/cdsc-logo.jpg" alt="CDSC" className="h-12 w-12 rounded object-cover shrink-0" />
          <div className="text-[13px] font-bold text-red-700 leading-tight">
            {companyInfo?.company_name ?? 'CDSC INDUSTRIAL'}
          </div>
        </div>
        <div className="text-right text-[9px] text-gray-500 space-y-0.5">
          {companyInfo?.address && <div>{companyInfo.address}</div>}
          {(companyInfo?.phone || companyInfo?.email) && (
            <div>{companyInfo.phone}{companyInfo.phone && companyInfo.email ? ' | ' : ''}{companyInfo.email}</div>
          )}
          {companyInfo?.tin && <div>TIN: {companyInfo.tin}</div>}
        </div>
      </div>

      {/* Party row: Bill To (left) | QUOTATION (center) | Quote # / Date (right) */}
      <div className="grid grid-cols-3 gap-3 border-b pb-3">
        <div className="space-y-0.5">
          <div className="text-[9px] font-semibold uppercase text-gray-400">Bill To</div>
          <div className="font-semibold text-gray-800 text-[11px]">
            {selectedClient?.company_name ?? <span className="text-gray-400 italic font-normal">Not selected</span>}
          </div>
          {subject && (
            <div className="mt-1.5">
              <div className="text-[9px] font-semibold uppercase text-gray-400">Subject</div>
              <div className="text-gray-700 text-[10px]">{subject}</div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-center">
          <div className="text-[16px] font-extrabold text-red-700 uppercase tracking-widest text-center leading-tight">
            Quotation
          </div>
        </div>
        <div className="space-y-0.5 text-right">
          <div className="text-[9px] font-semibold uppercase text-gray-400">Quote Number</div>
          <div className="font-mono font-bold text-gray-800">{quoteNumber || 'Auto-generated'}</div>
          <div className="text-[9px] font-semibold uppercase text-gray-400 mt-1.5">Date</div>
          <div className="text-gray-700">{quoteDate}</div>
          {validUntil && (
            <>
              <div className="text-[9px] font-semibold uppercase text-gray-400 mt-1.5">Valid Until</div>
              <div className="text-gray-700">{validUntil}</div>
            </>
          )}
        </div>
      </div>

      {/* Items table */}
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-red-700 text-white">
            <th className="text-left px-1.5 py-1 w-6">#</th>
            <th className="text-left px-1.5 py-1">Item Description</th>
            <th className="text-right px-1.5 py-1 w-12">Qty</th>
            <th className="text-left px-1.5 py-1 w-16">Unit</th>
            <th className="text-right px-1.5 py-1 w-20">Unit Price</th>
            <th className="text-right px-1.5 py-1 w-20">Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => {
            const total = (parseFloat(line.unit_price) || 0) * (parseFloat(line.quantity) || 0)
            return (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-1.5 py-1 text-gray-400">{i + 1}</td>
                <td className="px-1.5 py-1">{line.item_name || <span className="text-gray-300 italic">—</span>}</td>
                <td className="px-1.5 py-1 text-right">{line.quantity || '—'}</td>
                <td className="px-1.5 py-1 text-gray-500">{line.unit || '—'}</td>
                <td className="px-1.5 py-1 text-right">₱{(parseFloat(line.unit_price) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                <td className="px-1.5 py-1 text-right font-medium">₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-52 space-y-0.5 text-[10px]">
          <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>₱{subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
          {vatEnabled && <div className="flex justify-between"><span className="text-gray-500">VAT (12%)</span><span className="text-blue-600">₱{vatAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>}
          {ewtEnabled && <div className="flex justify-between"><span className="text-gray-500">EWT (2%)</span><span className="text-red-700">−₱{ewtAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>}
          <div className="flex justify-between border-t pt-0.5 font-bold text-[11px]"><span>Total</span><span className="text-red-700">₱{totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
        </div>
      </div>

      {/* Notes */}
      {notes && (
        <div className="border-t pt-2">
          <div className="text-[9px] font-semibold uppercase text-gray-400 mb-1">Notes / Terms</div>
          <div className="text-[10px] text-gray-700 whitespace-pre-wrap">{notes}</div>
        </div>
      )}

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-6 border-t pt-4 mt-1">
        <div className="text-center">
          <div className="border-b border-gray-400 mb-1 h-8" />
          <div className="text-[9px] text-gray-400 uppercase tracking-wider">Prepared By</div>
        </div>
        <div className="text-center">
          <div className="border-b border-gray-400 mb-1 h-8" />
          <div className="text-[9px] text-gray-400 uppercase tracking-wider">Accepted By</div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Quotation</h2>
          <p className="text-muted-foreground text-sm">Create and manage client quotations</p>
        </div>
        {open ? (
          <Button variant="outline" onClick={() => { setOpen(false); resetForm() }}>
            <X className="h-4 w-4 mr-2" />Cancel
          </Button>
        ) : (
          <Button onClick={() => { resetForm(); setOpen(true) }} className="bg-red-600 hover:bg-red-700">
            <Plus className="h-4 w-4 mr-2" />New Quotation
          </Button>
        )}
      </div>

      {!open && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold">{loading ? '—' : counts.total}</div>
            <div className="text-sm text-muted-foreground">Total Quotes</div>
          </CardContent></Card>
          <Card><CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold text-gray-600">{loading ? '—' : counts.draft}</div>
            <div className="text-sm text-muted-foreground">Draft</div>
          </CardContent></Card>
          <Card><CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold text-blue-600">{loading ? '—' : counts.sent}</div>
            <div className="text-sm text-muted-foreground">Sent</div>
          </CardContent></Card>
          <Card><CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold text-green-600">{loading ? '—' : counts.accepted}</div>
            <div className="text-sm text-muted-foreground">Accepted</div>
          </CardContent></Card>
        </div>
      )}

      {open ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Form */}
          <div className="space-y-1">
            {/* Mobile tab toggle */}
            <div className="flex gap-2 lg:hidden mb-3">
              <Button
                size="sm"
                variant={mobileTab === 'form' ? 'default' : 'outline'}
                className={mobileTab === 'form' ? 'bg-red-600 hover:bg-red-700' : ''}
                onClick={() => setMobileTab('form')}
              >Form</Button>
              <Button
                size="sm"
                variant={mobileTab === 'preview' ? 'default' : 'outline'}
                className={mobileTab === 'preview' ? 'bg-red-600 hover:bg-red-700' : ''}
                onClick={() => setMobileTab('preview')}
              >Preview</Button>
            </div>

            <div className={mobileTab === 'preview' ? 'hidden lg:block' : 'block'}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Quotation Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Quote Number</Label>
                      <Input placeholder="Auto-generated if blank" value={quoteNumber} onChange={e => setQuoteNumber(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Date</Label>
                      <Input type="date" value={quoteDate} onChange={e => setQuoteDate(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Client <span className="text-destructive">*</span></Label>
                    <Select value={clientId} onValueChange={v => setClientId(v ?? '')}>
                      <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                      <SelectContent>
                        {clients.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Valid Until</Label>
                    <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Subject / Title</Label>
                    <Input placeholder="e.g. Supply of Industrial Equipment" value={subject} onChange={e => setSubject(e.target.value)} />
                  </div>

                  {/* Line items */}
                  <div className="space-y-2">
                    <Label>Line Items</Label>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="min-w-[180px]">Item Description</TableHead>
                            <TableHead className="w-16">Qty</TableHead>
                            <TableHead className="w-20">Unit</TableHead>
                            <TableHead className="w-28">Unit Price</TableHead>
                            <TableHead className="w-28 text-right">Amount</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lines.map((line, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="py-1.5">
                                <div className="flex gap-1 min-w-0">
                                  <Select value={line.item_name} onValueChange={v => updateLine(idx, 'item_name', v ?? '')}>
                                    <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Select item…" /></SelectTrigger>
                                    <SelectContent>
                                      {items.map(it => (
                                        <SelectItem key={it.item_name} value={it.item_name}>{it.item_name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" title="Search inventory"
                                    onClick={() => { setItemSearchIdx(idx); setItemQuery('') }}>
                                    <Package className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell className="py-1.5">
                                <Input type="number" min="0" className="h-8 text-xs w-full" value={line.quantity} onChange={e => updateLine(idx, 'quantity', e.target.value)} />
                              </TableCell>
                              <TableCell className="py-1.5">
                                <div className="h-8 flex items-center px-2 text-xs bg-muted/40 rounded border text-muted-foreground">{line.unit || '—'}</div>
                              </TableCell>
                              <TableCell className="py-1.5">
                                <Input type="number" min="0" step="0.01" className="h-8 text-xs w-full" value={line.unit_price} onChange={e => updateLine(idx, 'unit_price', e.target.value)} />
                              </TableCell>
                              <TableCell className="py-1.5 text-right text-xs font-medium">{fmt((parseFloat(line.quantity)||0)*(parseFloat(line.unit_price)||0))}</TableCell>
                              <TableCell className="py-1.5">
                                {lines.length > 1 && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    onClick={() => setLines(prev => prev.filter((_, i) => i !== idx))}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setLines(prev => [...prev, emptyLine()])}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" />Add Item
                    </Button>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <Label>Notes / Terms</Label>
                    <textarea
                      className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                      placeholder="Payment terms, delivery notes, etc."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </div>

                  {/* Tax toggles */}
                  <div className="space-y-2">
                    <Label>Tax</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" className="rounded" checked={vatEnabled} onChange={e => setVatEnabled(e.target.checked)} />
                        VAT 12%
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" className="rounded" checked={ewtEnabled} onChange={e => setEwtEnabled(e.target.checked)} />
                        EWT 2%
                      </label>
                    </div>
                  </div>

                  {/* Totals summary */}
                  <div className="rounded-lg bg-muted/30 p-4 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(subtotal)}</span></div>
                    {vatEnabled && <div className="flex justify-between"><span className="text-muted-foreground">VAT 12%</span><span>{fmt(vatAmount)}</span></div>}
                    {ewtEnabled && <div className="flex justify-between text-red-600"><span>EWT 2%</span><span>({fmt(ewtAmount)})</span></div>}
                    <div className="h-px bg-border my-1" />
                    <div className="flex justify-between font-bold"><span>Total</span><span className="text-red-600">{fmt(totalAmount)}</span></div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => { setOpen(false); resetForm() }}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700">
                      {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Save Quotation'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right: Live Preview */}
          <div className={mobileTab === 'form' ? 'hidden lg:block' : 'block'}>
            <div className="sticky top-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Live Preview</div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    const clientName = clientId ? clients.find(c => c.id === clientId)?.company_name : ''
                    setEmailSubjectQ(`Quotation ${quoteNumber || '(draft)'}${clientName ? ` — ${clientName}` : ''}`)
                    setEmailBodyQ(`Dear ${clientName ?? 'Sir/Madam'},\n\nPlease find attached our Quotation ${quoteNumber || '(draft)'}.\n\nThis quotation is valid as indicated. Kindly review and confirm at your earliest convenience.\n\nBest regards,\n${companyInfo?.company_name ?? 'CDSC Industrial Supply'}`)
                    setShowEmailQ(true)
                  }} className="text-xs h-7 px-2">
                    <Mail className="h-3.5 w-3.5 mr-1" />Email
                  </Button>
                  <Button size="sm" variant="outline" onClick={handlePrint} className="text-xs h-7 px-2">
                    <Printer className="h-3.5 w-3.5 mr-1" />Print
                  </Button>
                </div>
              </div>
              <PreviewDoc />
            </div>
          </div>
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quotation List</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell></TableRow>
                ) : displayedQuotations.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    No quotations match your search.
                  </TableCell></TableRow>
                ) : displayedQuotations.map(q => {
                  const cfg = STATUS_CFG[q.status] ?? { label: q.status, cls: 'bg-gray-100 text-gray-700' }
                  return (
                    <TableRow key={q.id}>
                      <TableCell className="font-mono text-xs font-semibold text-red-600">{q.quote_number}</TableCell>
                      <TableCell className="text-sm">{q.quote_date}</TableCell>
                      <TableCell className="text-sm">{q.valid_until ?? '—'}</TableCell>
                      <TableCell className="text-sm font-medium">{q.client_name ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">{q.subject ?? '—'}</TableCell>
                      <TableCell className="text-sm font-medium text-right">{fmt(q.total_amount ?? 0)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
                          {cfg.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent">
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => updateStatus(q.id, 'sent')}>Mark as Sent</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(q.id, 'accepted')}>Mark as Accepted</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(q.id, 'declined')}>Mark as Declined</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(q.id, 'expired')}>Mark as Expired</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Email Dialog */}
      <Dialog open={showEmailQ} onOpenChange={setShowEmailQ}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" />Send Quotation by Email
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input
                type="email"
                placeholder="client@example.com"
                value={emailToQ}
                onChange={e => setEmailToQ(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input
                value={emailSubjectQ}
                onChange={e => setEmailSubjectQ(e.target.value)}
                placeholder="Subject…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Body</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                rows={7}
                value={emailBodyQ}
                onChange={e => setEmailBodyQ(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A Google sign-in popup will appear to authorize Gmail. The email will be sent with the PDF attached.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setShowEmailQ(false)}>Cancel</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 gap-1.5"
                onClick={() => {
                  if (!emailToQ) { toast.error('Please enter a recipient email address.'); return }
                  const el = printRef.current
                  const printHtml = el ? `<!DOCTYPE html><html><head><title>Quotation</title>
                    <script src="https://cdn.tailwindcss.com"><\/script>
                    <style>body { font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; } @media print { body { margin: 0; } }</style>
                  </head><body class="p-6 text-[11px]">${el.innerHTML}</body></html>` : undefined
                  setShowEmailQ(false)
                  toast.loading('Waiting for Google sign-in…', { id: 'email-send-q' })
                  sendEmailWithGmail({
                    to: emailToQ,
                    subject: emailSubjectQ,
                    body: emailBodyQ,
                    printHtml,
                    pdfFilename: `Quotation-${quoteNumber || 'draft'}.pdf`,
                    onSuccess: () => toast.success('Email sent via Gmail!', { id: 'email-send-q' }),
                    onError: (msg) => toast.error(msg, { id: 'email-send-q' }),
                  })
                }}
              >
                <Send className="h-4 w-4" />Send in Gmail
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Item Search Dialog */}
      <Dialog open={itemSearchIdx !== null} onOpenChange={o => { if (!o) setItemSearchIdx(null) }}>
        <DialogContent className="w-[98vw] sm:!max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Package className="h-4 w-4" />Item Inventory</DialogTitle>
          </DialogHeader>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input autoFocus placeholder="Search by item name…" className="pl-9" value={itemQuery} onChange={e => setItemQuery(e.target.value)} />
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-auto border rounded-lg">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-[40%]">Item Name</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-[10%]">Unit</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground w-[15%]">Cost</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground w-[15%]">Selling Price</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-[20%]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredSearchItems.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-6 text-muted-foreground text-sm">No items found.</td></tr>
                ) : filteredSearchItems.map(it => (
                  <tr key={it.item_name} className="hover:bg-muted/40 cursor-pointer" onClick={() => {
                    if (itemSearchIdx === null) return
                    const autoPrice = it.selling_price ?? it.cost ?? null
                    setLines(p => p.map((l, i) => i === itemSearchIdx ? {
                      ...l,
                      item_name: it.item_name,
                      unit: it.unit_of_measure || l.unit,
                      unit_price: autoPrice !== null ? String(autoPrice) : l.unit_price,
                    } : l))
                    setItemSearchIdx(null)
                  }}>
                    <td className="px-3 py-2 font-medium">{it.item_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{it.unit_of_measure || '—'}</td>
                    <td className="px-3 py-2 text-right">{it.cost != null ? `₱${it.cost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}</td>
                    <td className="px-3 py-2 text-right font-medium text-green-700">{it.selling_price != null ? `₱${it.selling_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}</td>
                    <td className="px-3 py-2"><span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">Active</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
