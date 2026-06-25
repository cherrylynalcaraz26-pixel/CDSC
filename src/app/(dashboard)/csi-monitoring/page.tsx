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
import { Plus, X, Search, MoreHorizontal, Loader2, FileText, LayoutGrid, List, ChevronDown, ChevronRight, Package, Trash2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { useSearchContext } from '@/context/search-context'

interface ItemOption { item_name: string; unit_of_measure: string }
interface ClientOption { id: string; company_name: string }
interface SOItemOption { item_name: string; unit: string; quantity: number }

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
  const [soItemsMap, setSoItemsMap] = useState<Record<string, SOItemOption[]>>({})
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editingSiNumber, setEditingSiNumber] = useState<string | null>(null)
  const [siFilter, setSiFilter] = useState('')
  const [header, setHeader] = useState(emptyHeader())
  const [items, setItems] = useState<CSIItem[]>([emptyItem()])
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'by-si' | 'all-items'>('by-si')
  const [expandedSIs, setExpandedSIs] = useState<Set<string>>(new Set())
  const [inventoryItem, setInventoryItem] = useState<string>('')
  const [inventoryOpen, setInventoryOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form')
  const [companyInfo, setCompanyInfo] = useState<{ company_name: string; address: string; phone: string; email: string; tin: string } | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  async function load() {
    setLoading(true)
    const [{ data: itemOptData }, { data: clientData }, { data: soData }] = await Promise.all([
      supabase.from('items').select('item_name, unit_of_measure').order('item_name'),
      supabase.from('clients').select('id, company_name').eq('status', 'active').order('company_name'),
      supabase.from('sales_orders').select('id, so_number').not('so_number', 'is', null).order('created_at', { ascending: false }),
    ])
    setItemOptions((itemOptData ?? []) as ItemOption[])
    setClientOptions((clientData ?? []) as ClientOption[])
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

  async function loadCompanyInfo() {
    const { data } = await supabase.from('system_settings').select('company_name, address, phone, email, tin').single()
    if (data) setCompanyInfo(data)
  }
  useEffect(() => { loadCompanyInfo() }, [])

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

  const filtered = records.filter(r => {
    const q = search.toLowerCase()
    const matchSearch = !q || (
      r.si_number.toLowerCase().includes(q) ||
      (r.client_name ?? '').toLowerCase().includes(q) ||
      r.item_name.toLowerCase().includes(q) ||
      (r.dr_number ?? '').toLowerCase().includes(q)
    )
    const matchSI = !siFilter || r.si_number.toLowerCase().includes(siFilter.toLowerCase())
    return matchSearch && matchSI
  })

  const totalAmount = filtered.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const uniqueSIs = new Set(filtered.map(r => r.si_number)).size

  const siGroups: { si_number: string; date: string; client: string; po: string | null; dr: string | null; items: CSIRecord[]; total: number }[] = []
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

  function openAdd() {
    setEditingSiNumber(null)
    setHeader(emptyHeader())
    setItems([emptyItem()])
    setOpen(true)
  }

  function openEdit(siNumber: string) {
    const siRecords = records.filter(r => r.si_number === siNumber)
    if (siRecords.length === 0) return
    const first = siRecords[0]
    setEditingSiNumber(siNumber)
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
                      <Input placeholder="e.g. 00001" value={header.si_number} onChange={e => setHeader(h => ({ ...h, si_number: e.target.value }))} />
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
                  <div className="grid grid-cols-2 gap-4">
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
                      <Input placeholder="e.g. 00001" value={header.dr_number} onChange={e => setHeader(h => ({ ...h, dr_number: e.target.value }))} />
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
                          <TableHead className="w-8"></TableHead>
                          <TableHead>Item Description</TableHead>
                          <TableHead className="w-16">Unit</TableHead>
                          <TableHead className="w-20">Qty</TableHead>
                          <TableHead className="w-28">Unit Price (₱)</TableHead>
                          <TableHead className="w-24 text-right">Amount</TableHead>
                          <TableHead className="w-8"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, i) => {
                          const amt = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0)
                          return (
                            <TableRow key={i}>
                              <TableCell className="py-1.5">
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-blue-600"
                                  title="View inventory" onClick={() => { setInventoryItem(item.item_name); setInventoryOpen(true) }}>
                                  <Package className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                              <TableCell className="py-1.5">
                                <Select value={item.item_name} onValueChange={val => {
                                  const opt = itemOptions.find(o => o.item_name === (val ?? ''))
                                  setItems(prev => prev.map((it, idx) => idx === i ? { ...it, item_name: val ?? '', unit: opt?.unit_of_measure ?? it.unit } : it))
                                }}>
                                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select item…" /></SelectTrigger>
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
                    <Button type="button" variant="outline" size="sm" onClick={handlePrint} className="h-7 px-2 text-xs gap-1">
                      <Printer className="h-3.5 w-3.5" /> Print
                    </Button>
                  </div>
                  <div ref={printRef} className="border rounded-lg bg-white text-[11px] p-4 shadow-sm space-y-3 font-sans">
                    {/* Header */}
                    <div className="flex justify-between items-start border-b pb-3">
                      <img src="/cdsc-logo.jpg" alt="CDSC" className="h-12 w-12 rounded object-cover" />
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
            {viewMode === 'by-si' ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Date</TableHead>
                    <TableHead>SI Number</TableHead>
                    <TableHead>SO Number</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>DR Number</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
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
                        <TableCell onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent">
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
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
                    <TableHead>Date</TableHead>
                    <TableHead>SI Number</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Item/s</TableHead>
                    <TableHead className="text-right">QTY</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
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
    </div>
  )
}
