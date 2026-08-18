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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Plus, MoreHorizontal, Loader2, Trash2, X, FileText, Printer, Mail, Send, Package, Search, Pencil, Eye, CheckCircle, XCircle, Clock, CheckCheck, ClipboardList, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { undoToast } from '@/lib/undo-toast'
import { useSearchContext } from '@/context/search-context'
import { sendEmail, QuotationPdfData } from '@/lib/send-email'
import Image from 'next/image'
import QuotationRequestsPanel from '@/components/quotation/quotation-requests-panel'

interface Client { id: string; company_name: string; email: string | null }
interface ItemOption { item_name: string; unit_of_measure: string; cost: number | null; selling_price: number | null; image_url: string | null; image_urls: string[] | null }
interface SystemSettings {
  company_name: string
  address: string
  phone: string
  email: string
  tin: string
  logo_url?: string
}

interface QuoteLine {
  item_name: string
  description: string
  quantity: string
  unit: string
  unit_price: string
  selling_price: string
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

const emptyLine = (): QuoteLine => ({ item_name: '', description: '', quantity: '', unit: '', unit_price: '', selling_price: '' })
const today = () => new Date().toISOString().split('T')[0]

type EWTType = 'none' | 'goods' | 'services' | 'rental'
const EWT_CFG: Record<EWTType, { label: string; rate: number; atc: string; desc: string }> = {
  none:     { label: 'None',     rate: 0,    atc: '',      desc: '' },
  goods:    { label: 'Goods',    rate: 0.01, atc: 'WC158', desc: 'Purchase of Goods' },
  services: { label: 'Services', rate: 0.02, atc: 'WC157', desc: 'Purchase of Services' },
  rental:   { label: 'Rental',   rate: 0.05, atc: 'WC160', desc: 'Rental' },
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  draft:     { label: 'Draft',     cls: 'bg-gray-100 text-gray-700' },
  sent:      { label: 'Sent',      cls: 'bg-blue-100 text-blue-700' },
  accepted:  { label: 'Accepted',  cls: 'bg-green-100 text-green-700' },
  confirmed: { label: 'Confirmed', cls: 'bg-green-100 text-green-700' },
  declined:  { label: 'Declined',  cls: 'bg-red-100 text-red-700' },
  expired:   { label: 'Expired',   cls: 'bg-yellow-100 text-yellow-700' },
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
  const [discardOpen, setDiscardOpen] = useState(false)
  const [discardCallback, setDiscardCallback] = useState<(() => void) | null>(null)
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form')
  const [showEmailQ, setShowEmailQ] = useState(false)
  const [sendingEmailQ, setSendingEmailQ] = useState(false)
  const [sendingListEmail, setSendingListEmail] = useState(false)
  const [emailToQ, setEmailToQ] = useState('')
  const [emailSubjectQ, setEmailSubjectQ] = useState('')
  const [emailBodyQ, setEmailBodyQ] = useState('')
  const [itemSearchIdx, setItemSearchIdx] = useState<number | null>(null)
  const [dragLineIndex, setDragLineIndex] = useState<number | null>(null)
  const [itemQuery, setItemQuery] = useState('')
  const [activeTab, setActiveTab] = useState('quotations')
  const [rfqPendingCount, setRfqPendingCount] = useState(0)

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null)

  // View
  const [viewingQ, setViewingQ] = useState<Quotation | null>(null)
  const [viewingQItems, setViewingQItems] = useState<{ item_name: string; description?: string | null; quantity: number; unit: string | null; selling_price: number | null; unit_price: number; total_amount: number }[]>([])

  // List email
  const [listEmailQ, setListEmailQ] = useState<Quotation | null>(null)
  const [listEmailTo, setListEmailTo] = useState('')
  const [listEmailSubject, setListEmailSubject] = useState('')
  const [listEmailBody, setListEmailBody] = useState('')

  // Form state
  const [quoteNumber, setQuoteNumber] = useState('')
  const [quoteDate, setQuoteDate] = useState(today())
  const [validUntil, setValidUntil] = useState('')
  const [clientId, setClientId] = useState('')
  const [subject, setSubject] = useState('')
  const [lines, setLines] = useState<QuoteLine[]>([emptyLine()])
  const [notes, setNotes] = useState('')
  const [vatType, setVatType] = useState<'exclusive' | 'inclusive' | 'exempt'>('exclusive')
  const [ewtType, setEwtType] = useState<EWTType>('none')
  const [preparedBy, setPreparedBy] = useState('')
  const [acceptedBy, setAcceptedBy] = useState('')

  const selectedClient = clients.find(c => c.id === clientId)
  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.selling_price) || parseFloat(l.unit_price) || 0) * (parseFloat(l.quantity) || 0), 0)
  const vatAmount = vatType === 'exclusive' ? subtotal * 0.12 : vatType === 'inclusive' ? subtotal * (0.12 / 1.12) : 0
  const ewtCfg = EWT_CFG[ewtType]
  const ewtAmount = ewtType !== 'none' ? (subtotal / 1.12) * ewtCfg.rate : 0
  const ewtLabel = ewtType !== 'none' ? `EWT — ${ewtCfg.atc}` : 'EWT'
  const totalAmount = (vatType === 'inclusive' ? subtotal : subtotal + vatAmount) - ewtAmount

  const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
  const itemImage = (name: string) => {
    const found = items.find(i => i.item_name === name)
    return found?.image_urls?.[0] || found?.image_url || null
  }

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
    const [{ data: quoData }, { data: clientData }, { data: itemData }, { data: sysData }, { count: rfqCount }] = await Promise.all([
      supabase.from('quotations').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, company_name, email').eq('status', 'active').order('company_name'),
      supabase.from('items').select('item_name, unit_of_measure, cost, selling_price, image_url, image_urls').eq('status', 'active').order('item_name'),
      supabase.from('system_settings').select('company_name, address, phone, email, tin, logo_url').single(),
      supabase.from('quotation_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ])
    setQuotations((quoData ?? []) as Quotation[])
    setClients(clientData ?? [])
    setItems((itemData ?? []) as ItemOption[])
    if (sysData) setCompanyInfo(sysData as SystemSettings)
    setRfqPendingCount(rfqCount ?? 0)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function resetForm() {
    setQuoteNumber(''); setQuoteDate(today()); setValidUntil(''); setClientId('')
    setSubject(''); setLines([emptyLine()]); setNotes(''); setVatType('exclusive'); setEwtType('none')
    setPreparedBy(''); setAcceptedBy(''); setEditingId(null)
    setMobileTab('form')
  }

  async function openEdit(q: Quotation) {
    setEditingId(q.id)
    setQuoteNumber(q.quote_number ?? '')
    setQuoteDate(q.quote_date ?? today())
    setValidUntil(q.valid_until ?? '')
    setSubject(q.subject ?? '')
    setNotes(q.notes ?? '')
    setVatType((q as any).vat_type ?? ((q.vat_amount ?? 0) > 0 ? 'exclusive' : 'exempt'))
    setEwtType('none')
    setPreparedBy((q as any).prepared_by ?? ''); setAcceptedBy((q as any).accepted_by ?? '')
    const matched = clients.find(c => c.company_name === q.client_name)
    setClientId(matched?.id ?? '')

    // Load saved line items
    const { data: qItems } = await supabase
      .from('quotation_items')
      .select('item_name, description, quantity, unit, unit_price, selling_price')
      .eq('quotation_id', q.id)
      .order('created_at')
    setLines(qItems && qItems.length > 0
      ? qItems.map(r => ({
          item_name: r.item_name ?? '',
          description: r.description ?? '',
          quantity: String(r.quantity ?? 1),
          unit: r.unit ?? '',
          unit_price: String(r.unit_price ?? ''),
          selling_price: r.selling_price != null ? String(r.selling_price) : '',
        }))
      : [emptyLine()])

    setOpen(true)
    setMobileTab('form')
  }

  async function handleQuotationCreated(quotationId: string) {
    await load()
    const { data } = await supabase.from('quotations').select('*').eq('id', quotationId).single()
    if (data) {
      setActiveTab('quotations')
      openEdit(data as Quotation)
    }
  }

  async function deleteQuotation(id: string) {
    const snapshot = quotations.find(q => q.id === id)
    const { data: itemSnapshot } = await supabase
      .from('quotation_items')
      .select('item_name, description, quantity, unit, unit_price, selling_price, total_amount')
      .eq('quotation_id', id)
      .order('created_at')
    const { error } = await supabase.from('quotations').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    undoToast('Quotation deleted', async () => {
      if (!snapshot) return
      const { status: _status, id: _id, ...rest } = snapshot
      void _status; void _id
      const { data: restored, error: restoreErr } = await supabase.from('quotations').insert({ ...rest, status: snapshot.status }).select('id').single()
      if (restoreErr || !restored) { toast.error(restoreErr?.message ?? 'Failed to restore quotation'); return }
      if (itemSnapshot && itemSnapshot.length > 0) {
        await supabase.from('quotation_items').insert(itemSnapshot.map(i => ({ ...i, quotation_id: restored.id })))
      }
      load()
    })
    load()
  }

  function openListEmail(q: Quotation) {
    const client = clients.find(c => c.company_name === q.client_name)
    setListEmailQ(q)
    setListEmailTo(client?.email ?? '')
    setListEmailSubject(`Quotation ${q.quote_number ?? '(draft)'}${q.client_name ? ` — ${q.client_name}` : ''}`)
    setListEmailBody(`Dear ${q.client_name ?? 'Sir/Madam'},\n\nPlease find attached our Quotation ${q.quote_number ?? '(draft)'}.\n\nThis quotation is valid as indicated. Kindly review and confirm at your earliest convenience.\n\nBest regards,\n${companyInfo?.company_name ?? 'CDSC Industrial Supply'}`)
  }

  function updateLine(idx: number, field: keyof QuoteLine, value: string) {
    setLines(prev => prev.map((line, i) => {
      if (i !== idx) return line
      if (field === 'item_name') {
        const found = items.find(it => it.item_name === value)
        const autoPrice = found?.cost ?? null
        const autoSell = found?.selling_price ?? null
        return {
          ...line,
          item_name: value,
          quantity: line.quantity || '1',
          unit: found?.unit_of_measure ?? line.unit,
          unit_price: autoPrice !== null ? String(autoPrice) : line.unit_price,
          selling_price: autoSell !== null ? String(autoSell) : line.selling_price,
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
    const prevSnapshot = editingId ? quotations.find(q => q.id === editingId) : null
    const { data: prevItemSnapshot } = editingId
      ? await supabase.from('quotation_items').select('item_name, description, quantity, unit, unit_price, selling_price, total_amount').eq('quotation_id', editingId).order('created_at')
      : { data: null }
    const payload = {
      quote_number: quoteNumber || null,
      quote_date: quoteDate,
      valid_until: validUntil || null,
      client_id: clientId,
      client_name: selectedClient?.company_name ?? null,
      subject: subject || null,
      subtotal,
      vat_type: vatType,
      vat_amount: vatAmount,
      ewt_amount: ewtAmount,
      total_amount: totalAmount,
      notes: notes || null,
      prepared_by: preparedBy || null,
      accepted_by: acceptedBy || null,
    }
    let error
    let savedId = editingId
    if (editingId) {
      ;({ error } = await supabase.from('quotations').update(payload).eq('id', editingId))
    } else {
      const { data: inserted, error: insErr } = await supabase.from('quotations').insert({ ...payload, status: 'draft' }).select('id').single()
      error = insErr
      savedId = inserted?.id ?? null
    }
    if (error) { toast.error(error.message); setSaving(false); return }

    // Save line items
    if (savedId) {
      await supabase.from('quotation_items').delete().eq('quotation_id', savedId)
      const validLines = lines.filter(l => l.item_name.trim())
      if (validLines.length > 0) {
        const effectivePrice = (l: typeof lines[0]) => parseFloat(l.selling_price) || parseFloat(l.unit_price) || 0
        await supabase.from('quotation_items').insert(validLines.map(l => ({
          quotation_id: savedId,
          item_name: l.item_name,
          description: l.description || null,
          quantity: parseFloat(l.quantity) || 1,
          unit: l.unit || null,
          unit_price: parseFloat(l.unit_price) || 0,
          selling_price: parseFloat(l.selling_price) || null,
          total_amount: effectivePrice(l) * (parseFloat(l.quantity) || 1),
        })))
      }
    }

    if (editingId && prevSnapshot) {
      const idToRestore = editingId
      const { id: _id, ...prevRest } = prevSnapshot
      void _id
      undoToast('Quotation updated', async () => {
        await supabase.from('quotations').update(prevRest).eq('id', idToRestore)
        await supabase.from('quotation_items').delete().eq('quotation_id', idToRestore)
        if (prevItemSnapshot && prevItemSnapshot.length > 0) {
          await supabase.from('quotation_items').insert(prevItemSnapshot.map(i => ({ ...i, quotation_id: idToRestore })))
        }
        load()
      })
    } else if (!editingId && savedId) {
      const idToRemove = savedId
      undoToast('Quotation saved', async () => {
        await supabase.from('quotation_items').delete().eq('quotation_id', idToRemove)
        await supabase.from('quotations').delete().eq('id', idToRemove)
        load()
      })
    }
    resetForm()
    setOpen(false)
    load()
    setSaving(false)
  }

  // Google Drive's image URLs (item photos, uploaded logos) don't send CORS headers, so a
  // direct browser fetch() to read the bytes for embedding in the PDF gets blocked even
  // though the same URL displays fine in an <img> tag. Route those through our own
  // same-origin proxy (which fetches server-side, where CORS doesn't apply) instead.
  async function fetchImageDataUrl(url: string): Promise<string | undefined> {
    try {
      const isDrive = /(^|\.)(drive\.google\.com|googleusercontent\.com)$/.test(new URL(url, window.location.origin).hostname)
      if (isDrive) {
        const res = await fetch(`/api/fetch-image?url=${encodeURIComponent(url)}`)
        if (!res.ok) return undefined
        const data = await res.json()
        return data.dataUrl as string
      }
      const resp = await fetch(url)
      const blob = await resp.blob()
      return await new Promise<string>(resolve => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
    } catch { return undefined }
  }

  async function buildQuotePdfData(q: Quotation, items: { item_name: string; description?: string | null; quantity: number; unit: string | null; unit_price: number; selling_price: number | null; total_amount: number }[]): Promise<QuotationPdfData> {
    const logoSrc = companyInfo?.logo_url || '/cdsc-logo.jpg'
    const logoDataUrl = await fetchImageDataUrl(logoSrc)
    const itemsWithImages = await Promise.all(items.map(async i => {
      const src = i.item_name ? itemImage(i.item_name) : null
      return { ...i, imageDataUrl: src ? await fetchImageDataUrl(src) : undefined }
    }))
    return {
      companyName: companyInfo?.company_name ?? 'CDSC INDUSTRIAL SUPPLY',
      companyAddress: companyInfo?.address ?? undefined,
      companyPhone: companyInfo?.phone ?? undefined,
      companyEmail: companyInfo?.email ?? undefined,
      companyTin: companyInfo?.tin ?? undefined,
      logoDataUrl,
      quoteNumber: q.quote_number ?? '-',
      quoteDate: q.quote_date ?? '-',
      validUntil: q.valid_until ?? undefined,
      clientName: q.client_name ?? undefined,
      subject: q.subject ?? undefined,
      items: itemsWithImages,
      subtotal: q.subtotal ?? 0,
      vatAmount: q.vat_amount ?? 0,
      ewtAmount: q.ewt_amount ?? 0,
      totalAmount: q.total_amount ?? 0,
      notes: q.notes ?? undefined,
    }
  }

  function buildQuoteHtml(q: Quotation, items: { item_name: string; description?: string | null; quantity: number; unit: string | null; unit_price: number; selling_price: number | null; total_amount: number }[] = []) {
    const fmtAmt = (n: number) => `₱${(n ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
    const hasVat = (q.vat_amount ?? 0) > 0
    const hasEwt = (q.ewt_amount ?? 0) > 0
    const itemsHtml = items.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;font-size:10px;margin-top:8px;">
        <thead>
          <tr style="background:#b91c1c;color:#fff;">
            <th style="text-align:center;vertical-align:middle;padding:6px 6px;width:24px;">#</th>
            <th style="text-align:center;vertical-align:middle;padding:6px 6px;">Item Description</th>
            <th style="text-align:center;vertical-align:middle;padding:6px 6px;width:50px;">QTY</th>
            <th style="text-align:center;vertical-align:middle;padding:6px 6px;width:60px;">Unit</th>
            <th style="text-align:center;vertical-align:middle;padding:6px 6px;width:90px;">Unit Price</th>
            <th style="text-align:center;vertical-align:middle;padding:6px 6px;width:80px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it, i) => {
            const price = it.selling_price ?? it.unit_price ?? 0
            const total = it.total_amount ?? price * it.quantity
            return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'};">
              <td style="padding:4px 6px;color:#9ca3af;">${i + 1}</td>
              <td style="padding:4px 6px;">${it.item_name ?? '—'}${it.description ? `<div style="font-size:9px;color:#6b7280;margin-top:2px;">${it.description}</div>` : ''}</td>
              <td style="padding:4px 6px;text-align:right;font-weight:700;">${it.quantity}</td>
              <td style="padding:4px 6px;color:#6b7280;">${it.unit ?? '—'}</td>
              <td style="padding:4px 6px;text-align:right;">${fmtAmt(price)}</td>
              <td style="padding:4px 6px;text-align:right;font-weight:600;">${fmtAmt(total)}</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>` : ''
    const logoUrl = companyInfo?.logo_url || (typeof window !== 'undefined' ? `${window.location.origin}/cdsc-logo.jpg` : '/cdsc-logo.jpg')
    return `<!DOCTYPE html><html><head><title>Quotation</title>
      <style>body{font-family:Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;margin:0;padding:24px;font-size:11px;}@media print{body{margin:0;}}</style>
    </head><body>
      <div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #e5e7eb;padding-bottom:12px;margin-bottom:12px;">
          <div>
            <img src="${logoUrl}" alt="CDSC" style="width:48px;height:48px;border-radius:4px;object-fit:cover;flex-shrink:0;" crossorigin="anonymous" />
          </div>
          <div style="text-align:right;">
            <div style="font-size:13px;font-weight:700;color:#b91c1c;line-height:1.25;margin-bottom:2px;">${companyInfo?.company_name ?? 'CDSC Industrial Supply'}</div>
            <div style="font-size:9px;color:#6b7280;">${companyInfo?.address ?? ''}${companyInfo?.phone ? '<br/>' + companyInfo.phone : ''}${companyInfo?.email ? '<br/>' + companyInfo.email : ''}${companyInfo?.tin ? '<br/>TIN: ' + companyInfo.tin : ''}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;border-bottom:1px solid #e5e7eb;padding-bottom:12px;margin-bottom:12px;">
          <div>
            <div style="font-size:9px;font-weight:600;text-transform:uppercase;color:#9ca3af;">Quote To</div>
            <div style="font-weight:600;color:#1f2937;">${q.client_name ?? '—'}</div>
            ${q.subject ? `<div style="font-size:9px;font-weight:600;text-transform:uppercase;color:#9ca3af;margin-top:4px;">Subject</div><div style="font-size:10px;color:#374151;">${q.subject}</div>` : ''}
          </div>
          <div style="display:flex;align-items:center;justify-content:center;">
            <div style="font-size:16px;font-weight:900;color:#b91c1c;text-align:center;letter-spacing:0.1em;">QUOTATION</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:9px;font-weight:600;text-transform:uppercase;color:#9ca3af;">Quote Number</div>
            <div style="font-family:monospace;font-weight:700;">${q.quote_number ?? '—'}</div>
            <div style="font-size:9px;font-weight:600;text-transform:uppercase;color:#9ca3af;margin-top:4px;">Date</div>
            <div>${q.quote_date ?? '—'}</div>
            ${q.valid_until ? `<div style="font-size:9px;font-weight:600;text-transform:uppercase;color:#9ca3af;margin-top:4px;">Valid Until</div><div>${q.valid_until}</div>` : ''}
          </div>
        </div>
        ${itemsHtml}
        <div style="display:flex;justify-content:flex-end;margin-top:12px;">
          <div style="width:220px;font-size:10px;">
            <div style="display:flex;justify-content:space-between;padding-bottom:4px;"><span style="color:#6b7280;">Subtotal</span><span>${fmtAmt(q.subtotal)}</span></div>
            ${hasVat ? `<div style="display:flex;justify-content:space-between;border-top:1px solid #e5e7eb;padding-top:4px;"><span style="color:#6b7280;">VAT (12%)</span><span style="color:#2563eb;">${fmtAmt(q.vat_amount)}</span></div>` : ''}
            ${hasEwt ? `<div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">EWT</span><span style="color:#b91c1c;">−${fmtAmt(q.ewt_amount)}</span></div>` : ''}
            <div style="display:flex;justify-content:space-between;border-top:1px solid #e5e7eb;padding-top:4px;font-weight:700;font-size:11px;"><span>Total</span><span style="color:#b91c1c;">${fmtAmt(q.total_amount)}</span></div>
          </div>
        </div>
        ${q.notes ? `<div style="border-top:1px solid #e5e7eb;padding-top:8px;margin-top:8px;"><div style="font-size:9px;font-weight:600;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Notes / Terms</div><div style="font-size:10px;color:#374151;">${q.notes}</div></div>` : ''}
        <div style="display:flex;justify-content:space-between;margin-top:40px;gap:24px;">
          <div style="flex:1;text-align:center;">
            <div style="border-top:1px solid #374151;padding-top:6px;font-size:10px;color:#374151;font-weight:600;">PREPARED BY</div>
            <div style="font-size:9px;color:#9ca3af;margin-top:2px;">Signature over Printed Name</div>
          </div>
          <div style="flex:1;text-align:center;">
            <div style="border-top:1px solid #374151;padding-top:6px;font-size:10px;color:#374151;font-weight:600;">ACCEPTED BY</div>
            <div style="font-size:9px;color:#9ca3af;margin-top:2px;">Signature over Printed Name / Date</div>
          </div>
        </div>
      </div>
    </body></html>`
  }

  async function updateStatus(id: string, status: string) {
    const prevStatus = quotations.find(q => q.id === id)?.status
    const { error } = await supabase.from('quotations').update({ status }).eq('id', id)
    if (error) { toast.error(error.message); return }
    undoToast(`Status updated to ${STATUS_CFG[status]?.label ?? status}`, async () => {
      if (!prevStatus) return
      await supabase.from('quotations').update({ status: prevStatus }).eq('id', id)
      load()
    })
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

  const PreviewDoc = () => {
    const imageLines = lines.filter(l => l.item_name.trim() && itemImage(l.item_name))
    return (
    <div ref={printRef} className="space-y-4">
    <div className="border rounded-lg bg-white text-[11px] p-5 shadow-sm space-y-3 font-sans">
      {/* Header: Logo (left) | Company Name + Address (right) */}
      <div className="flex justify-between items-start border-b pb-3">
        <div>
          <img src={companyInfo?.logo_url || '/cdsc-logo.jpg'} alt={companyInfo?.company_name || 'CDSC'} className="h-12 w-12 rounded object-cover" />
        </div>
        <div className="text-right space-y-0.5">
          <div className="text-[13px] font-bold text-red-700 leading-tight">
            {companyInfo?.company_name ?? 'CDSC Industrial Supply'}
          </div>
          <div className="text-[9px] text-gray-500">
            {companyInfo?.address && <div>{companyInfo.address}</div>}
            {(companyInfo?.phone || companyInfo?.email) && (
              <div>{companyInfo.phone}{companyInfo.phone && companyInfo.email ? ' | ' : ''}{companyInfo.email}</div>
            )}
            {companyInfo?.tin && <div>TIN: {companyInfo.tin}</div>}
          </div>
        </div>
      </div>

      {/* Party row: Bill To (left) | QUOTATION (center) | Quote # / Date (right) */}
      <div className="grid grid-cols-3 gap-3 border-b pb-3">
        <div className="space-y-0.5">
          <div className="text-[9px] font-semibold uppercase text-gray-400">Quote To</div>
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
            <th className="text-right px-1.5 py-1 w-14 font-bold">QTY</th>
            <th className="text-left px-1.5 py-1 w-16">Unit</th>
            <th className="text-right px-1.5 py-1 w-24">Selling Price</th>
            <th className="text-right px-1.5 py-1 w-20">Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => {
            const effectivePrice = parseFloat(line.selling_price) || parseFloat(line.unit_price) || 0
            const total = effectivePrice * (parseFloat(line.quantity) || 0)
            return (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-1.5 py-1 text-gray-400">{i + 1}</td>
                <td className="px-1.5 py-1">
                  <div className="flex items-center gap-1.5">
                    {line.item_name && itemImage(line.item_name) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={itemImage(line.item_name)!} alt="" className="h-6 w-6 rounded object-cover shrink-0" />
                    )}
                    <div>
                      <div>{line.item_name || <span className="text-gray-300 italic">—</span>}</div>
                      {line.description && <div className="text-[9px] text-gray-500">{line.description}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-1.5 py-1 text-right font-bold text-gray-800">{line.quantity || '—'}</td>
                <td className="px-1.5 py-1 text-gray-500">{line.unit || '—'}</td>
                <td className="px-1.5 py-1 text-right font-medium">₱{effectivePrice.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
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
          {vatType !== 'exempt' && <div className="flex justify-between"><span className="text-gray-500">VAT {vatType === 'inclusive' ? '(incl. 12%)' : '(12%)'}</span><span className="text-blue-600">₱{vatAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>}
          {ewtType !== 'none' && <div className="flex justify-between"><span className="text-gray-500">{ewtLabel} ({ewtCfg.rate * 100}%)</span><span className="text-red-700">−₱{ewtAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>}
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
          <div className="border-b border-gray-400 mb-1 h-8 flex items-end justify-center pb-0.5">
            {preparedBy && <span className="text-[10px] font-medium text-gray-700">{preparedBy}</span>}
          </div>
          <div className="text-[9px] text-gray-400 uppercase tracking-wider">Prepared By</div>
        </div>
        <div className="text-center">
          <div className="border-b border-gray-400 mb-1 h-8 flex items-end justify-center pb-0.5">
            {acceptedBy && <span className="text-[10px] font-medium text-gray-700">{acceptedBy}</span>}
          </div>
          <div className="text-[9px] text-gray-400 uppercase tracking-wider">Accepted By</div>
        </div>
      </div>
    </div>

    {imageLines.length > 0 && (
      <div className="border rounded-lg bg-white text-[11px] p-5 shadow-sm space-y-3 font-sans" style={{ pageBreakBefore: 'always' }}>
        <div className="flex justify-between items-center border-b pb-2">
          <div className="text-[13px] font-bold text-red-700">Item Images</div>
          <div className="text-[9px] text-gray-400">Page 2</div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {imageLines.map((line, i) => (
            <div key={i} className="border rounded p-2 text-center space-y-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={itemImage(line.item_name)!} alt={line.item_name} className="w-full h-28 object-cover rounded" />
              <div className="text-[9px] text-gray-700 truncate">{line.item_name}</div>
            </div>
          ))}
        </div>
      </div>
    )}
    </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Quotation</h2>
          <p className="text-muted-foreground text-sm">Create and manage client quotations and requests</p>
        </div>
        {activeTab === 'quotations' && (
          open ? (
            <Button variant="outline" onClick={() => {
              const hasData = clientId || quoteNumber || lines.some(l => l.item_name)
              if (hasData) { setDiscardCallback(() => () => { setOpen(false); resetForm() }); setDiscardOpen(true); return }
              setOpen(false); resetForm()
            }}>
              <X className="h-4 w-4 mr-2" />Cancel
            </Button>
          ) : (
            <Button onClick={() => { resetForm(); setOpen(true) }} className="bg-red-600 hover:bg-red-700">
              <Plus className="h-4 w-4 mr-2" />New Quotation
            </Button>
          )
        )}
      </div>

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v ?? 'quotations')}>
        <TabsList>
          <TabsTrigger value="quotations" className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />Quotations
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />Requests for Quotation
            {rfqPendingCount > 0 && (
              <span className="ml-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{rfqPendingCount}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quotations" className="space-y-6 mt-4">

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
        <div className="space-y-6">
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
                      <SelectTrigger className="w-full">
                        {clientId
                          ? <span className="truncate text-sm">{clients.find(c => c.id === clientId)?.company_name}</span>
                          : <span className="text-muted-foreground text-sm">Select client…</span>}
                      </SelectTrigger>
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
                    const client = clientId ? clients.find(c => c.id === clientId) : null
                    setEmailToQ(client?.email ?? '')
                    setEmailSubjectQ(`Quotation ${quoteNumber || '(draft)'}${client?.company_name ? ` — ${client.company_name}` : ''}`)
                    setEmailBodyQ(`Dear ${client?.company_name ?? 'Sir/Madam'},\n\nPlease find attached our Quotation ${quoteNumber || '(draft)'}.\n\nThis quotation is valid as indicated. Kindly review and confirm at your earliest convenience.\n\nBest regards,\n${companyInfo?.company_name ?? 'CDSC Industrial Supply'}`)
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

        {/* Line Items — full width */}
        <Card>
          <CardContent className="pt-5 space-y-2">
            <Label>Line Items</Label>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-12">No.</TableHead>
                    <TableHead className="w-16">Qty</TableHead>
                    <TableHead className="w-20">Unit</TableHead>
                    <TableHead className="min-w-[220px]">Item Description</TableHead>
                    <TableHead className="w-28">Unit Price <span className="font-normal text-muted-foreground text-[10px]">(cost)</span></TableHead>
                    <TableHead className="w-28">Selling Price</TableHead>
                    <TableHead className="w-28 text-right">Amount</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, idx) => (
                    <TableRow
                      key={idx}
                      className={dragLineIndex === idx ? 'bg-red-50/60' : undefined}
                      onDragOver={e => { if (dragLineIndex !== null) e.preventDefault() }}
                      onDrop={e => {
                        e.preventDefault()
                        if (dragLineIndex === null || dragLineIndex === idx) return
                        setLines(prev => {
                          const next = [...prev]
                          const [moved] = next.splice(dragLineIndex, 1)
                          next.splice(idx, 0, moved)
                          return next
                        })
                        setDragLineIndex(null)
                      }}
                    >
                      <TableCell className="py-1.5">
                        <div
                          className="flex items-center gap-1 text-sm text-muted-foreground cursor-grab active:cursor-grabbing"
                          draggable
                          onDragStart={() => setDragLineIndex(idx)}
                          onDragEnd={() => setDragLineIndex(null)}
                          title="Drag to reorder"
                        >
                          <GripVertical className="h-3.5 w-3.5 shrink-0" />
                          {idx + 1}
                        </div>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Input type="number" min="0" className="h-8 text-xs w-14" value={line.quantity} onChange={e => updateLine(idx, 'quantity', e.target.value)} />
                      </TableCell>
                      <TableCell className="py-1.5">
                        <div className="h-8 flex items-center px-2 text-xs bg-muted/40 rounded border text-muted-foreground">{line.unit || '—'}</div>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <div className="space-y-1 min-w-0">
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
                              <Search className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <Input placeholder="Description (optional)" className="h-7 text-xs" value={line.description}
                            onChange={e => updateLine(idx, 'description', e.target.value)} />
                        </div>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Input type="number" min="0" step="0.01" className="h-8 text-xs w-full" value={line.unit_price} onChange={e => updateLine(idx, 'unit_price', e.target.value)} />
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Input type="number" min="0" step="0.01" className="h-8 text-xs w-full" value={line.selling_price} onChange={e => updateLine(idx, 'selling_price', e.target.value)} />
                      </TableCell>
                      <TableCell className="py-1.5 text-right text-xs font-medium">{fmt((parseFloat(line.quantity)||0)*(parseFloat(line.selling_price)||parseFloat(line.unit_price)||0))}</TableCell>
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
          </CardContent>
        </Card>

        {/* Notes, signatures, tax settings, totals — full width */}
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="space-y-1.5">
              <Label>Notes / Terms</Label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                placeholder="Payment terms, delivery notes, etc."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prepared By</Label>
                <textarea
                  className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  rows={2}
                  placeholder="Name / Position"
                  value={preparedBy}
                  onChange={e => setPreparedBy(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Accepted By</Label>
                <textarea
                  className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  rows={2}
                  placeholder="Name / Position"
                  value={acceptedBy}
                  onChange={e => setAcceptedBy(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>VAT Type</Label>
              <div className="flex gap-2 flex-wrap">
                {([
                  { value: 'exclusive', label: 'VAT Exclusive' },
                  { value: 'inclusive', label: 'VAT Inclusive' },
                  { value: 'exempt',    label: 'VAT Exempt' },
                ] as const).map(opt => (
                  <button key={opt.value} type="button" onClick={() => setVatType(opt.value)}
                    className={`px-3 py-1.5 text-sm rounded-md border font-medium transition-colors ${vatType === opt.value ? 'bg-red-600 text-white border-red-600' : 'bg-background text-muted-foreground hover:bg-muted border-input'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {vatType === 'exclusive' ? 'VAT (12%) added on top of subtotal' : vatType === 'inclusive' ? 'VAT already included in price (extracted at 12/112)' : 'No VAT applied'}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>EWT (Expanded Withholding Tax)</Label>
              <div className="flex gap-2 flex-wrap">
                {(['none', 'goods', 'services', 'rental'] as EWTType[]).map(opt => (
                  <button key={opt} type="button" onClick={() => setEwtType(opt)}
                    className={`px-3 py-1.5 text-sm rounded-md border font-medium transition-colors ${ewtType === opt ? 'bg-red-600 text-white border-red-600' : 'bg-background text-muted-foreground hover:bg-muted border-input'}`}>
                    {opt === 'none' ? 'None' : `${EWT_CFG[opt].label} (${EWT_CFG[opt].rate * 100}%)`}
                  </button>
                ))}
              </div>
              {ewtType !== 'none' && (
                <p className="text-xs text-muted-foreground">
                  ATC: <span className="font-semibold text-foreground">{ewtCfg.atc}</span> — {ewtCfg.desc} @ {ewtCfg.rate * 100}%
                </p>
              )}
            </div>

            <div className="rounded-lg bg-muted/30 p-4 space-y-1 text-sm max-w-sm ml-auto">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(subtotal)}</span></div>
              {vatType !== 'exempt' && <div className="flex justify-between"><span className="text-muted-foreground">VAT {vatType === 'inclusive' ? '(incl. 12%)' : '12%'}</span><span>{fmt(vatAmount)}</span></div>}
              {ewtType !== 'none' && <div className="flex justify-between"><span className="text-muted-foreground">{ewtLabel} ({ewtCfg.rate * 100}%)</span><span className="text-red-700">− {fmt(ewtAmount)}</span></div>}
              <div className="h-px bg-border my-1" />
              <div className="flex justify-between font-bold"><span>Total</span><span className="text-red-600">{fmt(totalAmount)}</span></div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t mt-4">
              <Button variant="outline" onClick={() => {
                const hasData = clientId || quoteNumber || lines.some(l => l.item_name)
                if (hasData) { setDiscardCallback(() => () => { setOpen(false); resetForm() }); setDiscardOpen(true); return }
                setOpen(false); resetForm()
              }}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700">
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{editingId ? 'Updating…' : 'Saving…'}</> : editingId ? 'Update Quotation' : 'Save Quotation'}
              </Button>
            </div>
          </CardContent>
        </Card>
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
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={async () => {
                              setViewingQ(q)
                              const { data } = await supabase.from('quotation_items').select('item_name,description,quantity,unit,unit_price,selling_price,total_amount').eq('quotation_id', q.id).order('created_at')
                              setViewingQItems(data ?? [])
                            }}>
                              <Eye className="mr-2 h-4 w-4" />View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(q)}>
                              <Pencil className="mr-2 h-4 w-4" />Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openListEmail(q)}>
                              <Mail className="mr-2 h-4 w-4" />Send Email
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => updateStatus(q.id, 'sent')}>
                              <Send className="mr-2 h-4 w-4" />Mark as Sent
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(q.id, 'accepted')} className="text-green-600">
                              <CheckCircle className="mr-2 h-4 w-4" />Mark as Accepted
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(q.id, 'declined')} className="text-destructive">
                              <XCircle className="mr-2 h-4 w-4" />Mark as Declined
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(q.id, 'expired')} className="text-yellow-600">
                              <Clock className="mr-2 h-4 w-4" />Mark as Expired
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => deleteQuotation(q.id)} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />Delete
                            </DropdownMenuItem>
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
        </TabsContent>

        <TabsContent value="requests" className="mt-4">
          <QuotationRequestsPanel onQuotationCreated={handleQuotationCreated} />
        </TabsContent>
      </Tabs>

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
              The email will be sent from cdsc.gmot@gmail.com with the quotation attached as a PDF.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" disabled={sendingEmailQ} onClick={() => setShowEmailQ(false)}>Cancel</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 gap-1.5"
                disabled={sendingEmailQ}
                onClick={async () => {
                  if (!emailToQ) { toast.error('Please enter a recipient email address.'); return }
                  if (!editingId) { toast.error('Please save the quotation first before sending.'); return }
                  // Build a quotation-like object from current form state
                  const formQ: Quotation = {
                    id: editingId,
                    quote_number: quoteNumber,
                    quote_date: quoteDate,
                    valid_until: validUntil || null,
                    client_name: selectedClient?.company_name ?? null,
                    subject: subject || null,
                    subtotal,
                    vat_amount: vatAmount,
                    ewt_amount: ewtAmount,
                    total_amount: totalAmount,
                    notes: notes || null,
                    status: 'draft',
                    created_at: new Date().toISOString(),
                  }
                  const formItems = lines.filter(l => l.item_name.trim()).map(l => ({
                    item_name: l.item_name,
                    description: l.description || null,
                    quantity: parseFloat(l.quantity) || 1,
                    unit: l.unit || null,
                    unit_price: parseFloat(l.unit_price) || 0,
                    selling_price: parseFloat(l.selling_price) || null,
                    total_amount: (parseFloat(l.selling_price) || parseFloat(l.unit_price) || 0) * (parseFloat(l.quantity) || 1),
                  }))
                  setSendingEmailQ(true)
                  try {
                    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
                    const confirmUrlQ = `${appUrl}/api/confirm/quote/${formQ.id}`
                    const htmlBodyQ = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
${emailBodyQ.replace(/\n/g, '<br/>')}
<br/><br/>
<div style="text-align:center;margin:24px 0">
  <a href="${confirmUrlQ}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 32px;border-radius:8px">Confirm Quotation</a>
</div>
<p style="color:#6b7280;font-size:12px;text-align:center">Clicking the button above confirms your acceptance of this quotation and creates a Sales Order.</p>
</div>`
                    await sendEmail({
                      to: emailToQ,
                      subject: emailSubjectQ,
                      body: emailBodyQ,
                      htmlBody: htmlBodyQ,
                      pdfData: await buildQuotePdfData(formQ, formItems),
                      pdfFilename: `Quotation-${quoteNumber || 'draft'}.pdf`,
                    })
                    toast.success('Email sent successfully!')
                    setShowEmailQ(false)
                  } catch (err: unknown) {
                    toast.error(err instanceof Error ? err.message : 'Failed to send email')
                  } finally {
                    setSendingEmailQ(false)
                  }
                }}
              >
                {sendingEmailQ ? <><Loader2 className="h-4 w-4 animate-spin" />Sending…</> : <><Send className="h-4 w-4" />Send Email</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Quotation Dialog */}
      <Dialog open={!!viewingQ} onOpenChange={o => { if (!o) { setViewingQ(null); setViewingQItems([]) } }}>
        <DialogContent className="w-[98vw] sm:!max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" />Quotation Preview
            </DialogTitle>
          </DialogHeader>
          {viewingQ && (
            <iframe
              srcDoc={buildQuoteHtml(viewingQ, viewingQItems)}
              className="w-full border-0 rounded"
              style={{ minHeight: '600px' }}
              title="Quotation Preview"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* List Send Email Dialog */}
      <Dialog open={!!listEmailQ} onOpenChange={o => { if (!o) setListEmailQ(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" />Send Quotation by Email
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input type="email" placeholder="client@example.com" value={listEmailTo} onChange={e => setListEmailTo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={listEmailSubject} onChange={e => setListEmailSubject(e.target.value)} placeholder="Subject…" />
            </div>
            <div className="space-y-1.5">
              <Label>Body</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                rows={7}
                value={listEmailBody}
                onChange={e => setListEmailBody(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">The email will be sent from cdsc.gmot@gmail.com and the quotation will be marked as Sent.</p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" disabled={sendingListEmail} onClick={() => setListEmailQ(null)}>Cancel</Button>
              <Button
                className="bg-red-600 hover:bg-red-700 gap-1.5"
                disabled={sendingListEmail}
                onClick={async () => {
                  if (!listEmailTo) { toast.error('Please enter a recipient email address.'); return }
                  const q = listEmailQ!
                  setSendingListEmail(true)
                  try {
                    const { data: qItemsForEmail } = await supabase.from('quotation_items').select('item_name,description,quantity,unit,unit_price,selling_price,total_amount').eq('quotation_id', q.id).order('created_at')
                    const appUrlList = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
                    const confirmUrlList = `${appUrlList}/api/confirm/quote/${q.id}`
                    const htmlBodyList = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
${listEmailBody.replace(/\n/g, '<br/>')}
<br/><br/>
<div style="text-align:center;margin:24px 0">
  <a href="${confirmUrlList}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 32px;border-radius:8px">Confirm Quotation</a>
</div>
<p style="color:#6b7280;font-size:12px;text-align:center">Clicking the button above confirms your acceptance of this quotation and creates a Sales Order.</p>
</div>`
                    await sendEmail({
                      to: listEmailTo,
                      subject: listEmailSubject,
                      body: listEmailBody,
                      htmlBody: htmlBodyList,
                      pdfData: await buildQuotePdfData(q, qItemsForEmail ?? []),
                      pdfFilename: `Quotation-${q.quote_number ?? 'draft'}.pdf`,
                    })
                    toast.success('Email sent successfully!')
                    setListEmailQ(null)
                    updateStatus(q.id, 'sent')
                  } catch (err: unknown) {
                    toast.error(err instanceof Error ? err.message : 'Failed to send email')
                  } finally {
                    setSendingListEmail(false)
                  }
                }}
              >
                {sendingListEmail ? <><Loader2 className="h-4 w-4 animate-spin" />Sending…</> : <><Send className="h-4 w-4" />Send Email</>}
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
                    setLines(p => p.map((l, i) => i === itemSearchIdx ? {
                      ...l,
                      item_name: it.item_name,
                      quantity: l.quantity || '1',
                      unit: it.unit_of_measure || l.unit,
                      unit_price: it.cost != null ? String(it.cost) : l.unit_price,
                      selling_price: it.selling_price != null ? String(it.selling_price) : l.selling_price,
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

      {/* Discard Unsaved Changes Dialog */}
      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Discard Changes?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">You have unsaved changes. Are you sure you want to discard them?</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDiscardOpen(false)}>Keep Editing</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => { setDiscardOpen(false); discardCallback?.() }}>Discard</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
