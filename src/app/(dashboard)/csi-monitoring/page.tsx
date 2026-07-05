'use client'

import { useState, useEffect, useRef, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
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
import { Plus, X, Search, MoreHorizontal, Loader2, FileText, LayoutGrid, List, ChevronDown, ChevronRight, ChevronUp, Package, Trash2, Printer, SlidersHorizontal, FileOutput } from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { useSearchContext } from '@/context/search-context'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Legend, AreaChart, Area,
} from 'recharts'

interface ItemOption { item_name: string; unit_of_measure: string }
interface ClientOption {
  id: string
  company_name: string
  show_csi_in_portal: boolean
  address: string | null
  city: string | null
  province: string | null
  tin: string | null
  industry: string | null
}
interface SOItemOption { item_name: string; unit: string; quantity: number }

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
}

interface CSIItem {
  item_name: string
  unit: string
  quantity: string
  unit_price: string
}

const emptyItem = (): CSIItem => ({ item_name: '', unit: '', quantity: '', unit_price: '' })

const emptyHeader = () => ({
  si_date: new Date().toISOString().split('T')[0],
  si_number: '',
  po_number: '',
  client_name: '',
  dr_number: '',
})

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
  const [drNumbers, setDrNumbers] = useState<{ id: string; dr_number: string }[]>([])
  const [soItemsMap, setSoItemsMap] = useState<Record<string, SOItemOption[]>>({})
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [chartsExpanded, setChartsExpanded] = useState(false)
  const [editingSiNumber, setEditingSiNumber] = useState<string | null>(null)
  const [siFilter, setSiFilter] = useState('')
  const [itemFilter, setItemFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('all')
  const [header, setHeader] = useState(emptyHeader())
  const [items, setItems] = useState<CSIItem[]>([emptyItem()])
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'by-si' | 'all-items' | 'cross-ref'>('by-si')
  const [drItemsForCrossRef, setDrItemsForCrossRef] = useState<{ dr_number: string; item_name: string; client_name: string | null }[]>([])
  const [expandedSIs, setExpandedSIs] = useState<Set<string>>(new Set())
  const [inventoryItem, setInventoryItem] = useState<string>('')
  const [inventoryOpen, setInventoryOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form')
  const [siNumberOptions, setSiNumberOptions] = useState<{ value: string; tag: 'current' | 'next' | 'missing' }[]>([])
  const [companyInfo, setCompanyInfo] = useState<{ company_name: string; address: string; phone: string; email: string; tin: string } | null>(null)
  const [blankCalib, setBlankCalib] = useState<BlankFormCalib>(() => loadBlankCalib())
  const [calibOpen, setCalibOpen] = useState(false)
  const [calibDraft, setCalibDraft] = useState<BlankFormCalib>(DEFAULT_BLANK_CALIB)
  const printRef = useRef<HTMLDivElement>(null)

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
    const [{ data: itemOptData }, { data: clientData }, { data: soData }, { data: drItemsData }, { data: drLogData }] = await Promise.all([
      supabase.from('items').select('item_name, unit_of_measure').order('item_name'),
      supabase.from('clients').select('id, company_name, show_csi_in_portal, address, city, province, tin, industry').eq('status', 'active').order('company_name'),
      supabase.from('sales_orders').select('id, so_number').not('so_number', 'is', null).order('created_at', { ascending: false }),
      supabase.from('dr_log_items').select('dr_number, item_name, dr_logs!inner(client_name)').order('item_name'),
      supabase.from('dr_logs').select('id, dr_number').order('dr_date', { ascending: false }),
    ])
    setDrItemsForCrossRef((drItemsData ?? []).map((d: any) => ({ dr_number: d.dr_number, item_name: d.item_name, client_name: d.dr_logs?.client_name ?? null })))
    setItemOptions((itemOptData ?? []) as ItemOption[])
    setClientOptions((clientData ?? []) as ClientOption[])
    setDrNumbers((drLogData ?? []) as { id: string; dr_number: string }[])
    const filteredSOs = (soData ?? []).filter((s: any) => s.so_number) as { id: string; so_number: string }[]
    setSoNumbers(filteredSOs)
    const soIds = filteredSOs.map(s => s.id)
    if (soIds.length > 0) {
      const { data: soItemsData } = await supabase
        .from('so_items')
        .select('item_name, unit, quantity, so_id, sales_orders!inner(so_number)')
        .in('so_id', soIds)
      if (soItemsData) {
        const map: Record<string, SOItemOption[]> = {}
        for (const row of soItemsData as any[]) {
          const soNum = row.sales_orders?.so_number
          if (!soNum) continue
          if (!map[soNum]) map[soNum] = []
          map[soNum].push({ item_name: row.item_name, unit: row.unit ?? '', quantity: Number(row.quantity) })
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
    const matchSI = !siFilter || r.si_number.toLowerCase().includes(siFilter.toLowerCase())
    const matchItem = !itemFilter || r.item_name.toLowerCase().includes(itemFilter.toLowerCase())
    const matchClient = !clientFilter || (r.client_name ?? '') === clientFilter
    const matchYear = yearFilter === 'all' || r.si_date?.slice(0, 4) === yearFilter
    return matchSearch && matchSI && matchItem && matchClient && matchYear
  })

  const totalAmount = filtered.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const uniqueSIs = new Set(filtered.map(r => r.si_number)).size

  const siGroups: { si_number: string; date: string; client: string; po: string | null; dr: string | null; items: CSIRecord[]; total: number; show_in_portal: boolean }[] = []
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
      })
    }
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">CSI Monitoring</h1>
          <p className="text-muted-foreground text-sm">Charge Sales Invoice records</p>
        </div>
        {open ? (
          <Button variant="outline" onClick={() => { setOpen(false); setHeader(emptyHeader()); setItems([emptyItem()]); setEditingSiNumber(null) }}>
            <X className="h-4 w-4 mr-2" />Cancel
          </Button>
        ) : (
          <Button onClick={openAdd} className="bg-red-600 hover:bg-red-700">
            <Plus className="h-4 w-4 mr-2" /> New Record
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
                        <SelectTrigger><SelectValue placeholder="Select SI number…" /></SelectTrigger>
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
                    <Select value={header.client_name} onValueChange={v => setHeader(h => ({ ...h, client_name: v ?? '' }))}>
                      <SelectTrigger><SelectValue placeholder="Select client…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">— None —</SelectItem>
                        {clientOptions.map(c => <SelectItem key={c.id} value={c.company_name}>{c.company_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-[2fr_1fr] gap-4">
                    <div className="space-y-1.5">
                      <Label>SO Number</Label>
                      <Select value={header.po_number} onValueChange={v => setHeader(h => ({ ...h, po_number: v ?? '' }))}>
                        <SelectTrigger><SelectValue placeholder="Select SO…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">— None —</SelectItem>
                          {soNumbers.map(s => <SelectItem key={s.id} value={s.so_number}>{s.so_number}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {header.po_number && soItemsMap[header.po_number]?.length > 0 && (
                        <button type="button" onClick={() => setItems(soItemsMap[header.po_number].map(i => ({ item_name: i.item_name, unit: i.unit, quantity: String(i.quantity), unit_price: '' })))}
                          className="w-full h-7 text-xs border border-dashed border-blue-400 text-blue-600 hover:bg-blue-50 rounded-md mt-1 font-medium">
                          Load items from SO
                        </button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>DR Number</Label>
                      <Select value={header.dr_number} onValueChange={v => setHeader(h => ({ ...h, dr_number: v ?? '' }))}>
                        <SelectTrigger><SelectValue placeholder="Select DR…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">— None —</SelectItem>
                          {drNumbers.map(d => <SelectItem key={d.id} value={d.dr_number}>{d.dr_number}</SelectItem>)}
                          {header.dr_number && !drNumbers.some(d => d.dr_number === header.dr_number) && (
                            <SelectItem value={header.dr_number}>{header.dr_number}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">Line Items</p>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="min-w-[200px]">Item Description</TableHead>
                          <TableHead className="w-8"></TableHead>
                          <TableHead className="w-20">Unit</TableHead>
                          <TableHead className="w-20">Qty</TableHead>
                          <TableHead className="w-28">Unit Price (₱)</TableHead>
                          <TableHead className="w-28 text-right">Amount</TableHead>
                          <TableHead className="w-8"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, i) => {
                          const amt = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0)
                          return (
                            <TableRow key={i}>
                              <TableCell className="py-1.5">
                                <Select value={item.item_name} onValueChange={val => {
                                  const opt = itemOptions.find(o => o.item_name === (val ?? ''))
                                  setItems(prev => prev.map((it, idx) => idx === i ? { ...it, item_name: val ?? '', unit: opt?.unit_of_measure ?? it.unit } : it))
                                }}>
                                  <SelectTrigger className="h-8 text-sm w-full"><SelectValue placeholder="Select item…" /></SelectTrigger>
                                  <SelectContent>
                                    {itemOptions.map(opt => (
                                      <SelectItem key={opt.item_name} value={opt.item_name}>
                                        {opt.item_name} <span className="text-xs text-muted-foreground ml-1">({opt.unit_of_measure})</span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="py-1.5">
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-blue-600"
                                  title="View inventory" onClick={() => { setInventoryItem(item.item_name); setInventoryOpen(true) }}>
                                  <Package className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                              <TableCell className="py-1.5">
                                <div className="h-8 flex items-center px-2 text-sm bg-muted/30 rounded border text-muted-foreground">{item.unit || '—'}</div>
                              </TableCell>
                              <TableCell className="py-1.5">
                                <Input type="number" min={0} className="h-8 text-sm" placeholder="0" value={item.quantity}
                                  onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: e.target.value } : it))} />
                              </TableCell>
                              <TableCell className="py-1.5">
                                <Input type="number" min={0} step="0.01" className="h-8 text-sm" placeholder="0.00" value={item.unit_price}
                                  onChange={e => setItems(prev => prev.map((it, idx) => idx === i ? { ...it, unit_price: e.target.value } : it))} />
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
                          const amt = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0)
                          return item.item_name ? (
                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-1.5 py-1 text-gray-400">{i + 1}</td>
                              <td className="px-1.5 py-1">{item.item_name}</td>
                              <td className="px-1.5 py-1 text-gray-500">{item.unit || '—'}</td>
                              <td className="px-1.5 py-1 text-right">{Number(item.quantity) || '—'}</td>
                              <td className="px-1.5 py-1 text-right">{item.unit_price ? formatPeso(Number(item.unit_price)) : '—'}</td>
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

            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
              <Button variant="outline" onClick={() => { setOpen(false); setHeader(emptyHeader()); setItems([emptyItem()]); setEditingSiNumber(null) }}>Cancel</Button>
              <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : editingSiNumber ? 'Update' : 'Save'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!open && (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{loading ? '—' : uniqueSIs}</div>
            <div className="text-xs text-muted-foreground">Total SI Numbers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{loading ? '—' : filtered.length}</div>
            <div className="text-xs text-muted-foreground">Line Items</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-green-600">{loading ? '—' : formatPeso(totalAmount)}</div>
            <div className="text-xs text-muted-foreground">Total Amount</div>
          </CardContent>
        </Card>
      </div>
      )}

      {!open && (() => {
        const PALETTE = ['#dc2626','#2563eb','#16a34a','#d97706','#7c3aed','#0891b2','#be185d','#65a30d']

        const clientStats = clientOptions.map((c, i) => {
          const clientRecs = records.filter(r => r.client_name === c.company_name)
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
        for (const r of records) {
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
              <Card className="lg:col-span-2">
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
              <Card className="flex flex-col">
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
                <Card>
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
              <Card>
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

      {!open && <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            list="si-number-list"
            value={siFilter}
            onChange={e => setSiFilter(e.target.value)}
            placeholder="Filter by SI Number…"
            className="h-9 pl-8 pr-8 text-sm border rounded-md bg-background w-52 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <datalist id="si-number-list">
            {[...new Set(records.map(r => r.si_number))].sort().map(si => (
              <option key={si} value={si} />
            ))}
          </datalist>
          {siFilter && (
            <button onClick={() => setSiFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            value={itemFilter}
            onChange={e => setItemFilter(e.target.value)}
            placeholder="Search line item…"
            className="h-9 pl-8 pr-8 text-sm border rounded-md bg-background w-52 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          {itemFilter && (
            <button onClick={() => setItemFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Select value={clientFilter} onValueChange={v => setClientFilter(v === '__all__' ? '' : (v ?? ''))}>
          <SelectTrigger className="h-9 w-48 text-sm">
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Clients</SelectItem>
            {clientOptions.map(c => <SelectItem key={c.id} value={c.company_name}>{c.company_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={v => setYearFilter(v ?? 'all')}>
          <SelectTrigger className="h-9 w-32 text-sm"><SelectValue placeholder="All Years" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
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
      </div>}

      {!open && <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-red-600" /> Charge Sales Invoice Log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {viewMode === 'cross-ref' ? (() => {
              const csiItems = new Set(records.map(r => r.item_name.trim().toLowerCase()))
              const drItems = new Set(drItemsForCrossRef.map(d => d.item_name.trim().toLowerCase()))
              const inCsiNotDr = [...new Set(records.map(r => r.item_name))].filter(n => !drItems.has(n.trim().toLowerCase()))
              const inDrNotCsi = [...new Set(drItemsForCrossRef.map(d => d.item_name))].filter(n => !csiItems.has(n.trim().toLowerCase()))
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
                            <TableHead className="text-right">CSI Count</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {inCsiNotDr.map(name => (
                              <TableRow key={name}>
                                <TableCell className="text-sm">{name}</TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">
                                  {records.filter(r => r.item_name === name).length}
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
                            <TableHead className="text-right">DR Count</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {inDrNotCsi.map(name => (
                              <TableRow key={name}>
                                <TableCell className="text-sm">{name}</TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">
                                  {drItemsForCrossRef.filter(d => d.item_name === name).length}
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
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead className="w-28">Date</TableHead>
                    <TableHead className="w-32">SI Number</TableHead>
                    <TableHead className="w-32">SO Number</TableHead>
                    <TableHead className="min-w-[160px]">Client</TableHead>
                    <TableHead className="w-28">DR Number</TableHead>
                    <TableHead className="text-right w-16">Items</TableHead>
                    <TableHead className="text-right w-32">Total Amount</TableHead>
                    <TableHead className="w-24 text-center">Portal</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : siGroups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                        No records found. Click <strong>New Record</strong> to add one.
                      </TableCell>
                    </TableRow>
                  ) : siGroups.map(group => (
                    <Fragment key={group.si_number}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleSI(group.si_number)}
                      >
                        <TableCell className="text-muted-foreground">
                          {expandedSIs.has(group.si_number)
                            ? <ChevronDown className="h-4 w-4" />
                            : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {format(parseISO(group.date), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="font-mono text-sm font-semibold text-red-600">{group.si_number}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{group.po ?? '—'}</TableCell>
                        <TableCell className="text-sm">{group.client}</TableCell>
                        <TableCell className="text-sm font-mono">{group.dr ?? '—'}</TableCell>
                        <TableCell className="text-right text-sm">{group.items.length}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{formatPeso(group.total)}</TableCell>
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
                          <TableCell colSpan={9} className="p-0 bg-muted/20">
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
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Date</TableHead>
                    <TableHead className="w-32">SI Number</TableHead>
                    <TableHead className="min-w-[160px]">Client</TableHead>
                    <TableHead>Item/s</TableHead>
                    <TableHead className="text-right w-16">QTY</TableHead>
                    <TableHead className="w-20">Unit</TableHead>
                    <TableHead className="text-right w-32">Unit Price</TableHead>
                    <TableHead className="text-right w-28">Amount</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                        No records found. Click <strong>New Record</strong> to add one.
                      </TableCell>
                    </TableRow>
                  ) : filtered.map(rec => (
                    <TableRow key={rec.id}>
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
        </CardContent>
      </Card>
      }

      {/* Inventory Lookup Modal */}
      <Dialog open={inventoryOpen} onOpenChange={setInventoryOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Inventory Stock — {inventoryItem || 'All Items'}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SI Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records
                  .filter(r => !inventoryItem || r.item_name === inventoryItem)
                  .slice(0, 50)
                  .map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs text-red-600">{r.si_number}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{format(parseISO(r.si_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="text-sm">{r.client_name ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm">{r.quantity}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.unit ?? '—'}</TableCell>
                      <TableCell className="text-right text-sm">{r.unit_price ? formatPeso(Number(r.unit_price)) : '—'}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{r.amount ? formatPeso(Number(r.amount)) : '—'}</TableCell>
                    </TableRow>
                  ))}
                {records.filter(r => !inventoryItem || r.item_name === inventoryItem).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No CSI records found for this item.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInventoryOpen(false)}>Close</Button>
          </DialogFooter>
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

      <Dialog open={calibOpen} onOpenChange={setCalibOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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
