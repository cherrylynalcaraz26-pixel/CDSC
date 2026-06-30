'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Plus, MoreHorizontal, Eye, Printer, Trash2, CheckCircle2, XCircle,
  Loader2, X, FileText, Package, Search, Mail, ChevronDown, ChevronUp,
  Globe, EyeOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useSearchContext } from '@/context/search-context'
import { sendEmail, SOPdfData } from '@/lib/send-email'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { subMonths, startOfMonth, endOfMonth, format as fmtDate } from 'date-fns'

type SOStatus = 'draft' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

const STATUS_CFG: Record<SOStatus, { label: string; cls: string }> = {
  draft:      { label: 'Draft',      cls: 'bg-gray-100 text-gray-600' },
  confirmed:  { label: 'Confirmed',  cls: 'bg-blue-100 text-blue-700' },
  processing: { label: 'Processing', cls: 'bg-yellow-100 text-yellow-700' },
  shipped:    { label: 'Shipped',    cls: 'bg-purple-100 text-purple-700' },
  delivered:  { label: 'Delivered',  cls: 'bg-green-100 text-green-700' },
  cancelled:  { label: 'Cancelled',  cls: 'bg-red-100 text-red-700' },
}

interface SO {
  id: string; so_number: string | null; so_date: string | null; created_at: string
  client_name: string | null; client_po_number: string | null
  status: SOStatus; total_amount: number; remarks: string | null
  show_in_portal: boolean
}

interface SOLine { item_name: string; quantity: string; unit: string; unit_price: string; selling_price: string }
interface SOItem { id: string; item_name: string; quantity: number; unit: string | null; unit_price: number; selling_price: number | null; total_amount: number }
interface ItemOption { item_code: string; item_name: string; unit_of_measure: string; cost: number | null; selling_price: number | null }
interface ClientOption { id: string; company_name: string; payment_terms?: string | null }
interface SystemSettings { company_name: string; address: string; phone: string; email: string; tin: string; logo_url?: string }

const emptyLine = (): SOLine => ({ item_name: '', quantity: '', unit: '', unit_price: '', selling_price: '' })
const today = () => new Date().toISOString().split('T')[0]

export default function SalesOrdersPage() {
  const supabase = createClient()
  const printRef = useRef<HTMLDivElement>(null)
  const [sos, setSOs] = useState<SO[]>([])
  const [items, setItems] = useState<ItemOption[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [companyInfo, setCompanyInfo] = useState<SystemSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form')
  const [itemSearchIdx, setItemSearchIdx] = useState<number | null>(null)
  const [itemQuery, setItemQuery] = useState('')

  // View SO
  const [viewSO, setViewSO] = useState<SO | null>(null)
  const [viewSOItems, setViewSOItems] = useState<SOItem[]>([])
  const [viewSODeliveries, setViewSODeliveries] = useState<{ dr_number: string; dr_date: string; status: string; client_name: string | null; client_accepted_at: string | null; client_accepted_by: string | null; items: { item_name: string; unit: string; quantity: number }[] }[]>([])

  // Link DR to SO
  const [linkDROptions, setLinkDROptions] = useState<{ dr_number: string; dr_date: string; status: string; supplier_name: string | null }[]>([])
  const [linkDRSelected, setLinkDRSelected] = useState('')
  const [linkDRSaving, setLinkDRSaving] = useState(false)

  // CSI linked to SO
  const [viewSOCSIs, setViewSOCSIs] = useState<{ si_number: string; si_date: string; total: number; items: { item_name: string; unit: string | null; quantity: number; unit_price: number }[] }[]>([])
  const [linkCSIOptions, setLinkCSIOptions] = useState<{ si_number: string; si_date: string; total: number }[]>([])
  const [linkCSISelected, setLinkCSISelected] = useState('')
  const [linkCSISaving, setLinkCSISaving] = useState(false)

  // delivery summary per so_number for list display
  const [soDeliveryMap, setSoDeliveryMap] = useState<Record<string, { total: number; pending: number; partial: number; delivered: number }>>({})


  // Email SO
  const [emailSO, setEmailSO] = useState<SO | null>(null)
  const [emailSOItems, setEmailSOItems] = useState<SOItem[]>([])
  const [emailToSO, setEmailToSO] = useState('')
  const [emailSubjectSO, setEmailSubjectSO] = useState('')
  const [emailBodySO, setEmailBodySO] = useState('')
  const [sendingEmailSO, setSendingEmailSO] = useState(false)

  // Edit SO
  const [editingSOId, setEditingSOId] = useState<string | null>(null)

  // Pipeline
  const [pipelineOpen, setPipelineOpen] = useState(false)
  // collectedClients removed — no OR/CR receipt system

  // Form
  const [soNumber, setSoNumber] = useState('')
  const [soDate, setSoDate] = useState(today())
  const [clientId, setClientId] = useState('')
  const [clientPONumber, setClientPONumber] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [remarks, setRemarks] = useState('')
  const [lines, setLines] = useState<SOLine[]>([emptyLine()])

  const selectedClient = clients.find(c => c.id === clientId)
  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.selling_price) || parseFloat(l.unit_price) || 0) * (parseFloat(l.quantity) || 0), 0)
  const costTotal = lines.reduce((s, l) => s + (parseFloat(l.unit_price) || 0) * (parseFloat(l.quantity) || 0), 0)
  const estimatedProfit = subtotal - costTotal
  const profitMarginPct = subtotal > 0 ? (estimatedProfit / subtotal) * 100 : 0
  const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

  const filteredSearchItems = itemQuery.trim()
    ? items.filter(it => it.item_name.toLowerCase().includes(itemQuery.toLowerCase()))
    : items

  async function load() {
    setLoading(true)
    const [{ data: soData }, { data: itemData }, { data: cliData }, { data: sysData }] = await Promise.all([
      supabase.from('sales_orders').select('id,so_number,so_date,created_at,client_name,client_po_number,status,total_amount,remarks,show_in_portal').order('created_at', { ascending: false }),
      supabase.from('items').select('item_code,item_name,unit_of_measure,cost,selling_price').eq('status', 'active').order('item_name'),
      supabase.from('clients').select('id,company_name,payment_terms').eq('status', 'active').order('company_name'),
      supabase.from('system_settings').select('company_name, address, phone, email, tin, logo_url').single(),
    ])
    const soList = (soData ?? []) as SO[]
    setSOs(soList)
    setItems((itemData ?? []) as ItemOption[])
    setClients((cliData ?? []) as ClientOption[])
    if (sysData) setCompanyInfo(sysData as SystemSettings)

    // Load delivery summary — query dr_logs (source of truth) + sales_deliveries
    const soNums = soList.map(s => s.so_number).filter(Boolean) as string[]
    if (soNums.length > 0) {
      const [{ data: drData }, { data: dvData }] = await Promise.all([
        supabase.from('dr_logs').select('dr_number,po_number,status').in('po_number', soNums),
        supabase.from('sales_deliveries').select('so_number,dr_number,status').in('so_number', soNums),
      ])
      const map: Record<string, { total: number; pending: number; partial: number; delivered: number }> = {}
      const seenDRs = new Set<string>()
      for (const d of (drData ?? [])) {
        if (!d.po_number) continue
        if (!map[d.po_number]) map[d.po_number] = { total: 0, pending: 0, partial: 0, delivered: 0 }
        map[d.po_number].total++
        if (d.status === 'received' || d.status === 'delivered') map[d.po_number].delivered++
        else if (d.status === 'partial') map[d.po_number].partial++
        else map[d.po_number].pending++
        if (d.dr_number) seenDRs.add(d.dr_number)
      }
      for (const d of (dvData ?? [])) {
        if (!d.so_number || (d.dr_number && seenDRs.has(d.dr_number))) continue
        if (!map[d.so_number]) map[d.so_number] = { total: 0, pending: 0, partial: 0, delivered: 0 }
        map[d.so_number].total++
        if (d.status === 'delivered' || d.status === 'received') map[d.so_number].delivered++
        else if (d.status === 'partial') map[d.so_number].partial++
        else map[d.so_number].pending++
      }
      setSoDeliveryMap(map)
    }

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function resetForm() {
    setSoNumber(''); setSoDate(today()); setClientId(''); setClientPONumber('')
    setDeliveryDate(''); setRemarks(''); setLines([emptyLine()]); setMobileTab('form')
    setEditingSOId(null)
  }

  async function submitSO() {
    if (!clientId) { toast.error('Client is required'); return }
    setSaving(true)
    const payload = {
      so_number: soNumber.trim() || null,
      so_date: soDate,
      client_id: clientId,
      client_name: selectedClient?.company_name ?? '',
      client_po_number: clientPONumber || null,
      delivery_date: deliveryDate || null,
      remarks: remarks || null,
      status: 'draft' as const,
      total_amount: subtotal,
    }
    const validLines = lines.filter(l => l.item_name.trim())
    const itemRows = validLines.map(l => ({
      item_name: l.item_name,
      quantity: parseFloat(l.quantity) || 1,
      unit: l.unit || null,
      unit_price: parseFloat(l.unit_price) || 0,
      selling_price: parseFloat(l.selling_price) || null,
      total_amount: (parseFloat(l.selling_price) || parseFloat(l.unit_price) || 0) * (parseFloat(l.quantity) || 0),
    }))

    if (editingSOId) {
      // Update existing SO
      const { error } = await supabase.from('sales_orders').update(payload).eq('id', editingSOId)
      if (error) { toast.error(error.message); setSaving(false); return }
      // Replace items
      await supabase.from('so_items').delete().eq('so_id', editingSOId)
      if (itemRows.length > 0) {
        const { error: itemErr } = await supabase.from('so_items').insert(itemRows.map(r => ({ ...r, so_id: editingSOId })))
        if (itemErr) toast.error(`Items: ${itemErr.message}`)
      }
      toast.success('Sales Order updated')
    } else {
      // Create new SO
      const { data: soData, error } = await supabase.from('sales_orders').insert(payload).select('id').single()
      if (error) { toast.error(error.message); setSaving(false); return }
      if (soData?.id && itemRows.length > 0) {
        const { error: itemErr } = await supabase.from('so_items').insert(itemRows.map(r => ({ ...r, so_id: soData.id })))
        if (itemErr) toast.error(`Items: ${itemErr.message}`)
      }
      toast.success('Sales Order created')
    }
    setOpen(false); resetForm(); load()
    setSaving(false)
  }

  async function openEditSO(so: SO) {
    const { data: items } = await supabase.from('so_items').select('*').eq('so_id', so.id)
    setSoNumber(so.so_number ?? '')
    setSoDate(so.so_date ?? today())
    const cli = clients.find(c => c.company_name === so.client_name)
    setClientId(cli?.id ?? '')
    setClientPONumber(so.client_po_number ?? '')
    setDeliveryDate('')
    setRemarks(so.remarks ?? '')
    setLines(
      items && items.length > 0
        ? (items as SOItem[]).map(it => ({
            item_name: it.item_name,
            quantity: String(it.quantity),
            unit: it.unit ?? '',
            unit_price: String(it.unit_price),
            selling_price: it.selling_price != null ? String(it.selling_price) : '',
          }))
        : [emptyLine()]
    )
    setEditingSOId(so.id)
    setMobileTab('form')
    setOpen(true)
  }

  async function updateStatus(id: string, status: SOStatus) {
    const { error } = await supabase.from('sales_orders').update({ status }).eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success(`Status → ${STATUS_CFG[status].label}`); load() }
  }

  async function deleteSO(id: string) {
    const { data: saved } = await supabase.from('sales_orders').select('*').eq('id', id).single()
    const { error } = await supabase.from('sales_orders').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    load()
    toast.success('Sales Order deleted', {
      action: { label: 'Undo', onClick: async () => {
        if (saved) { const { id: _id, so_number: _so, created_at: _ca, ...rest } = saved as any; await supabase.from('sales_orders').insert(rest); load() }
      }},
    })
  }

  async function togglePortalVisibility(so: SO) {
    const next = !so.show_in_portal
    const { error } = await supabase.from('sales_orders').update({ show_in_portal: next }).eq('id', so.id)
    if (error) toast.error(error.message)
    else { toast.success(next ? 'Visible in Client Portal' : 'Hidden from Client Portal'); load() }
  }

  function buildSOHtml(so: SO, soItems: SOItem[]): string {
    const info = companyInfo
    const logoUrl = companyInfo?.logo_url || `${window.location.origin}/cdsc-logo.jpg`
    const soDate = so.so_date ? new Date(so.so_date + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date(so.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    const fmtN = (n: number) => n.toLocaleString('en-PH', { minimumFractionDigits: 2 })
    const subtotalAmt = soItems.reduce((s, it) => s + (it.total_amount ?? 0), 0)
    const rows = soItems.map((it, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
        <td style="padding:4px 6px;color:#9ca3af;text-align:center">${i + 1}</td>
        <td style="padding:4px 6px">${it.item_name ?? ''}</td>
        <td style="padding:4px 6px;text-align:center">${it.quantity}</td>
        <td style="padding:4px 6px;color:#6b7280;text-align:center">${it.unit ?? ''}</td>
        <td style="padding:4px 6px;text-align:right">${fmtN(it.selling_price ?? it.unit_price ?? 0)}</td>
        <td style="padding:4px 6px;text-align:right;font-weight:600">${fmtN(it.total_amount ?? 0)}</td>
      </tr>`).join('')
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;padding:32px;color:#1f2937}
      table{border-collapse:collapse;width:100%}
    </style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:1px solid #e5e7eb;margin-bottom:14px">
      <div>
        <img src="${logoUrl}" style="width:64px;height:64px;object-fit:cover;border-radius:4px"/>
      </div>
      <div style="text-align:right">
        <div style="font-size:14px;font-weight:bold;color:#b91c1c;margin-bottom:2px">${info?.company_name ?? 'CDSC Industrial Supply'}</div>
        <div style="font-size:9px;color:#6b7280">
          ${info?.address ? `<div>${info.address}</div>` : ''}
          ${info?.phone || info?.email ? `<div>${[info.phone, info.email].filter(Boolean).join(' | ')}</div>` : ''}
          ${info?.tin ? `<div>TIN: ${info.tin}</div>` : ''}
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding-bottom:12px;border-bottom:1px solid #e5e7eb;margin-bottom:14px">
      <div>
        <div style="font-size:9px;font-weight:600;color:#9ca3af;text-transform:uppercase;margin-bottom:2px">Bill To</div>
        <div style="font-weight:bold;font-size:11px">${so.client_name ?? ''}</div>
        ${so.client_po_number ? `<div style="margin-top:6px"><div style="font-size:9px;font-weight:600;color:#9ca3af;text-transform:uppercase">Client PO #</div><div>${so.client_po_number}</div></div>` : ''}
        ${so.remarks ? `<div style="margin-top:6px"><div style="font-size:9px;font-weight:600;color:#9ca3af;text-transform:uppercase">Remarks</div><div style="font-size:10px">${so.remarks}</div></div>` : ''}
      </div>
      <div style="display:flex;align-items:center;justify-content:center">
        <div style="font-size:18px;font-weight:900;color:#b91c1c;text-transform:uppercase;text-align:center;letter-spacing:2px">Sales<br/>Order</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:9px;font-weight:600;color:#9ca3af;text-transform:uppercase">SO Number</div>
        <div style="font-weight:bold;font-family:monospace">${so.so_number ?? '—'}</div>
        <div style="font-size:9px;font-weight:600;color:#9ca3af;text-transform:uppercase;margin-top:6px">Date</div>
        <div>${soDate}</div>
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
        <div style="border-top:1px solid #e5e7eb;padding-top:4px;display:flex;justify-content:space-between;font-weight:bold;font-size:12px">
          <span>Total</span><span style="color:#b91c1c">${fmtN(subtotalAmt)}</span>
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
        <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:bold">RECEIVED BY</div>
        <div style="font-size:8px;color:#9ca3af">Signature over Printed Name / Date</div>
      </div>
    </div>
    </body></html>`
  }

  async function buildSOPdfData(so: SO, soItems: SOItem[]): Promise<SOPdfData> {
    const logoUrl = companyInfo?.logo_url || '/cdsc-logo.jpg'
    let logoDataUrl: string | undefined
    try {
      const blob = await fetch(logoUrl).then(r => r.blob())
      logoDataUrl = await new Promise<string>(res => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(blob) })
    } catch { /* skip */ }
    const fmtDate = (d: string | null) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : ''
    const subtotalAmt = soItems.reduce((s, it) => s + (it.total_amount ?? 0), 0)
    return {
      companyName: companyInfo?.company_name ?? 'CDSC Industrial Supply',
      companyAddress: companyInfo?.address,
      companyPhone: companyInfo?.phone,
      companyEmail: companyInfo?.email,
      companyTin: companyInfo?.tin,
      logoDataUrl,
      soNumber: so.so_number ?? '—',
      soDate: fmtDate(so.so_date) || new Date(so.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
      clientName: so.client_name ?? '',
      clientPoNumber: so.client_po_number ?? undefined,
      remarks: so.remarks ?? undefined,
      items: soItems.map(it => ({
        item_name: it.item_name,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        selling_price: it.selling_price,
        total_amount: it.total_amount,
      })),
      subtotal: subtotalAmt,
      totalAmount: subtotalAmt,
    }
  }

  async function openViewSO(so: SO) {
    const [{ data: soItemsData }, { data: sdData }, { data: drLogData }] = await Promise.all([
      supabase.from('so_items').select('*').eq('so_id', so.id),
      so.so_number
        ? supabase.from('sales_deliveries').select('delivery_number,delivery_date,dr_number,status,client_name').eq('so_number', so.so_number).order('delivery_date', { ascending: false })
        : Promise.resolve({ data: [] }),
      so.so_number
        ? supabase.from('dr_logs').select('dr_number,dr_date,status,supplier_name,client_accepted_at,client_accepted_by').eq('po_number', so.so_number).order('dr_date', { ascending: false })
        : Promise.resolve({ data: [] }),
    ])
    setViewSOItems((soItemsData ?? []) as SOItem[])

    // Merge dr_logs + sales_deliveries (dr_logs is source of truth)
    const seenDRs = new Set<string>()
    const mergedDRs: { dr_number: string; dr_date: string; status: string; client_name: string | null; client_accepted_at: string | null; client_accepted_by: string | null; source: 'dr_logs' | 'sales_deliveries' }[] = []
    for (const d of (drLogData ?? [])) {
      if (d.dr_number) seenDRs.add(d.dr_number)
      mergedDRs.push({ dr_number: d.dr_number, dr_date: d.dr_date, status: d.status, client_name: (d as any).supplier_name ?? null, client_accepted_at: (d as any).client_accepted_at ?? null, client_accepted_by: (d as any).client_accepted_by ?? null, source: 'dr_logs' })
    }
    for (const d of (sdData ?? [])) {
      if (d.dr_number && seenDRs.has(d.dr_number)) continue
      mergedDRs.push({ dr_number: d.dr_number ?? d.delivery_number, dr_date: d.delivery_date, status: d.status, client_name: d.client_name, client_accepted_at: null, client_accepted_by: null, source: 'sales_deliveries' })
    }

    const deliveryNums = (sdData ?? []).map((d: any) => d.delivery_number).filter(Boolean)
    const drNums = mergedDRs.map(d => d.dr_number).filter(Boolean)
    let deliveries: typeof viewSODeliveries = []
    if (drNums.length > 0) {
      const [{ data: sdItemsData }, { data: drItemsData }] = await Promise.all([
        deliveryNums.length > 0 ? supabase.from('sales_delivery_items').select('*').in('delivery_number', deliveryNums) : Promise.resolve({ data: [] }),
        supabase.from('dr_log_items').select('*').in('dr_number', drNums),
      ])
      deliveries = mergedDRs.map((d) => {
        const items = d.source === 'dr_logs'
          ? (drItemsData ?? []).filter((i: any) => i.dr_number === d.dr_number).map((i: any) => ({ item_name: i.item_name, unit: i.unit ?? '', quantity: Number(i.quantity) }))
          : (sdItemsData ?? []).filter((i: any) => i.delivery_number === d.dr_number).map((i: any) => ({ item_name: i.item_name, unit: i.unit ?? '', quantity: Number(i.quantity) }))
        return { dr_number: d.dr_number, dr_date: d.dr_date, status: d.status, client_name: d.client_name, client_accepted_at: d.client_accepted_at, client_accepted_by: d.client_accepted_by, items }
      })
    }
    setViewSODeliveries(deliveries)
    setViewSO(so)
    setLinkDRSelected('')
    setLinkCSISelected('')

    // Load DRs that can be linked — matching client, no PO or PO is this SO
    if (so.client_name && so.so_number) {
      const [{ data: linkableDRs }, { data: linkedCSIData }, { data: linkableCSIData }] = await Promise.all([
        supabase.from('dr_logs')
          .select('dr_number,dr_date,status,supplier_name')
          .eq('supplier_name', so.client_name)
          .or('po_number.is.null,po_number.eq.')
          .order('dr_date', { ascending: false })
          .limit(50),
        supabase.from('csi_records')
          .select('si_number,si_date,item_name,unit,quantity,unit_price,amount')
          .eq('po_number', so.so_number)
          .order('si_date', { ascending: false }),
        supabase.from('csi_records')
          .select('si_number,si_date,amount')
          .eq('client_name', so.client_name)
          .or('po_number.is.null,po_number.eq.')
          .order('si_date', { ascending: false })
          .limit(100),
      ])
      setLinkDROptions((linkableDRs ?? []).filter((d: any) => !mergedDRs.some(m => m.dr_number === d.dr_number)))

      // Group linked CSIs by si_number
      const csiMap: Record<string, { si_number: string; si_date: string; total: number; items: { item_name: string; unit: string | null; quantity: number; unit_price: number }[] }> = {}
      for (const r of (linkedCSIData ?? [])) {
        if (!csiMap[r.si_number]) csiMap[r.si_number] = { si_number: r.si_number, si_date: r.si_date, total: 0, items: [] }
        csiMap[r.si_number].items.push({ item_name: r.item_name, unit: r.unit ?? null, quantity: Number(r.quantity), unit_price: Number(r.unit_price) })
        csiMap[r.si_number].total += Number(r.amount)
      }
      setViewSOCSIs(Object.values(csiMap))

      // Unique linkable CSI si_numbers not already linked
      const linkedSINums = new Set(Object.keys(csiMap))
      const linkableMap: Record<string, { si_number: string; si_date: string; total: number }> = {}
      for (const r of (linkableCSIData ?? [])) {
        if (!linkedSINums.has(r.si_number) && !linkableMap[r.si_number]) {
          linkableMap[r.si_number] = { si_number: r.si_number, si_date: r.si_date, total: Number(r.amount) }
        }
      }
      setLinkCSIOptions(Object.values(linkableMap))
    } else if (so.client_name) {
      const { data: linkableDRs } = await supabase.from('dr_logs')
        .select('dr_number,dr_date,status,supplier_name')
        .eq('supplier_name', so.client_name)
        .or('po_number.is.null,po_number.eq.')
        .order('dr_date', { ascending: false })
        .limit(50)
      setLinkDROptions((linkableDRs ?? []).filter((d: any) => !mergedDRs.some(m => m.dr_number === d.dr_number)))
      setViewSOCSIs([])
      setLinkCSIOptions([])
    }
  }

  async function linkDRToSO() {
    if (!viewSO?.so_number || !linkDRSelected) return
    setLinkDRSaving(true)
    const { error } = await supabase.from('dr_logs').update({ po_number: viewSO.so_number }).eq('dr_number', linkDRSelected)
    if (error) { toast.error(error.message); setLinkDRSaving(false); return }
    toast.success(`DR ${linkDRSelected} linked to SO ${viewSO.so_number}`)
    setLinkDRSaving(false)
    await openViewSO(viewSO)
    load()
  }

  async function unlinkDRFromSO(drNumber: string) {
    if (!viewSO) return
    const { error } = await supabase.from('dr_logs').update({ po_number: null }).eq('dr_number', drNumber)
    if (error) { toast.error(error.message); return }
    toast.success(`DR ${drNumber} unlinked`)
    await openViewSO(viewSO)
    load()
  }

  async function linkCSIToSO() {
    if (!viewSO?.so_number || !linkCSISelected) return
    setLinkCSISaving(true)
    const { error } = await supabase.from('csi_records').update({ po_number: viewSO.so_number }).eq('si_number', linkCSISelected)
    if (error) { toast.error(error.message); setLinkCSISaving(false); return }
    toast.success(`SI ${linkCSISelected} linked to SO ${viewSO.so_number}`)
    setLinkCSISaving(false)
    await openViewSO(viewSO)
  }

  async function unlinkCSIFromSO(siNumber: string) {
    if (!viewSO) return
    const { error } = await supabase.from('csi_records').update({ po_number: null }).eq('si_number', siNumber)
    if (error) { toast.error(error.message); return }
    toast.success(`SI ${siNumber} unlinked`)
    await openViewSO(viewSO)
  }

  async function openEmailSO(so: SO) {
    const [{ data }, { data: clientRow }] = await Promise.all([
      supabase.from('so_items').select('*').eq('so_id', so.id),
      so.client_name
        ? supabase.from('clients').select('email').eq('company_name', so.client_name).single()
        : Promise.resolve({ data: null }),
    ])
    setEmailSOItems((data ?? []) as SOItem[])
    setEmailToSO((clientRow as any)?.email ?? '')
    setEmailSubjectSO(`Sales Order ${so.so_number ?? ''} — ${companyInfo?.company_name ?? 'CDSC Industrial Supply'}`)
    setEmailBodySO(`Dear ${so.client_name ?? 'Client'},\n\nPlease find attached Sales Order ${so.so_number ?? ''}.\n\nKindly confirm receipt and advise on any concerns.\n\nBest regards,\n${companyInfo?.company_name ?? 'CDSC Industrial Supply'}`)
    setEmailSO(so)
  }

  async function handleSendEmailSO() {
    if (!emailSO) return
    if (!emailToSO.trim()) { toast.error('Recipient email required'); return }
    setSendingEmailSO(true)
    try {
      const pdfData = await buildSOPdfData(emailSO, emailSOItems)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
      const confirmUrl = `${appUrl}/api/confirm/so/${emailSO.id}`
      const htmlBody = `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
${emailBodySO.replace(/\n/g, '<br/>')}
<br/><br/>
<div style="text-align:center;margin:24px 0">
  <a href="${confirmUrl}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 32px;border-radius:8px">Confirm Order</a>
</div>
<p style="color:#6b7280;font-size:12px;text-align:center">Clicking the button above confirms your acceptance of this Sales Order.</p>
</div>`
      await sendEmail({
        to: emailToSO.trim(),
        subject: emailSubjectSO,
        body: emailBodySO,
        htmlBody,
        soPdfData: pdfData,
        pdfFilename: `SO-${emailSO.so_number ?? emailSO.id}.pdf`,
      })
      toast.success('Email sent successfully')
      setEmailSO(null)
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to send email')
    } finally {
      setSendingEmailSO(false)
    }
  }

  function handlePrint() {
    if (open) {
      // Print form preview
      const el = printRef.current
      if (!el) return
      const win = window.open('', '_blank', 'width=900,height=700')
      if (!win) return
      // Build a temporary fake SO from form state
      const fakeSO: SO = {
        id: '', so_number: soNumber || null, so_date: soDate, created_at: new Date().toISOString(),
        client_name: selectedClient?.company_name ?? null, client_po_number: clientPONumber || null,
        status: 'draft', total_amount: subtotal, remarks: remarks || null, show_in_portal: false,
      }
      const fakeItems: SOItem[] = lines.filter(l => l.item_name).map((l, i) => ({
        id: String(i), item_name: l.item_name, quantity: parseFloat(l.quantity) || 1,
        unit: l.unit || null, unit_price: parseFloat(l.unit_price) || 0,
        selling_price: parseFloat(l.selling_price) || null,
        total_amount: (parseFloat(l.selling_price) || parseFloat(l.unit_price) || 0) * (parseFloat(l.quantity) || 0),
      }))
      const html = buildSOHtml(fakeSO, fakeItems)
      win.document.write(html)
      win.document.close()
      setTimeout(() => { win.focus(); win.print(); win.close() }, 800)
    }
  }

  const { query } = useSearchContext()
  const displayedSOs = query.trim()
    ? sos.filter(s => {
        const q = query.toLowerCase()
        return (s.so_number ?? '').toLowerCase().includes(q) ||
          (s.client_name ?? '').toLowerCase().includes(q) ||
          (s.client_po_number ?? '').toLowerCase().includes(q) ||
          (s.status ?? '').toLowerCase().includes(q)
      })
    : sos

  const counts = {
    draft:     sos.filter(s => s.status === 'draft').length,
    active:    sos.filter(s => ['confirmed', 'processing', 'shipped'].includes(s.status)).length,
    delivered: sos.filter(s => s.status === 'delivered').length,
    total:     sos.reduce((s, o) => s + (o.total_amount ?? 0), 0),
  }

  const todayStr = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })

  const soMonthlyData = (() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i)
      const start = startOfMonth(d).toISOString().slice(0, 10)
      const end = endOfMonth(d).toISOString().slice(0, 10)
      const total = sos
        .filter(s => s.status !== 'cancelled' && (s.so_date ?? s.created_at?.slice(0, 10) ?? '') >= start && (s.so_date ?? s.created_at?.slice(0, 10) ?? '') <= end)
        .reduce((sum, s) => sum + (s.total_amount ?? 0), 0)
      return { month: fmtDate(d, 'MMM'), total }
    })
  })()
  const deliveryStr = deliveryDate ? new Date(deliveryDate + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : ''

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sales Orders</h2>
          <p className="text-muted-foreground text-sm">Create and manage client sales orders</p>
        </div>
        {open ? (
          <Button variant="outline" onClick={() => {
            const hasData = clientId || soNumber || lines.some(l => l.item_name)
            if (hasData && !window.confirm('You have unsaved changes. Discard them?')) return
            setOpen(false); resetForm()
          }}>
            <X className="h-4 w-4 mr-2" />Cancel
          </Button>
        ) : (
          <Button onClick={() => { resetForm(); setOpen(true) }} className="bg-red-600 hover:bg-red-700">
            <Plus className="h-4 w-4 mr-2" />New Sales Order
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold">{loading ? '—' : fmt(counts.total)}</div>
          <div className="text-sm text-muted-foreground">Total SO Value</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold text-gray-600">{loading ? '—' : counts.draft}</div>
          <div className="text-sm text-muted-foreground">Drafts</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold text-blue-600">{loading ? '—' : counts.active}</div>
          <div className="text-sm text-muted-foreground">Active Orders</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold text-green-600">{loading ? '—' : counts.delivered}</div>
          <div className="text-sm text-muted-foreground">Delivered</div>
        </CardContent></Card>
      </div>

      {/* Monthly Sales Chart */}
      {!open && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Monthly Sales Revenue (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            {soMonthlyData.every(m => m.total === 0) ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-xs">No sales data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={soMonthlyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => [`₱${(v ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, 'Revenue']} />
                  <Bar dataKey="total" name="Revenue" fill="#dc2626" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Inline New SO Form ── */}
      {open && (
        <>
          {/* Mobile tab toggle */}
          <div className="flex lg:hidden gap-2 border-b pb-3">
            <Button size="sm" variant={mobileTab === 'form' ? 'default' : 'outline'} className={mobileTab === 'form' ? 'bg-red-600 hover:bg-red-700' : ''} onClick={() => setMobileTab('form')}>Form</Button>
            <Button size="sm" variant={mobileTab === 'preview' ? 'default' : 'outline'} className={mobileTab === 'preview' ? 'bg-red-600 hover:bg-red-700' : ''} onClick={() => setMobileTab('preview')}>Preview</Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: Form */}
            <div className={mobileTab === 'preview' ? 'hidden lg:block' : 'block'}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />{editingSOId ? 'Edit Sales Order' : 'Sales Order Details'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>SO Number</Label>
                      <Input placeholder="Auto-generated" value={soNumber} onChange={e => setSoNumber(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>SO Date</Label>
                      <Input type="date" value={soDate} onChange={e => setSoDate(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Client <span className="text-destructive">*</span></Label>
                    <div className="flex gap-1">
                      <Select value={clientId} onValueChange={v => setClientId(v ?? '')}>
                        <SelectTrigger className="flex-1">
                          {clientId
                            ? <span className="truncate text-sm">{selectedClient?.company_name}</span>
                            : <span className="text-muted-foreground text-sm">Select client…</span>}
                        </SelectTrigger>
                        <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
                      </Select>
                      {clientId && (
                        <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setClientId('')}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Client PO Number</Label>
                      <Input placeholder="e.g. PO-2024-0001" value={clientPONumber} onChange={e => setClientPONumber(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Delivery Date</Label>
                      <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
                    </div>
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
                            <TableHead className="w-20">Unit</TableHead>
                            <TableHead className="w-28">Unit Price</TableHead>
                            <TableHead className="w-28">Selling Price</TableHead>
                            <TableHead className="w-24 text-right">Amount</TableHead>
                            <TableHead className="w-8"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lines.map((line, i) => {
                            const lineTotal = (parseFloat(line.selling_price) || parseFloat(line.unit_price) || 0) * (parseFloat(line.quantity) || 0)
                            return (
                              <TableRow key={i}>
                                <TableCell className="py-1.5">
                                  <div className="flex gap-1 min-w-0">
                                    <Select value={line.item_name} onValueChange={val => {
                                      const selected = items.find(it => it.item_name === val)
                                      setLines(p => p.map((l, idx) => idx === i ? {
                                        ...l, item_name: val ?? '',
                                        unit: selected?.unit_of_measure || l.unit,
                                        unit_price: selected?.cost !== null && selected?.cost !== undefined ? String(selected.cost) : l.unit_price,
                                        selling_price: selected?.selling_price !== null && selected?.selling_price !== undefined ? String(selected.selling_price) : l.selling_price,
                                        quantity: l.quantity || '1',
                                      } : l))
                                    }}>
                                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Select item…" /></SelectTrigger>
                                      <SelectContent>{items.map(it => <SelectItem key={it.item_code} value={it.item_name}>{it.item_name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" title="Search inventory"
                                      onClick={() => { setItemSearchIdx(i); setItemQuery('') }}>
                                      <Package className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <Input type="number" min={1} className="h-8 text-xs w-full min-w-[64px]" placeholder="1" value={line.quantity}
                                    onChange={e => setLines(p => p.map((l, idx) => idx === i ? { ...l, quantity: e.target.value } : l))} />
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <div className="h-8 flex items-center px-2 text-xs bg-muted/40 rounded border text-muted-foreground">{line.unit || '—'}</div>
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <Input type="number" min={0} step="0.01" className="h-8 text-xs w-full" placeholder="0.00" value={line.unit_price}
                                    onChange={e => setLines(p => p.map((l, idx) => idx === i ? { ...l, unit_price: e.target.value } : l))} />
                                </TableCell>
                                <TableCell className="py-1.5">
                                  <Input type="number" min={0} step="0.01" className="h-8 text-xs w-full" placeholder="0.00" value={line.selling_price}
                                    onChange={e => setLines(p => p.map((l, idx) => idx === i ? { ...l, selling_price: e.target.value } : l))} />
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

                  {/* Remarks */}
                  <div className="space-y-1.5">
                    <Label>Remarks</Label>
                    <textarea
                      className="w-full min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                      placeholder="Optional notes…"
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                    />
                  </div>

                  {/* Totals */}
                  <div className="rounded-lg bg-muted/30 p-4 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Cost Total</span><span>{fmt(costTotal)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Selling Total</span><span>{fmt(subtotal)}</span></div>
                    <div className="h-px bg-border my-1" />
                    <div className="flex justify-between font-bold"><span>Total</span><span className="text-red-600">{fmt(subtotal)}</span></div>
                    <div className="h-px bg-border my-1" />
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Estimated Profit</span>
                      <span className={estimatedProfit >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{fmt(estimatedProfit)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Profit Margin</span>
                      <span className={profitMarginPct >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{profitMarginPct.toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => {
                      const hasData = clientId || soNumber || lines.some(l => l.item_name)
                      if (hasData && !window.confirm('You have unsaved changes. Discard them?')) return
                      setOpen(false); resetForm()
                    }}>Cancel</Button>
                    <Button type="button" variant="outline" className="gap-1.5" onClick={handlePrint}>
                      <Printer className="h-4 w-4" />Print
                    </Button>
                    <Button onClick={submitSO} disabled={saving} className="bg-red-600 hover:bg-red-700">
                      {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{editingSOId ? 'Updating…' : 'Creating…'}</> : editingSOId ? 'Update Sales Order' : 'Create Sales Order'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* RIGHT: Live Preview */}
            <div className={mobileTab === 'form' ? 'hidden lg:block' : 'block'}>
              <div className="sticky top-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live Preview</p>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handlePrint}>
                    <Printer className="h-3.5 w-3.5" />Print
                  </Button>
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

                  {/* Party row */}
                  <div className="grid grid-cols-3 gap-3 border-b pb-3">
                    <div className="space-y-0.5">
                      <div className="text-[9px] font-semibold uppercase text-gray-400">Bill To</div>
                      <div className="font-semibold text-gray-800 text-[11px]">
                        {selectedClient?.company_name ?? <span className="text-gray-400 italic font-normal">Not selected</span>}
                      </div>
                      {clientPONumber && (
                        <div className="mt-1.5">
                          <div className="text-[9px] font-semibold uppercase text-gray-400">Client PO #</div>
                          <div className="text-gray-700">{clientPONumber}</div>
                        </div>
                      )}
                      {remarks && (
                        <div className="mt-1.5">
                          <div className="text-[9px] font-semibold uppercase text-gray-400">Remarks</div>
                          <div className="text-gray-700 text-[10px]">{remarks}</div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-center">
                      <div className="text-[16px] font-extrabold text-red-700 uppercase tracking-widest text-center leading-tight">
                        Sales<br />Order
                      </div>
                    </div>
                    <div className="space-y-0.5 text-right">
                      <div className="text-[9px] font-semibold uppercase text-gray-400">SO Number</div>
                      <div className="font-mono font-bold text-gray-800">{soNumber || 'Auto-generated'}</div>
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

                  {/* Items */}
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
                        const sp = parseFloat(line.selling_price) || parseFloat(line.unit_price) || 0
                        const total = sp * (parseFloat(line.quantity) || 0)
                        return (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-1.5 py-1 text-gray-400">{i + 1}</td>
                            <td className="px-1.5 py-1">{line.item_name || <span className="text-gray-300 italic">—</span>}</td>
                            <td className="px-1.5 py-1 text-right">{line.quantity || '—'}</td>
                            <td className="px-1.5 py-1 text-gray-500">{line.unit || '—'}</td>
                            <td className="px-1.5 py-1 text-right">₱{sp.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                            <td className="px-1.5 py-1 text-right font-medium">₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {/* Totals */}
                  <div className="flex justify-end">
                    <div className="w-52 space-y-0.5 text-[10px]">
                      <div className="flex justify-between border-t pt-0.5 font-bold text-[11px]"><span>Total</span><span className="text-red-700">₱{subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
                    </div>
                  </div>

                  {/* Signatures */}
                  <div className="grid grid-cols-2 gap-6 border-t pt-4 mt-1">
                    <div className="text-center">
                      <div className="border-b border-gray-400 mb-1 h-8" />
                      <div className="text-[9px] text-gray-400 uppercase tracking-wider">Authorized By</div>
                    </div>
                    <div className="text-center">
                      <div className="border-b border-gray-400 mb-1 h-8" />
                      <div className="text-[9px] text-gray-400 uppercase tracking-wider">Received By</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* SO Pipeline */}
      {!open && (
        <Card>
          <CardHeader className="pb-0 pt-4 px-4">
            <button className="flex items-center justify-between w-full text-left" onClick={() => setPipelineOpen(o => !o)}>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Sales Order Pipeline — Next Actions
              </CardTitle>
              {pipelineOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CardHeader>
          {pipelineOpen && (
            <CardContent className="p-0 mt-3">
              <div className="grid grid-cols-4 text-center text-[10px] font-semibold uppercase tracking-wider border-b border-t">
                {[
                  { label: 'SO Created',  color: 'text-blue-600 bg-blue-50' },
                  { label: 'Confirmed',   color: 'text-indigo-600 bg-indigo-50' },
                  { label: 'Processing',  color: 'text-yellow-600 bg-yellow-50' },
                  { label: 'Shipped',     color: 'text-orange-600 bg-orange-50' },
                ].map(s => (
                  <div key={s.label} className={`py-2 ${s.color}`}>{s.label}</div>
                ))}
              </div>
              {loading ? (
                <div className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" /></div>
              ) : sos.filter(s => !['cancelled', 'delivered'].includes(s.status)).length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">No active sales orders</div>
              ) : (
                <div className="divide-y max-h-64 overflow-y-auto">
                  {sos.filter(s => !['cancelled', 'delivered'].includes(s.status)).map(so => {
                    const statusOrder = ['draft', 'confirmed', 'processing', 'shipped', 'delivered']
                    const stageIdx = statusOrder.indexOf(so.status)
                    const stages = [
                      { done: true,          label: so.so_number ?? '—',           sub: so.client_name ?? '' },
                      { done: stageIdx >= 1, label: stageIdx >= 1 ? 'Confirmed'  : 'Pending' },
                      { done: stageIdx >= 2, label: stageIdx >= 2 ? 'Processing' : 'Pending' },
                      { done: stageIdx >= 3, label: stageIdx >= 3 ? 'Shipped'    : 'Pending' },
                    ]
                    return (
                      <div key={so.id} className="grid grid-cols-4 text-center text-xs">
                        {stages.map((s, i) => (
                          <div key={i} className={`py-2.5 px-1 border-r last:border-r-0 ${s.done ? '' : 'opacity-40'}`}>
                            <div className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold mx-auto mb-0.5 ${s.done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                              {s.done ? '✓' : (i + 1)}
                            </div>
                            <div className="font-medium truncate px-1">{s.label}</div>
                            {s.sub && <div className="text-[10px] text-muted-foreground truncate px-1">{s.sub}</div>}
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

      {/* Sales Order List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sales Order List</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SO Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Client PO #</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead>Portal</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell></TableRow>
              ) : displayedSOs.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  No sales orders match your search.
                </TableCell></TableRow>
              ) : displayedSOs.map(so => {
                const sCfg = STATUS_CFG[so.status] ?? STATUS_CFG.draft
                return (
                  <TableRow key={so.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openViewSO(so)}>
                    <TableCell className="font-mono text-xs font-semibold text-red-600">{so.so_number ?? '—'}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {(so.so_date ?? so.created_at) ? format(new Date(so.so_date ?? so.created_at), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{so.client_name ?? '—'}</TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground">{so.client_po_number ?? '—'}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(so.total_amount ?? 0)}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sCfg.cls}`}>{sCfg.label}</span>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const dm = so.so_number ? soDeliveryMap[so.so_number] : null
                        if (!dm || dm.total === 0) return <span className="text-xs text-muted-foreground">No DR</span>
                        const incomplete = dm.pending + dm.partial
                        if (incomplete === 0) return <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">{dm.total} DR{dm.total !== 1 ? 's' : ''} — Done</span>
                        return (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">
                            {incomplete} Pending{dm.partial > 0 ? ` / ${dm.partial} Partial` : ''}
                          </span>
                        )
                      })()}
                    </TableCell>
                    <TableCell>
                      {so.show_in_portal
                        ? <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700"><Globe className="h-3 w-3" />Visible</span>
                        : <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500"><EyeOff className="h-3 w-3" />Hidden</span>
                      }
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem onClick={() => openViewSO(so)}>
                            <Eye className="mr-2 h-4 w-4" />View SO
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditSO(so)}>
                            <FileText className="mr-2 h-4 w-4" />Edit SO
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={async () => {
                            const { data } = await supabase.from('so_items').select('*').eq('so_id', so.id)
                            const items = (data ?? []) as SOItem[]
                            const fakeSO = so
                            const html = buildSOHtml(fakeSO, items)
                            const win = window.open('', '_blank', 'width=900,height=700')
                            if (!win) return
                            win.document.write(html); win.document.close()
                            setTimeout(() => { win.focus(); win.print(); win.close() }, 800)
                          }}>
                            <Printer className="mr-2 h-4 w-4" />Print SO
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEmailSO(so)}>
                            <Mail className="mr-2 h-4 w-4" />Send Email
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {so.status === 'draft' && (
                            <DropdownMenuItem onClick={() => updateStatus(so.id, 'confirmed')} className="text-blue-600">
                              <CheckCircle2 className="mr-2 h-4 w-4" />Confirm Order
                            </DropdownMenuItem>
                          )}
                          {so.status === 'confirmed' && (
                            <DropdownMenuItem onClick={() => updateStatus(so.id, 'processing')} className="text-yellow-600">
                              <CheckCircle2 className="mr-2 h-4 w-4" />Mark Processing
                            </DropdownMenuItem>
                          )}
                          {(so.status === 'processing' || so.status === 'shipped') && (
                            <DropdownMenuItem onClick={() => updateStatus(so.id, 'delivered')} className="text-green-600">
                              <CheckCircle2 className="mr-2 h-4 w-4" />Mark Delivered
                            </DropdownMenuItem>
                          )}
                          {!['delivered', 'cancelled'].includes(so.status) && (
                            <DropdownMenuItem onClick={() => updateStatus(so.id, 'cancelled')} className="text-destructive">
                              <XCircle className="mr-2 h-4 w-4" />Cancel
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => togglePortalVisibility(so)} className={so.show_in_portal ? 'text-orange-600' : 'text-green-600'}>
                            {so.show_in_portal
                              ? <><EyeOff className="mr-2 h-4 w-4" />Do not Show in Client Portal</>
                              : <><Globe className="mr-2 h-4 w-4" />Show in Client Portal</>
                            }
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => deleteSO(so.id)} className="text-destructive">
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

      {/* View SO Dialog */}
      <Dialog open={!!viewSO} onOpenChange={o => { if (!o) { setViewSO(null); setViewSODeliveries([]); setViewSOCSIs([]) } }}>
        <DialogContent className="w-[98vw] sm:!max-w-3xl max-h-[90vh] flex flex-col overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
            <DialogTitle className="flex items-center gap-2"><Eye className="h-4 w-4" />Sales Order — {viewSO?.so_number ?? '—'}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 px-6 pb-6">
            {viewSO && (
              <iframe
                srcDoc={buildSOHtml(viewSO, viewSOItems)}
                style={{ width: '100%', minHeight: '480px', border: 'none' }}
              />
            )}
            {/* Pending / Incomplete Deliveries */}
            {(() => {
              const pending = viewSODeliveries.filter(d => d.status !== 'delivered' && d.status !== 'received')
              if (pending.length === 0) return null
              return (
                <div className="border border-orange-200 rounded-lg overflow-hidden bg-orange-50">
                  <div className="bg-orange-100 px-4 py-2 flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-orange-700">⚠ Pending / Incomplete Deliveries</span>
                    <span className="ml-auto text-xs text-orange-600">{pending.length} DR{pending.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="divide-y divide-orange-100 text-xs">
                    {pending.map(d => {
                      const statusCls = d.status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700'
                      return (
                        <div key={d.dr_number} className="px-4 py-2.5 space-y-1.5">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-semibold text-red-600">{d.dr_number}</span>
                            <span className="text-muted-foreground">{d.dr_date ? new Date(d.dr_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                            <span className={`px-2 py-0.5 rounded-full font-medium capitalize ${statusCls}`}>{d.status}</span>
                          </div>
                          {d.items.length > 0 && (
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                              {d.items.map((it, i) => (
                                <span key={i}>{it.item_name} × {it.quantity} {it.unit}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Delivery History */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/40 px-4 py-2 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">All Deliveries</span>
                <span className="ml-auto text-xs text-muted-foreground">{viewSODeliveries.length} DR{viewSODeliveries.length !== 1 ? 's' : ''}</span>
              </div>
              {viewSODeliveries.length === 0 ? (
                <p className="px-4 py-3 text-xs text-muted-foreground italic">No deliveries recorded for this SO yet.</p>
              ) : (
                <div className="divide-y text-xs">
                  {viewSODeliveries.map(d => {
                    const isDone = d.status === 'delivered' || d.status === 'received'
                    const statusCls = isDone ? 'bg-green-100 text-green-700' : d.status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700'
                    const statusLabel = d.status === 'received' ? 'Delivered' : d.status === 'partial' ? 'Partial' : d.status === 'pending' ? 'Pending' : d.status
                    return (
                      <div key={d.dr_number} className="px-4 py-2.5 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-semibold text-red-600">{d.dr_number}</span>
                          <span className="text-muted-foreground text-xs">{d.dr_date ? new Date(d.dr_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                          <span className={`px-2 py-0.5 rounded-full font-medium text-xs capitalize ${statusCls}`}>{statusLabel}</span>
                          {isDone && !d.client_accepted_at && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">Awaiting Client Acceptance</span>
                          )}
                          {isDone && d.client_accepted_at && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                              ✓ Accepted by {d.client_accepted_by} · {new Date(d.client_accepted_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                          <button onClick={() => unlinkDRFromSO(d.dr_number)} className="ml-auto text-[10px] text-red-400 hover:text-red-600 px-1.5 py-0.5 rounded hover:bg-red-50">Unlink</button>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground text-xs">
                          {d.items.map((it, i) => (
                            <span key={i}>{it.item_name} × {it.quantity} {it.unit}</span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Link DR to SO */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/40 px-4 py-2.5 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Link a DR to this SO</span>
              </div>
              <div className="px-4 py-3 flex gap-2 items-center">
                <Select value={linkDRSelected} onValueChange={(v) => setLinkDRSelected(v ?? '')}>
                  <SelectTrigger className="flex-1 text-xs h-8">
                    <SelectValue placeholder={linkDROptions.length === 0 ? 'No unlinked DRs for this client' : 'Select DR to link…'} />
                  </SelectTrigger>
                  <SelectContent className="min-w-[320px]">
                    {linkDROptions.map(dr => (
                      <SelectItem key={dr.dr_number} value={dr.dr_number ?? ''} className="text-xs">
                        <span className="font-mono text-red-600">{dr.dr_number}</span>
                        <span className="ml-2 text-muted-foreground">{dr.dr_date ? new Date(dr.dr_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span>
                        <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize ${dr.status === 'received' ? 'bg-green-100 text-green-700' : dr.status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700'}`}>{dr.status}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" className="h-8 text-xs shrink-0" disabled={!linkDRSelected || linkDRSaving} onClick={linkDRToSO}>
                  {linkDRSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Link DR'}
                </Button>
              </div>
            </div>

            {/* Linked CSIs */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/40 px-4 py-2 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sales Invoices (CSI)</span>
                <span className="ml-auto text-xs text-muted-foreground">{viewSOCSIs.length} SI{viewSOCSIs.length !== 1 ? 's' : ''}</span>
              </div>
              {viewSOCSIs.length === 0 ? (
                <p className="px-4 py-3 text-xs text-muted-foreground italic">No invoices linked to this SO yet.</p>
              ) : (
                <div className="divide-y text-xs">
                  {viewSOCSIs.map(si => (
                    <div key={si.si_number} className="px-4 py-2.5 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold text-blue-600">{si.si_number}</span>
                        <span className="text-muted-foreground">{si.si_date ? new Date(si.si_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                        <span className="px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-100">
                          ₱{si.total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </span>
                        <button onClick={() => unlinkCSIFromSO(si.si_number)} className="ml-auto text-[10px] text-red-400 hover:text-red-600 px-1.5 py-0.5 rounded hover:bg-red-50">Unlink</button>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                        {si.items.map((it, i) => (
                          <span key={i}>{it.item_name} × {it.quantity} {it.unit ?? ''}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Link CSI to SO */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/40 px-4 py-2.5 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Link a CSI to this SO</span>
              </div>
              <div className="px-4 py-3 flex gap-2 items-center">
                <Select value={linkCSISelected} onValueChange={(v) => setLinkCSISelected(v ?? '')}>
                  <SelectTrigger className="flex-1 text-xs h-8">
                    <SelectValue placeholder={linkCSIOptions.length === 0 ? 'No unlinked CSIs for this client' : 'Select SI to link…'} />
                  </SelectTrigger>
                  <SelectContent className="min-w-[320px]">
                    {linkCSIOptions.map(si => (
                      <SelectItem key={si.si_number} value={si.si_number} className="text-xs">
                        <span className="font-mono text-blue-600">{si.si_number}</span>
                        <span className="ml-2 text-muted-foreground">{si.si_date ? new Date(si.si_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" className="h-8 text-xs shrink-0" disabled={!linkCSISelected || linkCSISaving} onClick={linkCSIToSO}>
                  {linkCSISaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Link CSI'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email SO Dialog */}
      <Dialog open={!!emailSO} onOpenChange={o => { if (!o && !sendingEmailSO) setEmailSO(null) }}>
        <DialogContent className="sm:!max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="h-4 w-4" />Send Sales Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>Recipient Email <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                placeholder="client@example.com"
                value={emailToSO}
                onChange={e => setEmailToSO(e.target.value)}
                disabled={sendingEmailSO}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input
                placeholder="Email subject"
                value={emailSubjectSO}
                onChange={e => setEmailSubjectSO(e.target.value)}
                disabled={sendingEmailSO}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Message Body</Label>
              <textarea
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                placeholder="Email message…"
                value={emailBodySO}
                onChange={e => setEmailBodySO(e.target.value)}
                disabled={sendingEmailSO}
              />
            </div>
            <p className="text-xs text-muted-foreground">PDF attachment: <span className="font-mono">SO-{emailSO?.so_number ?? '—'}.pdf</span></p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setEmailSO(null)} disabled={sendingEmailSO}>Cancel</Button>
              <Button onClick={handleSendEmailSO} disabled={sendingEmailSO} className="bg-red-600 hover:bg-red-700">
                {sendingEmailSO ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending…</> : <><Mail className="h-4 w-4 mr-2" />Send Email</>}
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
            <table className="w-full text-sm min-w-[500px]">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-[45%]">Item Name</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground w-[10%]">Unit</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground w-[20%]">Cost</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground w-[25%]">Selling Price</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredSearchItems.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-sm">No items found.</td></tr>
                ) : filteredSearchItems.map(it => (
                  <tr key={it.item_name} className="hover:bg-muted/40 cursor-pointer" onClick={() => {
                    if (itemSearchIdx === null) return
                    setLines(p => p.map((l, i) => i === itemSearchIdx ? {
                      ...l,
                      item_name: it.item_name,
                      unit: it.unit_of_measure || l.unit,
                      unit_price: it.cost !== null && it.cost !== undefined ? String(it.cost) : l.unit_price,
                      selling_price: it.selling_price !== null && it.selling_price !== undefined ? String(it.selling_price) : l.selling_price,
                      quantity: l.quantity || '1',
                    } : l))
                    setItemSearchIdx(null)
                  }}>
                    <td className="px-3 py-2 font-medium">{it.item_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{it.unit_of_measure || '—'}</td>
                    <td className="px-3 py-2 text-right">{it.cost != null ? `₱${it.cost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}</td>
                    <td className="px-3 py-2 text-right font-medium text-green-700">{it.selling_price != null ? `₱${it.selling_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}</td>
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
