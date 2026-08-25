'use client'

import { useState, useEffect, useRef } from 'react'
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Search, MoreHorizontal, Loader2, Truck, Trash2, LayoutGrid, List, X, Printer, SlidersHorizontal, FileOutput, Camera, CheckCircle2, AlertCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { useSearchContext } from '@/context/search-context'
import { usePersistedState } from '@/lib/use-persisted-state'
import { uploadImageToDrive } from '@/lib/upload-image'

interface Supplier { id: string; company_name: string }
interface Client {
  id: string
  company_name: string
  address: string | null
  city: string | null
  province: string | null
  tin: string | null
  industry: string | null
}
interface ItemOption { item_code: string; item_name: string; unit_of_measure: string }

interface BlankFormCalib {
  pageWidthMm: number
  pageHeightMm: number
  fontSizePt: number
  dateTop: number; dateLeft: number
  deliveredToTop: number; deliveredToLeft: number
  addressTop: number; addressLeft: number
  tinTop: number; tinLeft: number
  businessStyleTop: number; businessStyleLeft: number
  tableTop: number
  rowHeight: number
  colQtyLeft: number
  colUnitLeft: number
  colDescLeft: number
  maxRows: number
}

const DEFAULT_BLANK_CALIB: BlankFormCalib = {
  pageWidthMm: 210,
  pageHeightMm: 297,
  fontSizePt: 10,
  dateTop: 29, dateLeft: 135,
  deliveredToTop: 35, deliveredToLeft: 70,
  addressTop: 40, addressLeft: 60,
  tinTop: 45, tinLeft: 55,
  businessStyleTop: 50, businessStyleLeft: 75,
  tableTop: 63,
  rowHeight: 6,
  colQtyLeft: 47,
  colUnitLeft: 60,
  colDescLeft: 85,
  maxRows: 23,
}

const BLANK_CALIB_KEY = 'cdsc_dr_blank_form_calib'

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

interface DRLog {
  id: string
  dr_number: string
  dr_date: string
  supplier_id: string | null
  supplier_name: string | null
  po_number: string | null
  remarks: string | null
  status: string
  received_by_name: string | null
  created_at: string
  attachment_url: string | null
}

interface DRItem {
  id?: number
  dr_number: string
  quantity: number | string
  unit: string
  item_name: string
}

interface DRForm {
  dr_number: string
  dr_date: string
  supplier_id: string
  supplier_name: string
  po_number: string
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
  remarks: '',
  status: 'received',
  received_by_name: '',
})

const emptyItem = (): DRItem => ({ dr_number: '', quantity: '', unit: '', item_name: '' })

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  received:  { label: 'Received',  cls: 'bg-green-100 text-green-700' },
  partial:   { label: 'Partial',   cls: 'bg-yellow-100 text-yellow-700' },
  rejected:  { label: 'Rejected',  cls: 'bg-red-100 text-red-700' },
  returned:  { label: 'Returned',  cls: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-700' },
}

export default function DRLogsPage() {
  const supabase = createClient()
  const [logs, setLogs] = useState<DRLog[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [itemOptions, setItemOptions] = useState<ItemOption[]>([])
  const [soNumbers, setSoNumbers] = useState<{ id: string; so_number: string }[]>([])
  const [soItemsMap, setSoItemsMap] = useState<Record<string, { item_name: string; unit: string; quantity: number }[]>>({})
  const [allItems, setAllItems] = useState<DRItem[]>([])
  const { query: search } = useSearchContext()
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = usePersistedState('dr-logs:statusFilter', 'all')
  const [clientFilter, setClientFilter] = usePersistedState('dr-logs:clientFilter', '')
  const [yearFilter, setYearFilter] = usePersistedState('dr-logs:yearFilter', 'all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<DRLog | null>(null)
  const [form, setForm] = useState<DRForm>(emptyForm())
  const [deliveredToId, setDeliveredToId] = useState('')
  const [items, setItems] = useState<DRItem[]>([emptyItem()])
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [viewMode, setViewMode] = usePersistedState<'by-dr' | 'all-items'>('dr-logs:viewMode', 'by-dr')
  const [drActiveTab, setDrActiveTab] = useState<'form' | 'preview'>('form')
  const [companyInfo, setCompanyInfo] = useState<{ company_name: string; address: string; phone: string; email: string; tin: string } | null>(null)
  const [itemSearches, setItemSearches] = useState<Record<number, string>>({})
  const [previewAttachmentUrl, setPreviewAttachmentUrl] = useState<string | null>(null)
  const [uploadingAttachmentDr, setUploadingAttachmentDr] = useState<string | null>(null)
  const [itemDropdowns, setItemDropdowns] = useState<Record<number, boolean>>({})
  const [drNumberOptions, setDrNumberOptions] = useState<{ value: string; tag: 'current' | 'next' | 'missing' }[]>([])
  const [drNumberDropdownOpen, setDrNumberDropdownOpen] = useState(false)
  const [blankCalib, setBlankCalib] = useState<BlankFormCalib>(() => loadBlankCalib())
  const [calibOpen, setCalibOpen] = useState(false)
  const [calibDraft, setCalibDraft] = useState<BlankFormCalib>(DEFAULT_BLANK_CALIB)
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  function saveCalib(next: BlankFormCalib) {
    setBlankCalib(next)
    window.localStorage.setItem(BLANK_CALIB_KEY, JSON.stringify(next))
  }

  function openCalib() {
    setCalibDraft(blankCalib)
    setCalibOpen(true)
  }

  function handlePrint() {
    const el = printRef.current
    if (!el) return
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><title>Delivery Receipt</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
    <style>
      body { font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    </style>
  </head><body class="p-6 text-[11px]">${el.innerHTML}</body></html>`)
    win.document.close()
    setTimeout(() => { win.focus(); win.print(); win.close() }, 800)
  }

  async function printDR(log: DRLog) {
    const { data: drItems } = await supabase.from('dr_log_items').select('item_name,unit,quantity').eq('dr_number', log.dr_number).order('id')
    const items = drItems ?? []
    const co = companyInfo
    const html = `<!DOCTYPE html><html><head><title>DR ${log.dr_number}</title>
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
          <div class="text-[9px] font-semibold uppercase text-gray-400 mb-0.5">Delivered To</div>
          <div class="font-semibold text-gray-800">${log.supplier_name ?? '—'}</div>
          ${log.po_number ? `<div class="text-[9px] font-semibold uppercase text-gray-400 mt-1.5 mb-0.5">SO Reference</div><div class="font-mono text-gray-800">${log.po_number}</div>` : ''}
          ${log.received_by_name ? `<div class="text-[9px] font-semibold uppercase text-gray-400 mt-1.5 mb-0.5">Received By</div><div class="text-gray-800">${log.received_by_name}</div>` : ''}
        </div>
        <div class="text-center flex items-center justify-center">
          <div class="text-[16px] font-extrabold text-red-700 uppercase tracking-widest">Delivery Receipt</div>
        </div>
        <div class="text-right">
          <div class="text-[9px] font-semibold uppercase text-gray-400">DR Number</div>
          <div class="font-mono font-bold text-gray-800">${log.dr_number}</div>
          <div class="text-[9px] font-semibold uppercase text-gray-400 mt-1.5">Date</div>
          <div class="text-gray-800">${log.dr_date ? format(parseISO(log.dr_date), 'MM/dd/yyyy') : '—'}</div>
          <div class="text-[9px] font-semibold uppercase text-gray-400 mt-1.5">Status</div>
          <div class="text-gray-800 capitalize">${log.status}</div>
        </div>
      </div>
      <table class="w-full border-collapse">
        <thead>
          <tr class="bg-red-700 text-white">
            <th class="text-left px-1.5 py-1">#</th>
            <th class="text-left px-1.5 py-1">Item Description</th>
            <th class="text-left px-1.5 py-1">Unit</th>
            <th class="text-right px-1.5 py-1">Qty</th>
          </tr>
        </thead>
        <tbody>
          ${items.length === 0 ? '<tr><td colspan="4" class="px-1.5 py-3 text-center text-gray-400 italic">No items</td></tr>' :
            items.map((it, i) => `<tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
              <td class="px-1.5 py-1 text-gray-400">${i + 1}</td>
              <td class="px-1.5 py-1">${it.item_name}</td>
              <td class="px-1.5 py-1 text-gray-500">${it.unit ?? '—'}</td>
              <td class="px-1.5 py-1 text-right font-medium">${Number(it.quantity)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      ${log.remarks ? `<div class="text-[9px] text-gray-500 border-t pt-2">Remarks: ${log.remarks}</div>` : ''}
    </div>
    </body></html>`
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(html)
    win.document.close()
    setTimeout(() => { win.focus(); win.print(); win.close() }, 800)
  }

  // Prints only the field values, absolutely positioned to line up with a pre-printed
  // blank DR form — no borders, logo, labels or backgrounds are rendered.
  async function printDRBlank(log: DRLog) {
    const { data: drItems } = await supabase.from('dr_log_items').select('item_name,unit,quantity').eq('dr_number', log.dr_number).order('id')
    const items = (drItems ?? []).slice(0, blankCalib.maxRows)
    const client = clients.find(c => c.company_name === log.supplier_name)
    const c = blankCalib
    const dateStr = log.dr_date ? format(parseISO(log.dr_date), 'MM/dd/yyyy') : ''
    const addressLine = [client?.address, client?.city, client?.province].filter(Boolean).join(', ')
    const field = (top: number, left: number, value: string) =>
      value ? `<div style="position:absolute;top:${top}mm;left:${left}mm;">${value}</div>` : ''
    const rows = items.map((it, i) => {
      const top = c.tableTop + i * c.rowHeight
      return field(top, c.colQtyLeft, String(Number(it.quantity))) +
        field(top, c.colUnitLeft, it.unit ?? '') +
        field(top, c.colDescLeft, it.item_name)
    }).join('')
    const html = `<!DOCTYPE html><html><head><title>DR ${log.dr_number} (Blank Form)</title>
    <style>
      @page { size: ${c.pageWidthMm}mm ${c.pageHeightMm}mm; margin: 0; }
      html, body { margin: 0; padding: 0; }
      body { position: relative; width: ${c.pageWidthMm}mm; height: ${c.pageHeightMm}mm; font-family: Arial, sans-serif; font-size: ${c.fontSizePt}pt; color: #000; }
      div { white-space: nowrap; }
    </style>
    </head><body>
    ${field(c.dateTop, c.dateLeft, dateStr)}
    ${field(c.deliveredToTop, c.deliveredToLeft, log.supplier_name ?? '')}
    ${field(c.addressTop, c.addressLeft, addressLine)}
    ${field(c.tinTop, c.tinLeft, client?.tin ?? '')}
    ${field(c.businessStyleTop, c.businessStyleLeft, client?.industry ?? '')}
    ${rows}
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

  async function load() {
    setLoading(true)
    const [{ data: drData }, { data: supData }, { data: clientData }, { data: itemData }, { data: soData }] = await Promise.all([
      supabase.from('dr_logs').select('*').order('dr_date', { ascending: false }),
      supabase.from('suppliers').select('id, company_name').order('company_name'),
      supabase.from('clients').select('id, company_name, address, city, province, tin, industry').order('company_name'),
      supabase.from('items').select('item_code, item_name, unit_of_measure').eq('status', 'active').order('item_name'),
      supabase.from('sales_orders').select('id, so_number').not('so_number', 'is', null).order('created_at', { ascending: false }),
    ])
    setLogs(drData ?? [])
    setSuppliers(supData ?? [])
    setClients(clientData ?? [])
    setItemOptions((itemData ?? []) as ItemOption[])
    setSoNumbers((soData ?? []).filter((s: any) => s.so_number) as { id: string; so_number: string }[])

    const soIds = (soData ?? []).map((s: any) => s.id).filter(Boolean)
    if (soIds.length > 0) {
      const { data: soItemsData } = await supabase
        .from('so_items')
        .select('item_name, unit, quantity, so_id, sales_orders!inner(so_number)')
        .in('so_id', soIds)
      if (soItemsData) {
        const map: Record<string, { item_name: string; unit: string; quantity: number }[]> = {}
        for (const row of soItemsData as any[]) {
          const soNum = row.sales_orders?.so_number
          if (!soNum) continue
          if (!map[soNum]) map[soNum] = []
          map[soNum].push({ item_name: row.item_name, unit: row.unit ?? '', quantity: Number(row.quantity) })
        }
        setSoItemsMap(map)
      }
    }

    const drNumbers = (drData ?? []).map(d => d.dr_number)
    if (drNumbers.length > 0) {
      const allFetched: DRItem[] = []
      const PAGE = 1000
      let from = 0
      while (true) {
        const { data } = await supabase
          .from('dr_log_items')
          .select('*')
          .in('dr_number', drNumbers)
          .order('id')
          .range(from, from + PAGE - 1)
        if (!data || data.length === 0) break
        allFetched.push(...data)
        if (data.length < PAGE) break
        from += PAGE
      }
      setAllItems(allFetched)
    } else {
      setAllItems([])
    }
    const { data: sysData } = await supabase.from('system_settings').select('company_name, address, phone, email, tin').single()
    if (sysData) setCompanyInfo(sysData)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function getItems(drNumber: string) {
    const key = drNumber.trim().toUpperCase()
    return allItems.filter(i => i.dr_number.trim().toUpperCase() === key)
  }

  function getTotalQty(drNumber: string) {
    return getItems(drNumber).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0)
  }

  // An SO that already has a DR log recorded against it shouldn't be offered again in the
  // SO Reference dropdown — keep the currently-edited DR's own SO reference selectable though.
  const usedSoNumbers = new Set(
    logs.filter(l => l.po_number && l.id !== editing?.id).map(l => l.po_number as string)
  )
  const availableSoNumbers = soNumbers.filter(s => !usedSoNumbers.has(s.so_number) || s.so_number === form.po_number)

  const availableYears = Array.from(new Set(logs.map(l => l.dr_date?.slice(0, 4)).filter(Boolean))).sort((a, b) => b.localeCompare(a))

  const filtered = logs.filter(l => {
    const matchSearch =
      l.dr_number.toLowerCase().includes(search.toLowerCase()) ||
      (l.supplier_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (l.po_number ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || l.status === statusFilter
    const matchClient = !clientFilter || (l.supplier_name ?? '') === clientFilter
    const matchYear = yearFilter === 'all' || l.dr_date?.slice(0, 4) === yearFilter
    return matchSearch && matchStatus && matchClient && matchYear
  })

  const PAGE_SIZE = 30
  const pagedFiltered = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const allItemsFlat = filtered.flatMap(log =>
    getItems(log.dr_number).map(item => ({ ...item, log }))
  )
  const pagedItemsFlat = allItemsFlat.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const activeTotal = viewMode === 'by-dr' ? filtered.length : allItemsFlat.length
  const totalPages = Math.max(1, Math.ceil(activeTotal / PAGE_SIZE))

  useEffect(() => { setPage(1) }, [search, statusFilter, clientFilter, yearFilter, viewMode])

  function toggleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  async function uploadDrAttachment(drNumber: string, file: File) {
    setUploadingAttachmentDr(drNumber)
    try {
      const url = await uploadImageToDrive(file, { displayName: `DR-${drNumber}`, folder: 'DR Attachments' })
      const { error } = await supabase.from('dr_logs').update({ attachment_url: url }).eq('dr_number', drNumber)
      if (error) { toast.error(error.message); return }
      setLogs(prev => prev.map(l => l.dr_number === drNumber ? { ...l, attachment_url: url } : l))
      toast.success(`Photo attached to DR ${drNumber}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload image')
    } finally {
      setUploadingAttachmentDr(null)
    }
  }

  // Suggests the next sequential DR number after the highest one used so far (within its
  // own prefix/format, e.g. "DR-2025-00001"), plus any gaps in the existing sequence.
  function getDrNumberSuggestions(excludeId?: string): { next: string; missing: string[] } {
    const parsed = logs
      .filter(l => l.id !== excludeId)
      .map(l => {
        const m = l.dr_number.match(/^(.*?)(\d+)$/)
        return m ? { prefix: m[1], num: parseInt(m[2], 10), width: m[2].length } : null
      })
      .filter((x): x is { prefix: string; num: number; width: number } => x !== null)
    if (parsed.length === 0) return { next: '', missing: [] }
    const prefixCounts = new Map<string, number>()
    parsed.forEach(p => prefixCounts.set(p.prefix, (prefixCounts.get(p.prefix) ?? 0) + 1))
    const topPrefix = [...prefixCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const group = parsed.filter(p => p.prefix === topPrefix)
    const max = Math.max(...group.map(p => p.num))
    const width = Math.max(...group.map(p => p.width))
    const existing = new Set(group.map(p => p.num))
    const missing: string[] = []
    for (let n = 1; n < max; n++) {
      if (!existing.has(n)) missing.push(topPrefix + String(n).padStart(width, '0'))
    }
    return { next: topPrefix + String(max + 1).padStart(width, '0'), missing }
  }

  function openAdd() {
    setEditing(null)
    setForm(emptyForm())
    setDeliveredToId('')
    setItems([emptyItem()])
    setItemSearches({})
    setItemDropdowns({})
    const { next, missing } = getDrNumberSuggestions()
    setDrNumberOptions([
      ...missing.map(value => ({ value, tag: 'missing' as const })),
      ...(next ? [{ value: next, tag: 'next' as const }] : []),
    ])
    setDrActiveTab('form')
    setOpen(true)
  }

  async function openEdit(log: DRLog) {
    setEditing(log)
    setForm({
      dr_number: log.dr_number,
      dr_date: log.dr_date,
      supplier_id: '',
      supplier_name: log.supplier_name ?? '',
      po_number: log.po_number ?? '',
      remarks: log.remarks ?? '',
      status: log.status,
      received_by_name: log.received_by_name ?? '',
    })
    // pre-select the client dropdown by matching company name
    const matchedClient = clients.find(c => c.company_name === log.supplier_name)
    setDeliveredToId(matchedClient?.id ?? '')
    const existing = getItems(log.dr_number)
    const loaded = existing.length > 0 ? existing : [emptyItem()]
    setItems(loaded)
    setItemSearches(Object.fromEntries(loaded.map((it, i) => [i, it.item_name])))
    setItemDropdowns({})
    const { next, missing } = getDrNumberSuggestions(log.id)
    setDrNumberOptions([
      { value: log.dr_number, tag: 'current' },
      ...missing.map(value => ({ value, tag: 'missing' as const })),
      ...(next ? [{ value: next, tag: 'next' as const }] : []),
    ])
    setDrActiveTab('form')
    setOpen(true)
  }

  function closeForm() {
    setOpen(false)
    setEditing(null)
    setForm(emptyForm())
    setItems([emptyItem()])
  }

  function handleCancelClick() {
    const hasData = form.dr_number || form.supplier_name || form.po_number || form.remarks || items.some(it => it.item_name)
    if (hasData) { setDiscardConfirmOpen(true); return }
    closeForm()
  }

  function discardForm() {
    setDiscardConfirmOpen(false)
    closeForm()
  }

  function handleClientChange(clientId: string | null) {
    const client = clients.find(c => c.id === clientId)
    setDeliveredToId(clientId ?? '')
    setForm(f => ({ ...f, supplier_name: client?.company_name ?? '' }))
  }

  function updateItem(index: number, field: keyof DRItem, value: string) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  function addItemRow() {
    setItems(prev => [...prev, emptyItem()])
  }

  function removeItemRow(index: number) {
    setItems(prev => prev.length === 1 ? [emptyItem()] : prev.filter((_, i) => i !== index))
  }

  async function save() {
    if (!form.dr_number.trim()) { toast.error('DR Number is required'); return }
    if (!form.dr_date) { toast.error('DR Date is required'); return }
    setSaving(true)
    const drNumber = form.dr_number.trim().toUpperCase()
    const soNumber = form.po_number || null
    const clientName = form.supplier_name || null
    const payload = {
      dr_number: drNumber,
      dr_date: form.dr_date,
      supplier_id: null,
      supplier_name: clientName,
      po_number: soNumber,
      remarks: form.remarks || null,
      status: form.status,
      received_by_name: form.received_by_name || null,
      updated_at: new Date().toISOString(),
    }

    if (editing) {
      const { error } = await supabase.from('dr_logs').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('dr_logs').insert(payload)
      if (error) { toast.error(error.message); setSaving(false); return }
    }

    const validItems = items.filter(it => it.item_name.trim())
    await supabase.from('dr_log_items').delete().eq('dr_number', drNumber)
    if (validItems.length > 0) {
      await supabase.from('dr_log_items').insert(
        validItems.map(it => ({
          dr_number: drNumber,
          quantity: Number(it.quantity) || 0,
          unit: it.unit || '',
          item_name: it.item_name.trim(),
        }))
      )
    }

    // Check warehouse stock availability and notify if lacking
    if (clientName && (form.status === 'received' || form.status === 'partial')) {
      const stockIssues: string[] = []
      for (const it of validItems) {
        const qty = Number(it.quantity) || 0
        if (qty <= 0) continue
        const { data: wsRow } = await supabase
          .from('warehouse_stock')
          .select('quantity')
          .eq('item_name', it.item_name.trim())
          .is('client_name', null)
          .maybeSingle()
        const available = wsRow ? Number(wsRow.quantity) : 0
        if (available < qty) {
          stockIssues.push(`${it.item_name}: need ${qty} ${it.unit || ''}, available ${available}`)
        }
      }
      if (stockIssues.length > 0) {
        toast.warning('Insufficient stock for some items', {
          duration: 8000,
          description: stockIssues.join(' • '),
        })
      }
    }

    // Editing a DR that had already decremented warehouse_stock would otherwise decrement it
    // again on every save. Reverse the previous decrement (using the pre-edit persisted items
    // and status) before the block below applies the new one — so only the net change between
    // the old and new item quantities ever hits the stock. This applies to every DR, not just
    // ones linked to an SO reference. Matches the general/unassigned pool (client_name IS NULL),
    // since that's what Receiving actually adds stock into — not the DR's own client name.
    if (editing && (editing.status === 'received' || editing.status === 'partial')) {
      const prevItems = getItems(editing.dr_number)
      for (const it of prevItems) {
        const qty = Number(it.quantity) || 0
        if (qty <= 0) continue
        const { data: wsRow } = await supabase
          .from('warehouse_stock')
          .select('id, quantity')
          .eq('item_name', it.item_name.trim())
          .is('client_name', null)
          .maybeSingle()
        if (wsRow) {
          await supabase.from('warehouse_stock').update({
            quantity: Number(wsRow.quantity) + qty,
            updated_at: new Date().toISOString(),
          }).eq('id', wsRow.id)
        } else {
          // No row yet for this item (e.g. it's never been received into stock) — create
          // one instead of silently dropping the reversal, so the ledger entry below stays
          // truthful and future receiving has a row to accumulate onto.
          await supabase.from('warehouse_stock').insert({
            client_name: null, item_name: it.item_name.trim(), unit: it.unit || null, quantity: qty,
          })
        }
        await supabase.from('warehouse_stock_ledger').insert({
          item_name: it.item_name.trim(),
          unit: it.unit || null,
          change_qty: qty,
          source_type: 'dr_delivery',
          reference_no: drNumber,
          client_name: clientName,
          notes: 'Reversal of previous delivery (DR edited)',
        })
      }
    }

    // Update warehouse_stock: decrement for each delivered item — regardless of whether this
    // DR is linked to an SO reference.
    if (form.status === 'received' || form.status === 'partial') {
      for (const it of validItems) {
        const qty = Number(it.quantity) || 0
        if (qty <= 0) continue
        const { data: wsRow } = await supabase
          .from('warehouse_stock')
          .select('id, quantity')
          .eq('item_name', it.item_name.trim())
          .is('client_name', null)
          .maybeSingle()
        if (wsRow) {
          await supabase.from('warehouse_stock').update({
            quantity: Math.max(0, Number(wsRow.quantity) - qty),
            updated_at: new Date().toISOString(),
          }).eq('id', wsRow.id)
        } else {
          // No row yet for this item — without this, the decrement is silently lost and
          // warehouse stock ends up overstated once the item is eventually received in.
          // Create the row at 0 (can't go negative) so the ledger below records the real
          // shortfall and the row exists for future receiving to accumulate onto.
          await supabase.from('warehouse_stock').insert({
            client_name: null, item_name: it.item_name.trim(), unit: it.unit || null, quantity: 0,
          })
        }
        await supabase.from('warehouse_stock_ledger').insert({
          item_name: it.item_name.trim(),
          unit: it.unit || null,
          change_qty: -qty,
          source_type: 'dr_delivery',
          reference_no: drNumber,
          client_name: clientName,
        })
      }
    }

    // Auto-sync into the client's own portal stock ledger (client_inventory) so My Stock in
    // the client portal reflects deliveries automatically — no manual "Receive Stock" click
    // needed. Writes a client_inventory_transactions row with reference_no = dr_number using
    // the same convention the manual Receive Stock flow uses, so that flow's "already
    // received" DR exclusion logic naturally prevents the same delivery being double-counted
    // if a client still receives it manually.
    if (clientName) {
      const { data: clientRow } = await supabase.from('clients').select('id').eq('company_name', clientName).maybeSingle()
      const clientRowId = clientRow?.id ?? null
      if (clientRowId) {
        const autoNote = (drNum: string) => `Auto-received from DR ${drNum}`

        if (editing && (editing.status === 'received' || editing.status === 'partial')) {
          const prevItems = getItems(editing.dr_number)
          for (const it of prevItems) {
            const qty = Number(it.quantity) || 0
            if (qty <= 0) continue
            const { data: ciRow } = await supabase
              .from('client_inventory')
              .select('id, quantity_on_hand')
              .eq('client_id', clientRowId)
              .eq('item_name', it.item_name.trim())
              .maybeSingle()
            if (ciRow) {
              await supabase.from('client_inventory').update({
                quantity_on_hand: Math.max(0, Number(ciRow.quantity_on_hand) - qty),
                updated_at: new Date().toISOString(),
              }).eq('id', ciRow.id)
            }
          }
          await supabase.from('client_inventory_transactions')
            .delete()
            .eq('client_id', clientRowId)
            .eq('reference_no', editing.dr_number)
            .eq('notes', autoNote(editing.dr_number))
        }

        if (form.status === 'received' || form.status === 'partial') {
          for (const it of validItems) {
            const qty = Number(it.quantity) || 0
            if (qty <= 0) continue
            const itemName = it.item_name.trim()
            const { data: ciRow } = await supabase
              .from('client_inventory')
              .select('id, quantity_on_hand')
              .eq('client_id', clientRowId)
              .eq('item_name', itemName)
              .maybeSingle()
            if (ciRow) {
              await supabase.from('client_inventory').update({
                quantity_on_hand: Number(ciRow.quantity_on_hand) + qty,
                updated_at: new Date().toISOString(),
              }).eq('id', ciRow.id)
            } else {
              await supabase.from('client_inventory').insert({
                client_id: clientRowId,
                item_name: itemName,
                unit: it.unit || null,
                quantity_on_hand: qty,
                low_stock_threshold: 0,
              })
            }
            await supabase.from('client_inventory_transactions').insert({
              client_id: clientRowId,
              item_name: itemName,
              unit: it.unit || null,
              transaction_type: 'received',
              quantity: qty,
              reference_no: drNumber,
              notes: autoNote(drNumber),
            })
          }
        }
      }
    }

    // Mirror to sales_deliveries when linked to an SO
    if (soNumber) {
      await supabase.from('sales_deliveries').delete().eq('dr_number', drNumber)
      const { data: sdRow } = await supabase.from('sales_deliveries').insert({
        so_number: soNumber,
        dr_number: drNumber,
        client_name: clientName,
        delivery_date: form.dr_date,
        delivered_by: form.received_by_name || null,
        notes: form.remarks || null,
        status: form.status === 'received' ? 'delivered' : form.status === 'partial' ? 'partial' : 'pending',
      }).select('delivery_number').single()

      if (sdRow && validItems.length > 0) {
        await supabase.from('sales_delivery_items').delete().eq('delivery_number', sdRow.delivery_number)
        await supabase.from('sales_delivery_items').insert(
          validItems.map(it => ({
            delivery_number: sdRow.delivery_number,
            item_name: it.item_name.trim(),
            unit: it.unit || '',
            quantity: Number(it.quantity) || 0,
          }))
        )
      }
    }

    toast.success(editing ? 'DR Log updated' : 'DR Log recorded')
    setOpen(false)
    load()
    setSaving(false)
  }

  async function confirmDelete() {
    if (!deleteId) return
    const log = logs.find(l => l.id === deleteId)
    const { data: savedItems } = log
      ? await supabase.from('dr_log_items').select('*').eq('dr_number', log.dr_number)
      : { data: [] }
    if (log) await supabase.from('dr_log_items').delete().eq('dr_number', log.dr_number)
    const { error } = await supabase.from('dr_logs').delete().eq('id', deleteId)
    if (error) { toast.error(error.message); setDeleteId(null); return }
    setDeleteId(null)
    load()
    toast.success('DR Log deleted', {
      action: {
        label: 'Undo',
        onClick: async () => {
          if (log) {
            const { id: _id, created_at: _ca, ...logRest } = log as any
            await supabase.from('dr_logs').insert(logRest)
            if (savedItems && savedItems.length > 0) {
              const items = savedItems.map(({ id: _i, ...r }: any) => r)
              await supabase.from('dr_log_items').insert(items)
            }
            load()
          }
        },
      },
    })
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
        {open && (
          <Button variant="outline" onClick={handleCancelClick}>
            <X className="h-4 w-4 mr-2" />Cancel
          </Button>
        )}
      </div>

      {!open && (<>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total DRs', count: counts.total,    color: 'text-foreground',  icon: Truck,        grad: 'from-red-500 to-red-600',     tint: 'from-red-50',    shadow: 'shadow-red-500/30' },
          { label: 'Received',  count: counts.received, color: 'text-green-600',   icon: CheckCircle2, grad: 'from-green-500 to-green-600', tint: 'from-green-50',  shadow: 'shadow-green-500/30' },
          { label: 'Partial',   count: counts.partial,  color: 'text-yellow-600',  icon: AlertCircle,  grad: 'from-amber-500 to-amber-600', tint: 'from-amber-50',  shadow: 'shadow-amber-500/30' },
          { label: 'Rejected',  count: counts.rejected, color: 'text-red-600',     icon: XCircle,      grad: 'from-slate-400 to-slate-500', tint: 'from-slate-50',  shadow: 'shadow-slate-500/30' },
        ].map(s => (
          <Card key={s.label} className="relative overflow-hidden border-none">
            <div className={`absolute inset-0 bg-gradient-to-br ${s.tint} to-transparent`} />
            <CardContent className="relative pt-4 pb-3 flex items-start justify-between gap-3">
              <div>
                <div className={`text-2xl font-bold ${s.color}`}>{loading ? '—' : s.count}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </div>
              <div className={`h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br ${s.grad} flex items-center justify-center shadow-sm ${s.shadow}`}>
                <s.icon className="h-5 w-5 text-white" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending / Incomplete banner */}
      {!loading && (() => {
        const pending = logs.filter(l => l.status === 'partial' || l.status === 'rejected')
        if (pending.length === 0) return null
        return (
          <Card className="border-yellow-300 bg-yellow-50">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-semibold text-yellow-800">Pending / Incomplete Deliveries</span>
                <span className="ml-auto text-xs text-yellow-700 bg-yellow-200 px-2 py-0.5 rounded-full font-medium">{pending.length}</span>
              </div>
              <div className="space-y-1">
                {pending.map(l => {
                  const sc = STATUS_CFG[l.status] ?? STATUS_CFG.received
                  const items = getItems(l.dr_number)
                  return (
                    <div key={l.id} className="flex items-center gap-3 text-xs py-1 border-b border-yellow-200 last:border-0">
                      <span className="font-mono font-semibold text-red-600 w-28 shrink-0">{l.dr_number}</span>
                      <span className="text-gray-700 flex-1 truncate">{l.supplier_name ?? '—'}</span>
                      {l.po_number && <span className="text-gray-500 hidden sm:block">SO: {l.po_number}</span>}
                      <span className="text-gray-400 hidden sm:block">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                      <span className={`px-2 py-0.5 rounded-full font-medium shrink-0 ${sc.cls}`}>{sc.label}</span>
                      <button className="text-blue-600 hover:underline shrink-0" onClick={() => openEdit(l)}>Edit</button>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )
      })()}

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Client</Label>
          <Select value={clientFilter || '_all'} onValueChange={(v: string | null) => setClientFilter(!v || v === '_all' ? '' : v)}>
            <SelectTrigger className="min-w-[220px]">
              <SelectValue>{(v: string) => v === '_all' ? 'Client' : v}</SelectValue>
            </SelectTrigger>
            <SelectContent className="min-w-[300px]">
              <SelectItem value="_all">All Clients</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.company_name}>{c.company_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Year</Label>
          <Select value={yearFilter} onValueChange={v => setYearFilter(v ?? 'all')}>
            <SelectTrigger className="w-32">
              <SelectValue>{(v: string) => v === 'all' ? 'Filter by Year' : v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'all')}>
            <SelectTrigger className="w-40">
              <SelectValue>{(v: string) => v === 'all' ? 'Status' : STATUS_CFG[v]?.label ?? v}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">View</Label>
          <div className="flex rounded-md border overflow-hidden">
            <button
              onClick={() => setViewMode('by-dr')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${viewMode === 'by-dr' ? 'bg-red-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted'}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> By DR#
            </button>
            <button
              onClick={() => setViewMode('all-items')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border-l ${viewMode === 'all-items' ? 'bg-red-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted'}`}
            >
              <List className="h-3.5 w-3.5" /> All Items
            </button>
          </div>
        </div>
        <Button onClick={openAdd} className="bg-red-600 hover:bg-red-700 ml-auto">
          <Plus className="h-4 w-4 mr-2" /> New DR Log
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4 text-red-600" /> Delivery Receipt Log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            {viewMode === 'by-dr' ? (
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead className="w-12">No.</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>DR Number</TableHead>
                    <TableHead>Delivered To</TableHead>
                    <TableHead className="text-right">Total Qty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16 text-center">Photo</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        No DR logs found. Click <strong>New DR Log</strong> to add one.
                      </TableCell>
                    </TableRow>
                  ) : pagedFiltered.map((log, i) => {
                    const sc = STATUS_CFG[log.status] ?? STATUS_CFG.received
                    const isExpanded = expandedId === log.id
                    const logItems = getItems(log.dr_number)
                    const totalQty = getTotalQty(log.dr_number)

                    return (
                      <>
                        <TableRow
                          key={log.id}
                          className="cursor-pointer hover:bg-red-50/40 transition-colors"
                          onClick={() => toggleExpand(log.id)}
                        >
                          <TableCell className="text-sm text-muted-foreground">{(page - 1) * PAGE_SIZE + i + 1}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {format(parseISO(log.dr_date), 'MM/dd/yyyy')}
                          </TableCell>
                          <TableCell className="font-mono text-sm font-semibold text-red-600">{log.dr_number}</TableCell>
                          <TableCell className="text-sm font-medium">{log.supplier_name ?? '—'}</TableCell>
                          <TableCell className="text-right font-medium text-sm">{totalQty}</TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.cls}`}>{sc.label}</span>
                          </TableCell>
                          <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                            {log.attachment_url ? (
                              <button
                                type="button"
                                onClick={() => setPreviewAttachmentUrl(log.attachment_url)}
                                className="h-9 w-9 mx-auto rounded border overflow-hidden block"
                                title="View attached photo"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={log.attachment_url} alt={`DR ${log.dr_number} attachment`} className="h-full w-full object-cover" />
                              </button>
                            ) : (
                              <label className="h-9 w-9 mx-auto rounded border border-dashed flex items-center justify-center text-muted-foreground hover:text-blue-600 hover:border-blue-400 cursor-pointer transition-colors"
                                title="Upload photo">
                                {uploadingAttachmentDr === log.dr_number
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Camera className="h-3.5 w-3.5" />}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  disabled={uploadingAttachmentDr !== null}
                                  onChange={e => {
                                    const f = e.target.files?.[0]
                                    if (f) uploadDrAttachment(log.dr_number, f)
                                    e.target.value = ''
                                  }}
                                />
                              </label>
                            )}
                          </TableCell>
                          <TableCell onClick={e => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent">
                                <MoreHorizontal className="h-4 w-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => printDR(log)}><Printer className="h-3.5 w-3.5 mr-1.5" />Print DR</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => printDRBlank(log)}><FileOutput className="h-3.5 w-3.5 mr-1.5" />Print (Blank Form)</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEdit(log)}>Edit</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(log.id)}>Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>

                        {isExpanded && (
                          <TableRow key={`${log.id}-expanded`} className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={8} className="py-3 px-6">
                              <div className="space-y-3">
                                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                                  {log.po_number && <span>SO: <span className="font-mono text-foreground">{log.po_number}</span></span>}
                                  {log.received_by_name && <span>Received by: <span className="text-foreground">{log.received_by_name}</span></span>}
                                  {log.remarks && <span>Remarks: <span className="text-foreground">{log.remarks}</span></span>}
                                </div>
                                {logItems.length === 0 ? (
                                  <p className="text-xs text-muted-foreground italic">No item records.</p>
                                ) : (
                                  <div className="border rounded-md overflow-hidden text-xs">
                                    <table className="w-full">
                                      <thead className="bg-muted/60">
                                        <tr>
                                          <th className="text-left px-3 py-1.5 font-medium w-10">#</th>
                                          <th className="text-right px-3 py-1.5 font-medium w-16">Qty</th>
                                          <th className="text-left px-3 py-1.5 font-medium w-24">Unit</th>
                                          <th className="text-left px-3 py-1.5 font-medium">Item Description</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {logItems.map((item, i) => (
                                          <tr key={item.id ?? i} className="border-t">
                                            <td className="px-3 py-1 text-muted-foreground">{i + 1}</td>
                                            <td className="px-3 py-1 text-right font-medium">{Number(item.quantity)}</td>
                                            <td className="px-3 py-1 text-muted-foreground">{item.unit}</td>
                                            <td className="px-3 py-1">{item.item_name}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                                {/* SO Pending Items — show outstanding qty vs ordered */}
                                {log.po_number && (() => {
                                  const soItems = soItemsMap[log.po_number] ?? []
                                  if (soItems.length === 0) return null
                                  // Sum all dr_log_items for DRs referencing this SO
                                  const deliveredMap: Record<string, number> = {}
                                  allItems
                                    .filter(di => {
                                      const dl = logs.find(l => l.dr_number === di.dr_number)
                                      return dl?.po_number === log.po_number && (dl.status === 'received' || dl.status === 'partial')
                                    })
                                    .forEach(di => {
                                      deliveredMap[di.item_name] = (deliveredMap[di.item_name] ?? 0) + Number(di.quantity)
                                    })
                                  const pending = soItems.filter(si => (deliveredMap[si.item_name] ?? 0) < si.quantity)
                                  if (pending.length === 0) return (
                                    <div className="mt-2 flex items-center gap-1.5 text-xs text-green-600 font-medium">
                                      <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                                      All SO items fully delivered
                                    </div>
                                  )
                                  return (
                                    <div className="mt-2">
                                      <p className="text-xs font-semibold text-yellow-700 mb-1">Pending from SO {log.po_number}</p>
                                      <div className="border border-yellow-200 rounded-md overflow-hidden text-xs bg-yellow-50">
                                        <table className="w-full">
                                          <thead className="bg-yellow-100">
                                            <tr>
                                              <th className="text-left px-3 py-1 font-medium">Item</th>
                                              <th className="text-right px-3 py-1 font-medium">Ordered</th>
                                              <th className="text-right px-3 py-1 font-medium">Delivered</th>
                                              <th className="text-right px-3 py-1 font-medium text-yellow-800">Remaining</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {pending.map((si, pi) => {
                                              const del = deliveredMap[si.item_name] ?? 0
                                              return (
                                                <tr key={pi} className="border-t border-yellow-200">
                                                  <td className="px-3 py-1">{si.item_name}</td>
                                                  <td className="px-3 py-1 text-right">{si.quantity}</td>
                                                  <td className="px-3 py-1 text-right text-green-700">{del}</td>
                                                  <td className="px-3 py-1 text-right font-semibold text-yellow-800">{si.quantity - del}</td>
                                                </tr>
                                              )
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )
                                })()}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    )
                  })}
                </TableBody>
              </Table>
            ) : (
              (() => {
                return (
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow>
                        <TableHead className="w-12">No.</TableHead>
                        <TableHead>DR Number</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Delivered To</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Item Description</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-10">
                            <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ) : allItemsFlat.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                            No item records found.
                          </TableCell>
                        </TableRow>
                      ) : pagedItemsFlat.map((row, i) => {
                        const sc = STATUS_CFG[row.log.status] ?? STATUS_CFG.received
                        return (
                          <TableRow key={`${row.id ?? i}-flat`}>
                            <TableCell className="text-sm text-muted-foreground">{(page - 1) * PAGE_SIZE + i + 1}</TableCell>
                            <TableCell className="font-mono text-sm font-semibold text-red-600">{row.dr_number}</TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              {format(parseISO(row.log.dr_date), 'MM/dd/yyyy')}
                            </TableCell>
                            <TableCell className="text-sm">{row.log.supplier_name ?? '—'}</TableCell>
                            <TableCell className="text-right font-medium text-sm">{Number(row.quantity)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{row.unit}</TableCell>
                            <TableCell className="text-sm">{row.item_name}</TableCell>
                            <TableCell>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.cls}`}>{sc.label}</span>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )
              })()
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm px-4 py-3 border-t bg-gradient-to-r from-gray-50 to-white rounded-b-xl">
              <span className="text-muted-foreground">
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, activeTotal)} of {activeTotal}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-md border text-sm font-medium disabled:opacity-40 hover:bg-muted transition-colors"
                >← Prev</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-md text-sm font-medium transition-colors shadow-sm ${p === page ? 'bg-gradient-to-br from-red-600 to-red-700 text-white shadow-red-600/30' : 'border hover:bg-muted shadow-none'}`}
                  >{p}</button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-md border text-sm font-medium disabled:opacity-40 hover:bg-muted transition-colors"
                >Next →</button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </>)}

      {open && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Truck className="h-4 w-4 text-red-600" />
              {editing ? 'Edit DR Log' : 'New DR Log'}
            </CardTitle>
            <div className="flex rounded-md border overflow-hidden w-fit lg:hidden">
              <button
                onClick={() => setDrActiveTab('form')}
                className={`px-4 py-1.5 text-sm font-medium ${drActiveTab === 'form' ? 'bg-red-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted'}`}
              >Form</button>
              <button
                onClick={() => setDrActiveTab('preview')}
                className={`px-4 py-1.5 text-sm font-medium border-l ${drActiveTab === 'preview' ? 'bg-red-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted'}`}
              >Preview</button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT column: all form fields */}
              <div className={`space-y-5 ${drActiveTab === 'preview' ? 'hidden lg:block' : 'block'}`}>
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">DR Details</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>DR Number <span className="text-destructive">*</span></Label>
                      <div className="relative">
                        <Input
                          placeholder="e.g. DR-2025-00001"
                          value={form.dr_number}
                          onChange={e => setForm(f => ({ ...f, dr_number: e.target.value }))}
                          onFocus={() => setDrNumberDropdownOpen(true)}
                          onBlur={() => setTimeout(() => setDrNumberDropdownOpen(false), 150)}
                        />
                        {drNumberDropdownOpen && drNumberOptions.length > 0 && (
                          <div className="absolute z-20 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-44 overflow-y-auto min-w-[220px]">
                            {drNumberOptions.map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                onMouseDown={() => { setForm(f => ({ ...f, dr_number: opt.value })); setDrNumberDropdownOpen(false) }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-0 flex items-center justify-between"
                              >
                                <span className="font-mono">{opt.value}</span>
                                {opt.tag === 'current' && <span className="text-xs text-muted-foreground ml-1.5">(Current)</span>}
                                {opt.tag === 'next' && <span className="text-xs text-muted-foreground ml-1.5">(Next)</span>}
                                {opt.tag === 'missing' && <span className="text-xs text-amber-600 ml-1.5">(Missing)</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>DR Date <span className="text-destructive">*</span></Label>
                      <Input type="date" value={form.dr_date}
                        onChange={e => setForm(f => ({ ...f, dr_date: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Delivered To</Label>
                    <Select value={deliveredToId} onValueChange={handleClientChange}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select client / delivered to" /></SelectTrigger>
                      <SelectContent className="min-w-[320px]">
                        <SelectItem value="">— None —</SelectItem>
                        {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-[2fr_1fr] gap-4">
                    <div className="space-y-1.5">
                      <Label>SO Reference</Label>
                      <Select value={form.po_number} onValueChange={v => setForm(f => ({ ...f, po_number: v ?? '' }))}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Select SO…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">— None —</SelectItem>
                          {availableSoNumbers.map(s => <SelectItem key={s.id} value={s.so_number}>{s.so_number}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {form.po_number && soItemsMap[form.po_number]?.length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full h-7 text-xs mt-1"
                          onClick={() => setItems(soItemsMap[form.po_number].map(i => ({ dr_number: '', item_name: i.item_name, unit: i.unit, quantity: String(i.quantity) })))}
                        >
                          Load from SO
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v ?? 'received' }))}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="received">Received</SelectItem>
                          <SelectItem value="partial">Partial</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                          <SelectItem value="returned">Returned</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Received By</Label>
                    <Input placeholder="Name of receiver" value={form.received_by_name}
                      onChange={e => setForm(f => ({ ...f, received_by_name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Remarks</Label>
                    <Textarea rows={2} className="resize-y" placeholder="Notes, discrepancies, condition of goods…" value={form.remarks}
                      onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">Delivery Items</p>
                  <div className="border rounded-lg overflow-hidden [&_[data-slot=table-container]]:overflow-x-hidden">
                    <Table className="table-fixed w-full">
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead>Item Description</TableHead>
                          <TableHead className="w-20">Qty</TableHead>
                          <TableHead className="w-24">Unit</TableHead>
                          <TableHead className="w-8"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell className="py-1.5 relative">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                                <input
                                  value={itemSearches[i] ?? item.item_name}
                                  onChange={e => {
                                    setItemSearches(s => ({ ...s, [i]: e.target.value }))
                                    setItemDropdowns(d => ({ ...d, [i]: true }))
                                  }}
                                  onFocus={() => setItemDropdowns(d => ({ ...d, [i]: true }))}
                                  onBlur={() => setTimeout(() => setItemDropdowns(d => ({ ...d, [i]: false })), 150)}
                                  placeholder="Search item…"
                                  className="w-full h-8 pl-8 pr-3 rounded border border-input text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                />
                                {itemDropdowns[i] && (
                                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                                    {itemOptions
                                      .filter(it => !itemSearches[i] || it.item_name.toLowerCase().includes((itemSearches[i] ?? '').toLowerCase()))
                                      .slice(0, 40)
                                      .map(it => (
                                        <button
                                          key={it.item_code}
                                          type="button"
                                          onMouseDown={() => {
                                            setItems(prev => prev.map((row, idx) => idx === i
                                              ? { ...row, item_name: it.item_name, unit: it.unit_of_measure }
                                              : row))
                                            setItemSearches(s => ({ ...s, [i]: it.item_name }))
                                            setItemDropdowns(d => ({ ...d, [i]: false }))
                                          }}
                                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                                        >
                                          <span>{it.item_name}</span>
                                          <span className="text-xs text-muted-foreground ml-2">{it.unit_of_measure}</span>
                                        </button>
                                      ))}
                                    {itemOptions.filter(it => !itemSearches[i] || it.item_name.toLowerCase().includes((itemSearches[i] ?? '').toLowerCase())).length === 0 && (
                                      <div className="px-3 py-2 text-xs text-muted-foreground">No items found</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-1.5">
                              <Input
                                type="number" min={0} placeholder="0"
                                value={item.quantity}
                                onChange={e => updateItem(i, 'quantity', e.target.value)}
                                className="h-8 text-sm w-full"
                              />
                            </TableCell>
                            <TableCell className="py-1.5">
                              <div className="h-8 flex items-center px-2 text-sm bg-muted/30 rounded border text-muted-foreground">
                                {item.unit || '—'}
                              </div>
                            </TableCell>
                            <TableCell className="py-1.5">
                              <button
                                type="button"
                                onClick={() => removeItemRow(i)}
                                className="h-8 w-8 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addItemRow} className="mt-1">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
                  </Button>
                </div>
              </div>

              {/* RIGHT column: live preview */}
              <div className={`${drActiveTab === 'form' ? 'hidden lg:block' : 'block'}`}>
                <div className="sticky top-0">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live Preview</p>
                    <div className="flex gap-1.5">
                      <Button type="button" variant="outline" size="sm" onClick={openCalib} className="h-7 px-2 text-xs gap-1">
                        <SlidersHorizontal className="h-3.5 w-3.5" /> Calibrate
                      </Button>
                      {editing && (
                        <Button type="button" variant="outline" size="sm" onClick={() => printDRBlank(editing)} className="h-7 px-2 text-xs gap-1">
                          <FileOutput className="h-3.5 w-3.5" /> Blank Form
                        </Button>
                      )}
                      <Button type="button" variant="outline" size="sm" onClick={handlePrint} className="h-7 px-2 text-xs gap-1">
                        <Printer className="h-3.5 w-3.5" /> Print
                      </Button>
                    </div>
                  </div>
                  <div ref={printRef} className="border rounded-lg bg-white text-[11px] p-4 shadow-sm space-y-3 font-sans">
                    {/* Header: logo LEFT | company name + address RIGHT */}
                    <div className="flex justify-between items-start border-b pb-3">
                      <div>
                        <img src="/cdsc-logo.jpg" alt="CDSC" className="h-12 w-28 object-contain" />
                      </div>
                      <div className="text-right">
                        <div className="text-[13px] font-bold text-red-700 mb-0.5">{companyInfo?.company_name || 'CDSC Industrial Supply'}</div>
                        {companyInfo?.address && <div className="text-[9px] text-gray-500">{companyInfo.address}</div>}
                        {(companyInfo?.phone || companyInfo?.email) && (
                          <div className="text-[9px] text-gray-500">
                            {companyInfo.phone}{companyInfo.phone && companyInfo.email ? ' | ' : ''}{companyInfo.email}
                          </div>
                        )}
                        {companyInfo?.tin && <div className="text-[9px] text-gray-500">TIN: {companyInfo.tin}</div>}
                      </div>
                    </div>

                    {/* Party info: Delivered To | DELIVERY RECEIPT title | DR No/Date */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="text-[9px] font-semibold uppercase text-gray-400 mb-0.5">Delivered To</div>
                        <div className="font-semibold text-gray-800">{form.supplier_name || <span className="text-gray-400 italic">—</span>}</div>
                        {form.po_number && <>
                          <div className="text-[9px] font-semibold uppercase text-gray-400 mt-1.5 mb-0.5">SO Reference</div>
                          <div className="font-mono text-gray-800">{form.po_number}</div>
                        </>}
                      </div>
                      <div className="text-center flex items-center justify-center">
                        <div className="text-[16px] font-extrabold text-red-700 uppercase tracking-widest">Delivery Receipt</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[9px] font-semibold uppercase text-gray-400">DR Number</div>
                        <div className="font-mono font-bold text-gray-800">{form.dr_number || '—'}</div>
                        <div className="text-[9px] font-semibold uppercase text-gray-400 mt-1.5">Date</div>
                        <div className="text-gray-800">{form.dr_date ? format(parseISO(form.dr_date), 'MM/dd/yyyy') : '—'}</div>
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
                        </tr>
                      </thead>
                      <tbody>
                        {items.filter(it => it.item_name).length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-1.5 py-3 text-center text-gray-300 italic">No items added yet</td>
                          </tr>
                        ) : items.map((item, i) => (
                          item.item_name ? (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-1.5 py-1 text-gray-400">{i + 1}</td>
                              <td className="px-1.5 py-1">{item.item_name}</td>
                              <td className="px-1.5 py-1 text-gray-500">{item.unit || '—'}</td>
                              <td className="px-1.5 py-1 text-right font-medium">{Number(item.quantity) || '—'}</td>
                            </tr>
                          ) : null
                        ))}
                      </tbody>
                    </table>

                    {form.received_by_name && (
                      <div className="border-t pt-2 text-[10px]">
                        <span className="text-gray-400 font-semibold">Received By: </span>{form.received_by_name}
                      </div>
                    )}
                    {form.remarks && (
                      <div className={`${form.received_by_name ? '' : 'border-t '}pt-2 text-[10px]`}>
                        <span className="text-gray-400 font-semibold">Remarks: </span>{form.remarks}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
              <Button variant="outline" onClick={handleCancelClick}>Cancel</Button>
              <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : editing ? 'Update DR Log' : 'Save DR Log'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete DR Log?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete this delivery receipt log and all its items.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attachment Preview */}
      <Dialog open={previewAttachmentUrl !== null} onOpenChange={o => { if (!o) setPreviewAttachmentUrl(null) }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>DR Attachment</DialogTitle>
          </DialogHeader>
          {previewAttachmentUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewAttachmentUrl} alt="DR attachment" className="w-full max-h-[70vh] object-contain rounded-lg border" />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={calibOpen} onOpenChange={setCalibOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Calibrate Blank Form Print</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            All values are in millimeters, measured from the top-left corner of the page. Load your blank DR form
            into the printer, click <strong>Print Test Grid</strong>, hold it up to the form to read off where the
            blank line for each field falls, then enter those numbers below. Make sure your print dialog uses 100%
            scale with no margins.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={printCalibGrid} className="w-fit gap-1.5">
            <Printer className="h-3.5 w-3.5" /> Print Test Grid
          </Button>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div className="col-span-2 grid grid-cols-3 gap-3">
              <CalibField label="Page Width" value={calibDraft.pageWidthMm} onChange={v => setCalibDraft(d => ({ ...d, pageWidthMm: v }))} />
              <CalibField label="Page Height" value={calibDraft.pageHeightMm} onChange={v => setCalibDraft(d => ({ ...d, pageHeightMm: v }))} />
              <CalibField label="Font Size (pt)" value={calibDraft.fontSizePt} onChange={v => setCalibDraft(d => ({ ...d, fontSizePt: v }))} />
            </div>
            <CalibPair label="Date" top={calibDraft.dateTop} left={calibDraft.dateLeft}
              onChange={(top, left) => setCalibDraft(d => ({ ...d, dateTop: top, dateLeft: left }))} />
            <CalibPair label="Delivered To" top={calibDraft.deliveredToTop} left={calibDraft.deliveredToLeft}
              onChange={(top, left) => setCalibDraft(d => ({ ...d, deliveredToTop: top, deliveredToLeft: left }))} />
            <CalibPair label="Address" top={calibDraft.addressTop} left={calibDraft.addressLeft}
              onChange={(top, left) => setCalibDraft(d => ({ ...d, addressTop: top, addressLeft: left }))} />
            <CalibPair label="TIN" top={calibDraft.tinTop} left={calibDraft.tinLeft}
              onChange={(top, left) => setCalibDraft(d => ({ ...d, tinTop: top, tinLeft: left }))} />
            <CalibPair label="Business Style" top={calibDraft.businessStyleTop} left={calibDraft.businessStyleLeft}
              onChange={(top, left) => setCalibDraft(d => ({ ...d, businessStyleTop: top, businessStyleLeft: left }))} />
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
