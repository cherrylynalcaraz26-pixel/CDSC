'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, SortableTableHead } from '@/components/ui/table'
import { useTableSort } from '@/lib/use-table-sort'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

import {
  Plus, Printer, Loader2,
  Trash2, CheckCircle2, XCircle, ArrowRightLeft, X,
  Package, Search, Mail, Send, Pencil, FileText,
  ChevronDown, ChevronUp, Wallet, Clock3, AlertCircle, Store, GripVertical, Paperclip,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useSearchContext } from '@/context/search-context'
import { sendEmail, POPdfData } from '@/lib/send-email'
import { uploadFileToDrive, uploadImageToDrive, isImageAttachment, isPdfAttachment, driveImageSrc, driveEmbedUrl } from '@/lib/upload-image'

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
  open:                { label: 'Pending',          cls: 'bg-blue-100 text-blue-700' },
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
  invoice_no?: string | null
}

interface Supplier { id: string; company_name: string; payment_terms: string | null; ewt_rate: number | null; email: string | null }
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
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form')
  const [companyInfo, setCompanyInfo] = useState<{
    company_name: string; address: string; phone: string; email: string; tin: string; logo_url?: string
  } | null>(null)

  // Form state
  const [supplierId, setSupplierId] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('30 days')
  const [remarks, setRemarks] = useState('')
  const [lines, setLines] = useState<POLine[]>([emptyLine()])
  const [dragLineIdx, setDragLineIdx] = useState<number | null>(null)

  function reorderLines(from: number, to: number) {
    if (from === to) return
    setLines(prev => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }
  const [discountType, setDiscountType] = useState<'none' | '2' | '5' | 'custom'>('none')
  const [discountCustom, setDiscountCustom] = useState('')
  const discountRate = discountType === 'none' ? 0 : discountType === 'custom' ? (parseFloat(discountCustom) || 0) : parseFloat(discountType)

  // Warehouse stock map: item_name → total qty
  const [warehouseStock, setWarehouseStock] = useState<Record<string, number>>({})

  // Item search modal
  const [itemSearchIdx, setItemSearchIdx] = useState<number | null>(null)
  const [itemQuery, setItemQuery] = useState('')

  // Add Item — lets purchasing add a brand-new catalog item straight from the
  // Item Inventory search modal, without leaving the PO to use Items/Categories.
  const [addItemOpen, setAddItemOpen] = useState(false)
  const [newItemForm, setNewItemForm] = useState({ item_name: '', unit_of_measure: 'piece', cost: '', selling_price: '' })
  const [savingNewItem, setSavingNewItem] = useState(false)

  function openAddItem() {
    setNewItemForm({ item_name: itemQuery.trim(), unit_of_measure: 'piece', cost: '', selling_price: '' })
    setAddItemOpen(true)
  }

  // Derives a short letters-only prefix from the item name (e.g. "Steel Pipe" -> "STE")
  // so the auto-generated code reads as related to the item instead of a plain running number.
  function deriveItemCodePrefix(name: string): string {
    const cleaned = name.replace(/[^a-zA-Z]/g, '').toUpperCase()
    return cleaned.slice(0, 3) || 'ITM'
  }

  async function saveNewItem() {
    const name = newItemForm.item_name.trim()
    if (!name) { toast.error('Item name is required'); return }
    setSavingNewItem(true)
    const prefix = deriveItemCodePrefix(name)
    const { data: last } = await supabase
      .from('items')
      .select('item_code')
      .like('item_code', `${prefix}-%`)
      .order('item_code', { ascending: false })
      .limit(1)
      .single()
    let next = 1
    if (last?.item_code) {
      const num = parseInt(last.item_code.replace(`${prefix}-`, ''), 10)
      if (!isNaN(num)) next = num + 1
    }
    const item_code = `${prefix}-${String(next).padStart(3, '0')}`
    const unit_of_measure = newItemForm.unit_of_measure.trim() || 'piece'
    const cost = newItemForm.cost.trim() ? parseFloat(newItemForm.cost) : null
    const selling_price = newItemForm.selling_price.trim() ? parseFloat(newItemForm.selling_price) : null

    const { error } = await supabase.from('items').insert({
      item_code, item_name: name, unit_of_measure, cost, selling_price, status: 'active',
    })
    if (error) { toast.error(error.message); setSavingNewItem(false); return }

    const newOption: ItemOption = { item_code, item_name: name, unit_of_measure, status: 'active', cost, selling_price }
    setItems(prev => [...prev, newOption].sort((a, b) => a.item_name.localeCompare(b.item_name)))
    if (itemSearchIdx !== null) {
      setLines(p => p.map((l, idx) => idx === itemSearchIdx
        ? { ...l, item_name: name, quantity: l.quantity || '1', unit: unit_of_measure, unit_price: cost != null ? String(cost) : l.unit_price, selling_price: selling_price != null ? String(selling_price) : l.selling_price }
        : l))
    }
    toast.success('Item added')
    setSavingNewItem(false)
    setAddItemOpen(false)
    setItemSearchIdx(null)
  }

  // Vendor catalog browser — lets purchasing pick items straight from the
  // selected supplier's own catalog instead of typing them from scratch.
  const [vendorCatalogOpen, setVendorCatalogOpen] = useState(false)
  const [vendorCatalogLoading, setVendorCatalogLoading] = useState(false)
  const [vendorCatalogItems, setVendorCatalogItems] = useState<{ id: string; item_name: string; description: string | null; unit_of_measure: string; price: number | null; image_url: string | null }[]>([])
  const [vendorCatalogQuery, setVendorCatalogQuery] = useState('')

  // Details modal (row click)
  const [viewPO, setViewPO] = useState<PO | null>(null)
  const [viewPOItems, setViewPOItems] = useState<{ item_name: string; quantity: number; quantity_received: number; unit: string | null; unit_price: number; selling_price: number | null; total_amount: number }[]>([])
  const [viewPOAttachments, setViewPOAttachments] = useState<{ id: string; file_url: string; file_name: string }[]>([])
  const [uploadingPOAttachment, setUploadingPOAttachment] = useState(false)
  const [previewAttachment, setPreviewAttachment] = useState<{ url: string; name: string } | null>(null)
  const [poAttachmentCounts, setPoAttachmentCounts] = useState<Record<string, number>>({})

  async function openDetails(po: PO) {
    setViewPO(po)
    const { data } = await supabase.from('po_items').select('item_name,quantity,quantity_received,unit_of_measure,unit_cost,selling_price,total_cost').eq('po_id', po.id).order('created_at')
    setViewPOItems((data ?? []).map(r => ({ item_name: r.item_name, quantity: r.quantity, quantity_received: Number(r.quantity_received) || 0, unit: r.unit_of_measure, unit_price: r.unit_cost, selling_price: r.selling_price, total_amount: r.total_cost })))
    await loadPOAttachments(po.po_number)
  }

  async function loadPOAttachments(poNumber: string | null) {
    if (!poNumber) { setViewPOAttachments([]); return }
    const { data } = await supabase.from('po_attachments').select('id, file_url, file_name').eq('po_number', poNumber).order('uploaded_at')
    setViewPOAttachments(data ?? [])
  }

  async function uploadPOAttachments(poNumber: string | null, files: FileList | null) {
    if (!poNumber || !files || files.length === 0) return
    setUploadingPOAttachment(true)
    try {
      for (const file of Array.from(files)) {
        // Images go through uploadImageToDrive so file_url is a directly-renderable
        // thumbnail src; everything else keeps the generic Drive viewer link.
        const url = file.type.startsWith('image/')
          ? await uploadImageToDrive(file, { folder: 'PO Attachments' })
          : (await uploadFileToDrive(file, { folder: 'PO Attachments' })).url
        await supabase.from('po_attachments').insert({ po_number: poNumber, file_url: url, file_name: file.name })
      }
      await loadPOAttachments(poNumber)
      setPoAttachmentCounts(prev => ({ ...prev, [poNumber]: (prev[poNumber] ?? 0) + files.length }))
      toast.success('Attachment(s) uploaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload attachment')
    } finally {
      setUploadingPOAttachment(false)
    }
  }

  async function deletePOAttachment(id: string, poNumber: string | null) {
    const { error } = await supabase.from('po_attachments').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    await loadPOAttachments(poNumber)
    if (poNumber) setPoAttachmentCounts(prev => ({ ...prev, [poNumber]: Math.max(0, (prev[poNumber] ?? 1) - 1) }))
  }

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null)

  // Pipeline
  const [pipelineOpen, setPipelineOpen] = useState(false)
  const [receivedPONums, setReceivedPONums] = useState<Set<string>>(new Set())
  const [csiSuppliers, setCsiSuppliers] = useState<Set<string>>(new Set())
  const [collectedSuppliers, setCollectedSuppliers] = useState<Set<string>>(new Set())

  // VAT mode
  const [vatInclusive, setVatInclusive] = useState(false)

  // EWT
  const [ewtType, setEwtType] = useState<EWTType>('services')

  // Prepared By / Approved By
  const [preparedBy, setPreparedBy] = useState('')
  const [approvedBy, setApprovedBy] = useState('')

  // Email modal
  const [showEmail, setShowEmail] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
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
        .select('*, supplier:suppliers(company_name)')
        .order('created_at', { ascending: false }),
      supabase.from('suppliers').select('id, company_name, payment_terms, ewt_rate, email').eq('is_active', true).order('company_name'),
      supabase.from('items').select('item_code, item_name, unit_of_measure, status, cost, selling_price').order('item_name'),
    ])
    setPOs((poData ?? []) as PO[])
    setSuppliers(supData ?? [])
    setItems((itemData ?? []) as ItemOption[])
    const { data: sysData } = await supabase.from('system_settings').select('company_name, address, phone, email, tin, logo_url').single()
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
      fetchAllRows((from, to) => supabase.from('csi_records').select('client_name').order('id').range(from, to)).then(data => ({ data })),
      supabase.from('collections').select('client_name'),
    ])
    setReceivedPONums(new Set((rrData ?? []).map((r: any) => r.po_number).filter(Boolean)))
    setCsiSuppliers(new Set((csiData ?? []).map((r: any) => (r.client_name ?? '').trim()).filter(Boolean)))
    setCollectedSuppliers(new Set((colData ?? []).map((r: any) => (r.client_name ?? '').trim()).filter(Boolean)))

    const { data: attData } = await supabase.from('po_attachments').select('po_number')
    const attCounts: Record<string, number> = {}
    for (const r of attData ?? []) attCounts[r.po_number] = (attCounts[r.po_number] ?? 0) + 1
    setPoAttachmentCounts(attCounts)

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function openVendorCatalog() {
    if (!supplierId) { toast.error('Select a supplier first'); return }
    setVendorCatalogQuery('')
    setVendorCatalogOpen(true)
    setVendorCatalogLoading(true)
    const { data } = await supabase.from('vendor_catalog_items')
      .select('id, item_name, description, unit_of_measure, price, image_url')
      .eq('supplier_id', supplierId)
      .eq('is_active', true)
      .order('item_name')
    setVendorCatalogItems(data ?? [])
    setVendorCatalogLoading(false)
  }

  // Adds a picked catalog item into the first empty line, or appends a new one —
  // same pattern as picking from the item-search modal.
  function addLineFromVendorCatalog(it: { item_name: string; unit_of_measure: string; price: number | null }) {
    setLines(p => {
      const emptyIdx = p.findIndex(l => !l.item_name)
      const newLine: POLine = { item_name: it.item_name, quantity: '1', unit: it.unit_of_measure || 'piece', unit_price: it.price != null ? String(it.price) : '', selling_price: '' }
      if (emptyIdx !== -1) return p.map((l, idx) => idx === emptyIdx ? newLine : l)
      return [...p, newLine]
    })
    toast.success(`${it.item_name} added to line items`)
  }

  // Computed totals
  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.unit_price) || 0) * (parseFloat(l.quantity) || 0), 0)
  const selectedSupplier = suppliers.find(s => s.id === supplierId)
  const ewtCfg = EWT_CFG[ewtType]
  const taxRate = ewtCfg.rate
  const taxLabel = ewtType !== 'none' ? `EWT — ${ewtCfg.atc}` : 'EWT'

  const discountAmount = subtotal * (discountRate / 100)
  const netSubtotal = subtotal - discountAmount
  const vatAmount = vatInclusive ? netSubtotal * (0.12 / 1.12) : netSubtotal * 0.12
  // EWT is withheld on the VAT-exclusive amount. netSubtotal is already VAT-exclusive
  // unless vatInclusive is on, in which case the 12% baked into it must be stripped first.
  const taxAmount = (vatInclusive ? netSubtotal / 1.12 : netSubtotal) * taxRate
  const totalAmount = vatInclusive ? netSubtotal : netSubtotal + vatAmount
  const netPayable = subtotal - vatAmount

  function resetForm() {
    setEditingId(null)
    setSupplierId(''); setPoNumber(''); setDeliveryDate(''); setInvoiceNo('')
    setPaymentTerms('30 days'); setRemarks(''); setLines([emptyLine()])
    setActiveTab('form'); setDiscountType('none'); setDiscountCustom('')
    setEwtType('services'); setPreparedBy(''); setApprovedBy(''); setVatInclusive(false)
  }

  // Next sequential PO-<year>-NNNNN number, continuing the highest number already
  // used this year (falls back to 00001 if none yet) — same convention as the
  // existing PO-2026-000xx records.
  async function nextPoNumber() {
    const year = new Date().getFullYear()
    const prefix = `PO-${year}-`
    const { data } = await supabase
      .from('purchase_orders')
      .select('po_number')
      .ilike('po_number', `${prefix}%`)
      .order('po_number', { ascending: false })
      .limit(1)
    const lastNum = parseInt(data?.[0]?.po_number?.slice(prefix.length) ?? '0', 10) || 0
    return `${prefix}${String(lastNum + 1).padStart(5, '0')}`
  }

  async function handleOpenCreate() {
    resetForm()
    setPoNumber(await nextPoNumber())
    setViewPOAttachments([])
    setOpen(true)
  }

  function handleCancelClick() {
    const hasData = supplierId || poNumber || lines.some(l => l.item_name)
    if (hasData) { setDiscardConfirmOpen(true); return }
    setOpen(false); resetForm()
  }

  function discardForm() {
    setDiscardConfirmOpen(false)
    setOpen(false)
    resetForm()
  }

  async function openEdit(po: PO) {
    resetForm()
    setEditingId(po.id)
    setSupplierId((po.supplier as any)?.id ?? (po as any).supplier_id ?? '')
    setPoNumber(po.po_number ?? '')
    setDeliveryDate(po.delivery_date ?? '')
    setInvoiceNo(po.invoice_no ?? '')
    setPaymentTerms(po.payment_terms ?? '30 days')
    setRemarks(po.remarks ?? '')

    // Restore discount
    const dr = po.discount_rate ?? 0
    if (dr === 0) setDiscountType('none')
    else if (dr === 2) setDiscountType('2')
    else if (dr === 5) setDiscountType('5')
    else { setDiscountType('custom'); setDiscountCustom(String(dr)) }

    // Restore EWT type based on saved ewt_amount vs subtotal ratio
    if ((po.ewt_amount ?? 0) === 0) setEwtType('none')
    else setEwtType('services')

    // Load existing line items
    const { data: poItems } = await supabase
      .from('po_items')
      .select('item_name, quantity, unit_of_measure, unit_cost, selling_price')
      .eq('po_id', po.id)
      .order('created_at')

    if (poItems && poItems.length > 0) {
      setLines(poItems.map(r => ({
        item_name: r.item_name ?? '',
        quantity: String(r.quantity ?? 1),
        unit: r.unit_of_measure ?? '',
        unit_price: String(r.unit_cost ?? ''),
        selling_price: r.selling_price != null ? String(r.selling_price) : '',
      })))
    } else {
      setLines([emptyLine()])
      toast.info('No saved line items found for this PO. Please re-enter and save to persist them.')
    }

    await loadPOAttachments(po.po_number)
    setOpen(true)
  }

  async function updateItemUnitPrice(itemName: string, newPrice: string) {
    const price = parseFloat(newPrice)
    if (!itemName || isNaN(price) || price <= 0) {
      toast.error('Enter a valid unit price first')
      return
    }
    const { error } = await supabase.from('items').update({ cost: price }).eq('item_name', itemName)
    if (error) toast.error('Failed to update unit price')
    else toast.success(`Unit price updated to ₱${price.toLocaleString('en-PH', { minimumFractionDigits: 2 })} — affects future records only`)
  }

  async function submitPO() {
    if (!supplierId) { toast.error('Select a supplier'); return }
    setSaving(true)
    const payload = {
      po_number: poNumber || null,
      supplier_id: supplierId || null,
      invoice_no: invoiceNo || null,
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
      // Editing rewrites every line item from scratch — remember what was already
      // received per item name first, so that history isn't lost for lines that
      // still exist after the edit.
      const { data: oldItems } = await supabase.from('po_items').select('item_name, quantity_received').eq('po_id', savedPoId)
      const receivedMap = new Map((oldItems ?? []).map(r => [r.item_name, Number(r.quantity_received) || 0]))

      await supabase.from('po_items').delete().eq('po_id', savedPoId)
      const validLines = lines.filter(l => l.item_name.trim())
      if (validLines.length > 0) {
        const itemRows = validLines.map(l => ({
          po_id: savedPoId,
          item_name: l.item_name,
          quantity: parseFloat(l.quantity) || 1,
          unit_of_measure: l.unit || null,
          unit_cost: parseFloat(l.unit_price) || 0,
          selling_price: parseFloat(l.selling_price) || null,
          total_cost: (parseFloat(l.unit_price) || 0) * (parseFloat(l.quantity) || 1),
          quantity_received: receivedMap.get(l.item_name) ?? 0,
        }))
        const { data: insertedItems } = await supabase.from('po_items').insert(itemRows).select('id, item_name, quantity, unit_of_measure')

        // If this PO was already marked Completed, autoReceivePO already ran and won't
        // run again (it skips once a Receiving Report exists for the PO number) — so a
        // brand-new line added in this edit would otherwise sit uncredited forever.
        // Receive just that line now, the same way autoReceivePO would have.
        if (editingId && insertedItems) {
          const { data: poRow } = await supabase.from('purchase_orders').select('po_number, status').eq('id', savedPoId).maybeSingle()
          if (poRow?.status === 'completed') {
            for (const it of insertedItems) {
              if (receivedMap.has(it.item_name)) continue
              const qty = Number(it.quantity) || 0
              if (qty <= 0) continue
              const { data: wsRow } = await supabase.from('warehouse_stock').select('id, quantity').eq('item_name', it.item_name).is('client_name', null).maybeSingle()
              if (wsRow) {
                await supabase.from('warehouse_stock').update({
                  quantity: Number(wsRow.quantity) + qty,
                  updated_at: new Date().toISOString(),
                }).eq('id', wsRow.id)
              } else {
                await supabase.from('warehouse_stock').insert({ item_name: it.item_name, unit: it.unit_of_measure ?? '', quantity: qty, client_name: null })
              }
              await supabase.from('warehouse_stock_ledger').insert({
                item_name: it.item_name,
                unit: it.unit_of_measure ?? '',
                change_qty: qty,
                source_type: 'po_receiving',
                reference_no: poRow.po_number,
              })
              await supabase.from('po_items').update({ quantity_received: qty }).eq('id', it.id)
            }
          }
        }
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

    if (status === 'completed') {
      const received = await autoReceivePO(id)
      toast.success(received ? 'PO completed — automatically received, stock updated' : 'Status → Completed')
    } else if (status === 'open') {
      const undone = await undoReceivePO(id)
      toast.success(undone ? 'Status → Pending — receiving undone, stock reverted' : 'Status → Pending')
    } else {
      toast.success(`Status → ${STATUS_CFG[status].label}`)
    }
    load()
  }

  // Inverse of autoReceivePO — moving a PO back to Pending means it hasn't actually
  // arrived, so any Receiving Report(s) created for it (auto, manual, or partial) are
  // removed and the warehouse stock/ledger entries they credited are reversed. Reverses
  // each item's actual accumulated `quantity_received` exactly once (not the ordered
  // quantity times the RR count — a PO can have several RRs against it from partial
  // deliveries, and each one only ever credited what it actually received), floors at 0
  // in case some of that stock has already moved on (e.g. delivered out via DR Logs), and
  // resets `quantity_received` back to 0 so the PO starts clean if received again.
  async function undoReceivePO(id: string): Promise<boolean> {
    const { data: poRaw } = await supabase.from('purchase_orders').select('po_number').eq('id', id).maybeSingle()
    const po = poRaw as { po_number: string | null } | null
    if (!po?.po_number) return false

    const { data: rrs } = await supabase.from('receiving_reports').select('id').eq('po_number', po.po_number)
    if (!rrs || rrs.length === 0) return false

    const { data: poItems } = await supabase.from('po_items').select('id, item_name, quantity_received, unit_of_measure').eq('po_id', id)

    for (const it of poItems ?? []) {
      const qty = Number(it.quantity_received) || 0
      if (qty > 0) {
        const { data: wsRow } = await supabase.from('warehouse_stock').select('id, quantity').eq('item_name', it.item_name).is('client_name', null).maybeSingle()
        if (wsRow) {
          await supabase.from('warehouse_stock').update({
            quantity: Math.max(0, Number(wsRow.quantity) - qty),
            updated_at: new Date().toISOString(),
          }).eq('id', wsRow.id)
        }
        await supabase.from('warehouse_stock_ledger').insert({
          item_name: it.item_name,
          unit: it.unit_of_measure ?? '',
          change_qty: -qty,
          source_type: 'manual_edit',
          reference_no: po.po_number,
          notes: 'PO reverted to Pending — receiving undone',
        })
      }
      await supabase.from('po_items').update({ quantity_received: 0 }).eq('id', it.id)
    }
    for (const rr of rrs) {
      await supabase.from('receiving_reports').delete().eq('id', rr.id)
    }
    return true
  }

  // Marking a PO "Completed" used to leave it stranded in Receiving's "Pending
  // Deliveries" forever, since receiving was otherwise a separate manual step — this
  // creates the Receiving Report (and credits warehouse stock) automatically, the same
  // way manually receiving it would, so completing a PO here is enough on its own.
  // Skips silently if it's already been received (manually or by an earlier call here),
  // or if the PO has no number/items to receive against.
  async function autoReceivePO(id: string): Promise<boolean> {
    const { data: poRaw } = await supabase.from('purchase_orders').select('po_number, supplier:suppliers(company_name)').eq('id', id).maybeSingle()
    const po = poRaw as unknown as { po_number: string | null; supplier: { company_name: string } | null } | null
    if (!po?.po_number) return false

    const { data: existingRRs } = await supabase.from('receiving_reports').select('id').eq('po_number', po.po_number).limit(1)
    if (existingRRs && existingRRs.length > 0) return false

    const { data: poItems } = await supabase.from('po_items').select('id, item_name, quantity, unit_of_measure').eq('po_id', id)
    if (!poItems || poItems.length === 0) return false

    const { error: rrError } = await supabase.from('receiving_reports').insert({
      rr_number: `AUTO-${po.po_number}`,
      po_number: po.po_number,
      supplier: po.supplier?.company_name ?? null,
      delivery_date: new Date().toISOString().split('T')[0],
      received_by: 'System (Auto)',
      status: 'completed',
    })
    if (rrError) return false

    for (const it of poItems) {
      const qty = Number(it.quantity) || 0
      if (qty <= 0) continue
      const { data: wsRow } = await supabase.from('warehouse_stock').select('id, quantity').eq('item_name', it.item_name).is('client_name', null).maybeSingle()
      if (wsRow) {
        await supabase.from('warehouse_stock').update({
          quantity: Number(wsRow.quantity) + qty,
          updated_at: new Date().toISOString(),
        }).eq('id', wsRow.id)
      } else {
        await supabase.from('warehouse_stock').insert({ item_name: it.item_name, unit: it.unit_of_measure ?? '', quantity: qty, client_name: null })
      }
      await supabase.from('warehouse_stock_ledger').insert({
        item_name: it.item_name,
        unit: it.unit_of_measure ?? '',
        change_qty: qty,
        source_type: 'po_receiving',
        reference_no: po.po_number,
      })
      await supabase.from('po_items').update({ quantity_received: qty }).eq('id', it.id)
    }
    return true
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

  function buildPOHtml(po: PO, items: { item_name: string; quantity: number; unit: string | null; unit_price: number; selling_price: number | null; total_amount: number }[] = []) {
    const supplierName = (po.supplier as any)?.company_name ?? '-'
    const logoUrl = companyInfo?.logo_url || (typeof window !== 'undefined' ? `${window.location.origin}/cdsc-logo.jpg` : '/cdsc-logo.jpg')
    const poDate = po.po_date ? new Date(po.po_date + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'
    const delDate = po.delivery_date ? new Date(po.delivery_date + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : null
    const fmtN = (n: number) => (n ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })
    const hasEwt = (po.ewt_amount ?? 0) > 0
    const hasDiscount = (po.discount_rate ?? 0) > 0
    const vNetSub = (po.subtotal ?? 0) - (po.discount_amount ?? 0)
    const rows = items.map((it, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
        <td style="padding:4px 6px;color:#9ca3af;text-align:center">${i + 1}</td>
        <td style="padding:4px 6px">${it.item_name ?? '-'}</td>
        <td style="padding:4px 6px;text-align:center">${it.quantity}</td>
        <td style="padding:4px 6px;color:#6b7280;text-align:center">${it.unit ?? '-'}</td>
        <td style="padding:4px 6px;text-align:right">${fmtN(it.unit_price)}</td>
        <td style="padding:4px 6px;text-align:right;font-weight:600">${fmtN(it.total_amount)}</td>
      </tr>`).join('')
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Purchase Order</title><style>
      *{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;padding:32px;color:#1f2937;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      table{border-collapse:collapse;width:100%}
      @media print{body{margin:0;padding:24px}}
    </style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:1px solid #e5e7eb;margin-bottom:14px">
      <div><img src="${logoUrl}" style="width:64px;height:64px;object-fit:cover;border-radius:4px"/></div>
      <div style="text-align:right">
        <div style="font-size:14px;font-weight:bold;color:#b91c1c;margin-bottom:2px">${companyInfo?.company_name ?? 'CDSC Industrial Supply'}</div>
        <div style="font-size:9px;color:#6b7280">
          ${companyInfo?.address ? `<div>${companyInfo.address}</div>` : ''}
          ${companyInfo?.phone || companyInfo?.email ? `<div>${[companyInfo.phone, companyInfo.email].filter(Boolean).join(' | ')}</div>` : ''}
          ${companyInfo?.tin ? `<div>TIN: ${companyInfo.tin}</div>` : ''}
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding-bottom:12px;border-bottom:1px solid #e5e7eb;margin-bottom:14px">
      <div>
        <div style="font-size:9px;font-weight:600;color:#9ca3af;text-transform:uppercase;margin-bottom:2px">Supplier</div>
        <div style="font-weight:bold;font-size:11px">${supplierName}</div>
        ${po.payment_terms ? `<div style="margin-top:6px"><div style="font-size:9px;font-weight:600;color:#9ca3af;text-transform:uppercase">Payment Terms</div><div>${po.payment_terms}</div></div>` : ''}
        ${po.remarks ? `<div style="margin-top:6px"><div style="font-size:9px;font-weight:600;color:#9ca3af;text-transform:uppercase">Remarks</div><div style="font-size:10px">${po.remarks}</div></div>` : ''}
      </div>
      <div style="display:flex;align-items:center;justify-content:center">
        <div style="font-size:18px;font-weight:900;color:#b91c1c;text-transform:uppercase;text-align:center;letter-spacing:2px">Purchase<br/>Order</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:9px;font-weight:600;color:#9ca3af;text-transform:uppercase">PO Number</div>
        <div style="font-weight:bold;font-family:monospace">${po.po_number ?? '—'}</div>
        <div style="font-size:9px;font-weight:600;color:#9ca3af;text-transform:uppercase;margin-top:6px">Date</div>
        <div>${poDate}</div>
        ${delDate ? `<div style="font-size:9px;font-weight:600;color:#9ca3af;text-transform:uppercase;margin-top:6px">Delivery Date</div><div>${delDate}</div>` : ''}
      </div>
    </div>
    <table style="margin-bottom:8px">
      <thead><tr style="background:#b91c1c;color:#fff">
        <th style="padding:5px 6px;text-align:center;width:28px">#</th>
        <th style="padding:5px 6px;text-align:left">Item Description</th>
        <th style="padding:5px 6px;text-align:center;width:48px">QTY</th>
        <th style="padding:5px 6px;text-align:center;width:60px">Unit</th>
        <th style="padding:5px 6px;text-align:right;width:80px">Unit Price</th>
        <th style="padding:5px 6px;text-align:right;width:80px">Total</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="6" style="padding:12px;text-align:center;color:#9ca3af">No items</td></tr>'}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;margin-bottom:20px">
      <div style="width:200px">
        ${hasDiscount ? `<div style="display:flex;justify-content:space-between;padding-bottom:4px;font-size:10px"><span style="color:#6b7280">Discount (${po.discount_rate}%)</span><span style="color:#ea580c">-${fmtN(po.discount_amount)}</span></div>` : ''}
        ${hasEwt ? `<div style="display:flex;justify-content:space-between;padding-bottom:4px;font-size:10px"><span style="color:#6b7280">EWT</span><span style="color:#b91c1c">-${fmtN(po.ewt_amount)}</span></div>` : ''}
        <div style="border-top:1px solid #e5e7eb;padding-top:4px;display:flex;justify-content:space-between;font-weight:bold;font-size:12px">
          <span>Total</span><span style="color:#b91c1c">${fmtN(vNetSub)}</span>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;border-top:1px solid #e5e7eb;padding-top:24px">
      <div style="text-align:center">
        <div style="border-bottom:1px solid #374151;height:36px;margin-bottom:4px"></div>
        <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:bold">PREPARED BY</div>
        <div style="font-size:8px;color:#9ca3af">Signature over Printed Name</div>
      </div>
      <div style="text-align:center">
        <div style="border-bottom:1px solid #374151;height:36px;margin-bottom:4px"></div>
        <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:bold">APPROVED BY</div>
        <div style="font-size:8px;color:#9ca3af">Signature over Printed Name / Date</div>
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

  async function handlePrintPO(po: PO) {
    const { data } = await supabase.from('po_items').select('item_name,quantity,unit_of_measure,unit_cost,selling_price,total_cost').eq('po_id', po.id).order('created_at')
    const items = (data ?? []).map(r => ({ item_name: r.item_name, quantity: r.quantity, unit: r.unit_of_measure, unit_price: r.unit_cost, selling_price: r.selling_price, total_amount: r.total_cost }))
    const win = window.open('', '_blank', 'width=900,height=750')
    if (!win) return
    win.document.write(buildPOHtml(po, items))
    win.document.close()
    setTimeout(() => { win.focus(); win.print(); win.close() }, 800)
  }

  function openEmailDialog(po?: PO) {
    if (po) {
      const supplier = suppliers.find(s => s.id === ((po.supplier as any)?.id ?? (po as any).supplier_id))
      const supplierName = supplier?.company_name ?? (po.supplier as any)?.company_name ?? 'Sir/Madam'
      setEmailPO(po)
      setEmailTo(supplier?.email ?? '')
      setEmailSubject(`Purchase Order ${po.po_number ?? '(draft)'}${supplierName !== 'Sir/Madam' ? ` — ${supplierName}` : ''}`)
      setEmailBody(`Dear ${supplierName},\n\nPlease find attached the Purchase Order ${po.po_number ?? '(draft)'}.\n\nKindly confirm receipt and advise on delivery schedule.\n\nBest regards,\n${companyInfo?.company_name ?? 'CDSC Industrial Supply'}`)
    } else {
      const supplier = suppliers.find(s => s.id === supplierId)
      setEmailPO(null)
      setEmailTo(supplier?.email ?? '')
      setEmailSubject(`Purchase Order ${poNumber || '(draft)'}${supplier?.company_name ? ` — ${supplier.company_name}` : ''}`)
      setEmailBody(`Dear ${supplier?.company_name ?? 'Sir/Madam'},\n\nPlease find attached the Purchase Order ${poNumber || '(draft)'}.\n\nKindly confirm receipt and advise on delivery schedule.\n\nBest regards,\n${companyInfo?.company_name ?? 'CDSC Industrial Supply'}`)
    }
    setShowEmail(true)
  }

  async function buildPOPdfData(po: PO | null): Promise<POPdfData> {
    let logoDataUrl: string | undefined
    try {
      const resp = await fetch(companyInfo?.logo_url || '/cdsc-logo.jpg')
      const blob = await resp.blob()
      logoDataUrl = await new Promise<string>(resolve => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
    } catch { /* skip */ }

    let poItems: { item_name: string; quantity: number; unit?: string | null; unit_price: number; selling_price?: number | null; total_amount: number }[] = []
    if (po?.id) {
      const { data } = await supabase.from('po_items').select('item_name,quantity,unit_of_measure,unit_cost,selling_price,total_cost').eq('po_id', po.id).order('created_at')
      if (data) poItems = data.map(r => ({ item_name: r.item_name, quantity: r.quantity, unit: r.unit_of_measure, unit_price: r.unit_cost, selling_price: r.selling_price, total_amount: r.total_cost }))
    } else {
      poItems = lines.filter(l => l.item_name.trim()).map(l => ({
        item_name: l.item_name,
        quantity: parseFloat(l.quantity) || 1,
        unit: l.unit || null,
        unit_price: parseFloat(l.unit_price) || 0,
        selling_price: parseFloat(l.selling_price) || null,
        total_amount: (parseFloat(l.unit_price) || 0) * (parseFloat(l.quantity) || 1),
      }))
    }

    const supplier = po
      ? suppliers.find(s => s.id === ((po.supplier as any)?.id ?? (po as any).supplier_id))
      : suppliers.find(s => s.id === supplierId)

    return {
      companyName: companyInfo?.company_name ?? 'CDSC INDUSTRIAL SUPPLY',
      companyAddress: companyInfo?.address ?? undefined,
      companyPhone: companyInfo?.phone ?? undefined,
      companyEmail: companyInfo?.email ?? undefined,
      companyTin: companyInfo?.tin ?? undefined,
      logoDataUrl,
      poNumber: po?.po_number ?? poNumber ?? '-',
      poDate: po?.po_date ?? new Date().toISOString().split('T')[0],
      deliveryDate: po?.delivery_date ?? deliveryDate ?? undefined,
      supplierName: supplier?.company_name ?? (po?.supplier as any)?.company_name ?? undefined,
      paymentTerms: po?.payment_terms ?? paymentTerms ?? undefined,
      remarks: po?.remarks ?? remarks ?? undefined,
      items: poItems,
      subtotal: po?.subtotal ?? subtotal,
      discountRate: po?.discount_rate ?? discountRate,
      discountAmount: po?.discount_amount ?? discountAmount,
      vatAmount: po?.vat_amount ?? vatAmount,
      ewtAmount: po?.ewt_amount ?? taxAmount,
      netPayable: po?.net_payable ?? netPayable,
    }
  }

  async function handleSendEmail() {
    if (!emailTo) { toast.error('Please enter a recipient email address.'); return }
    const po = emailPO
    const poNum = po?.po_number ?? poNumber ?? 'draft'
    setSendingEmail(true)
    try {
      const poPdfData = await buildPOPdfData(po)
      await sendEmail({ to: emailTo, subject: emailSubject, body: emailBody, poPdfData, pdfFilename: `PO-${poNum}.pdf` })
      toast.success('Email sent successfully!')
      setShowEmail(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setSendingEmail(false)
    }
  }

  const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

  const displayedPos = query.trim()
    ? pos.filter(p => {
        const q = query.toLowerCase()
        return (p.po_number ?? '').toLowerCase().includes(q) ||
          (p.supplier?.company_name ?? '').toLowerCase().includes(q) ||
          (p.invoice_no ?? '').toLowerCase().includes(q) ||
          (p.status ?? '').toLowerCase().includes(q)
      })
    : pos

  type PoSortKey = 'po_number' | 'invoice_no' | 'supplier' | 'po_date' | 'delivery_date' | 'subtotal' | 'vat_amount' | 'ewt_amount' | 'net_payable' | 'status'
  const { sorted: sortedPos, sortKey: poSortKey, sortDir: poSortDir, onSort: onSortPo } = useTableSort<PO, PoSortKey>(displayedPos, (po, key) => {
    switch (key) {
      case 'po_number': return po.po_number ?? ''
      case 'invoice_no': return po.invoice_no ?? ''
      case 'supplier': return po.supplier?.company_name ?? ''
      case 'po_date': return po.po_date ?? ''
      case 'delivery_date': return po.delivery_date ?? ''
      case 'subtotal': return po.subtotal ?? 0
      case 'vat_amount': return po.vat_amount ?? 0
      case 'ewt_amount': return po.ewt_amount ?? 0
      case 'net_payable': return po.net_payable ?? 0
      case 'status': return po.status ?? ''
    }
  })

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
          <Button variant="outline" onClick={handleCancelClick}>
            <X className="h-4 w-4 mr-2" />Cancel
          </Button>
        ) : (
          <Button onClick={handleOpenCreate} className="bg-red-600 hover:bg-red-700">
            <Plus className="h-4 w-4 mr-2" />Create PO
          </Button>
        )}
      </div>

      {!open && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden border-none">
            <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-transparent" />
            <CardContent className="relative pt-5 pb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-2xl font-bold">{loading ? '—' : fmt(counts.total)}</div>
                <div className="text-sm text-muted-foreground mt-0.5">Total PO Value</div>
              </div>
              <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-sm shadow-red-500/30">
                <Wallet className="h-5 w-5 text-white" />
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border-none">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-transparent" />
            <CardContent className="relative pt-5 pb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-2xl font-bold text-blue-600">{loading ? '—' : counts.open}</div>
                <div className="text-sm text-muted-foreground mt-0.5">Pending Orders</div>
              </div>
              <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm shadow-blue-500/30">
                <Clock3 className="h-5 w-5 text-white" />
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border-none">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-transparent" />
            <CardContent className="relative pt-5 pb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-2xl font-bold text-yellow-600">{loading ? '—' : counts.partial}</div>
                <div className="text-sm text-muted-foreground mt-0.5">Partial Delivery</div>
              </div>
              <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-sm shadow-amber-500/30">
                <AlertCircle className="h-5 w-5 text-white" />
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border-none">
            <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-transparent" />
            <CardContent className="relative pt-5 pb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-2xl font-bold text-green-600">{loading ? '—' : counts.completed}</div>
                <div className="text-sm text-muted-foreground mt-0.5">Completed</div>
              </div>
              <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-sm shadow-green-500/30">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
            </CardContent>
          </Card>
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
              <div className="grid grid-cols-5 text-center text-[10px] font-semibold uppercase tracking-wider gap-1.5 px-3 pb-2">
                {[
                  { label: 'PO Created',  cls: 'text-blue-700 bg-blue-50 ring-1 ring-blue-200' },
                  { label: 'Receiving',   cls: 'text-yellow-700 bg-amber-50 ring-1 ring-amber-200' },
                  { label: 'DR Logged',   cls: 'text-orange-700 bg-orange-50 ring-1 ring-orange-200' },
                  { label: 'CSI Issued',  cls: 'text-purple-700 bg-purple-50 ring-1 ring-purple-200' },
                  { label: 'Collected',   cls: 'text-green-700 bg-green-50 ring-1 ring-green-200' },
                ].map(s => (
                  <div key={s.label} className={`py-1.5 rounded-full ${s.cls}`}>{s.label}</div>
                ))}
              </div>
              {loading ? (
                <div className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>
              ) : pos.filter(p => p.status === 'open' || p.status === 'partially_delivered').length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">No pending purchase orders</div>
              ) : (
                <div className="divide-y border-t max-h-64 overflow-y-auto">
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
                      <div key={po.id} className="grid grid-cols-5 text-center text-xs hover:bg-muted/30 transition-colors">
                        {stages.map((s, i) => (
                          <div key={i} className={`py-2.5 px-1 border-r last:border-r-0 ${s.done ? '' : 'opacity-40'}`}>
                            <div className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold mx-auto mb-0.5 ${s.done ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-sm shadow-green-500/30' : 'bg-gray-100 text-gray-400'}`}>
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
                  <TableHead className="w-10">No.</TableHead>
                  <SortableTableHead label="PO Number" sortKey="po_number" activeKey={poSortKey} direction={poSortDir} onSort={onSortPo} />
                  <SortableTableHead label="Invoice No." sortKey="invoice_no" activeKey={poSortKey} direction={poSortDir} onSort={onSortPo} />
                  <SortableTableHead label="Supplier" sortKey="supplier" activeKey={poSortKey} direction={poSortDir} onSort={onSortPo} />
                  <SortableTableHead label="PO Date" sortKey="po_date" activeKey={poSortKey} direction={poSortDir} onSort={onSortPo} />
                  <SortableTableHead label="Delivery Date" sortKey="delivery_date" activeKey={poSortKey} direction={poSortDir} onSort={onSortPo} />
                  <SortableTableHead label="Subtotal" sortKey="subtotal" align="right" activeKey={poSortKey} direction={poSortDir} onSort={onSortPo} />
                  <SortableTableHead label="VAT 12%" sortKey="vat_amount" align="right" activeKey={poSortKey} direction={poSortDir} onSort={onSortPo} />
                  <SortableTableHead label="EWT" sortKey="ewt_amount" align="right" activeKey={poSortKey} direction={poSortDir} onSort={onSortPo} />
                  <SortableTableHead label="Net Payable" sortKey="net_payable" align="right" activeKey={poSortKey} direction={poSortDir} onSort={onSortPo} />
                  <SortableTableHead label="Status" sortKey="status" activeKey={poSortKey} direction={poSortDir} onSort={onSortPo} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : sortedPos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                      No purchase orders yet. Click <strong>Create PO</strong> to get started.
                    </TableCell>
                  </TableRow>
                ) : sortedPos.map((po, idx) => {
                  const sCfg = STATUS_CFG[po.status] ?? STATUS_CFG.open
                  return (
                    <TableRow key={po.id} className="cursor-pointer hover:bg-red-50/40 transition-colors" onClick={() => openDetails(po)}>
                      <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-red-600">{po.po_number ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          {po.invoice_no ?? '—'}
                          {!!poAttachmentCounts[po.po_number ?? ''] && (
                            <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                          )}
                        </span>
                      </TableCell>
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
        <>
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
                      <Input placeholder="Auto-generated" value={poNumber} onChange={e => setPoNumber(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Delivery Date</Label>
                      <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
                    </div>
                  </div>

                  {/* Invoice No. */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label>Invoice No.</Label>
                      {viewPOAttachments.length > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-green-700 bg-green-50 border border-green-200 rounded-full px-1.5 py-0.5">
                          <Paperclip className="h-2.5 w-2.5" />{viewPOAttachments.length} uploaded
                        </span>
                      )}
                    </div>
                    <Input placeholder="Supplier's invoice number" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} />
                  </div>

                  {/* Attachments */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>Attachments</Label>
                      <Button
                        type="button" variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" disabled={uploadingPOAttachment}
                        onClick={() => document.getElementById('po-form-attachment-input')?.click()}
                      >
                        {uploadingPOAttachment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        Add File
                      </Button>
                      <input
                        id="po-form-attachment-input" type="file" multiple className="hidden"
                        onChange={e => { uploadPOAttachments(poNumber, e.target.files); e.target.value = '' }}
                      />
                    </div>
                    {viewPOAttachments.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No attachments yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {viewPOAttachments.map(a => (
                          <div key={a.id} className="flex items-center gap-1.5 border rounded-md pl-1 pr-1 py-1 text-xs bg-muted/30">
                            <button
                              type="button"
                              onClick={() => setPreviewAttachment({ url: a.file_url, name: a.file_name })}
                              className="flex items-center gap-1.5 hover:underline"
                            >
                              {isImageAttachment(a.file_name)
                                ? // eslint-disable-next-line @next/next/no-img-element
                                  <img src={driveImageSrc(a.file_url)} alt="" className="h-7 w-7 object-cover rounded" />
                                : <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
                              <span className="text-blue-600 truncate max-w-[140px]">{a.file_name}</span>
                            </button>
                            <button type="button" onClick={() => deletePOAttachment(a.id, poNumber)} className="text-muted-foreground hover:text-destructive p-0.5">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
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

                  {/* VAT Mode */}
                  <div className="space-y-1.5">
                    <Label>VAT Mode</Label>
                    <div className="flex gap-2 flex-wrap">
                      {[{ label: 'VAT Exclusive', value: false }, { label: 'VAT Inclusive', value: true }].map(opt => (
                        <button key={String(opt.value)} type="button" onClick={() => setVatInclusive(opt.value)}
                          className={`px-3 py-1.5 text-sm rounded-md border font-medium transition-colors ${vatInclusive === opt.value ? 'bg-red-600 text-white border-red-600' : 'bg-background text-muted-foreground hover:bg-muted border-input'}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {vatInclusive ? 'VAT is already included in the unit price (price ÷ 1.12)' : 'VAT (12%) will be added on top of the subtotal'}
                    </p>
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
                    {/* Header: Logo (left) | Company Name + Address (right) */}
                    <div className="flex justify-between items-start border-b pb-3">
                      <div>
                        <img src={companyInfo?.logo_url || '/cdsc-logo.jpg'} alt={companyInfo?.company_name || 'Logo'} className="h-12 w-12 rounded object-cover" />
                      </div>
                      <div className="text-right space-y-0.5">
                        <div className="text-[13px] font-bold text-red-700 leading-tight">
                          {companyInfo?.company_name || 'CDSC Industrial Supply'}
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
                          const total = (parseFloat(line.unit_price) || 0) * (parseFloat(line.quantity) || 0)
                          return (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-1.5 py-1 text-gray-400">{i + 1}</td>
                              <td className="px-1.5 py-1">{line.item_name || <span className="text-gray-300 italic">—</span>}</td>
                              <td className="px-1.5 py-1 text-right font-bold text-gray-800">{line.quantity || '—'}</td>
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
                        {discountRate > 0 && <div className="flex justify-between"><span className="text-gray-500">Discount ({discountRate}%)</span><span className="text-orange-600">−₱{discountAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>}
                        {ewtType !== 'none' && <div className="flex justify-between"><span className="text-gray-500">{taxLabel}</span><span className="text-red-700">−₱{taxAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>}
                        <div className="flex justify-between border-t pt-0.5 font-bold text-[11px]"><span>Total</span><span className="text-red-700">₱{netSubtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
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

          {/* Line Items — full width */}
          <Card>
            <CardContent className="pt-5 space-y-2">
              <div className="flex items-center justify-between">
                <Label>Line Items</Label>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={openVendorCatalog}>
                  <Store className="h-3.5 w-3.5" />Browse Vendor Catalog
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-6"></TableHead>
                      <TableHead className="min-w-[160px]">Item Description</TableHead>
                      <TableHead className="w-16">Qty</TableHead>
                      <TableHead className="w-16">Unit</TableHead>
                      <TableHead className="w-36">Unit Price</TableHead>
                      <TableHead className="w-24 text-right">Amount</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, i) => {
                      const lineTotal = (parseFloat(line.unit_price) || 0) * (parseFloat(line.quantity) || 0)
                      const itemMeta = items.find(it => it.item_name === line.item_name)
                      const statusCfg = itemMeta ? (ITEM_STATUS_CFG[itemMeta.status] ?? ITEM_STATUS_CFG.active) : null
                      const stockQty = line.item_name ? (warehouseStock[line.item_name] ?? 0) : null
                      const needsToBuy = itemMeta && (itemMeta.status === 'low_stock' || itemMeta.status === 'out_of_stock')
                      return (
                        <TableRow
                          key={i}
                          className={dragLineIdx === i ? 'opacity-40' : ''}
                          onDragOver={e => { e.preventDefault() }}
                          onDrop={e => {
                            e.preventDefault()
                            if (dragLineIdx !== null) reorderLines(dragLineIdx, i)
                            setDragLineIdx(null)
                          }}
                        >
                          <TableCell className="py-1.5 align-top cursor-grab active:cursor-grabbing text-muted-foreground"
                            draggable
                            onDragStart={() => setDragLineIdx(i)}
                            onDragEnd={() => setDragLineIdx(null)}
                          >
                            <GripVertical className="h-4 w-4" />
                          </TableCell>
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
                            <div className="flex gap-1 items-center">
                              <Input type="number" min={0} step="0.01" className="h-8 text-xs flex-1 min-w-0" placeholder="0.00" value={line.unit_price}
                                onChange={e => setLines(p => p.map((l, idx) => idx === i ? { ...l, unit_price: e.target.value } : l))} />
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-7 shrink-0 text-muted-foreground hover:text-blue-600"
                                title="Update item default unit price (affects future records only)"
                                onClick={() => updateItemUnitPrice(line.item_name, line.unit_price)}>
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
            </CardContent>
          </Card>

          {/* Totals & actions — full width */}
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div className="rounded-lg bg-muted/30 p-4 space-y-1 text-sm max-w-sm ml-auto">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(subtotal)}</span></div>
                {discountRate > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount ({discountRate}%)</span><span className="text-orange-600">− {fmt(discountAmount)}</span></div>}
                {discountRate > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Net Subtotal</span><span>{fmt(netSubtotal)}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Input VAT (12%)</span><span className="text-blue-600">{fmt(vatAmount)}</span></div>
                {ewtType !== 'none' && <div className="flex justify-between"><span className="text-muted-foreground">{taxLabel} ({ewtCfg.rate * 100}%)</span><span className="text-red-700">− {fmt(taxAmount)}</span></div>}
                <div className="h-px bg-border my-1" />
                <div className="flex justify-between font-bold"><span>Net Payable</span><span className="text-red-600">{fmt(netPayable)}</span></div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t mt-4">
                <Button variant="outline" onClick={handleCancelClick}>Cancel</Button>
                <Button type="button" variant="outline" className="gap-1.5" onClick={handlePrint}>
                  <Printer className="h-4 w-4" />Print
                </Button>
                <Button type="button" variant="outline" className="gap-1.5" onClick={() => openEmailDialog()}>
                  <Mail className="h-4 w-4" />Email
                </Button>
                <Button onClick={submitPO} disabled={saving} className="bg-red-600 hover:bg-red-700">
                  {saving
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{editingId ? 'Saving…' : 'Creating…'}</>
                    : editingId ? 'Save Update' : 'Create Purchase Order'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* PO Details Dialog */}
      <Dialog open={!!viewPO} onOpenChange={o => { if (!o) { setViewPO(null); setViewPOItems([]); setViewPOAttachments([]) } }}>
        <DialogContent className="w-[98vw] sm:!max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-red-600" />
              {viewPO?.po_number ?? 'Purchase Order'}
            </DialogTitle>
          </DialogHeader>
          {viewPO && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${(STATUS_CFG[viewPO.status] ?? STATUS_CFG.open).cls}`}>
                  {(STATUS_CFG[viewPO.status] ?? STATUS_CFG.open).label}
                </span>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">Change Status</Label>
                  <Select
                    value={viewPO.status}
                    onValueChange={async v => {
                      await updateStatus(viewPO.id, v as POStatus)
                      setViewPO(p => p ? { ...p, status: v as POStatus } : p)
                    }}
                  >
                    <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_CFG) as POStatus[]).map(s => (
                        <SelectItem key={s} value={s}>{STATUS_CFG[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-muted/30 rounded-xl p-3">
                <div><span className="text-muted-foreground block">Supplier</span><span className="font-medium">{viewPO.supplier?.company_name ?? '—'}</span></div>
                <div><span className="text-muted-foreground block">Invoice No.</span><span className="font-medium inline-flex items-center gap-1">{viewPO.invoice_no ?? '—'}{viewPOAttachments.length > 0 && <Paperclip className="h-3 w-3 text-green-700" />}</span></div>
                <div><span className="text-muted-foreground block">PO Date</span><span className="font-medium">{viewPO.po_date ? format(new Date(viewPO.po_date), 'MMM d, yyyy') : '—'}</span></div>
                <div><span className="text-muted-foreground block">Delivery Date</span><span className="font-medium">{viewPO.delivery_date ? format(new Date(viewPO.delivery_date), 'MMM d, yyyy') : '—'}</span></div>
                <div><span className="text-muted-foreground block">Payment Terms</span><span className="font-medium">{viewPO.payment_terms ?? '—'}</span></div>
                <div><span className="text-muted-foreground block">Discount</span><span className="font-medium">{viewPO.discount_rate ? `${viewPO.discount_rate}% (${fmt(viewPO.discount_amount ?? 0)})` : '—'}</span></div>
                <div><span className="text-muted-foreground block">CWT</span><span className="font-medium">{fmt(viewPO.cwt_amount ?? 0)}</span></div>
                <div><span className="text-muted-foreground block">Remarks</span><span className="font-medium">{viewPO.remarks || '—'}</span></div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Attachments</Label>
                  <Button
                    type="button" variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" disabled={uploadingPOAttachment}
                    onClick={() => document.getElementById('po-attachment-input')?.click()}
                  >
                    {uploadingPOAttachment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Add File
                  </Button>
                  <input
                    id="po-attachment-input" type="file" multiple className="hidden"
                    onChange={e => { uploadPOAttachments(viewPO.po_number, e.target.files); e.target.value = '' }}
                  />
                </div>
                {viewPOAttachments.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No attachments yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {viewPOAttachments.map(a => (
                      <div key={a.id} className="flex items-center gap-1.5 border rounded-md pl-1 pr-1 py-1 text-xs bg-muted/30">
                        <button
                          type="button"
                          onClick={() => setPreviewAttachment({ url: a.file_url, name: a.file_name })}
                          className="flex items-center gap-1.5 hover:underline"
                        >
                          {isImageAttachment(a.file_name)
                            ? // eslint-disable-next-line @next/next/no-img-element
                              <img src={driveImageSrc(a.file_url)} alt="" className="h-7 w-7 object-cover rounded" />
                            : <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
                          <span className="text-blue-600 truncate max-w-[140px]">{a.file_name}</span>
                        </button>
                        <button type="button" onClick={() => deletePOAttachment(a.id, viewPO.po_number)} className="text-muted-foreground hover:text-destructive p-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border rounded-xl overflow-hidden text-xs">
                <table className="w-full">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-medium">Item</th>
                      <th className="text-right px-3 py-1.5 font-medium w-20">Qty</th>
                      {viewPO.status === 'partially_delivered' && (
                        <th className="text-right px-3 py-1.5 font-medium w-24 text-yellow-700">Received</th>
                      )}
                      <th className="text-left px-3 py-1.5 font-medium w-24">Unit</th>
                      <th className="text-right px-3 py-1.5 font-medium w-28">Unit Cost</th>
                      <th className="text-right px-3 py-1.5 font-medium w-28">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewPOItems.length === 0 ? (
                      <tr><td colSpan={viewPO.status === 'partially_delivered' ? 6 : 5} className="text-center py-4 text-muted-foreground italic">No line items found.</td></tr>
                    ) : viewPOItems.map((it, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1">{it.item_name}</td>
                        <td className="px-3 py-1 text-right font-medium">{it.quantity}</td>
                        {viewPO.status === 'partially_delivered' && (
                          <td className="px-3 py-1 text-right font-medium text-yellow-700">
                            {it.quantity_received} / {it.quantity}
                          </td>
                        )}
                        <td className="px-3 py-1 text-muted-foreground">{it.unit}</td>
                        <td className="px-3 py-1 text-right">{fmt(it.unit_price)}</td>
                        <td className="px-3 py-1 text-right font-medium">{fmt(it.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <div className="w-56 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(viewPO.subtotal ?? 0)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">VAT 12%</span><span className="text-blue-600">{fmt(viewPO.vat_amount ?? 0)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">EWT</span><span className="text-red-700">-{fmt(viewPO.ewt_amount ?? 0)}</span></div>
                  <div className="flex justify-between border-t pt-1 font-semibold text-sm"><span>Net Payable</span><span>{fmt(viewPO.net_payable ?? 0)}</span></div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { openEdit(viewPO); setViewPO(null) }}>
                  <Pencil className="h-3.5 w-3.5" />Edit
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handlePrintPO(viewPO)}>
                  <Printer className="h-3.5 w-3.5" />Print PO
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEmailDialog(viewPO)}>
                  <Mail className="h-3.5 w-3.5" />Send Email
                </Button>
                {viewPO.status === 'open' && (
                  <Button variant="outline" size="sm" className="gap-1.5 text-yellow-600" onClick={() => { updateStatus(viewPO.id, 'partially_delivered'); setViewPO(null) }}>
                    <ArrowRightLeft className="h-3.5 w-3.5" />Mark Partial Delivery
                  </Button>
                )}
                {(viewPO.status === 'open' || viewPO.status === 'partially_delivered') && (
                  <Button variant="outline" size="sm" className="gap-1.5 text-green-600" onClick={() => { updateStatus(viewPO.id, 'completed'); setViewPO(null) }}>
                    <CheckCircle2 className="h-3.5 w-3.5" />Mark Completed
                  </Button>
                )}
                {viewPO.status !== 'cancelled' && viewPO.status !== 'completed' && (
                  <Button variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={() => { updateStatus(viewPO.id, 'cancelled'); setViewPO(null) }}>
                    <XCircle className="h-3.5 w-3.5" />Cancel PO
                  </Button>
                )}
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive ml-auto" onClick={() => { deletePO(viewPO.id); setViewPO(null) }}>
                  <Trash2 className="h-3.5 w-3.5" />Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Attachment Preview */}
      <Dialog open={!!previewAttachment} onOpenChange={o => { if (!o) setPreviewAttachment(null) }}>
        <DialogContent className="w-[95vw] sm:!max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">{previewAttachment?.name}</DialogTitle>
          </DialogHeader>
          {previewAttachment && (
            isImageAttachment(previewAttachment.name) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={driveImageSrc(previewAttachment.url)} alt={previewAttachment.name} className="w-full max-h-[70vh] object-contain rounded-lg border" />
            ) : isPdfAttachment(previewAttachment.name) ? (
              <iframe src={driveEmbedUrl(previewAttachment.url)} className="w-full h-[70vh] rounded-lg border" />
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
                <FileText className="h-10 w-10" />
                <p>Preview isn&apos;t available for this file type.</p>
                <Button type="button" variant="outline" size="sm" onClick={() => window.open(previewAttachment.url, '_blank', 'noopener,noreferrer')}>
                  Open File
                </Button>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>

      {/* Item Search Dialog */}
      <Dialog open={itemSearchIdx !== null} onOpenChange={o => { if (!o) setItemSearchIdx(null) }}>
        <DialogContent className="w-[98vw] sm:!max-w-6xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex flex-row items-center justify-between gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" />Item Inventory
            </DialogTitle>
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={openAddItem}>
              <Plus className="h-3.5 w-3.5" />Add Item
            </Button>
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
                  <tr><td colSpan={7} className="text-center py-6 space-y-2">
                    <p className="text-muted-foreground text-sm">No items found.</p>
                    <Button type="button" size="sm" variant="outline" className="gap-1" onClick={openAddItem}>
                      <Plus className="h-3.5 w-3.5" />
                      {itemQuery.trim() ? <>Add &quot;{itemQuery.trim()}&quot; as new item</> : 'Add Item'}
                    </Button>
                  </td></tr>
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

      {/* Add Item Modal */}
      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Item</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-1">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Item Name <span className="text-destructive">*</span></Label>
              <Input
                autoFocus
                placeholder="e.g. Steel Pipe 1/2&quot;"
                value={newItemForm.item_name}
                onChange={e => setNewItemForm(f => ({ ...f, item_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unit of Measure</Label>
              <Input placeholder="e.g. piece" value={newItemForm.unit_of_measure}
                onChange={e => setNewItemForm(f => ({ ...f, unit_of_measure: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Cost (₱)</Label>
              <Input type="number" min={0} step="0.01" placeholder="0.00" value={newItemForm.cost}
                onChange={e => setNewItemForm(f => ({ ...f, cost: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Selling Price (₱)</Label>
              <Input type="number" min={0} step="0.01" placeholder="0.00" value={newItemForm.selling_price}
                onChange={e => setNewItemForm(f => ({ ...f, selling_price: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemOpen(false)} disabled={savingNewItem}>Cancel</Button>
            <Button onClick={saveNewItem} disabled={savingNewItem} className="bg-red-600 hover:bg-red-700">
              {savingNewItem ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vendor Catalog Dialog */}
      <Dialog open={vendorCatalogOpen} onOpenChange={setVendorCatalogOpen}>
        <DialogContent className="w-[98vw] sm:!max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-4 w-4" />{selectedSupplier?.company_name ?? 'Vendor'}&apos;s Catalog
            </DialogTitle>
          </DialogHeader>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search this vendor's catalog…"
              className="pl-9"
              value={vendorCatalogQuery}
              onChange={e => setVendorCatalogQuery(e.target.value)}
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {vendorCatalogLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (() => {
              const filtered = vendorCatalogItems.filter(it =>
                !vendorCatalogQuery.trim() || it.item_name.toLowerCase().includes(vendorCatalogQuery.toLowerCase())
              )
              if (filtered.length === 0) {
                return (
                  <div className="text-center py-12 text-sm text-muted-foreground">
                    {vendorCatalogItems.length === 0 ? 'This vendor hasn’t added any catalog items yet.' : 'No items match your search.'}
                  </div>
                )
              }
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filtered.map(it => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => { addLineFromVendorCatalog(it); setVendorCatalogOpen(false) }}
                      className="text-left border rounded-lg overflow-hidden hover:border-red-400 hover:shadow-sm transition-all bg-white"
                    >
                      <div className="h-24 bg-muted/40 flex items-center justify-center overflow-hidden">
                        {it.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.image_url} alt={it.item_name} className="h-full w-full object-contain p-2" />
                        ) : (
                          <Package className="h-6 w-6 text-muted-foreground/30" />
                        )}
                      </div>
                      <div className="p-2.5 space-y-0.5">
                        <div className="text-xs font-semibold truncate" title={it.item_name}>{it.item_name}</div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">{it.unit_of_measure}</span>
                          <span className="text-xs font-bold text-red-600">
                            {it.price != null ? `₱${Number(it.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Email Dialog */}
      <Dialog open={showEmail} onOpenChange={setShowEmail}>
        <DialogContent className="w-[95vw] max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" />Send Purchase Order by Email
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <Button variant="outline" disabled={sendingEmail} onClick={() => setShowEmail(false)}>Cancel</Button>
              <Button onClick={handleSendEmail} disabled={sendingEmail} className="bg-red-600 hover:bg-red-700 gap-1.5">
                {sendingEmail ? <><Loader2 className="h-4 w-4 animate-spin" />Sending…</> : <><Send className="h-4 w-4" />Send Email</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discard Confirmation */}
      <Dialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">You have unsaved changes. Do you want to keep editing or discard them?</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDiscardConfirmOpen(false)}>Keep Editing</Button>
            <Button variant="destructive" onClick={discardForm}>Discard</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
