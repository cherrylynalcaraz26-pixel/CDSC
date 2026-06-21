'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

import {
  Plus, MoreHorizontal, Eye, Printer, Loader2,
  Trash2, CheckCircle2, XCircle, ArrowRightLeft, X,
  Package, Search, Mail, Send, Pencil, FileText,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useSearchContext } from '@/context/search-context'
import { sendEmail } from '@/lib/send-email'

interface ItemOption {
  item_code: string
  item_name: string
  unit_of_measure: string
  status: string
  cost: number | null
  selling_price: number | null
}

type POStatus = 'open' | 'partially_delivered' | 'completed' | 'cancelled'

const STATUS_CFG: Record<POStatus, { label: string; cls: string }> = {
  open:                { label: 'Open',             cls: 'bg-blue-100 text-blue-700' },
  partially_delivered: { label: 'Partial Delivery', cls: 'bg-yellow-100 text-yellow-700' },
  completed:           { label: 'Completed',        cls: 'bg-green-100 text-green-700' },
  cancelled:           { label: 'Cancelled',        cls: 'bg-red-100 text-red-700' },
}

const ITEM_STATUS_CFG: Record<string, { label: string; cls: string }> = {
  active:      { label: 'Active',      cls: 'bg-green-100 text-green-700' },
  inactive:    { label: 'Inactive',    cls: 'bg-gray-100 text-gray-500' },
  low_stock:   { label: 'Low Stock',   cls: 'bg-yellow-100 text-yellow-700' },
  out_of_stock:{ label: 'Out of Stock',cls: 'bg-red-100 text-red-700' },
}

interface PO {
  id: string
  po_number: string | null
  po_date: string | null
  delivery_date: string | null
  status: POStatus
  subtotal: number
  vat_amount: number
  ewt_amount: number
  cwt_amount: number
  net_payable: number
  total_amount: number
  discount_rate: number
  discount_amount: number
  payment_terms: string | null
  remarks: string | null
  supplier?: { company_name: string } | null
  pr?: { pr_number: string } | null
}

interface Supplier { id: string; company_name: string; payment_terms: string | null; ewt_rate: number | null }
interface POLine   { item_name: string; quantity: string; unit: string; unit_price: string; selling_price: string }
const emptyLine = (): POLine => ({ item_name: '', quantity: '1', unit: 'piece', unit_price: '', selling_price: '' })

type EWTType = 'none' | 'goods' | 'services' | 'rental'
const EWT_CFG: Record<EWTType, { label: string; rate: number; atc: string; desc: string }> = {
  none:     { label: 'None',     rate: 0,    atc: '',      desc: '' },
  goods:    { label: 'Goods',    rate: 0.01, atc: 'WC158', desc: 'Purchase of Goods' },
  services: { label: 'Services', rate: 0.02, atc: 'WC157', desc: 'Purchase of Services' },
  rental:   { label: 'Rental',   rate: 0.05, atc: 'WC160', desc: 'Rental' },
}

export default function PurchaseOrdersPage() {
  const supabase = createClient()
  const { query } = useSearchContext()
  const [pos, setPOs] = useState<PO[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [items, setItems] = useState<ItemOption[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form')
  const [companyInfo, setCompanyInfo] = useState<{
    company_name: string; address: string; phone: string; email: string; tin: string
  } | null>(null)

  // Form state
  const [supplierId, setSupplierId] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('30 days')
  const [remarks, setRemarks] = useState('')
  const [lines, setLines] = useState<POLine[]>([emptyLine()])
  const [discountType, setDiscountType] = useState<'none' | '2' | '5' | 'custom'>('none')
  const [discountCustom, setDiscountCustom] = useState('')
  const discountRate = discountType === 'none' ? 0 : discountType === 'custom' ? (parseFloat(discountCustom) || 0) : parseFloat(discountType)

  // Warehouse stock map: item_name → total qty
  const [warehouseStock, setWarehouseStock] = useState<Record<string, number>>({})

  // Item search modal
  const [itemSearchIdx, setItemSearchIdx] = useState<number | null>(null)
  const [itemQuery, setItemQuery] = useState('')

  // View PO modal
  const [viewPO, setViewPO] = useState<PO | null>(null)

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null)

  // Pipeline
  const [pipelineOpen, setPipelineOpen] = useState(true)
  const [receivedPONums, setReceivedPONums] = useState<Set<string>>(new Set())
  const [csiSuppliers, setCsiSuppliers] = useState<Set<string>>(new Set())
  const [collectedSuppliers, setCollectedSuppliers] = useState<Set<string>>(new Set())

  // EWT
  const [ewtType, setEwtType] = useState<EWTType>('services')

  // Prepared By / Approved By
  const [preparedBy, setPreparedBy] = useState('')
  const [approvedBy, setApprovedBy] = useState('')

  // Email modal
  const [showEmail, setShowEmail] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [emailPO, setEmailPO] = useState<PO | null>(null)

  const printRef = useRef<HTMLDivElement>(null)

  async function load() {
    setLoading(true)
    const [{ data: poData }, { data: supData }, { data: itemData }] = await Promise.all([
      supabase
        .from('purchase_orders')
        .select('*, supplier:suppliers(company_name), pr:purchase_requests(pr_number)')
        .order('created_at', { ascending: false }),
      supabase.from('suppliers').select('id, company_name, payment_terms, ewt_rate').eq('is_active', true).order('company_name'),
      supabase.from('items').select('item_code, item_name, unit_of_measure, status, cost, selling_price').order('item_name'),
    ])
    setPOs((poData ?? []) as PO[])
    setSuppliers(supData ?? [])
    setItems((itemData ?? []) as ItemOption[])
    const { data: sysData } = await supabase.from('system_settings').select('company_name, address, phone, email, tin').single()
    if (sysData) setCompanyInfo(sysData)
    const { data: wsData } = await supabase.from('warehouse_stock').select('item_name, quantity')
    if (wsData) {
      const map: Record<string, number> = {}
      for (const r of wsData) {
        map[r.item_name] = (map[r.item_name] ?? 0) + (Number(r.quantity) || 0)
      }
      setWarehouseStock(map)
    }

    // Pipeline data
    const [{ data: rrData }, { data: csiData }, { data: colData }] = await Promise.all([
      supabase.from('receiving_reports').select('po_number'),
      supabase.from('csi_records').select('client_name'),
      supabase.from('collections').select('client_name'),
    ])
    setReceivedPONums(new Set((rrData ?? []).map((r: any) => r.po_number).filter(Boolean)))
    setCsiSuppliers(new Set((csiData ?? []).map((r: any) => (r.client_name ?? '').trim()).filter(Boolean)))
    setCollectedSuppliers(new Set((colData ?? []).map((r: any) => (r.client_name ?? '').trim()).filter(Boolean)))

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Computed totals
  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.selling_price) || 0) * (parseFloat(l.quantity) || 0), 0)
  const selectedSupplier = suppliers.find(s => s.id === supplierId)
  const ewtCfg = EWT_CFG[ewtType]
  const taxRate = ewtCfg.rate
  const taxLabel = ewtType !== 'none' ? `EWT — ${ewtCfg.atc}` : 'EWT'

  const discountAmount = subtotal * (discountRate / 100)
  const netSubtotal = subtotal - discountAmount
  const vatAmount = netSubtotal * 0.12
  const taxAmount = (netSubtotal / 1.12) * taxRate
  const totalAmount = netSubtotal + vatAmount
  const netPayable = totalAmount - taxAmount

  function resetForm() {
    setEditingId(null)
    setSupplierId(''); setPoNumber(''); setDeliveryDate('')
    setPaymentTerms('30 days'); setRemarks(''); setLines([emptyLine()])
    setActiveTab('form'); setDiscountType('none'); setDiscountCustom('')
    setEwtType('services'); setPreparedBy(''); setApprovedBy('')
  }

  async function openEdit(po: PO) {
    resetForm()
    setEditingId(po.id)
    setSupplierId((po.supplier as any)?.id ?? (po as any).supplier_id ?? '')
    setPoNumber(po.po_number ?? '')
    setDeliveryDate(po.delivery_date ?? '')
    setPaymentTerms(po.payment_terms ?? '30 days')
    setRemarks(po.remarks ?? '')

    // Load existing line items
    const { data: poItems } = await supabase
      .from('po_items')
      .select('item_name, quantity, unit_of_measure, unit_cost')
      .eq('po_id', po.id)
      .order('created_at')
    if (poItems && poItems.length > 0) {
      setLines(poItems.map(r => ({
        item_name: r.item_name ?? '',
        quantity: String(r.quantity ?? 1),
        unit: r.unit_of_measure ?? '',
        unit_price: String(r.unit_cost ?? ''),
        selling_price: '',
      })))
    }

    setOpen(true)
  }

  async function updateItemSellingPrice(itemName: string, newPrice: string) {
    const price = parseFloat(newPrice)
    if (!itemName || isNaN(price) || price <= 0) {
      toast.error('Enter a valid selling price first')
      return
    }
    const { error } = await supabase.from('items').update({ selling_price: price }).eq('item_name', itemName)
    if (error) toast.error('Failed to update selling price')
    else toast.success(`Selling price updated to ₱${price.toLocaleString('en-PH', { minimumFractionDigits: 2 })} — affects future records only`)
  }

  async function submitPO() {
    if (!supplierId) { toast.error('Select a supplier'); return }
    setSaving(true)
    const payload = {
      po_number: poNumber || null,
      supplier_id: supplierId || null,
      delivery_date: deliveryDate || null,
      payment_terms: paymentTerms || null,
      remarks: remarks || null,
      subtotal,
      vat_amount: vatAmount,
      ewt_amount: taxAmount,
      discount_rate: discountRate,
      discount_amount: discountAmount,
      tax_type: 'ewt',
      total_amount: totalAmount,
      net_payable: netPayable,
    }
    let error
    let savedPoId = editingId

    if (editingId) {
      ;({ error } = await supabase.from('purchase_orders').update(payload).eq('id', editingId))
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: inserted, error: insErr } = await supabase.from('purchase_orders').insert({
        ...payload,
        po_date: new Date().toISOString().split('T')[0],
        status: 'open',
        created_by: user?.id,
      }).select('id').single()
      error = insErr
      savedPoId = inserted?.id ?? null
    }
    if (error) { toast.error(error.message); setSaving(false); return }

    // Save line items to po_items
    if (savedPoId) {
      await supabase.from('po_items').delete().eq('po_id', savedPoId)
      const validLines = lines.filter(l => l.item_name.trim())
      if (validLines.length > 0) {
        const itemRows = validLines.map(l => ({
          po_id: savedPoId,
          item_name: l.item_name,
          quantity: parseFloat(l.quantity) || 1,
          unit_of_measure: l.unit || null,
          unit_cost: parseFloat(l.unit_price) || 0,
          total_cost: (parseFloat(l.unit_price) || 0) * (parseFloat(l.quantity) || 1),
        }))
        await supabase.from('po_items').insert(itemRows)
      }
    }

    toast.success(editingId ? 'Purchase Order updated' : 'Purchase Order created')
    setEditingId(null)
    resetForm()
    setOpen(false)
    load()
    setSaving(false)
  }

  async function updateStatus(id: string, status: POStatus) {
    const { error } = await supabase.from('purchase_orders').update({ status }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success(status === 'completed' ? 'PO completed — stock will be updated on receiving' : `Status → ${STATUS_CFG[status].label}`)
    load()
  }

  async function deletePO(id: string) {
    const { data: saved } = await supabase.from('purchase_orders').select('*').eq('id', id).single()
    const { error } = await supabase.from('purchase_orders').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    load()
    toast.success('PO deleted', {
      action: {
        label: 'Undo',
        onClick: async () => {
          if (saved) {
            const { id: _id, po_number: _po, created_at: _ca, ...rest } = saved as any
            await supabase.from('purchase_orders').insert(rest)
            load()
          }
        },
      },
    })
  }

  function buildPOHtml(po: PO) {
    const supplierName = (po.supplier as any)?.company_name ?? '—'
    const poDate = po.po_date ? new Date(po.po_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
    const delDate = po.delivery_date ? new Date(po.delivery_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : null
    const fmtAmt = (n: number) => `₱${(n ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
    const sCfg = STATUS_CFG[po.status] ?? STATUS_CFG.open
    const hasEwt = (po.ewt_amount ?? 0) > 0
    const hasDiscount = (po.discount_rate ?? 0) > 0
    const vNetSub = (po.subtotal ?? 0) - (po.discount_amount ?? 0)
    return `<!DOCTYPE html><html><head><title>Purchase Order</title>
      <script src="https://cdn.tailwindcss.com"><\/script>
      <style>body{font-family:Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@media print{body{margin:0;}}</style>
    </head><body class="p-6 text-[11px] font-sans">
      <div class="space-y-3">
        <div class="flex justify-between items-start border-b pb-3">
          <div><div class="text-[13px] font-bold text-red-700">${companyInfo?.company_name ?? 'CDSC INDUSTRIAL'}</div></div>
          <div class="text-right text-[9px] text-gray-500">${companyInfo?.address ?? ''}<br/>${companyInfo?.phone ?? ''}${companyInfo?.phone && companyInfo?.email ? ' | ' : ''}${companyInfo?.email ?? ''}${companyInfo?.tin ? '<br/>TIN: ' + companyInfo.tin : ''}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;" class="border-b pb-3">
          <div>
            <div class="text-[9px] font-semibold uppercase text-gray-400">Supplier</div>
            <div class="font-semibold text-gray-800">${supplierName}</div>
            <div class="text-[9px] font-semibold uppercase text-gray-400 mt-1">Payment Terms</div>
            <div>${po.payment_terms ?? '—'}</div>
            ${po.remarks ? `<div class="text-[9px] font-semibold uppercase text-gray-400 mt-1">Remarks</div><div class="text-[10px] text-gray-700">${po.remarks}</div>` : ''}
          </div>
          <div style="display:flex;align-items:center;justify-content:center;">
            <div style="font-size:16px;font-weight:900;color:#b91c1c;text-align:center;letter-spacing:0.1em;">PURCHASE<br/>ORDER</div>
          </div>
          <div style="text-align:right;">
            <div class="text-[9px] font-semibold uppercase text-gray-400">PO Number</div>
            <div class="font-mono font-bold">${po.po_number ?? '—'}</div>
            <div class="text-[9px] font-semibold uppercase text-gray-400 mt-1">Date</div>
            <div>${poDate}</div>
            ${delDate ? `<div class="text-[9px] font-semibold uppercase text-gray-400 mt-1">Delivery Date</div><div>${delDate}</div>` : ''}
            <div class="mt-1"><span style="font-size:9px;padding:2px 6px;border-radius:999px;background:${sCfg.cls.includes('blue') ? '#dbeafe' : sCfg.cls.includes('green') ? '#dcfce7' : sCfg.cls.includes('yellow') ? '#fef9c3' : '#fee2e2'};color:${sCfg.cls.includes('blue') ? '#1d4ed8' : sCfg.cls.includes('green') ? '#15803d' : sCfg.cls.includes('yellow') ? '#a16207' : '#b91c1c'};">${sCfg.label}</span></div>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;">
          <div style="width:220px;font-size:10px;">
            <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">Subtotal</span><span>${fmtAmt(po.subtotal)}</span></div>
            ${hasDiscount ? `<div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">Discount (${po.discount_rate}%)</span><span style="color:#ea580c;">−${fmtAmt(po.discount_amount)}</span></div><div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">Net Subtotal</span><span>${fmtAmt(vNetSub)}</span></div>` : ''}
            <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">VAT (12%)</span><span style="color:#2563eb;">${fmtAmt(po.vat_amount)}</span></div>
            ${hasEwt ? `<div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">EWT</span><span style="color:#b91c1c;">−${fmtAmt(po.ewt_amount)}</span></div>` : ''}
            <div style="display:flex;justify-content:space-between;border-top:1px solid #e5e7eb;padding-top:4px;font-weight:700;font-size:11px;"><span>Net Payable</span><span style="color:#b91c1c;">${fmtAmt(po.net_payable)}</span></div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;border-top:1px solid #e5e7eb;padding-top:16px;margin-top:4px;">
          <div style="text-align:center;"><div style="border-bottom:1px solid #9ca3af;height:32px;"></div><div style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">Prepared By</div></div>
          <div style="text-align:center;"><div style="border-bottom:1px solid #9ca3af;height:32px;"></div><div style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">Approved By</div></div>
        </div>
      </div>
    </body></html>`
  }

  function handlePrint() {
    const el = printRef.current
    if (!el) return
    const win = window.open('', '_blank', 'width=900,height=750')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><title>Purchase Order</title>
      <script src="https://cdn.tailwindcss.com"><\/script>
      <style>
        body { font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print { body { margin: 0; } }
      </style>
    </head><body class="p-6 text-[11px]">${el.innerHTML}</body></html>`)
    win.document.close()
    setTimeout(() => { win.focus(); win.print(); win.close() }, 800)
  }

  function handlePrintPO(po: PO) {
    const win = window.open('', '_blank', 'width=900,height=750')
    if (!win) return
    win.document.write(buildPOHtml(po))
    win.document.close()
    setTimeout(() => { win.focus(); win.print(); win.close() }, 800)
  }

  function openEmailDialog(po?: PO) {
    if (po) {
      const supplierName = (po.supplier as any)?.company_name ?? 'Sir/Madam'
      setEmailPO(po)
      setEmailSubject(`Purchase Order ${po.po_number ?? '(draft)'}${supplierName !== 'Sir/Madam' ? ` — ${supplierName}` : ''}`)
      setEmailBody(`Dear ${supplierName},\n\nPlease find attached the Purchase Order ${po.po_number ?? '(draft)'}.\n\nKindly confirm receipt and advise on delivery schedule.\n\nBest regards,\n${companyInfo?.company_name ?? 'CDSC Industrial Supply'}`)
    } else {
      const partyName = suppliers.find(s => s.id === supplierId)?.company_name
      setEmailPO(null)
      setEmailSubject(`Purchase Order ${poNumber || '(draft)'}${partyName ? ` — ${partyName}` : ''}`)
      setEmailBody(`Dear ${partyName ?? 'Sir/Madam'},\n\nPlease find attached the Purchase Order ${poNumber || '(draft)'}.\n\nKindly confirm receipt and advise on delivery schedule.\n\nBest regards,\n${companyInfo?.company_name ?? 'CDSC Industrial Supply'}`)
    }
    setEmailTo('')
    setShowEmail(true)
  }

  async function handleSendEmail() {
    if (!emailTo) { toast.error('Please enter a recipient email address.'); return }
    const po = emailPO
    const poNum = po?.po_number ?? poNumber ?? 'draft'
    const filename = `PO-${poNum}.pdf`
    let printHtml: string | undefined
    if (po) {
      printHtml = buildPOHtml(po)
    } else {
      const el = printRef.current
      if (el) printHtml = `<!DOCTYPE html><html><head><title>PO</title>
        <script src="https://cdn.tailwindcss.com"><\/script>
        <style>body{font-family:Arial,sans-serif;}</style>
      </head><body class="p-6 text-[11px]">${el.innerHTML}</body></html>`
    }
    setShowEmail(false)
    toast.loading('Generating PDF…', { id: 'email-send' })
    try {
      await sendEmail({ to: emailTo, subject: emailSubject, body: emailBody, printHtml, pdfFilename: filename })
      toast.success('Email sent successfully!', { id: 'email-send' })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email', { id: 'email-send' })
    }
  }

  const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

  const displayedPos = query.trim()
    ? pos.filter(p => {
        const q = query.toLowerCase()
        return (p.po_number ?? '').toLowerCase().includes(q) ||
          (p.supplier?.company_name ?? '').toLowerCase().includes(q) ||
          (p.pr?.pr_number ?? '').toLowerCase().includes(q) ||
          (p.status ?? '').toLowerCase().includes(q)
      })
    : pos

  const counts = {
    open: pos.filter(p => p.status === 'open').length,
    partial: pos.filter(p => p.status === 'partially_delivered').length,
    completed: pos.filter(p => p.status === 'completed').length,
    total: pos.reduce((s, p) => s + (p.total_amount ?? 0), 0),
  }

  const activeItems = items.filter(it => it.status === 'active')
  const filteredSearchItems = itemQuery.trim()
    ? items.filter(it =>
        it.item_name.toLowerCase().includes(itemQuery.toLowerCase()) ||
        it.item_code.toLowerCase().includes(itemQuery.toLowerCase())
      )
    : items

  const todayStr = new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  const deliveryStr = deliveryDate
    ? new Date(deliveryDate + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Purchase Orders</h2>
          <p className="text-muted-foreground text-sm">Manage supplier purchase orders, track deliveries and payments</p>
        </div>
        {open ? (
          <Button variant="outline" onClick={() => { setOpen(false); resetForm() }}>
            <X className="h-4 w-4 mr-2" />Cancel
          </Button>
        ) : (
          <Button onClick={() => { resetForm(); setOpen(true) }} className="bg-red-600 hover:bg-red-700">
            <Plus className="h-4 w-4 mr-2" />Create PO
          </Button>
        )}
      </div>

      {!open && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold">{loading ? '—' : fmt(counts.total)}</div>
            <div className="text-sm text-muted-foreground">Total PO Value</div>
          </CardContent></Card>
          <Card><CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold text-blue-600">{loading ? '—' : counts.open}</div>
            <div className="text-sm text-muted-foreground">Open Orders</div>
          </CardContent></Card>
          <Card><CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold text-yellow-600">{loading ? '—' : counts.partial}</div>
            <div className="text-sm text-muted-foreground">Partial Delivery</div>
          </CardContent></Card>
          <Card><CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold text-green-600">{loading ? '—' : counts.completed}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </CardContent></Card>
        </div>
      )}

      {/* PO Pipeline */}
      {!open && (
        <Card>
          <CardHeader className="pb-0 pt-4 px-4">
            <button
              className="flex items-center justify-between w-full text-left"
              onClick={() => setPipelineOpen(o => !o)}
            >
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-red-600" />
                Purchase Order Pipeline — Next Actions
              </CardTitle>
              {pipelineOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CardHeader>
          {pipelineOpen && (
            <CardContent className="p-0 mt-3">
              <div className="grid grid-cols-5 text-center text-[10px] font-semibold uppercase tracking-wider border-b border-t">
                {[
                  { label: 'PO Created',  color: 'text-blue-600 bg-blue-50' },
                  { label: 'Receiving',   color: 'text-yellow-600 bg-yellow-50' },
                  { label: 'DR Logged',   color: 'text-orange-600 bg-orange-50' },
                  { label: 'CSI Issued',  color: 'text-purple-600 bg-purple-50' },
                  { label: 'Collected',   color: 'text-green-600 bg-green-50' },
                ].map(s => (
                  <div key={s.label} className={`py-2 ${s.color}`}>{s.label}</div>
                ))}
              </div>
              {loading ? (
                <div className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>
              ) : pos.filter(p => p.status === 'open' || p.status === 'partially_delivered').length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">No open purchase orders</div>
              ) : (
                <div className="divide-y max-h-64 overflow-y-auto">
                  {pos.filter(p => p.status === 'open' || p.status === 'partially_delivered').map(po => {
                    const supplierName = (po.supplier as any)?.company_name ?? ''
                    const isReceived = receivedPONums.has(po.po_number ?? '')
                    const hasCsi = csiSuppliers.has(supplierName)
                    const hasOr = collectedSuppliers.has(supplierName)
                    const stages = [
                      { done: true,       label: po.po_number ?? '—', sub: STATUS_CFG[po.status]?.label ?? po.status },
                      { done: isReceived, label: isReceived ? 'Received' : 'Pending' },
                      { done: isReceived, label: isReceived ? 'Expected' : '—' },
                      { done: hasCsi,     label: hasCsi ? 'Issued' : 'Pending' },
                      { done: hasOr,      label: hasOr  ? 'Collected' : 'Pending' },
                    ]
                    return (
                      <div key={po.id} className="grid grid-cols-5 text-center text-xs">
                        {stages.map((s, i) => (
                          <div key={i} className={`py-2 px-1 border-r last:border-r-0 ${s.done ? '' : 'opacity-40'}`}>
                            <div className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold mx-auto mb-0.5 ${s.done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                              {s.done ? '✓' : (i + 1)}
                            </div>
                            <div className="font-medium truncate px-1">{s.label}</div>
                            {s.sub && <div className="text-[10px] text-muted-foreground">{s.sub}</div>}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* PO List */}
      {!open && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Purchase Order List</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>PR Ref</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>PO Date</TableHead>
                  <TableHead>Delivery Date</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">VAT 12%</TableHead>
                  <TableHead className="text-right">EWT</TableHead>
                  <TableHead className="text-right">Net Payable</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : displayedPos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                      No purchase orders yet. Click <strong>Create PO</strong> to get started.
                    </TableCell>
                  </TableRow>
                ) : displayedPos.map(po => {
                  const sCfg = STATUS_CFG[po.status] ?? STATUS_CFG.open
                  return (
                    <TableRow key={po.id}>
                      <TableCell className="font-mono text-xs font-semibold text-red-600">{po.po_number ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{(po.pr as any)?.pr_number ?? '—'}</TableCell>
                      <TableCell className="font-medium text-sm">{(po.supplier as any)?.company_name ?? '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {po.po_date ? format(new Date(po.po_date), 'MMM d, yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {po.delivery_date ? format(new Date(po.delivery_date), 'MMM d, yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm">{fmt(po.subtotal ?? 0)}</TableCell>
                      <TableCell className="text-right text-sm text-blue-600">{fmt(po.vat_amount ?? 0)}</TableCell>
                      <TableCell className="text-right text-sm text-red-700">{fmt(po.ewt_amount ?? 0)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(po.net_payable ?? 0)}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sCfg.cls}`}>{sCfg.label}</span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent">
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => setViewPO(po)}>
                              <Eye className="mr-2 h-4 w-4" />View PO
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(po)}>
                              <Pencil className="mr-2 h-4 w-4" />Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePrintPO(po)}>
                              <Printer className="mr-2 h-4 w-4" />Print PO
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEmailDialog(po)}>
                              <Mail className="mr-2 h-4 w-4" />Send Email
                            </DropdownMenuItem>
                            {po.status === 'open' && (
                              <DropdownMenuItem onClick={() => updateStatus(po.id, 'partially_delivered')} className="text-yellow-600">
                                <ArrowRightLeft className="mr-2 h-4 w-4" />Mark Partial Delivery
                              </DropdownMenuItem>
                            )}
                            {(po.status === 'open' || po.status === 'partially_delivered') && (
                              <DropdownMenuItem onClick={() => updateStatus(po.id, 'completed')} className="text-green-600">
                                <CheckCircle2 className="mr-2 h-4 w-4" />Mark Completed
                              </DropdownMenuItem>
                            )}
                            {po.status !== 'cancelled' && po.status !== 'completed' && (
                              <DropdownMenuItem onClick={() => updateStatus(po.id, 'cancelled')} className="text-destructive">
                                <XCircle className="mr-2 h-4 w-4" />Cancel PO
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => deletePO(po.id)} className="text-destructive">
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

      {/* ── Inline Create PO Form ── */}
      {open && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* LEFT: Form */}
          <div className="space-y-1">
            {/* Mobile tab toggle */}
            <div className="flex gap-2 lg:hidden mb-3">
              <Button size="sm" variant={activeTab === 'form' ? 'default' : 'outline'}
                className={activeTab === 'form' ? 'bg-red-600 hover:bg-red-700' : ''}
                onClick={() => setActiveTab('form')}>Form</Button>
              <Button size="sm" variant={activeTab === 'preview' ? 'default' : 'outline'}
                className={activeTab === 'preview' ? 'bg-red-600 hover:bg-red-700' : ''}
                onClick={() => setActiveTab('preview')}>Preview</Button>
            </div>

            <div className={activeTab === 'preview' ? 'hidden lg:block' : 'block'}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />Purchase Order Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">

                  {/* PO Number + Delivery Date */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>PO Number</Label>
                      <Input placeholder="Enter PO number" value={poNumber} onChange={e => setPoNumber(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Delivery Date</Label>
                      <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
                    </div>
                  </div>

                  {/* Supplier */}
                  <div className="space-y-1.5">
                    <Label>Supplier <span className="text-destructive">*</span></Label>
                    <div className="flex gap-1">
                      <Select value={supplierId} onValueChange={v => {
                        setSupplierId(v ?? '')
                        const sup = suppliers.find(s => s.id === v)
                        if (sup?.payment_terms) setPaymentTerms(sup.payment_terms)
                      }}>
                        <SelectTrigger className="flex-1">
                          {supplierId
                            ? <span className="truncate text-sm">{suppliers.find(s => s.id === supplierId)?.company_name}</span>
                            : <span className="text-muted-foreground text-sm">Select supplier…</span>}
                        </SelectTrigger>
                        <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>)}</SelectContent>
                      </Select>
                      {supplierId && (
                        <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setSupplierId('')}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Payment Terms */}
                  <div className="space-y-1.5">
                    <Label>Payment Terms</Label>
                    <Select value={paymentTerms} onValueChange={v => setPaymentTerms(v ?? '30 days')}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['COD', '7 days', '15 days', '30 days', '45 days', '60 days'].map(t =>
                          <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Remarks */}
                  <div className="space-y-1.5">
                    <Label>Remarks / Notes</Label>
                    <textarea
                      className="w-full min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                      rows={2}
                      placeholder="Notes, special instructions…"
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                    />
                  </div>

                  {/* Prepared By / Approved By */}
                  <div className="grid grid-cols-2 gap-3">
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
                      <Label>Approved By</Label>
                      <textarea
                        className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                        rows={2}
                        placeholder="Name / Position"
                        value={approvedBy}
                        onChange={e => setApprovedBy(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Discount */}
                  <div className="space-y-1.5">
                    <Label>Discount</Label>
                    <div className="flex gap-2 flex-wrap">
                      {(['none', '2', '5', 'custom'] as const).map(opt => (
                        <button key={opt} type="button" onClick={() => setDiscountType(opt)}
                          className={`px-3 py-1.5 text-sm rounded-md border font-medium transition-colors ${discountType === opt ? 'bg-red-600 text-white border-red-600' : 'bg-background text-muted-foreground hover:bg-muted border-input'}`}>
                          {opt === 'none' ? 'None' : opt === 'custom' ? 'Custom' : `${opt}%`}
                        </button>
                      ))}
                      {discountType === 'custom' && (
                        <Input type="number" min={0} max={100} step="0.1" placeholder="0.0"
                          value={discountCustom} onChange={e => setDiscountCustom(e.target.value)} className="w-24 h-9" />
                      )}
                    </div>
                  </div>

                  {/* EWT */}
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

                  {/* Line Items */}
                  <div className="space-y-2">
                    <Label>Line Items</Label>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="min-w-[160px]">Item Description</TableHead>
                            <TableHead className="w-16">Qty</TableHead>
                            <TableHead className="w-16">Unit</TableHead>
                            <TableHead className="w-28">Unit Price <span className="font-normal text-muted-foreground text-[10px]">(ref)</span></TableHead>
                            <TableHead className="w-32">Selling Price</TableHead>
                            <TableHead className="w-24 text-right">Amount</TableHead>
                            <TableHead className="w-8"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lines.map((line, i) => {
                            const lineTotal = (parseFloat(line.selling_price) || 0) * (parseFloat(line.quantity) || 0)
                            const itemMeta = items.find(it => it.item_name === line.item_name)
                            const statusCfg = itemMeta ? (ITEM_STATUS_CFG[itemMeta.status] ?? ITEM_STATUS_CFG.active) : null
                            const stockQty = line.item_name ? (warehouseStock[line.item_name] ?? 0) : null
                            const needsToBuy = itemMeta && (itemMeta.status === 'low_stock' || itemMeta.status === 'out_of_stock')
                            return (
                              <TableRow key={i}>
                                <TableCell className="py-1.5 align-top">
                                  <div className="flex gap-1 min-w-0">
                                    <Select value={line.item_name} onValueChange={val => {
                                      const selected = activeItems.find(it => it.item_name === val)
                                      const autoSell = selected?.selling_price ?? null
                                      setLines(p => p.map((l, idx) => idx === i ? {
                                        ...l, item_name: val ?? '',
                                        quantity: l.quantity || '1',
                                        unit: selected?.unit_of_measure || l.unit,
                                        unit_price: selected?.cost != null ? String(selected.cost) : l.unit_price,
                                        selling_price: autoSell !== null ? String(autoSell) : l.selling_price,
                                      } : l))
                                    }}>
                                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Select item…" /></SelectTrigger>
                                      <SelectContent>
                                        {activeItems.map(it => <SelectItem key={it.item_code} value={it.item_name}>{it.item_name}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                    <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" title="Search inventory"
                                      onClick={() => { setItemSearchIdx(i); setItemQuery('') }}>
                                      <Package className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                  {(statusCfg || stockQty !== null) && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {statusCfg && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusCfg.cls}`}>{statusCfg.label}</span>}
                                      {stockQty !== null && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${stockQty > 0 ? 'bg-slate-100 text-slate-600' : 'bg-red-50 text-red-600'}`}>{stockQty > 0 ? `${stockQty.toLocaleString()} in stock` : 'Out of stock'}</span>}
                                      {needsToBuy && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-orange-50 text-orange-700 border border-orange-200">⚠ Need to buy from Supplier</span>}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <Input type="number" min={1} className="h-8 text-xs w-full min-w-[64px]" placeholder="1" value={line.quantity}
                                    onChange={e => setLines(p => p.map((l, idx) => idx === i ? { ...l, quantity: e.target.value } : l))} />
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <div className="h-8 flex items-center px-2 text-xs bg-muted/40 rounded border text-muted-foreground">{line.unit || '—'}</div>
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <Input type="number" min={0} step="0.01" className="h-8 text-xs" placeholder="0.00" value={line.unit_price}
                                    onChange={e => setLines(p => p.map((l, idx) => idx === i ? { ...l, unit_price: e.target.value } : l))} />
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <div className="flex gap-1 items-center">
                                    <Input type="number" min={0} step="0.01" className="h-8 text-xs flex-1 min-w-0" placeholder="0.00" value={line.selling_price}
                                      onChange={e => setLines(p => p.map((l, idx) => idx === i ? { ...l, selling_price: e.target.value } : l))} />
                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-7 shrink-0 text-muted-foreground hover:text-blue-600"
                                      title="Update item default selling price (affects future records only)"
                                      onClick={() => updateItemSellingPrice(line.item_name, line.selling_price)}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                                <TableCell className="py-1.5 text-right text-xs font-medium">{fmt(lineTotal)}</TableCell>
                                <TableCell className="py-1.5">
                                  {lines.length > 1 && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                      onClick={() => setLines(p => p.filter((_, idx) => idx !== i))}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setLines(p => [...p, emptyLine()])}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" />Add Item
                    </Button>
                  </div>

                  {/* Totals summary */}
                  <div className="rounded-lg bg-muted/30 p-4 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(subtotal)}</span></div>
                    {discountRate > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount ({discountRate}%)</span><span className="text-orange-600">− {fmt(discountAmount)}</span></div>}
                    {discountRate > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Net Subtotal</span><span>{fmt(netSubtotal)}</span></div>}
                    <div className="flex justify-between"><span className="text-muted-foreground">Input VAT (12%)</span><span className="text-blue-600">{fmt(vatAmount)}</span></div>
                    {ewtType !== 'none' && <div className="flex justify-between"><span className="text-muted-foreground">{taxLabel} ({ewtCfg.rate * 100}%)</span><span className="text-red-700">− {fmt(taxAmount)}</span></div>}
                    <div className="h-px bg-border my-1" />
                    <div className="flex justify-between font-bold"><span>Net Payable</span><span className="text-red-600">{fmt(netPayable)}</span></div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => { setOpen(false); resetForm() }}>Cancel</Button>
                    <Button type="button" variant="outline" className="gap-1.5" onClick={handlePrint}>
                      <Printer className="h-4 w-4" />Print
                    </Button>
                    <Button type="button" variant="outline" className="gap-1.5" onClick={() => openEmailDialog()}>
                      <Mail className="h-4 w-4" />Email
                    </Button>
                    <Button onClick={submitPO} disabled={saving} className="bg-red-600 hover:bg-red-700">
                      {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</> : 'Create Purchase Order'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

              {/* RIGHT: Live preview */}
              <div className={`${activeTab === 'form' ? 'hidden lg:block' : 'block'}`}>
                <div className="sticky top-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live Preview</p>
                    <div className="flex gap-1.5">
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handlePrint}>
                        <Printer className="h-3.5 w-3.5" />Print
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => openEmailDialog()}>
                        <Mail className="h-3.5 w-3.5" />Email
                      </Button>
                    </div>
                  </div>

                  <div ref={printRef} className="border rounded-lg bg-white text-[11px] p-5 shadow-sm space-y-3 font-sans">
                    {/* Header: Logo + Company Name (left) | Address / Phone / TIN (right) */}
                    <div className="flex justify-between items-start border-b pb-3">
                      {/* Left: logo + company name */}
                      <div className="flex items-center gap-2.5">
                        <img src="/cdsc-logo.jpg" alt="CDSC" className="h-12 w-12 rounded object-cover shrink-0" />
                        <div className="text-[13px] font-bold text-red-700 leading-tight">
                          {companyInfo?.company_name || 'CDSC INDUSTRIAL'}
                        </div>
                      </div>

                      {/* Right: address / phone / TIN */}
                      <div className="text-right text-[9px] text-gray-500 space-y-0.5">
                        {companyInfo?.address && <div>{companyInfo.address}</div>}
                        {(companyInfo?.phone || companyInfo?.email) && (
                          <div>{companyInfo.phone}{companyInfo.phone && companyInfo.email ? ' | ' : ''}{companyInfo.email}</div>
                        )}
                        {companyInfo?.tin && <div>TIN: {companyInfo.tin}</div>}
                      </div>
                    </div>

                    {/* Party row: Supplier/Client (left) | PURCHASE ORDER (center) | PO# / Date (right) */}
                    <div className="grid grid-cols-3 gap-3 border-b pb-3">
                      {/* Left */}
                      <div className="space-y-0.5">
                        <div className="text-[9px] font-semibold uppercase text-gray-400">Supplier</div>
                        <div className="font-semibold text-gray-800 text-[11px]">
                          {supplierId
                            ? suppliers.find(s => s.id === supplierId)?.company_name || '—'
                            : <span className="text-gray-400 italic font-normal">Not selected</span>}
                        </div>
                        <div className="text-[9px] font-semibold uppercase text-gray-400 mt-1.5">Payment Terms</div>
                        <div className="text-gray-700">{paymentTerms || '—'}</div>
                        {remarks && (
                          <div className="mt-1.5">
                            <div className="text-[9px] font-semibold uppercase text-gray-400">Remarks</div>
                            <div className="text-gray-700 text-[10px]">{remarks}</div>
                          </div>
                        )}
                      </div>
                      {/* Center: document title */}
                      <div className="flex items-center justify-center">
                        <div className="text-[16px] font-extrabold text-red-700 uppercase tracking-widest text-center leading-tight">
                          Purchase<br />Order
                        </div>
                      </div>
                      {/* Right: PO Number / Date */}
                      <div className="space-y-0.5 text-right">
                        <div className="text-[9px] font-semibold uppercase text-gray-400">PO Number</div>
                        <div className="font-mono font-bold text-gray-800">{poNumber || '—'}</div>
                        <div className="text-[9px] font-semibold uppercase text-gray-400 mt-1.5">Date</div>
                        <div className="text-gray-700">{todayStr}</div>
                        {deliveryStr && (
                          <>
                            <div className="text-[9px] font-semibold uppercase text-gray-400 mt-1.5">Delivery Date</div>
                            <div className="text-gray-700">{deliveryStr}</div>
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
                          <th className="text-right px-1.5 py-1 w-20">Unit Price</th>
                          <th className="text-right px-1.5 py-1 w-20">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line, i) => {
                          const total = (parseFloat(line.selling_price) || 0) * (parseFloat(line.quantity) || 0)
                          return (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-1.5 py-1 text-gray-400">{i + 1}</td>
                              <td className="px-1.5 py-1">{line.item_name || <span className="text-gray-300 italic">—</span>}</td>
                              <td className="px-1.5 py-1 text-right font-bold text-gray-800">{line.quantity || '—'}</td>
                              <td className="px-1.5 py-1 text-gray-500">{line.unit || '—'}</td>
                              <td className="px-1.5 py-1 text-right">₱{(parseFloat(line.selling_price) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
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
                        {discountRate > 0 && <div className="flex justify-between"><span className="text-gray-500">Discount ({discountRate}%)</span><span className="text-orange-600">−₱{discountAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>}
                        {discountRate > 0 && <div className="flex justify-between"><span className="text-gray-500">Net Subtotal</span><span>₱{netSubtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>}
                        <div className="flex justify-between"><span className="text-gray-500">VAT (12%)</span><span className="text-blue-600">₱{vatAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
                        {ewtType !== 'none' && <div className="flex justify-between"><span className="text-gray-500">{taxLabel}</span><span className="text-red-700">−₱{taxAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>}
                        <div className="flex justify-between border-t pt-0.5 font-bold text-[11px]"><span>Net Payable</span><span className="text-red-700">₱{netPayable.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
                      </div>
                    </div>

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
                          {approvedBy && <span className="text-[10px] font-medium text-gray-700">{approvedBy}</span>}
                        </div>
                        <div className="text-[9px] text-gray-400 uppercase tracking-wider">Approved By</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

      )}

      {/* View PO Dialog */}
      <Dialog open={!!viewPO} onOpenChange={o => { if (!o) setViewPO(null) }}>
        <DialogContent className="w-[98vw] sm:!max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />Purchase Order — {viewPO?.po_number ?? '—'}
            </DialogTitle>
          </DialogHeader>
          {viewPO && (() => {
            const vSupplier = (viewPO.supplier as any)?.company_name ?? null
            const vDiscount = viewPO.discount_rate ?? 0
            const vDiscountAmt = viewPO.discount_amount ?? 0
            const vNetSub = viewPO.subtotal - vDiscountAmt
            const vTaxAmt = (viewPO.ewt_amount ?? 0) > 0 ? viewPO.ewt_amount : (viewPO.cwt_amount ?? 0)
            const vTaxLabel = (viewPO.ewt_amount ?? 0) > 0 ? 'EWT' : 'CWT'
            const vPoDate = viewPO.po_date ? new Date(viewPO.po_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : null
            const vDelDate = viewPO.delivery_date ? new Date(viewPO.delivery_date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : null
            const sCfg = STATUS_CFG[viewPO.status] ?? STATUS_CFG.open
            return (
              <div className="border rounded-lg bg-white text-[11px] p-5 shadow-sm space-y-3 font-sans">
                {/* Header */}
                <div className="flex justify-between items-start border-b pb-3">
                  <div className="flex items-center gap-2.5">
                    <img src="/cdsc-logo.jpg" alt="CDSC" className="h-12 w-12 rounded object-cover shrink-0" />
                    <div className="text-[13px] font-bold text-red-700 leading-tight">
                      {companyInfo?.company_name || 'CDSC INDUSTRIAL'}
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

                {/* Party / Title / Meta */}
                <div className="grid grid-cols-3 gap-3 border-b pb-3">
                  <div className="space-y-0.5">
                    <div className="text-[9px] font-semibold uppercase text-gray-400">Supplier / Client</div>
                    <div className="font-semibold text-gray-800 text-[11px]">{vSupplier ?? '—'}</div>
                    <div className="text-[9px] font-semibold uppercase text-gray-400 mt-1.5">Payment Terms</div>
                    <div className="text-gray-700">{viewPO.payment_terms || '—'}</div>
                    {viewPO.remarks && (
                      <div className="mt-1.5">
                        <div className="text-[9px] font-semibold uppercase text-gray-400">Remarks</div>
                        <div className="text-gray-700 text-[10px]">{viewPO.remarks}</div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-center justify-center gap-1">
                    <div className="text-[16px] font-extrabold text-red-700 uppercase tracking-widest text-center leading-tight">Purchase<br />Order</div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${sCfg.cls}`}>{sCfg.label}</span>
                  </div>
                  <div className="space-y-0.5 text-right">
                    <div className="text-[9px] font-semibold uppercase text-gray-400">PO Number</div>
                    <div className="font-mono font-bold text-gray-800">{viewPO.po_number || '—'}</div>
                    {vPoDate && <><div className="text-[9px] font-semibold uppercase text-gray-400 mt-1.5">Date</div><div className="text-gray-700">{vPoDate}</div></>}
                    {vDelDate && <><div className="text-[9px] font-semibold uppercase text-gray-400 mt-1.5">Delivery Date</div><div className="text-gray-700">{vDelDate}</div></>}
                  </div>
                </div>

                {/* Totals */}
                <div className="flex justify-end">
                  <div className="w-56 space-y-0.5 text-[10px]">
                    <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>₱{(viewPO.subtotal ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
                    {vDiscount > 0 && <div className="flex justify-between"><span className="text-gray-500">Discount ({vDiscount}%)</span><span className="text-orange-600">−₱{vDiscountAmt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>}
                    {vDiscount > 0 && <div className="flex justify-between"><span className="text-gray-500">Net Subtotal</span><span>₱{vNetSub.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>}
                    <div className="flex justify-between"><span className="text-gray-500">VAT (12%)</span><span className="text-blue-600">₱{(viewPO.vat_amount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">{vTaxLabel}</span><span className="text-red-700">−₱{(vTaxAmt ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between border-t pt-0.5 font-bold text-[11px]"><span>Net Payable</span><span className="text-red-700">₱{(viewPO.net_payable ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
                  </div>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-6 border-t pt-4 mt-1">
                  <div className="text-center">
                    <div className="border-b border-gray-400 mb-1 h-8" />
                    <div className="text-[9px] text-gray-400 uppercase tracking-wider">Prepared By</div>
                  </div>
                  <div className="text-center">
                    <div className="border-b border-gray-400 mb-1 h-8" />
                    <div className="text-[9px] text-gray-400 uppercase tracking-wider">Approved By</div>
                  </div>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Item Search Dialog */}
      <Dialog open={itemSearchIdx !== null} onOpenChange={o => { if (!o) setItemSearchIdx(null) }}>
        <DialogContent className="w-[98vw] sm:!max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" />Item Inventory
            </DialogTitle>
          </DialogHeader>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search by item name or code…"
              className="pl-9"
              value={itemQuery}
              onChange={e => setItemQuery(e.target.value)}
            />
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-auto border rounded-lg">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-[35%]">Item Name</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-[15%]">Code</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-[8%]">Unit</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground w-[10%]">Cost</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground w-[10%]">Selling</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground w-[12%]">In Warehouse</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-[10%]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredSearchItems.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-6 text-muted-foreground text-sm">No items found.</td></tr>
                ) : filteredSearchItems.map(it => {
                  const sCfg = ITEM_STATUS_CFG[it.status] ?? ITEM_STATUS_CFG.active
                  const qty = warehouseStock[it.item_name] ?? 0
                  return (
                    <tr
                      key={it.item_code}
                      className="hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => {
                        if (itemSearchIdx !== null) {
                          setLines(p => p.map((l, idx) => idx === itemSearchIdx
                            ? {
                                ...l,
                                item_name: it.item_name,
                                quantity: l.quantity || '1',
                                unit: it.unit_of_measure,
                                unit_price: it.cost != null ? String(it.cost) : l.unit_price,
                                selling_price: it.selling_price != null ? String(it.selling_price) : l.selling_price,
                              }
                            : l))
                        }
                        setItemSearchIdx(null)
                      }}
                    >
                      <td className="px-3 py-2 font-medium">{it.item_name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{it.item_code}</td>
                      <td className="px-3 py-2 text-muted-foreground">{it.unit_of_measure}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {it.cost != null ? `₱${Number(it.cost).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-green-700">
                        {it.selling_price != null ? `₱${Number(it.selling_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={`font-bold tabular-nums text-sm ${qty > 0 ? 'text-green-700' : 'text-red-500'}`}>
                          {qty > 0 ? qty.toLocaleString() : '0'}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">{it.unit_of_measure}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sCfg.cls}`}>{sCfg.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Email Dialog */}
      <Dialog open={showEmail} onOpenChange={setShowEmail}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" />Send Purchase Order by Email
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input
                type="email"
                placeholder="supplier@example.com"
                value={emailTo}
                onChange={e => setEmailTo(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                placeholder="Subject…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Body</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                rows={7}
                value={emailBody}
                onChange={e => setEmailBody(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The email will be sent from cdsc.gmot@gmail.com with the PO attached as a PDF.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setShowEmail(false)}>Cancel</Button>
              <Button onClick={handleSendEmail} className="bg-red-600 hover:bg-red-700 gap-1.5">
                <Send className="h-4 w-4" />Send Email
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
