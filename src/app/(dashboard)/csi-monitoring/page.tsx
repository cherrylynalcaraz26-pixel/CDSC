'use client'

import { useState, useEffect, useRef, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, SortableTableHead,
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
import { Checkbox } from '@/components/ui/checkbox'
import { PaginationBar } from '@/components/ui/pagination-bar'
import { Plus, X, Search, Box, MoreHorizontal, Loader2, FileText, LayoutGrid, List, ChevronDown, ChevronUp, Trash2, Printer, SlidersHorizontal, FileOutput, Mail, Camera, Image as ImageIcon, GripVertical, RefreshCw, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { useSearchContext } from '@/context/search-context'
import { usePersistedState } from '@/lib/use-persisted-state'
import { sendEmail, htmlToPdfBase64 } from '@/lib/send-email'
import { uploadImageToDrive } from '@/lib/upload-image'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend, AreaChart, Area,
} from 'recharts'

interface ItemOption { item_name: string; unit_of_measure: string; selling_price: number | null }
interface ClientOption {
  id: string
  company_name: string
  show_csi_in_portal: boolean
  address: string | null
  city: string | null
  province: string | null
  tin: string | null
  industry: string | null
  email: string | null
}
interface SOItemOption { item_name: string; unit: string; quantity: number; selling_price: number }
interface UOMOption { id: string; code: string; name: string }
interface AttributeOption { id: string; name: string; data_type: string; options: string[] | null }

interface BlankFormCalib {
  pageWidthMm: number
  pageHeightMm: number
  fontSizePt: number
  itemFontSizePt: number
  dateTop: number; dateLeft: number
  clientTop: number; clientLeft: number
  addressTop: number; addressLeft: number
  tinTop: number; tinLeft: number
  businessStyleTop: number; businessStyleLeft: number
  tableTop: number
  rowHeight: number
  colQtyLeft: number
  colUnitLeft: number
  colDescLeft: number
  colUnitPriceLeft: number
  colAmountLeft: number
  totalDueTop: number
  totalDueLeft: number
  maxRows: number
}

const DEFAULT_BLANK_CALIB: BlankFormCalib = {
  pageWidthMm: 210,
  pageHeightMm: 297,
  fontSizePt: 10,
  itemFontSizePt: 9,
  dateTop: 29, dateLeft: 135,
  clientTop: 35, clientLeft: 70,
  addressTop: 40, addressLeft: 60,
  tinTop: 45, tinLeft: 55,
  businessStyleTop: 50, businessStyleLeft: 75,
  tableTop: 64,
  rowHeight: 6,
  colQtyLeft: 44,
  colUnitLeft: 54,
  colDescLeft: 67,
  colUnitPriceLeft: 130,
  colAmountLeft: 149,
  totalDueTop: 163,
  totalDueLeft: 149,
  maxRows: 15,
}

const BLANK_CALIB_KEY = 'cdsc_csi_blank_form_calib'

function loadBlankCalib(): BlankFormCalib {
  if (typeof window === 'undefined') return DEFAULT_BLANK_CALIB
  try {
    const raw = window.localStorage.getItem(BLANK_CALIB_KEY)
    if (!raw) return DEFAULT_BLANK_CALIB
    return { ...DEFAULT_BLANK_CALIB, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_BLANK_CALIB
  }
}

interface CSIRecord {
  id: number
  si_date: string
  si_number: string
  po_number: string | null
  client_name: string | null
  item_name: string
  unit: string | null
  quantity: number
  unit_price: number
  amount: number
  dr_number: string | null
  created_at: string
  show_in_portal: boolean
  attachment_url: string | null
  collection_status: string | null
}

interface CSIItem {
  item_name: string
  unit: string
  quantity: string
  unit_price: string
}

type SortOption = 'date_desc' | 'date_asc' | 'si_asc' | 'si_desc' | 'amount_desc' | 'amount_asc' | 'client_asc' | 'client_desc'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'date_desc', label: 'Date (Newest)' },
  { value: 'date_asc', label: 'Date (Oldest)' },
  { value: 'si_asc', label: 'SI Number (A–Z)' },
  { value: 'si_desc', label: 'SI Number (Z–A)' },
  { value: 'amount_desc', label: 'Amount (High–Low)' },
  { value: 'amount_asc', label: 'Amount (Low–High)' },
  { value: 'client_asc', label: 'Client (A–Z)' },
  { value: 'client_desc', label: 'Client (Z–A)' },
]

function compareBySortOption(sort: SortOption, a: { date: string; si: string; amount: number; client: string }, b: { date: string; si: string; amount: number; client: string }) {
  switch (sort) {
    case 'date_asc': return a.date.localeCompare(b.date)
    case 'date_desc': return b.date.localeCompare(a.date)
    case 'si_asc': return a.si.localeCompare(b.si, undefined, { numeric: true })
    case 'si_desc': return b.si.localeCompare(a.si, undefined, { numeric: true })
    case 'amount_desc': return b.amount - a.amount
    case 'amount_asc': return a.amount - b.amount
    case 'client_asc': return a.client.localeCompare(b.client)
    case 'client_desc': return b.client.localeCompare(a.client)
    default: return 0
  }
}

// Bridges the header-click sort UI onto the same persisted `sortOption` used by
// the Sort dropdown, so both controls stay in sync instead of tracking separate state.
type SortCol = 'date' | 'si' | 'amount' | 'client'
function sortColOf(opt: SortOption): SortCol {
  if (opt.startsWith('date')) return 'date'
  if (opt.startsWith('si')) return 'si'
  if (opt.startsWith('amount')) return 'amount'
  return 'client'
}
function sortDirOf(opt: SortOption): 'asc' | 'desc' {
  return opt.endsWith('desc') ? 'desc' : 'asc'
}

const emptyItem = (): CSIItem => ({ item_name: '', unit: '', quantity: '', unit_price: '' })

const emptyHeader = () => ({
  si_date: new Date().toISOString().split('T')[0],
  si_number: '',
  po_number: '',
  client_name: '',
  dr_number: '',
})

function csiStatusBadge(status: string | null) {
  switch (status) {
    case 'cancelled': return { label: 'Cancelled', cls: 'bg-red-100 text-red-700' }
    case 'collected': return { label: 'Collected', cls: 'bg-green-100 text-green-800' }
    case 'for_collection': return { label: 'For Collection', cls: 'bg-amber-100 text-amber-800' }
    default: return { label: 'Active', cls: 'bg-gray-100 text-gray-600' }
  }
}

function formatPeso(val: number) {
  if (!val) return '—'
  return '₱' + val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function CSIMonitoringPage() {
  const supabase = createClient()
  const { query: search } = useSearchContext()
  const [records, setRecords] = useState<CSIRecord[]>([])
  const [itemOptions, setItemOptions] = useState<ItemOption[]>([])
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([])
  const [soNumbers, setSoNumbers] = useState<{ id: string; so_number: string }[]>([])
  const [drNumbers, setDrNumbers] = useState<{ id: string; dr_number: string; po_number: string | null; client_name: string | null }[]>([])
  const [drNumberLockedFromSo, setDrNumberLockedFromSo] = useState(false)
  const [soItemsMap, setSoItemsMap] = useState<Record<string, SOItemOption[]>>({})
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [chartsExpanded, setChartsExpanded] = useState(false)
  const [editingSiNumber, setEditingSiNumber] = useState<string | null>(null)
  const [clientFilter, setClientFilter] = usePersistedState('csi-monitoring:clientFilter', '')
  const [yearFilter, setYearFilter] = usePersistedState('csi-monitoring:yearFilter', 'all')
  const [sortOption, setSortOption] = usePersistedState<SortOption>('csi-monitoring:sortOption', 'date_desc')
  const [header, setHeader] = useState(emptyHeader())
  const [items, setItems] = useState<CSIItem[]>([emptyItem()])
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [viewMode, setViewMode] = usePersistedState<'by-si' | 'all-items' | 'cross-ref'>('csi-monitoring:viewMode', 'by-si')
  const [drItemsForCrossRef, setDrItemsForCrossRef] = useState<{ dr_number: string; item_name: string; client_name: string | null; quantity: number; unit: string | null }[]>([])
  const [crossRefDetail, setCrossRefDetail] = useState<{ type: 'csi' | 'dr'; name: string } | null>(null)
  const [expandedSIs, setExpandedSIs] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [itemSearchIdx, setItemSearchIdx] = useState<number | null>(null)
  const [dragItemIndex, setDragItemIndex] = useState<number | null>(null)
  const [uploadingAttachmentSi, setUploadingAttachmentSi] = useState<string | null>(null)
  const [previewAttachmentUrl, setPreviewAttachmentUrl] = useState<string | null>(null)
  const [itemQuery, setItemQuery] = useState('')
  const [addItemOpen, setAddItemOpen] = useState(false)
  const [newItemForm, setNewItemForm] = useState({ item_name: '', unit_of_measure: '', selling_price: '', attribute: '' })
  const [newItemImageFile, setNewItemImageFile] = useState<File | null>(null)
  const [newItemImageUrl, setNewItemImageUrl] = useState<string | null>(null)
  const newItemImageInputRef = useRef<HTMLInputElement>(null)
  const [savingNewItem, setSavingNewItem] = useState(false)
  const [uomList, setUomList] = useState<UOMOption[]>([])
  const [attributeList, setAttributeList] = useState<AttributeOption[]>([])
  const [newItemAttributeTypeId, setNewItemAttributeTypeId] = useState('')
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form')
  const [siNumberOptions, setSiNumberOptions] = useState<{ value: string; tag: 'current' | 'next' | 'missing' }[]>([])
  const [companyInfo, setCompanyInfo] = useState<{ company_name: string; address: string; phone: string; email: string; tin: string } | null>(null)
  const [blankCalib, setBlankCalib] = useState<BlankFormCalib>(() => loadBlankCalib())
  const [calibOpen, setCalibOpen] = useState(false)
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)
  const [calibDraft, setCalibDraft] = useState<BlankFormCalib>(DEFAULT_BLANK_CALIB)
  const printRef = useRef<HTMLDivElement>(null)
  const [selectedSIs, setSelectedSIs] = useState<Set<string>>(new Set())
  const [emailBulkOpen, setEmailBulkOpen] = useState(false)
  const [bulkEmailTo, setBulkEmailTo] = useState('')
  const [bulkEmailSubject, setBulkEmailSubject] = useState('')
  const [bulkEmailBody, setBulkEmailBody] = useState('')
  const [sendingBulkEmail, setSendingBulkEmail] = useState(false)

  function saveCalib(next: BlankFormCalib) {
    setBlankCalib(next)
    window.localStorage.setItem(BLANK_CALIB_KEY, JSON.stringify(next))
  }

  function openCalib() {
    setCalibDraft(blankCalib)
    setCalibOpen(true)
  }

  async function load() {
    setLoading(true)
    const [{ data: itemOptData }, { data: clientData }, { data: soData }, drItemsData, drLogData, { data: uomData }, { data: attrData }] = await Promise.all([
      supabase.from('items').select('item_name, unit_of_measure, selling_price').order('item_name'),
      supabase.from('clients').select('id, company_name, show_csi_in_portal, address, city, province, tin, industry, email').eq('status', 'active').order('company_name'),
      supabase.from('sales_orders').select('id, so_number').not('so_number', 'is', null).order('created_at', { ascending: false }),
      fetchAllRows((from, to) => supabase.from('dr_log_items').select('dr_number, item_name, quantity, unit').order('item_name').order('id').range(from, to)),
      fetchAllRows((from, to) => supabase.from('dr_logs').select('id, dr_number, po_number, supplier_name').order('dr_date', { ascending: false }).order('id').range(from, to)),
      supabase.from('uom_list').select('id, code, name').eq('is_active', true).order('code'),
      supabase.from('attributes').select('id, name, data_type, options').order('name'),
    ])
    setUomList((uomData ?? []) as UOMOption[])
    setAttributeList((attrData ?? []) as AttributeOption[])
    // On DR logs the "supplier" field holds the delivered-to client.
    const drClientMap = new Map((drLogData as any[]).map(d => [d.dr_number, d.supplier_name ?? null]))
    setDrItemsForCrossRef((drItemsData as any[]).map(d => ({ dr_number: d.dr_number, item_name: d.item_name, client_name: drClientMap.get(d.dr_number) ?? null, quantity: Number(d.quantity) || 0, unit: d.unit ?? null })))
    setItemOptions((itemOptData ?? []) as ItemOption[])
    setClientOptions((clientData ?? []) as ClientOption[])
    setDrNumbers((drLogData as any[]).map(d => ({ id: d.id, dr_number: d.dr_number, po_number: d.po_number, client_name: d.supplier_name ?? null })))
    const filteredSOs = (soData ?? []).filter((s: any) => s.so_number) as { id: string; so_number: string }[]
    setSoNumbers(filteredSOs)
    const soIds = filteredSOs.map(s => s.id)
    if (soIds.length > 0) {
      const { data: soItemsData } = await supabase
        .from('so_items')
        .select('item_name, unit, quantity, selling_price, so_id, sales_orders!inner(so_number)')
        .in('so_id', soIds)
      if (soItemsData) {
        const map: Record<string, SOItemOption[]> = {}
        for (const row of soItemsData as any[]) {
          const soNum = row.sales_orders?.so_number
          if (!soNum) continue
          if (!map[soNum]) map[soNum] = []
          map[soNum].push({ item_name: row.item_name, unit: row.unit ?? '', quantity: Number(row.quantity), selling_price: Number(row.selling_price) || 0 })
        }
        setSoItemsMap(map)
      }
    }
    const allFetched: CSIRecord[] = []
    const PAGE = 1000
    let from = 0
    while (true) {
      const { data } = await supabase
        .from('csi_records')
        .select('*')
        .order('si_date', { ascending: false })
        .order('si_number')
        .order('id')
        .range(from, from + PAGE - 1)
      if (!data || data.length === 0) break
      allFetched.push(...data)
      if (data.length < PAGE) break
      from += PAGE
    }
    setRecords(allFetched)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggleSIPortalVisibility(siNumber: string, current: boolean) {
    const next = !current
    const { error } = await supabase.from('csi_records').update({ show_in_portal: next }).eq('si_number', siNumber)
    if (error) { toast.error('Failed to update'); return }
    setRecords(prev => prev.map(r => r.si_number === siNumber ? { ...r, show_in_portal: next } : r))
    toast.success(next ? `SI ${siNumber} visible in portal` : `SI ${siNumber} hidden from portal`)
  }

  async function uploadSiAttachment(siNumber: string, file: File) {
    setUploadingAttachmentSi(siNumber)
    try {
      const url = await uploadImageToDrive(file, { displayName: `SI-${siNumber}`, folder: 'CSI Attachments' })
      const { error } = await supabase.from('csi_records').update({ attachment_url: url }).eq('si_number', siNumber)
      if (error) { toast.error(error.message); return }
      setRecords(prev => prev.map(r => r.si_number === siNumber ? { ...r, attachment_url: url } : r))
      toast.success(`Photo attached to SI ${siNumber}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload image')
    } finally {
      setUploadingAttachmentSi(null)
    }
  }

  async function toggleCsiPortalVisibility(clientId: string, current: boolean) {
    const next = !current
    const { error } = await supabase.from('clients').update({ show_csi_in_portal: next }).eq('id', clientId)
    if (error) { toast.error('Failed to update'); return }
    setClientOptions(prev => prev.map(c => c.id === clientId ? { ...c, show_csi_in_portal: next } : c))
    toast.success(next ? 'CSI visible in portal' : 'CSI hidden from portal')
  }

  async function loadCompanyInfo() {
    const { data } = await supabase.from('system_settings').select('company_name, address, phone, email, tin').single()
    if (data) setCompanyInfo(data)
  }
  useEffect(() => { loadCompanyInfo() }, [])

  async function printCSI(group: typeof siGroups[0]) {
    const { data: allItems } = await supabase
      .from('csi_records')
      .select('item_name,unit,quantity,unit_price,amount')
      .eq('si_number', group.si_number)
      .order('id')
    const items = allItems ?? group.items
    const co = companyInfo
    const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
    const html = `<!DOCTYPE html><html><head><title>SI ${group.si_number}</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
    <style>body{font-family:Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;}</style>
    </head><body class="p-6 text-[11px]">
    <div class="border rounded-lg bg-white p-4 space-y-3 font-sans text-[11px]">
      <div class="flex justify-between items-start border-b pb-3">
        <img src="/cdsc-logo.jpg" alt="CDSC" class="h-12 w-28 object-contain" />
        <div class="text-right">
          <div class="text-[13px] font-bold text-red-700">${co?.company_name ?? 'CDSC Industrial Supply'}</div>
          ${co?.address ? `<div class="text-[9px] text-gray-500">${co.address}</div>` : ''}
          ${co?.phone || co?.email ? `<div class="text-[9px] text-gray-500">${co?.phone ?? ''}${co?.phone && co?.email ? ' | ' : ''}${co?.email ?? ''}</div>` : ''}
          ${co?.tin ? `<div class="text-[9px] text-gray-500">TIN: ${co.tin}</div>` : ''}
        </div>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div>
          <div class="text-[9px] font-semibold uppercase text-gray-400 mb-0.5">Bill To</div>
          <div class="font-semibold text-gray-800">${group.client}</div>
          ${group.po ? `<div class="text-[9px] font-semibold uppercase text-gray-400 mt-1.5 mb-0.5">PO / SO Reference</div><div class="font-mono text-gray-800">${group.po}</div>` : ''}
          ${group.dr ? `<div class="text-[9px] font-semibold uppercase text-gray-400 mt-1.5 mb-0.5">DR Number</div><div class="font-mono text-gray-800">${group.dr}</div>` : ''}
        </div>
        <div class="text-center flex items-center justify-center">
          <div class="text-[16px] font-extrabold text-red-700 uppercase tracking-widest">Sales Invoice</div>
        </div>
        <div class="text-right">
          <div class="text-[9px] font-semibold uppercase text-gray-400">SI Number</div>
          <div class="font-mono font-bold text-gray-800">${group.si_number}</div>
          <div class="text-[9px] font-semibold uppercase text-gray-400 mt-1.5">Date</div>
          <div class="text-gray-800">${fmtDate(group.date)}</div>
        </div>
      </div>
      <table class="w-full border-collapse">
        <thead>
          <tr class="bg-red-700 text-white">
            <th class="text-left px-1.5 py-1">#</th>
            <th class="text-left px-1.5 py-1">Item Description</th>
            <th class="text-left px-1.5 py-1">Unit</th>
            <th class="text-right px-1.5 py-1">Qty</th>
            <th class="text-right px-1.5 py-1">Unit Price</th>
            <th class="text-right px-1.5 py-1">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it: any, i: number) => `<tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
            <td class="px-1.5 py-1 text-gray-400">${i + 1}</td>
            <td class="px-1.5 py-1">${it.item_name}</td>
            <td class="px-1.5 py-1 text-gray-500">${it.unit ?? '—'}</td>
            <td class="px-1.5 py-1 text-right">${Number(it.quantity)}</td>
            <td class="px-1.5 py-1 text-right">₱${Number(it.unit_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
            <td class="px-1.5 py-1 text-right font-medium">₱${Number(it.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot>
          <tr class="border-t-2 border-gray-300">
            <td colspan="5" class="px-1.5 py-2 text-right font-bold text-gray-700">Total</td>
            <td class="px-1.5 py-2 text-right font-bold text-red-700">₱${items.reduce((s: number, it: any) => s + (Number(it.amount) || 0), 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    </body></html>`
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(html)
    win.document.close()
    setTimeout(() => { win.focus(); win.print(); win.close() }, 800)
  }

  // Builds a self-contained (no external stylesheet) HTML document combining every
  // selected SI's line items into one section each, used to render a single PDF
  // attached to bulk emails — htmlToPdfBase64 rasterizes this in an isolated iframe,
  // so it can't rely on the Tailwind CDN script printCSI() uses.
  function buildCsiEmailPdfHtml(groups: typeof siGroups) {
    const co = companyInfo
    const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
    const fmtAmt = (n: number) => Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })
    const sectionsHtml = groups.map((group, gi) => {
      const rowsHtml = group.items.map((it, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${it.item_name}</td>
          <td>${it.unit ?? '—'}</td>
          <td class="r">${Number(it.quantity)}</td>
          <td class="r">₱${fmtAmt(it.unit_price)}</td>
          <td class="r" style="font-weight:600">₱${fmtAmt(it.amount)}</td>
        </tr>`).join('')
      const total = group.items.reduce((s, it) => s + (Number(it.amount) || 0), 0)
      return `
      <div class="${gi > 0 ? 'invoice invoice-spaced' : 'invoice'}">
        <div class="letterhead">
          <img src="/cdsc-logo.jpg" style="height:48px;width:auto;object-fit:contain;" />
          <div>
            <div class="co-name">${co?.company_name ?? 'CDSC Industrial Supply'}</div>
            ${co?.address ? `<div class="co-sub">${co.address}</div>` : ''}
            ${co?.phone || co?.email ? `<div class="co-sub">${co?.phone ?? ''}${co?.phone && co?.email ? ' | ' : ''}${co?.email ?? ''}</div>` : ''}
            ${co?.tin ? `<div class="co-sub">TIN: ${co.tin}</div>` : ''}
          </div>
        </div>
        <div class="party">
          <div>
            <div class="label">Bill To</div>
            <div class="val">${group.client}</div>
            ${group.po ? `<div class="label" style="margin-top:8px">SO / PO Reference</div><div class="val mono">${group.po}</div>` : ''}
            ${group.dr ? `<div class="label" style="margin-top:8px">DR Number</div><div class="val mono">${group.dr}</div>` : ''}
          </div>
          <div style="display:flex;align-items:center;justify-content:center"><div class="title">Sales Invoice</div></div>
          <div style="text-align:right">
            <div class="label">SI Number</div>
            <div class="val mono">${group.si_number}</div>
            <div class="label" style="margin-top:8px">Date</div>
            <div class="val">${fmtDate(group.date)}</div>
          </div>
        </div>
        <table>
          <thead><tr>
            <th>#</th><th>Item Description</th><th>Unit</th><th class="r">Qty</th><th class="r">Unit Price</th><th class="r">Amount</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot><tr>
            <td colspan="5" class="total-label">Total</td>
            <td class="total-val">₱${fmtAmt(total)}</td>
          </tr></tfoot>
        </table>
      </div>`
    }).join('')
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>CSI Invoices</title><style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; background: #fff; color: #111; padding: 28px; font-size: 11px; }
      .invoice-spaced { margin-top: 28px; padding-top: 20px; border-top: 2px dashed #d1d5db; }
      .letterhead { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 14px; }
      .co-name { font-size: 15px; font-weight: 800; color: #b91c1c; text-align: right; }
      .co-sub { font-size: 9px; color: #6b7280; text-align: right; margin-top: 2px; }
      .party { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 14px; }
      .label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #9ca3af; margin-bottom: 2px; letter-spacing: 0.4px; }
      .val { color: #1f2937; font-weight: 600; }
      .mono { font-family: 'Courier New', monospace; }
      .title { text-align: center; font-size: 16px; font-weight: 800; color: #b91c1c; text-transform: uppercase; letter-spacing: 2px; }
      table { width: 100%; border-collapse: collapse; margin-top: 6px; }
      th { background: #b91c1c; color: #fff; text-align: left; padding: 6px 8px; font-size: 10px; }
      th.r, td.r { text-align: right; }
      td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; }
      tr:nth-child(even) td { background: #f9fafb; }
      tfoot td { border-top: 2px solid #d1d5db; font-weight: 800; padding-top: 8px; }
      .total-label { text-align: right; color: #374151; }
      .total-val { text-align: right; color: #b91c1c; }
    </style></head><body>${sectionsHtml}</body></html>`
  }

  // Combined CSI email attachment filename — a short hyphenated SI list when there
  // are few, otherwise a count, so it doesn't turn into an unreadable wall of numbers.
  function csiAttachmentFilename(groups: typeof siGroups) {
    if (groups.length === 1) return `SI-${groups[0].si_number}.pdf`
    if (groups.length <= 5) return `CSI-Invoices-${groups.map(g => g.si_number).join('-')}.pdf`
    return `CSI-Invoices-${groups.length}-invoices.pdf`
  }

  // Prints the currently filtered CSI list (respecting search/client/year filters,
  // across all pages) grouped by SI — reuses the same builder as the bulk-email PDF
  // attachment so the printed layout matches what clients receive.
  function printCsiList() {
    if (sortedSiGroups.length === 0) { toast.error('No CSI records to print'); return }
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(buildCsiEmailPdfHtml(sortedSiGroups))
    win.document.close()
    setTimeout(() => { win.focus(); win.print(); win.close() }, 800)
  }

  function toggleSelectSI(si: string) {
    setSelectedSIs(prev => {
      const next = new Set(prev)
      if (next.has(si)) next.delete(si)
      else next.add(si)
      return next
    })
  }

  function toggleSelectAllOnPage() {
    const pageSIs = pagedSiGroups.map(g => g.si_number)
    const allSelected = pageSIs.length > 0 && pageSIs.every(si => selectedSIs.has(si))
    setSelectedSIs(prev => {
      const next = new Set(prev)
      if (allSelected) pageSIs.forEach(si => next.delete(si))
      else pageSIs.forEach(si => next.add(si))
      return next
    })
  }

  function openBulkEmail() {
    const groups = siGroups.filter(g => selectedSIs.has(g.si_number))
    if (groups.length === 0) return
    const co = companyInfo?.company_name ?? 'CDSC Industrial Supply'
    const uniqueClients = [...new Set(groups.map(g => g.client).filter(c => c && c !== '—'))]
    const singleClient = uniqueClients.length === 1 ? uniqueClients[0] : null
    const clientEmail = singleClient ? clientOptions.find(c => c.company_name === singleClient)?.email : null
    const siList = groups.map(g => g.si_number).join(', ')
    const plural = groups.length > 1
    setBulkEmailTo(clientEmail ?? '')
    setBulkEmailSubject(`Sales Invoice${plural ? 's' : ''} ${siList} — ${co}`)
    setBulkEmailBody(`Dear ${singleClient ?? 'Client'},\n\nPlease find attached Sales Invoice${plural ? 's' : ''} ${siList}.\n\nKindly let us know if you have any questions.\n\nBest regards,\n${co}`)
    setEmailBulkOpen(true)
  }

  async function handleSendBulkEmail() {
    if (!bulkEmailTo.trim()) { toast.error('Recipient email required'); return }
    const groups = siGroups.filter(g => selectedSIs.has(g.si_number))
    if (groups.length === 0) { toast.error('No CSI records selected'); return }
    setSendingBulkEmail(true)
    try {
      const base64 = await htmlToPdfBase64(buildCsiEmailPdfHtml(groups))
      const filename = csiAttachmentFilename(groups)
      await sendEmail({
        to: bulkEmailTo.trim(),
        subject: bulkEmailSubject,
        body: bulkEmailBody,
        attachments: [{ base64, filename }],
      })
      toast.success(`Email sent with 1 combined CSI attachment (${groups.length} SI${groups.length > 1 ? 's' : ''})`)
      setEmailBulkOpen(false)
      setSelectedSIs(new Set())
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to send email')
    } finally {
      setSendingBulkEmail(false)
    }
  }

  // Prints only the field values, absolutely positioned to line up with a pre-printed
  // blank Sales Invoice form — no borders, logo, labels or backgrounds are rendered.
  async function printCSIBlank(group: typeof siGroups[0]) {
    const { data: allItems } = await supabase
      .from('csi_records')
      .select('item_name,unit,quantity,unit_price,amount')
      .eq('si_number', group.si_number)
      .order('id')
    type BlankItem = { item_name: string; unit: string | null; quantity: number; unit_price: number; amount: number }
    const items: BlankItem[] = ((allItems ?? group.items) as BlankItem[]).slice(0, blankCalib.maxRows)
    const client = clientOptions.find(c => c.company_name === group.client)
    const c = blankCalib
    const dateStr = group.date ? format(parseISO(group.date), 'MM/dd/yyyy') : ''
    const addressLine = [client?.address, client?.city, client?.province].filter(Boolean).join(', ')
    const totalDue = items.reduce((s, it) => s + (Number(it.amount) || 0), 0)
    const field = (top: number, left: number, value: string) =>
      value ? `<div style="position:absolute;top:${top}mm;left:${left}mm;">${value}</div>` : ''
    const rows = items.map((it, i) => {
      const top = c.tableTop + i * c.rowHeight
      return field(top, c.colQtyLeft, String(Number(it.quantity))) +
        field(top, c.colUnitLeft, it.unit ?? '') +
        field(top, c.colDescLeft, it.item_name) +
        field(top, c.colUnitPriceLeft, Number(it.unit_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })) +
        field(top, c.colAmountLeft, Number(it.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 }))
    }).join('')
    const html = `<!DOCTYPE html><html><head><title>SI ${group.si_number} (Blank Form)</title>
    <style>
      @page { size: ${c.pageWidthMm}mm ${c.pageHeightMm}mm; margin: 0; }
      html, body { margin: 0; padding: 0; }
      body { position: relative; width: ${c.pageWidthMm}mm; height: ${c.pageHeightMm}mm; font-family: Arial, sans-serif; font-size: ${c.fontSizePt}pt; color: #000; }
      div { white-space: nowrap; }
    </style>
    </head><body>
    ${field(c.dateTop, c.dateLeft, dateStr)}
    ${field(c.clientTop, c.clientLeft, group.client === '—' ? '' : group.client)}
    ${field(c.addressTop, c.addressLeft, addressLine)}
    ${field(c.tinTop, c.tinLeft, client?.tin ?? '')}
    ${field(c.businessStyleTop, c.businessStyleLeft, client?.industry ?? '')}
    <div style="font-size:${c.itemFontSizePt}pt">${rows}</div>
    ${field(c.totalDueTop, c.totalDueLeft, totalDue.toLocaleString('en-PH', { minimumFractionDigits: 2 }))}
    </body></html>`
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(html)
    win.document.close()
    setTimeout(() => { win.focus(); win.print(); win.close() }, 500)
  }

  // Prints a 5mm-spaced ruler grid on the current calibration's page size, so you can
  // hold it up against the physical form and read off Top/Left offsets to enter below.
  function printCalibGrid() {
    const c = blankCalib
    const vLines: string[] = []
    for (let x = 0; x <= c.pageWidthMm; x += 5) {
      vLines.push(`<div style="position:absolute;top:0;left:${x}mm;width:0;border-left:${x % 20 === 0 ? '0.5pt solid #000' : '0.25pt solid #999'};height:${c.pageHeightMm}mm;"></div>`)
      if (x % 20 === 0) vLines.push(`<div style="position:absolute;top:0;left:${x + 0.5}mm;font-size:6pt;">${x}</div>`)
    }
    const hLines: string[] = []
    for (let y = 0; y <= c.pageHeightMm; y += 5) {
      hLines.push(`<div style="position:absolute;top:${y}mm;left:0;height:0;border-top:${y % 20 === 0 ? '0.5pt solid #000' : '0.25pt solid #999'};width:${c.pageWidthMm}mm;"></div>`)
      if (y % 20 === 0) hLines.push(`<div style="position:absolute;top:${y}mm;left:0;font-size:6pt;">${y}</div>`)
    }
    const html = `<!DOCTYPE html><html><head><title>Calibration Grid</title>
    <style>
      @page { size: ${c.pageWidthMm}mm ${c.pageHeightMm}mm; margin: 0; }
      html, body { margin: 0; padding: 0; }
      body { position: relative; width: ${c.pageWidthMm}mm; height: ${c.pageHeightMm}mm; font-family: Arial, sans-serif; color: #000; }
    </style>
    </head><body>${vLines.join('')}${hLines.join('')}</body></html>`
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(html)
    win.document.close()
    setTimeout(() => { win.focus(); win.print(); win.close() }, 500)
  }

  function handlePrint() {
    const el = printRef.current
    if (!el) return
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><title>Sales Invoice</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
    <style>body { font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }</style>
  </head><body class="p-6 text-[11px]">${el.innerHTML}</body></html>`)
    win.document.close()
    setTimeout(() => { win.focus(); win.print(); win.close() }, 800)
  }

  const availableYears = Array.from(new Set(records.map(r => r.si_date?.slice(0, 4)).filter(Boolean))).sort((a, b) => b.localeCompare(a))

  const filtered = records.filter(r => {
    const q = search.toLowerCase()
    const matchSearch = !q || (
      r.si_number.toLowerCase().includes(q) ||
      (r.client_name ?? '').toLowerCase().includes(q) ||
      r.item_name.toLowerCase().includes(q) ||
      (r.dr_number ?? '').toLowerCase().includes(q)
    )
    const matchClient = !clientFilter || (r.client_name ?? '') === clientFilter
    const matchYear = yearFilter === 'all' || r.si_date?.slice(0, 4) === yearFilter
    return matchSearch && matchClient && matchYear
  })

  const totalAmount = filtered.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const uniqueSIs = new Set(filtered.map(r => r.si_number)).size

  const siGroups: { si_number: string; date: string; client: string; po: string | null; dr: string | null; items: CSIRecord[]; total: number; show_in_portal: boolean; attachment_url: string | null; collection_status: string | null }[] = []
  const siSeen = new Set<string>()
  for (const rec of filtered) {
    if (!siSeen.has(rec.si_number)) {
      siSeen.add(rec.si_number)
      const siItems = filtered.filter(r => r.si_number === rec.si_number)
      siGroups.push({
        si_number: rec.si_number,
        date: rec.si_date,
        client: rec.client_name ?? '—',
        po: rec.po_number,
        dr: rec.dr_number,
        items: siItems,
        total: siItems.reduce((s, r) => s + (Number(r.amount) || 0), 0),
        show_in_portal: rec.show_in_portal !== false,
        attachment_url: rec.attachment_url ?? null,
        collection_status: rec.collection_status ?? null,
      })
    }
  }

  const sortedSiGroups = [...siGroups].sort((a, b) => compareBySortOption(sortOption,
    { date: a.date, si: a.si_number, amount: a.total, client: a.client },
    { date: b.date, si: b.si_number, amount: b.total, client: b.client }))
  const sortedFiltered = [...filtered].sort((a, b) => compareBySortOption(sortOption,
    { date: a.si_date, si: a.si_number, amount: Number(a.amount) || 0, client: a.client_name ?? '' },
    { date: b.si_date, si: b.si_number, amount: Number(b.amount) || 0, client: b.client_name ?? '' }))

  const PAGE_SIZE = 30
  const pagedSiGroups = sortedSiGroups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pagedFiltered = sortedFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const activeTotal = viewMode === 'by-si' ? siGroups.length : filtered.length
  const totalPages = Math.max(1, Math.ceil(activeTotal / PAGE_SIZE))

  useEffect(() => { setPage(1) }, [search, clientFilter, yearFilter, viewMode, sortOption])
  useEffect(() => { if (viewMode !== 'by-si') setSelectedSIs(new Set()) }, [viewMode])

  function onSortCol(col: SortCol) {
    const isActive = sortColOf(sortOption) === col
    const nextDir: 'asc' | 'desc' = isActive && sortDirOf(sortOption) === 'asc' ? 'desc' : 'asc'
    setSortOption(`${col}_${nextDir}` as SortOption)
  }

  function toggleSI(si: string) {
    setExpandedSIs(prev => {
      const next = new Set(prev)
      if (next.has(si)) next.delete(si)
      else next.add(si)
      return next
    })
  }

  // Suggests the next sequential SI number after the highest one used so far, plus any
  // gaps (skipped/missing numbers) in the existing sequence — so a skipped number can
  // still be picked instead of always jumping straight to the newest one.
  function getSiNumberSuggestions(): { next: string; missing: string[] } {
    const nums: number[] = []
    let width = 5
    for (const r of records) {
      if (/^\d+$/.test(r.si_number)) {
        nums.push(parseInt(r.si_number, 10))
        width = Math.max(width, r.si_number.length)
      }
    }
    if (nums.length === 0) return { next: '1'.padStart(width, '0'), missing: [] }
    const max = Math.max(...nums)
    const existing = new Set(nums)
    const missing: string[] = []
    for (let n = 1; n < max; n++) {
      if (!existing.has(n)) missing.push(String(n).padStart(width, '0'))
    }
    return { next: String(max + 1).padStart(width, '0'), missing }
  }

  function openAdd() {
    setEditingSiNumber(null)
    const { next, missing } = getSiNumberSuggestions()
    setSiNumberOptions([
      ...missing.map(value => ({ value, tag: 'missing' as const })),
      { value: next, tag: 'next' as const },
    ])
    setHeader({ ...emptyHeader(), si_number: next })
    setItems([emptyItem()])
    setDrNumberLockedFromSo(false)
    setOpen(true)
  }

  function openEdit(siNumber: string) {
    const siRecords = records.filter(r => r.si_number === siNumber)
    if (siRecords.length === 0) return
    const first = siRecords[0]
    setEditingSiNumber(siNumber)
    const { next, missing } = getSiNumberSuggestions()
    const options: { value: string; tag: 'current' | 'next' | 'missing' }[] = [
      { value: siNumber, tag: 'current' },
      ...missing.map(value => ({ value, tag: 'missing' as const })),
      { value: next, tag: 'next' as const },
    ]
    setSiNumberOptions(options)
    setDrNumberLockedFromSo(false)
    setHeader({
      si_date: first.si_date,
      si_number: first.si_number,
      po_number: first.po_number ?? '',
      client_name: first.client_name ?? '',
      dr_number: first.dr_number ?? '',
    })
    setItems(siRecords.map(r => ({
      item_name: r.item_name,
      unit: r.unit ?? '',
      quantity: String(r.quantity ?? ''),
      unit_price: String(r.unit_price ?? ''),
    })))
    setOpen(true)
  }

  function closeForm() {
    setOpen(false)
    setHeader(emptyHeader())
    setItems([emptyItem()])
    setEditingSiNumber(null)
  }

  function handleCancelClick() {
    const hasData = !!editingSiNumber || header.po_number || header.client_name || header.dr_number || items.some(it => it.item_name)
    if (hasData) { setDiscardConfirmOpen(true); return }
    closeForm()
  }

  function discardForm() {
    setDiscardConfirmOpen(false)
    closeForm()
  }

  function openAddItem() {
    setNewItemForm({ item_name: itemQuery.trim(), unit_of_measure: '', selling_price: '', attribute: '' })
    setNewItemImageFile(null)
    setNewItemImageUrl(null)
    setNewItemAttributeTypeId('')
    setAddItemOpen(true)
  }

  function handleNewItemAttributeTypeChange(id: string) {
    setNewItemAttributeTypeId(id)
    setNewItemForm(f => ({ ...f, attribute: '' }))
  }

  // Derives a short letters-only prefix from the item name (e.g. "Laptop Stand" -> "LAP")
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

    let imageUrl: string | null = null
    if (newItemImageFile) {
      try {
        imageUrl = await uploadImageToDrive(newItemImageFile, { displayName: name, folder: 'Items' })
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to upload image')
        setSavingNewItem(false)
        return
      }
    }

    const { error } = await supabase.from('items').insert({
      item_code,
      item_name: name,
      unit_of_measure,
      selling_price: newItemForm.selling_price.trim() ? parseFloat(newItemForm.selling_price) : null,
      attribute: newItemForm.attribute.trim() || null,
      image_url: imageUrl,
      image_urls: imageUrl ? [imageUrl] : [],
      status: 'active',
    })
    if (error) { toast.error(error.message); setSavingNewItem(false); return }
    const sellingPrice = newItemForm.selling_price.trim() ? parseFloat(newItemForm.selling_price) : null
    const newOption: ItemOption = { item_name: name, unit_of_measure, selling_price: sellingPrice }
    setItemOptions(prev => [...prev, newOption].sort((a, b) => a.item_name.localeCompare(b.item_name)))
    if (itemSearchIdx !== null) {
      setItems(prev => prev.map((it, idx) => idx === itemSearchIdx ? {
        ...it,
        item_name: name,
        unit: unit_of_measure,
        unit_price: sellingPrice != null ? String(sellingPrice) : it.unit_price,
      } : it))
    }
    toast.success('Item added')
    setSavingNewItem(false)
    setAddItemOpen(false)
    setItemSearchIdx(null)
  }

  async function updateSellingPriceInConfig(i: number) {
    const it = items[i]
    const price = Number(it.unit_price)
    if (!it.item_name) { toast.error('Select an item first'); return }
    if (!price || price <= 0) { toast.error('Enter a Selling Price first'); return }
    const { error } = await supabase.from('items').update({ selling_price: price }).eq('item_name', it.item_name)
    if (error) { toast.error(error.message); return }
    setItemOptions(prev => prev.map(o => o.item_name === it.item_name ? { ...o, selling_price: price } : o))
    toast.success(`Selling price for "${it.item_name}" updated to ${formatPeso(price)} in Configuration`)
  }

  async function save() {
    if (!header.si_number.trim()) { toast.error('SI Number is required'); return }
    if (!header.si_date) { toast.error('Date is required'); return }
    const validItems = items.filter(it => it.item_name.trim())
    if (validItems.length === 0) { toast.error('At least one item is required'); return }
    setSaving(true)

    // Delete existing records for this SI number if editing
    if (editingSiNumber) {
      await supabase.from('csi_records').delete().eq('si_number', editingSiNumber)
    }

    const rows = validItems.map(it => ({
      si_date: header.si_date,
      si_number: header.si_number.trim(),
      po_number: header.po_number || null,
      client_name: header.client_name || null,
      item_name: it.item_name.trim(),
      unit: it.unit || null,
      quantity: Number(it.quantity) || 0,
      unit_price: Number(it.unit_price) || 0,
      amount: (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
      dr_number: header.dr_number || null,
    }))

    const { error } = await supabase.from('csi_records').insert(rows)
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success(editingSiNumber ? 'Record updated' : 'Record added')
    setOpen(false)
    load()
    setSaving(false)
  }

  async function confirmDelete() {
    if (deleteId === null) return
    const { error } = await supabase.from('csi_records').delete().eq('id', deleteId)
    if (error) { toast.error(error.message); setDeleteId(null); return }
    setDeleteId(null)
    load()
    toast.success('Record deleted')
  }

  const totalItems = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0)
  const filteredSearchItems = itemQuery.trim()
    ? itemOptions.filter(it => it.item_name.toLowerCase().includes(itemQuery.toLowerCase()))
    : itemOptions

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">CSI Monitoring</h1>
          <p className="text-muted-foreground text-sm">Charge Sales Invoice records</p>
        </div>
        {open && (
          <Button variant="outline" onClick={handleCancelClick}>
            <X className="h-4 w-4 mr-2" />Cancel
          </Button>
        )}
      </div>

      {open && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-red-600" />
              {editingSiNumber ? 'Edit CSI Record' : 'New CSI Record'}
            </CardTitle>
            <div className="flex rounded-md border overflow-hidden w-fit lg:hidden">
              <button onClick={() => setActiveTab('form')} className={`px-4 py-1.5 text-sm font-medium ${activeTab === 'form' ? 'bg-red-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted'}`}>Form</button>
              <button onClick={() => setActiveTab('preview')} className={`px-4 py-1.5 text-sm font-medium border-l ${activeTab === 'preview' ? 'bg-red-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted'}`}>Preview</button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT: form */}
              <div className={`space-y-4 ${activeTab === 'preview' ? 'hidden lg:block' : 'block'}`}>
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">SI Details</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Date <span className="text-destructive">*</span></Label>
                      <Input type="date" value={header.si_date} onChange={e => setHeader(h => ({ ...h, si_date: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>SI Number <span className="text-destructive">*</span></Label>
                      <Select value={header.si_number} onValueChange={v => setHeader(h => ({ ...h, si_number: v ?? '' }))}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Select SI number…" /></SelectTrigger>
                        <SelectContent>
                          {siNumberOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.value}
                              {opt.tag === 'current' && <span className="text-xs text-muted-foreground ml-1.5">(Current)</span>}
                              {opt.tag === 'next' && <span className="text-xs text-muted-foreground ml-1.5">(Next)</span>}
                              {opt.tag === 'missing' && <span className="text-xs text-amber-600 ml-1.5">(Missing)</span>}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Client</Label>
                    <Select
                      value={header.client_name}
                      onValueChange={v => setHeader(h => {
                        const nextClient = v ?? ''
                        const drStillValid = !h.dr_number || drNumberLockedFromSo || drNumbers.some(d => d.dr_number === h.dr_number && d.client_name === nextClient)
                        return { ...h, client_name: nextClient, dr_number: drStillValid ? h.dr_number : '' }
                      })}
                    >
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select client…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">— None —</SelectItem>
                        {clientOptions.map(c => <SelectItem key={c.id} value={c.company_name}>{c.company_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-[2fr_1fr] gap-4">
                    <div className="space-y-1.5">
                      <Label>SO Number</Label>
                      <Select value={header.po_number} onValueChange={v => { setHeader(h => ({ ...h, po_number: v ?? '' })); setDrNumberLockedFromSo(false) }}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Select SO…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">— None —</SelectItem>
                          {soNumbers.map(s => <SelectItem key={s.id} value={s.so_number}>{s.so_number}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {header.po_number && soItemsMap[header.po_number]?.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setItems(soItemsMap[header.po_number].map(i => ({ item_name: i.item_name, unit: i.unit, quantity: String(i.quantity), unit_price: i.selling_price ? String(i.selling_price) : '' })))
                            // A DR already recorded against this SO is the correct DR for this invoice —
                            // lock the field so it can't be swapped to an unrelated one by mistake.
                            const linkedDr = drNumbers.find(d => d.po_number === header.po_number)
                            if (linkedDr) {
                              setHeader(h => ({ ...h, dr_number: linkedDr.dr_number }))
                              setDrNumberLockedFromSo(true)
                            } else {
                              setDrNumberLockedFromSo(false)
                            }
                          }}
                          className="w-full h-7 text-xs border border-dashed border-blue-400 text-blue-600 hover:bg-blue-50 rounded-md mt-1 font-medium"
                        >
                          Load items from SO
                        </button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>DR Number</Label>
                      <Select value={header.dr_number} onValueChange={v => setHeader(h => ({ ...h, dr_number: v ?? '' }))} disabled={drNumberLockedFromSo}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Select DR…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">— None —</SelectItem>
                          {drNumbers
                            .filter(d => !header.client_name || d.client_name === header.client_name)
                            .map(d => <SelectItem key={d.id} value={d.dr_number}>{d.dr_number}</SelectItem>)}
                          {header.dr_number && !drNumbers.some(d => d.dr_number === header.dr_number) && (
                            <SelectItem value={header.dr_number}>{header.dr_number}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      {drNumberLockedFromSo && (
                        <p className="text-[11px] text-muted-foreground">Locked — matched from the loaded SO&apos;s DR.</p>
                      )}
                      {!drNumberLockedFromSo && header.client_name && (
                        <p className="text-[11px] text-muted-foreground">Showing DR numbers for {header.client_name} only.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: live preview */}
              <div className={`${activeTab === 'form' ? 'hidden lg:block' : 'block'}`}>
                <div className="sticky top-0">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live Preview</p>
                    <div className="flex gap-1.5">
                      <Button type="button" variant="outline" size="sm" onClick={openCalib} className="h-7 px-2 text-xs gap-1">
                        <SlidersHorizontal className="h-3.5 w-3.5" /> Calibrate
                      </Button>
                      {editingSiNumber && (
                        <Button
                          type="button" variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
                          onClick={() => {
                            const grp = siGroups.find(g => g.si_number === editingSiNumber)
                            if (grp) printCSIBlank(grp)
                          }}
                        >
                          <FileOutput className="h-3.5 w-3.5" /> Blank Form
                        </Button>
                      )}
                      <Button type="button" variant="outline" size="sm" onClick={handlePrint} className="h-7 px-2 text-xs gap-1">
                        <Printer className="h-3.5 w-3.5" /> Print
                      </Button>
                    </div>
                  </div>
                  <div ref={printRef} className="border rounded-lg bg-white text-[11px] p-4 shadow-sm space-y-3 font-sans">
                    {/* Header */}
                    <div className="flex justify-between items-start border-b pb-3">
                      <img src="/cdsc-logo.jpg" alt="CDSC" className="h-12 w-28 object-contain" />
                      <div className="text-right">
                        <div className="text-[13px] font-bold text-red-700 mb-0.5">{companyInfo?.company_name || 'CDSC Industrial Supply'}</div>
                        {companyInfo?.address && <div className="text-[9px] text-gray-500">{companyInfo.address}</div>}
                        {(companyInfo?.phone || companyInfo?.email) && (
                          <div className="text-[9px] text-gray-500">{companyInfo.phone}{companyInfo.phone && companyInfo.email ? ' | ' : ''}{companyInfo.email}</div>
                        )}
                        {companyInfo?.tin && <div className="text-[9px] text-gray-500">TIN: {companyInfo.tin}</div>}
                      </div>
                    </div>

                    {/* Party info */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="text-[9px] font-semibold uppercase text-gray-400 mb-0.5">Client</div>
                        <div className="font-semibold text-gray-800">{header.client_name || <span className="text-gray-400 italic">—</span>}</div>
                        {header.po_number && <>
                          <div className="text-[9px] font-semibold uppercase text-gray-400 mt-1.5 mb-0.5">SO Reference</div>
                          <div className="font-mono text-gray-800">{header.po_number}</div>
                        </>}
                        {header.dr_number && <>
                          <div className="text-[9px] font-semibold uppercase text-gray-400 mt-1.5 mb-0.5">DR Number</div>
                          <div className="font-mono text-gray-800">{header.dr_number}</div>
                        </>}
                      </div>
                      <div className="text-center flex items-center justify-center">
                        <div className="text-[15px] font-extrabold text-red-700 uppercase tracking-widest">Sales Invoice</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] font-semibold uppercase text-gray-400">SI Number</div>
                        <div className="font-mono font-bold text-gray-800">{header.si_number || '—'}</div>
                        <div className="text-[9px] font-semibold uppercase text-gray-400 mt-1.5">Date</div>
                        <div className="text-gray-800">{header.si_date ? new Date(header.si_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</div>
                      </div>
                    </div>

                    {/* Items table */}
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-red-700 text-white">
                          <th className="text-left px-1.5 py-1">#</th>
                          <th className="text-left px-1.5 py-1">Item Description</th>
                          <th className="text-left px-1.5 py-1">Unit</th>
                          <th className="text-right px-1.5 py-1">Qty</th>
                          <th className="text-right px-1.5 py-1">Unit Price</th>
                          <th className="text-right px-1.5 py-1">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.filter(it => it.item_name).length === 0 ? (
                          <tr><td colSpan={6} className="px-1.5 py-3 text-center text-gray-300 italic">No items added yet</td></tr>
                        ) : items.map((item, i) => {
                          const unitPrice = Number(item.unit_price) || 0
                          const amt = (Number(item.quantity) || 0) * unitPrice
                          return item.item_name ? (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-1.5 py-1 text-gray-400">{i + 1}</td>
                              <td className="px-1.5 py-1">{item.item_name}</td>
                              <td className="px-1.5 py-1 text-gray-500">{item.unit || '—'}</td>
                              <td className="px-1.5 py-1 text-right">{Number(item.quantity) || '—'}</td>
                              <td className="px-1.5 py-1 text-right">{unitPrice ? formatPeso(unitPrice) : '—'}</td>
                              <td className="px-1.5 py-1 text-right font-medium">{formatPeso(amt)}</td>
                            </tr>
                          ) : null
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-300">
                          <td colSpan={5} className="px-1.5 py-1 text-right font-bold text-gray-700">Total</td>
                          <td className="px-1.5 py-1 text-right font-bold text-red-700">{formatPeso(totalItems)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Items — full width so all columns are visible */}
            <div className={`space-y-2 mt-6 ${activeTab === 'preview' ? 'hidden lg:block' : 'block'}`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">Line Items</p>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-12">No.</TableHead>
                      <TableHead className="w-24">Qty</TableHead>
                      <TableHead className="w-24">Unit</TableHead>
                      <TableHead className="min-w-[260px]">Item Description</TableHead>
                      <TableHead className="w-32">Unit Price (₱)</TableHead>
                      <TableHead className="w-36">Selling Price (₱)</TableHead>
                      <TableHead className="w-32 text-right">Amount</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, i) => {
                      const amt = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0)
                      return (
                        <TableRow
                          key={i}
                          className={dragItemIndex === i ? 'bg-red-50/60' : undefined}
                          onDragOver={e => { if (dragItemIndex !== null) e.preventDefault() }}
                          onDrop={e => {
                            e.preventDefault()
                            if (dragItemIndex === null || dragItemIndex === i) return
                            setItems(prev => {
                              const next = [...prev]
                              const [moved] = next.splice(dragItemIndex, 1)
                              next.splice(i, 0, moved)
                              return next
                            })
                            setDragItemIndex(null)
                          }}
                        >
                          <TableCell className="py-1.5">
                            <div
                              className="flex items-center gap-1 text-sm text-muted-foreground cursor-grab active:cursor-grabbing"
                              draggable
                              onDragStart={() => setDragItemIndex(i)}
                              onDragEnd={() => setDragItemIndex(null)}
                              title="Drag to reorder"
                            >
                              <GripVertical className="h-3.5 w-3.5 shrink-0" />
                              {i + 1}
                            </div>
                          </TableCell>
                          <TableCell className="py-1.5">
                            <Input type="number" min={0} className="h-8 text-sm" placeholder="0" value={item.quantity}
                              onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: e.target.value } : it))} />
                          </TableCell>
                          <TableCell className="py-1.5">
                            <div className="h-8 flex items-center px-2 text-sm bg-muted/30 rounded border text-muted-foreground">{item.unit || '—'}</div>
                          </TableCell>
                          <TableCell className="py-1.5">
                            <div className="flex items-center gap-1">
                              <Select value={item.item_name} onValueChange={val => {
                                const opt = itemOptions.find(o => o.item_name === (val ?? ''))
                                setItems(prev => prev.map((it, idx) => idx === i ? {
                                  ...it,
                                  item_name: val ?? '',
                                  unit: opt?.unit_of_measure ?? it.unit,
                                  unit_price: opt?.selling_price != null ? String(opt.selling_price) : it.unit_price,
                                } : it))
                              }}>
                                <SelectTrigger className="h-8 text-sm flex-1"><SelectValue placeholder="Select item…" /></SelectTrigger>
                                <SelectContent>
                                  {itemOptions.map(opt => (
                                    <SelectItem key={opt.item_name} value={opt.item_name}>
                                      {opt.item_name} <span className="text-xs text-muted-foreground ml-1">({opt.unit_of_measure})</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" title="Search items"
                                onClick={() => { setItemSearchIdx(i); setItemQuery('') }}>
                                <Box className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="py-1.5">
                            <div className="h-8 flex items-center px-2 text-sm bg-muted/30 rounded border text-muted-foreground tabular-nums" title="Current Configuration selling price (for reference)">
                              {(() => {
                                const sp = itemOptions.find(o => o.item_name === item.item_name)?.selling_price
                                return sp != null ? formatPeso(sp) : '—'
                              })()}
                            </div>
                          </TableCell>
                          <TableCell className="py-1.5">
                            <div className="flex items-center gap-1">
                              <Input type="number" min={0} step="0.01" className="h-8 text-sm flex-1" placeholder="0.00" value={item.unit_price}
                                onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, unit_price: e.target.value } : it))} />
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-blue-600"
                                title="Update this item's selling price in Configuration to match this Selling Price"
                                onClick={() => updateSellingPriceInConfig(i)}>
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="py-1.5 text-right text-sm font-medium tabular-nums">
                            ₱{amt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="py-1.5">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                              onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))} disabled={items.length === 1}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between px-3 py-2 bg-muted/20 border-t">
                  <Button type="button" variant="outline" size="sm" onClick={() => setItems(prev => [...prev, emptyItem()])}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Add Item
                  </Button>
                  <span className="text-sm font-semibold">Total: ₱{totalItems.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
              <Button variant="outline" onClick={handleCancelClick}>Cancel</Button>
              <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : editingSiNumber ? 'Update' : 'Save'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!open && (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="relative overflow-hidden border-none shadow-md shadow-black/5 ring-1 ring-black/5 rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-transparent" />
          <CardContent className="relative pt-4 pb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-2xl font-bold">{loading ? '—' : uniqueSIs}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Total SI Numbers</div>
            </div>
            <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-sm shadow-red-500/30">
              <FileText className="h-5 w-5 text-white" />
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-none shadow-md shadow-black/5 ring-1 ring-black/5 rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-transparent" />
          <CardContent className="relative pt-4 pb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-2xl font-bold">{loading ? '—' : filtered.length}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Line Items</div>
            </div>
            <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm shadow-blue-500/30">
              <List className="h-5 w-5 text-white" />
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-none shadow-md shadow-black/5 ring-1 ring-black/5 rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-transparent" />
          <CardContent className="relative pt-4 pb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-2xl font-bold text-green-600">{loading ? '—' : formatPeso(totalAmount)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Total Amount</div>
            </div>
            <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-sm shadow-green-500/30">
              <Wallet className="h-5 w-5 text-white" />
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {!open && (() => {
        const PALETTE = ['#dc2626','#2563eb','#16a34a','#d97706','#7c3aed','#0891b2','#be185d','#65a30d']

        const clientStats = clientOptions.map((c, i) => {
          const clientRecs = filtered.filter(r => r.client_name === c.company_name)
          const siSet = new Set(clientRecs.map(r => r.si_number))
          return {
            name: c.company_name,
            shortName: c.company_name.split(' ').slice(0, 2).join(' '),
            siCount: siSet.size,
            lineItems: clientRecs.length,
            totalAmount: clientRecs.reduce((s, r) => s + (Number(r.amount) || 0), 0),
            color: PALETTE[i % PALETTE.length],
          }
        }).filter(c => c.siCount > 0).sort((a, b) => b.totalAmount - a.totalAmount)

        if (clientStats.length === 0) return null

        const grandTotal = clientStats.reduce((s, c) => s + c.totalAmount, 0)

        // Monthly trend data
        const monthMap: Record<string, number> = {}
        for (const r of filtered) {
          if (!r.si_date) continue
          const key = r.si_date.slice(0, 7) // "YYYY-MM"
          monthMap[key] = (monthMap[key] || 0) + (Number(r.amount) || 0)
        }
        const trendData = Object.entries(monthMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-12)
          .map(([month, amount]) => ({
            month: format(parseISO(month + '-01'), 'MMM yy'),
            amount,
          }))

        const CustomTooltip = ({ active, payload, label }: any) => {
          if (!active || !payload?.length) return null
          return (
            <div className="bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3 text-sm">
              <p className="font-semibold text-gray-800 mb-1">{label}</p>
              {payload.map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
                  <span className="text-gray-500 text-xs">{p.name}:</span>
                  <span className="font-bold text-xs text-gray-900">
                    {p.name === 'Revenue' || p.name === 'amount'
                      ? formatPeso(p.value)
                      : p.value}
                  </span>
                </div>
              ))}
            </div>
          )
        }

        return (
          <div className="space-y-4">
            {/* Charts group header */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Analytics Charts</h3>
              <button
                onClick={() => setChartsExpanded(p => !p)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors"
              >
                {chartsExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {chartsExpanded ? 'Collapse' : 'Expand'} Charts
              </button>
            </div>

            {chartsExpanded && <>
            {/* Row 1: Revenue bar + Revenue Share stacked */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Revenue Bar Chart */}
              <Card className="lg:col-span-2 border-none shadow-md shadow-black/5 ring-1 ring-black/5 rounded-2xl">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-semibold">Revenue by Client</CardTitle>
                  <p className="text-xs text-muted-foreground">Total invoiced amount per client</p>
                </CardHeader>
                <CardContent className="px-2 pb-4">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={clientStats} margin={{ top: 8, right: 16, left: 8, bottom: 40 }} barSize={32}>
                        <defs>
                          {clientStats.map((c, i) => (
                            <linearGradient key={i} id={`bar-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={c.color} stopOpacity={1} />
                              <stop offset="100%" stopColor={c.color} stopOpacity={0.6} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="shortName" tick={{ fontSize: 11, fill: '#6b7280' }} angle={-30} textAnchor="end" interval={0} height={50} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={v => `₱${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={52} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />
                        <Bar dataKey="totalAmount" name="Revenue" radius={[6, 6, 0, 0]}>
                          {clientStats.map((_, i) => (
                            <Cell key={i} fill={`url(#bar-grad-${i})`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Revenue Share – stacked progress breakdown */}
              <Card className="flex flex-col border-none shadow-md shadow-black/5 ring-1 ring-black/5 rounded-2xl">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-semibold">Revenue Share</CardTitle>
                  <p className="text-xs text-muted-foreground">% of total per client</p>
                </CardHeader>
                <CardContent className="px-5 pb-5 flex-1 flex flex-col justify-center gap-4">
                    {/* stacked single bar */}
                    <div className="flex h-5 w-full rounded-full overflow-hidden gap-0.5">
                      {clientStats.map((c, i) => {
                        const pct = grandTotal > 0 ? (c.totalAmount / grandTotal) * 100 : 0
                        return pct > 0 ? (
                          <div key={i} style={{ width: `${pct}%`, background: c.color }} title={`${c.shortName}: ${pct.toFixed(1)}%`} className="transition-all duration-700" />
                        ) : null
                      })}
                    </div>
                    {/* per-client rows */}
                    <div className="space-y-3">
                      {clientStats.map((c, i) => {
                        const pct = grandTotal > 0 ? (c.totalAmount / grandTotal) * 100 : 0
                        return (
                          <div key={i}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="inline-block h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: c.color }} />
                                <span className="text-xs font-medium truncate max-w-[120px]" title={c.name}>{c.shortName}</span>
                              </div>
                              <div className="flex items-center gap-2 ml-2 shrink-0">
                                <span className="text-[11px] text-muted-foreground tabular-nums">{formatPeso(c.totalAmount)}</span>
                                <span className="text-xs font-bold tabular-nums" style={{ color: c.color }}>{pct.toFixed(1)}%</span>
                              </div>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: c.color }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {clientStats.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No data</p>}
                </CardContent>
              </Card>
            </div>

            {/* Row 2: Area trend + SI vs Items grouped bar */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Monthly Revenue Trend */}
              {trendData.length > 1 && (
                <Card className="border-none shadow-md shadow-black/5 ring-1 ring-black/5 rounded-2xl">
                  <CardHeader className="pb-2 pt-4 px-5">
                    <CardTitle className="text-sm font-semibold">Monthly Revenue Trend</CardTitle>
                    <p className="text-xs text-muted-foreground">Last 12 months</p>
                  </CardHeader>
                  <CardContent className="px-2 pb-4">
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={trendData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                        <defs>
                          <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#dc2626" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={v => `₱${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={52} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="amount" name="Revenue" stroke="#dc2626" strokeWidth={2} fill="url(#area-grad)" dot={{ fill: '#dc2626', r: 3 }} activeDot={{ r: 5 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* SI Count vs Line Items grouped bar */}
              <Card className="border-none shadow-md shadow-black/5 ring-1 ring-black/5 rounded-2xl">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-semibold">SI Count vs Line Items</CardTitle>
                  <p className="text-xs text-muted-foreground">Invoice activity per client</p>
                </CardHeader>
                <CardContent className="px-2 pb-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={clientStats} margin={{ top: 8, right: 16, left: 8, bottom: 40 }} barSize={14} barGap={3}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="shortName" tick={{ fontSize: 11, fill: '#6b7280' }} angle={-30} textAnchor="end" interval={0} height={50} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="circle" iconSize={8} />
                      <Bar dataKey="siCount" name="SI Count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="lineItems" name="Line Items" fill="#dc2626" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            </>}
          </div>
        )
      })()}

      {!open && <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Client</Label>
          <Select value={clientFilter || '__all__'} onValueChange={v => setClientFilter(!v || v === '__all__' ? '' : v)}>
            <SelectTrigger className="h-9 w-72 text-sm">
              <SelectValue className="truncate">{(v: string) => v === '__all__' ? 'Client' : v}</SelectValue>
            </SelectTrigger>
            <SelectContent className="min-w-[320px]">
              <SelectItem value="__all__">All Clients</SelectItem>
              {clientOptions.map(c => <SelectItem key={c.id} value={c.company_name}>{c.company_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Year</Label>
          <Select value={yearFilter} onValueChange={v => setYearFilter(v ?? 'all')}>
            <SelectTrigger className="h-9 w-32 text-sm">
              <SelectValue>{(v: string) => v === 'all' ? 'Filter by Year' : v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Sort</Label>
          <Select value={sortOption} onValueChange={v => setSortOption((v as SortOption) ?? 'date_desc')}>
            <SelectTrigger className="h-9 w-44 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {clientFilter && (() => {
          const sel = clientOptions.find(c => c.company_name === clientFilter)
          return sel ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleCsiPortalVisibility(sel.id, sel.show_csi_in_portal)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border font-medium transition-colors ${sel.show_csi_in_portal ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100'}`}
                title="Toggle whether CSI Issued is visible in the client portal"
              >
                <span className={`inline-block h-2 w-2 rounded-full ${sel.show_csi_in_portal ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                Portal: CSI {sel.show_csi_in_portal ? 'Visible' : 'Hidden'}
              </button>
              <button onClick={() => setClientFilter('')} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border rounded-md px-2 py-1">
                <X className="h-3 w-3" /> Clear
              </button>
            </div>
          ) : null
        })()}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">View</Label>
          <div className="flex border rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('by-si')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${viewMode === 'by-si' ? 'bg-red-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted'}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> By SI
            </button>
            <button
              onClick={() => setViewMode('all-items')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border-l ${viewMode === 'all-items' ? 'bg-red-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted'}`}
            >
              <List className="h-3.5 w-3.5" /> All Items
            </button>
            <button
              onClick={() => setViewMode('cross-ref')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border-l ${viewMode === 'cross-ref' ? 'bg-red-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted'}`}
            >
              <Search className="h-3.5 w-3.5" /> CSI vs DR
            </button>
          </div>
        </div>
        <Button variant="outline" onClick={printCsiList} className="ml-auto border-gray-300 text-gray-700 gap-1.5">
          <Printer className="h-4 w-4" /> Print
        </Button>
        <Button onClick={openAdd} className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-2" /> New Record
        </Button>
        {viewMode === 'by-si' && selectedSIs.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{selectedSIs.size} selected</span>
            <Button size="sm" onClick={openBulkEmail} className="bg-red-600 hover:bg-red-700 h-9">
              <Mail className="h-3.5 w-3.5 mr-1.5" /> Send Email
            </Button>
            <button onClick={() => setSelectedSIs(new Set())} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border rounded-md px-2 py-1.5">
              <X className="h-3 w-3" /> Clear
            </button>
          </div>
        )}
      </div>}

      {!open && <Card className="border-none shadow-md shadow-black/5 ring-1 ring-black/5 rounded-2xl overflow-hidden py-0 gap-0">
        <CardHeader className="pb-2 pt-5 px-5 bg-gradient-to-r from-muted/50 to-transparent">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-red-600" /> Charge Sales Invoice Log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
            {viewMode === 'cross-ref' ? (() => {
              const csiForCrossRef = clientFilter ? filtered.filter(r => r.client_name === clientFilter) : filtered
              const drForCrossRef = clientFilter ? drItemsForCrossRef.filter(d => d.client_name === clientFilter) : drItemsForCrossRef
              const csiItems = new Set(csiForCrossRef.map(r => r.item_name.trim().toLowerCase()))
              const drItems = new Set(drForCrossRef.map(d => d.item_name.trim().toLowerCase()))
              const inCsiNotDr = [...new Set(csiForCrossRef.map(r => r.item_name))].filter(n => !drItems.has(n.trim().toLowerCase()))
              const inDrNotCsi = [...new Set(drForCrossRef.map(d => d.item_name))].filter(n => !csiItems.has(n.trim().toLowerCase()))
              return (
                <div className="p-4 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-semibold text-amber-700">In CSI — Not in DR Logs</span>
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{inCsiNotDr.length}</span>
                      </div>
                      {inCsiNotDr.length === 0 ? (
                        <p className="text-xs text-muted-foreground">All CSI items are covered by DR logs.</p>
                      ) : (
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead>Item Name</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {inCsiNotDr.map(name => (
                              <TableRow
                                key={name}
                                className="cursor-pointer hover:bg-amber-50/60"
                                onClick={() => setCrossRefDetail({ type: 'csi', name })}
                              >
                                <TableCell className="text-sm">{name}</TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">
                                  {csiForCrossRef.filter(r => r.item_name === name).reduce((s, r) => s + (Number(r.quantity) || 0), 0)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-semibold text-blue-700">In DR Logs — Not in CSI</span>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{inDrNotCsi.length}</span>
                      </div>
                      {inDrNotCsi.length === 0 ? (
                        <p className="text-xs text-muted-foreground">All DR items are covered by CSI records.</p>
                      ) : (
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead>Item Name</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {inDrNotCsi.map(name => (
                              <TableRow
                                key={name}
                                className="cursor-pointer hover:bg-blue-50/60"
                                onClick={() => setCrossRefDetail({ type: 'dr', name })}
                              >
                                <TableCell className="text-sm">{name}</TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">
                                  {drForCrossRef.filter(d => d.item_name === name).reduce((s, d) => s + (Number(d.quantity) || 0), 0)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </div>
                </div>
              )
            })() : viewMode === 'by-si' ? (
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead className="w-8">
                      <Checkbox
                        checked={pagedSiGroups.length > 0 && pagedSiGroups.every(g => selectedSIs.has(g.si_number))}
                        indeterminate={pagedSiGroups.some(g => selectedSIs.has(g.si_number)) && !pagedSiGroups.every(g => selectedSIs.has(g.si_number))}
                        onCheckedChange={() => toggleSelectAllOnPage()}
                        aria-label="Select all on this page"
                      />
                    </TableHead>
                    <TableHead className="w-12">No.</TableHead>
                    <SortableTableHead label="Date" sortKey="date" activeKey={sortColOf(sortOption)} direction={sortDirOf(sortOption)} onSort={onSortCol} className="w-28" />
                    <SortableTableHead label="SI Number" sortKey="si" activeKey={sortColOf(sortOption)} direction={sortDirOf(sortOption)} onSort={onSortCol} className="w-32" />
                    <TableHead className="w-32">SO Number</TableHead>
                    <SortableTableHead label="Client" sortKey="client" activeKey={sortColOf(sortOption)} direction={sortDirOf(sortOption)} onSort={onSortCol} className="min-w-[160px]" />
                    <TableHead className="w-28">DR Number</TableHead>
                    <TableHead className="text-right w-16">Items</TableHead>
                    <SortableTableHead label="Total Amount" sortKey="amount" align="right" activeKey={sortColOf(sortOption)} direction={sortDirOf(sortOption)} onSort={onSortCol} className="w-32" />
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-16 text-center">Photo</TableHead>
                    <TableHead className="w-24 text-center">Portal</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : siGroups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
                        No records found. Click <strong>New Record</strong> to add one.
                      </TableCell>
                    </TableRow>
                  ) : pagedSiGroups.map((group, i) => (
                    <Fragment key={group.si_number}>
                      <TableRow
                        className="cursor-pointer hover:bg-red-50/40 transition-colors"
                        onClick={() => toggleSI(group.si_number)}
                      >
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedSIs.has(group.si_number)}
                            onCheckedChange={() => toggleSelectSI(group.si_number)}
                            aria-label={`Select SI ${group.si_number}`}
                          />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{(page - 1) * PAGE_SIZE + i + 1}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {format(parseISO(group.date), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="font-mono text-sm font-semibold text-red-600">{group.si_number}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{group.po ?? '—'}</TableCell>
                        <TableCell className="text-sm">{group.client}</TableCell>
                        <TableCell className="text-sm font-mono">{group.dr ?? '—'}</TableCell>
                        <TableCell className="text-right text-sm">{group.items.length}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{formatPeso(group.total)}</TableCell>
                        <TableCell>
                          <Badge className={csiStatusBadge(group.collection_status).cls}>{csiStatusBadge(group.collection_status).label}</Badge>
                        </TableCell>
                        <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                          {group.attachment_url ? (
                            <button
                              type="button"
                              onClick={() => setPreviewAttachmentUrl(group.attachment_url)}
                              className="h-9 w-9 mx-auto rounded border overflow-hidden block"
                              title="View attached photo"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={group.attachment_url} alt={`SI ${group.si_number} attachment`} className="h-full w-full object-cover" />
                            </button>
                          ) : (
                            <label className="h-9 w-9 mx-auto rounded border border-dashed flex items-center justify-center text-muted-foreground hover:text-blue-600 hover:border-blue-400 cursor-pointer transition-colors"
                              title="Upload photo">
                              {uploadingAttachmentSi === group.si_number
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Camera className="h-3.5 w-3.5" />}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={uploadingAttachmentSi !== null}
                                onChange={e => {
                                  const f = e.target.files?.[0]
                                  if (f) uploadSiAttachment(group.si_number, f)
                                  e.target.value = ''
                                }}
                              />
                            </label>
                          )}
                        </TableCell>
                        <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => toggleSIPortalVisibility(group.si_number, group.show_in_portal)}
                            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors ${group.show_in_portal ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-100 border-gray-200 text-gray-400 hover:bg-gray-200'}`}
                            title={group.show_in_portal ? 'Visible in portal — click to hide' : 'Hidden from portal — click to show'}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${group.show_in_portal ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                            {group.show_in_portal ? 'Visible' : 'Hidden'}
                          </button>
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent">
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => printCSI(group)}><Printer className="h-3.5 w-3.5 mr-1.5" />Print CSI</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => printCSIBlank(group)}><FileOutput className="h-3.5 w-3.5 mr-1.5" />Print (Blank Form)</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEdit(group.si_number)}>Edit</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(group.items[0].id)}>Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      {expandedSIs.has(group.si_number) && (
                        <TableRow key={`${group.si_number}-items`}>
                          <TableCell colSpan={12} className="p-0 bg-muted/20">
                            <div className="px-8 py-2">
                              <Table>
                                <TableHeader>
                                  <TableRow className="border-0">
                                    <TableHead className="text-xs h-8">Item/s</TableHead>
                                    <TableHead className="text-xs h-8 text-right">QTY</TableHead>
                                    <TableHead className="text-xs h-8">Unit</TableHead>
                                    <TableHead className="text-xs h-8 text-right">Unit Price</TableHead>
                                    <TableHead className="text-xs h-8 text-right">Amount</TableHead>
                                    <TableHead className="w-10 h-8" />
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.items.map(item => (
                                    <TableRow key={item.id} className="border-0">
                                      <TableCell className="text-sm py-1.5">{item.item_name}</TableCell>
                                      <TableCell className="text-right text-sm py-1.5 font-medium">{Number(item.quantity)}</TableCell>
                                      <TableCell className="text-sm py-1.5 text-muted-foreground">{item.unit ?? '—'}</TableCell>
                                      <TableCell className="text-right text-sm py-1.5">{item.unit_price ? formatPeso(Number(item.unit_price)) : '—'}</TableCell>
                                      <TableCell className="text-right text-sm py-1.5 font-medium">{item.amount ? formatPeso(Number(item.amount)) : '—'}</TableCell>
                                      <TableCell className="py-1.5">
                                        <DropdownMenu>
                                          <DropdownMenuTrigger className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent">
                                            <MoreHorizontal className="h-4 w-4" />
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => openEdit(item.si_number)}>Edit SI</DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(item.id)}>Delete Item</DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead className="w-12">No.</TableHead>
                    <SortableTableHead label="Date" sortKey="date" activeKey={sortColOf(sortOption)} direction={sortDirOf(sortOption)} onSort={onSortCol} className="w-28" />
                    <SortableTableHead label="SI Number" sortKey="si" activeKey={sortColOf(sortOption)} direction={sortDirOf(sortOption)} onSort={onSortCol} className="w-32" />
                    <SortableTableHead label="Client" sortKey="client" activeKey={sortColOf(sortOption)} direction={sortDirOf(sortOption)} onSort={onSortCol} className="min-w-[160px]" />
                    <TableHead>Item/s</TableHead>
                    <TableHead className="text-right w-16">QTY</TableHead>
                    <TableHead className="w-20">Unit</TableHead>
                    <TableHead className="text-right w-32">Unit Price</TableHead>
                    <SortableTableHead label="Amount" sortKey="amount" align="right" activeKey={sortColOf(sortOption)} direction={sortDirOf(sortOption)} onSort={onSortCol} className="w-28" />
                    <TableHead className="w-28">Status</TableHead>
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
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                        No records found. Click <strong>New Record</strong> to add one.
                      </TableCell>
                    </TableRow>
                  ) : pagedFiltered.map((rec, i) => (
                    <TableRow key={rec.id}>
                      <TableCell className="text-sm text-muted-foreground">{(page - 1) * PAGE_SIZE + i + 1}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(parseISO(rec.si_date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="font-mono text-sm font-semibold text-red-600">{rec.si_number}</TableCell>
                      <TableCell className="text-sm">{rec.client_name ?? '—'}</TableCell>
                      <TableCell className="text-sm">{rec.item_name}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{Number(rec.quantity)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{rec.unit ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm">{rec.unit_price ? formatPeso(Number(rec.unit_price)) : '—'}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{rec.amount ? formatPeso(Number(rec.amount)) : '—'}</TableCell>
                      <TableCell>
                        <Badge className={csiStatusBadge(rec.collection_status).cls}>{csiStatusBadge(rec.collection_status).label}</Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent">
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(rec.si_number)}>Edit SI</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(rec.id)}>Delete Item</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          {viewMode !== 'cross-ref' && totalPages > 1 && (
            <div className="flex items-center justify-between text-sm px-4 py-3 border-t">
              <span className="text-muted-foreground">
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, activeTotal)} of {activeTotal}
              </span>
              <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </CardContent>
      </Card>
      }

      {/* Item Search Dialog */}
      <Dialog open={itemSearchIdx !== null} onOpenChange={o => { if (!o) setItemSearchIdx(null) }}>
        <DialogContent className="w-[98vw] sm:!max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex flex-row items-center justify-between gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-4 w-4" />Search Item
            </DialogTitle>
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={openAddItem}>
              <Plus className="h-3.5 w-3.5" />Add Item
            </Button>
          </DialogHeader>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search item name…"
              className="pl-9"
              value={itemQuery}
              onChange={e => setItemQuery(e.target.value)}
            />
          </div>
          <div className="flex-1 overflow-y-auto border rounded-lg divide-y">
            {filteredSearchItems.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <p className="text-muted-foreground text-sm">No items found.</p>
                <Button type="button" size="sm" variant="outline" className="gap-1" onClick={openAddItem}>
                  <Plus className="h-3.5 w-3.5" />
                  {itemQuery.trim() ? <>Add &quot;{itemQuery.trim()}&quot; as new item</> : 'Add Item'}
                </Button>
              </div>
            ) : filteredSearchItems.map(opt => (
              <button
                key={opt.item_name}
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
                onClick={() => {
                  if (itemSearchIdx !== null) {
                    setItems(prev => prev.map((it, idx) => idx === itemSearchIdx ? {
                      ...it,
                      item_name: opt.item_name,
                      unit: opt.unit_of_measure,
                      unit_price: opt.selling_price != null ? String(opt.selling_price) : it.unit_price,
                    } : it))
                  }
                  setItemSearchIdx(null)
                }}
              >
                <span className="font-medium">{opt.item_name}</span>
                <span className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                  <span>{opt.unit_of_measure}</span>
                  <span className="font-semibold text-foreground tabular-nums">{opt.selling_price != null ? formatPeso(opt.selling_price) : '—'}</span>
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Item Modal */}
      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Item</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-1">
            <div className="sm:col-span-2 flex items-center gap-3">
              <div className="relative group shrink-0">
                <div className="h-16 w-16 rounded-lg overflow-hidden border bg-muted/30 flex items-center justify-center">
                  {newItemImageUrl
                    ? <img src={newItemImageUrl} alt="Item" className="h-full w-full object-cover" />
                    : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
                </div>
                <button
                  type="button"
                  onClick={() => newItemImageInputRef.current?.click()}
                  className="absolute inset-0 rounded-lg bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Camera className="h-4 w-4 text-white" />
                </button>
                {newItemImageUrl && (
                  <button
                    type="button"
                    onClick={() => { setNewItemImageUrl(null); setNewItemImageFile(null) }}
                    className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-gray-600 rounded-full flex items-center justify-center"
                  >
                    <X className="h-2.5 w-2.5 text-white" />
                  </button>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Item Photo</p>
                <button
                  type="button"
                  onClick={() => newItemImageInputRef.current?.click()}
                  className="mt-0.5 text-xs text-blue-600 hover:underline"
                >
                  {newItemImageUrl ? 'Change photo' : 'Upload photo'}
                </button>
              </div>
              <input
                ref={newItemImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) { setNewItemImageFile(f); setNewItemImageUrl(URL.createObjectURL(f)) }
                  e.target.value = ''
                }}
              />
            </div>
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
              <Select value={newItemForm.unit_of_measure} onValueChange={v => setNewItemForm(f => ({ ...f, unit_of_measure: v ?? '' }))}>
                <SelectTrigger className="w-full">
                  {newItemForm.unit_of_measure
                    ? <span className="truncate text-sm">{newItemForm.unit_of_measure}</span>
                    : <span className="text-muted-foreground text-sm">Select UOM…</span>}
                </SelectTrigger>
                <SelectContent>
                  {uomList.map(u => (
                    <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Selling Price (₱)</Label>
              <Input
                type="number" min={0} step="0.01" placeholder="0.00"
                value={newItemForm.selling_price}
                onChange={e => setNewItemForm(f => ({ ...f, selling_price: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Attribute</Label>
              <Select value={newItemAttributeTypeId} onValueChange={v => handleNewItemAttributeTypeChange(v ?? '')}>
                <SelectTrigger className="w-full">
                  {newItemAttributeTypeId
                    ? <span className="truncate text-sm">{attributeList.find(a => a.id === newItemAttributeTypeId)?.name}</span>
                    : <span className="text-muted-foreground text-sm">Select attribute…</span>}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— None —</SelectItem>
                  {attributeList.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {newItemAttributeTypeId && (() => {
              const attrType = attributeList.find(a => a.id === newItemAttributeTypeId)
              return (
                <div className="space-y-1.5">
                  <Label>{attrType?.name} Value</Label>
                  {attrType?.data_type === 'select' ? (
                    <Select value={newItemForm.attribute} onValueChange={v => setNewItemForm(f => ({ ...f, attribute: v ?? '' }))}>
                      <SelectTrigger className="w-full">
                        {newItemForm.attribute
                          ? <span className="truncate text-sm">{newItemForm.attribute}</span>
                          : <span className="text-muted-foreground text-sm">{attrType?.options?.length ? `Select ${attrType?.name}…` : 'No values yet'}</span>}
                      </SelectTrigger>
                      <SelectContent>
                        {attrType?.options?.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input placeholder={`Enter ${attrType?.name ?? 'value'}…`} value={newItemForm.attribute}
                      onChange={e => setNewItemForm(f => ({ ...f, attribute: e.target.value }))} />
                  )}
                </div>
              )
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemOpen(false)} disabled={savingNewItem}>Cancel</Button>
            <Button onClick={saveNewItem} disabled={savingNewItem} className="bg-red-600 hover:bg-red-700">
              {savingNewItem ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attachment Preview */}
      <Dialog open={previewAttachmentUrl !== null} onOpenChange={o => { if (!o) setPreviewAttachmentUrl(null) }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>SI Attachment</DialogTitle>
          </DialogHeader>
          {previewAttachmentUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewAttachmentUrl} alt="SI attachment" className="w-full max-h-[70vh] object-contain rounded-lg border" />
          )}
        </DialogContent>
      </Dialog>

      {/* CSI vs DR — Item Detail Breakdown */}
      <Dialog open={crossRefDetail !== null} onOpenChange={o => { if (!o) setCrossRefDetail(null) }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{crossRefDetail?.name}</DialogTitle>
          </DialogHeader>
          {crossRefDetail && (() => {
            const csiForCrossRef = clientFilter ? filtered.filter(r => r.client_name === clientFilter) : filtered
            const drForCrossRef = clientFilter ? drItemsForCrossRef.filter(d => d.client_name === clientFilter) : drItemsForCrossRef
            if (crossRefDetail.type === 'csi') {
              const rows = csiForCrossRef.filter(r => r.item_name === crossRefDetail.name)
              return (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>SI Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Unit</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {rows.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-sm text-red-600">{r.si_number}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{r.si_date ? format(parseISO(r.si_date), 'MMM d, yyyy') : '—'}</TableCell>
                        <TableCell className="text-sm">{r.client_name ?? '—'}</TableCell>
                        <TableCell className="text-right text-sm">{Number(r.quantity) || 0}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.unit ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            }
            const rows = drForCrossRef.filter(d => d.item_name === crossRefDetail.name)
            return (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>DR Number</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Unit</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {rows.map((d, i) => (
                    <TableRow key={`${d.dr_number}-${i}`}>
                      <TableCell className="font-mono text-sm">{d.dr_number}</TableCell>
                      <TableCell className="text-sm">{d.client_name ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm">{Number(d.quantity) || 0}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.unit ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          })()}
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

      {/* Delete Confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Record?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete this CSI record.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Send Email Dialog */}
      <Dialog open={emailBulkOpen} onOpenChange={o => { if (!o && !sendingBulkEmail) setEmailBulkOpen(false) }}>
        <DialogContent className="w-[95vw] max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="h-4 w-4" />Send CSI Invoice(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="flex flex-wrap gap-1.5">
              {siGroups.filter(g => selectedSIs.has(g.si_number)).map(g => (
                <span key={g.si_number} className="inline-flex items-center gap-1 text-xs font-mono bg-muted px-2 py-1 rounded-md">
                  {g.si_number}
                  <button
                    type="button"
                    onClick={() => toggleSelectSI(g.si_number)}
                    disabled={sendingBulkEmail}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Recipient Email <span className="text-destructive">*</span></Label>
                <Input
                  type="email"
                  placeholder="client@example.com"
                  value={bulkEmailTo}
                  onChange={e => setBulkEmailTo(e.target.value)}
                  disabled={sendingBulkEmail}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Input
                  placeholder="Email subject"
                  value={bulkEmailSubject}
                  onChange={e => setBulkEmailSubject(e.target.value)}
                  disabled={sendingBulkEmail}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Message Body</Label>
              <textarea
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                placeholder="Email message…"
                value={bulkEmailBody}
                onChange={e => setBulkEmailBody(e.target.value)}
                disabled={sendingBulkEmail}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              PDF attachment (line items for {selectedSIs.size} selected CSI{selectedSIs.size > 1 ? 's' : ''}, combined): <span className="font-mono">{csiAttachmentFilename(siGroups.filter(g => selectedSIs.has(g.si_number)))}</span>
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setEmailBulkOpen(false)} disabled={sendingBulkEmail}>Cancel</Button>
              <Button onClick={handleSendBulkEmail} disabled={sendingBulkEmail || selectedSIs.size === 0} className="bg-red-600 hover:bg-red-700">
                {sendingBulkEmail ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending…</> : <><Mail className="h-4 w-4 mr-2" />Send Email</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={calibOpen} onOpenChange={setCalibOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Calibrate Blank Form Print</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            All values are in millimeters, measured from the top-left corner of the page. Load your blank Sales
            Invoice form into the printer, click <strong>Print Test Grid</strong>, hold it up to the form to read
            off where the blank line for each field falls, then enter those numbers below. Make sure your print
            dialog uses 100% scale with no margins.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={printCalibGrid} className="w-fit gap-1.5">
            <Printer className="h-3.5 w-3.5" /> Print Test Grid
          </Button>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div className="col-span-2 grid grid-cols-3 gap-3">
              <CalibField label="Page Width" value={calibDraft.pageWidthMm} onChange={v => setCalibDraft(d => ({ ...d, pageWidthMm: v }))} />
              <CalibField label="Page Height" value={calibDraft.pageHeightMm} onChange={v => setCalibDraft(d => ({ ...d, pageHeightMm: v }))} />
              <CalibField label="Font Size (pt)" value={calibDraft.fontSizePt} onChange={v => setCalibDraft(d => ({ ...d, fontSizePt: v }))} />
              <CalibField label="Item Row Font Size (pt)" value={calibDraft.itemFontSizePt} onChange={v => setCalibDraft(d => ({ ...d, itemFontSizePt: v }))} />
            </div>
            <CalibPair label="Date" top={calibDraft.dateTop} left={calibDraft.dateLeft}
              onChange={(top, left) => setCalibDraft(d => ({ ...d, dateTop: top, dateLeft: left }))} />
            <CalibPair label="Client" top={calibDraft.clientTop} left={calibDraft.clientLeft}
              onChange={(top, left) => setCalibDraft(d => ({ ...d, clientTop: top, clientLeft: left }))} />
            <CalibPair label="Address" top={calibDraft.addressTop} left={calibDraft.addressLeft}
              onChange={(top, left) => setCalibDraft(d => ({ ...d, addressTop: top, addressLeft: left }))} />
            <CalibPair label="TIN" top={calibDraft.tinTop} left={calibDraft.tinLeft}
              onChange={(top, left) => setCalibDraft(d => ({ ...d, tinTop: top, tinLeft: left }))} />
            <CalibPair label="Business Style" top={calibDraft.businessStyleTop} left={calibDraft.businessStyleLeft}
              onChange={(top, left) => setCalibDraft(d => ({ ...d, businessStyleTop: top, businessStyleLeft: left }))} />
            <CalibPair label="Total Amount Due" top={calibDraft.totalDueTop} left={calibDraft.totalDueLeft}
              onChange={(top, left) => setCalibDraft(d => ({ ...d, totalDueTop: top, totalDueLeft: left }))} />
            <div className="col-span-2 border-t pt-3 grid grid-cols-3 gap-3">
              <CalibField label="Table Top" value={calibDraft.tableTop} onChange={v => setCalibDraft(d => ({ ...d, tableTop: v }))} />
              <CalibField label="Row Height" value={calibDraft.rowHeight} onChange={v => setCalibDraft(d => ({ ...d, rowHeight: v }))} />
              <CalibField label="Max Rows" value={calibDraft.maxRows} onChange={v => setCalibDraft(d => ({ ...d, maxRows: v }))} />
            </div>
            <div className="col-span-2 grid grid-cols-3 gap-3">
              <CalibField label="Qty Column Left" value={calibDraft.colQtyLeft} onChange={v => setCalibDraft(d => ({ ...d, colQtyLeft: v }))} />
              <CalibField label="Unit Column Left" value={calibDraft.colUnitLeft} onChange={v => setCalibDraft(d => ({ ...d, colUnitLeft: v }))} />
              <CalibField label="Description Column Left" value={calibDraft.colDescLeft} onChange={v => setCalibDraft(d => ({ ...d, colDescLeft: v }))} />
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <CalibField label="Unit Price Column Left" value={calibDraft.colUnitPriceLeft} onChange={v => setCalibDraft(d => ({ ...d, colUnitPriceLeft: v }))} />
              <CalibField label="Amount Column Left" value={calibDraft.colAmountLeft} onChange={v => setCalibDraft(d => ({ ...d, colAmountLeft: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCalibDraft(DEFAULT_BLANK_CALIB)}>Reset to Defaults</Button>
            <Button type="button" variant="outline" onClick={() => setCalibOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => { saveCalib(calibDraft); setCalibOpen(false); toast.success('Calibration saved') }} className="bg-red-600 hover:bg-red-700">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CalibField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number" step="0.5" value={value}
        onChange={e => onChange(Number(e.target.value) || 0)}
        className="h-8 text-sm"
      />
    </div>
  )
}

function CalibPair({ label, top, left, onChange }: { label: string; top: number; left: number; onChange: (top: number, left: number) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" step="0.5" value={top} placeholder="Top"
          onChange={e => onChange(Number(e.target.value) || 0, left)} className="h-8 text-sm" />
        <Input type="number" step="0.5" value={left} placeholder="Left"
          onChange={e => onChange(top, Number(e.target.value) || 0)} className="h-8 text-sm" />
      </div>
    </div>
  )
}
