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
import { Plus, Search, MoreHorizontal, Loader2, Truck, Trash2, ChevronDown, ChevronRight, LayoutGrid, List, X, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { useSearchContext } from '@/context/search-context'

interface Supplier { id: string; company_name: string }
interface Client { id: string; company_name: string }
interface ItemOption { item_code: string; item_name: string; unit_of_measure: string }

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
  received: { label: 'Received', cls: 'bg-green-100 text-green-700' },
  partial:  { label: 'Partial',  cls: 'bg-yellow-100 text-yellow-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
  returned: { label: 'Returned', cls: 'bg-gray-100 text-gray-600' },
}

export default function DRLogsPage() {
  const supabase = createClient()
  const [logs, setLogs] = useState<DRLog[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [itemOptions, setItemOptions] = useState<ItemOption[]>([])
  const [poNumbers, setPoNumbers] = useState<string[]>([])
  const [poItemsMap, setPoItemsMap] = useState<Record<string, { item_name: string; unit: string; quantity: number }[]>>({})
  const [allItems, setAllItems] = useState<DRItem[]>([])
  const { query: search } = useSearchContext()
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<DRLog | null>(null)
  const [form, setForm] = useState<DRForm>(emptyForm())
  const [items, setItems] = useState<DRItem[]>([emptyItem()])
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'by-dr' | 'all-items'>('by-dr')
  const [drActiveTab, setDrActiveTab] = useState<'form' | 'preview'>('form')
  const [companyInfo, setCompanyInfo] = useState<{ company_name: string; address: string; phone: string; email: string; tin: string } | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

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

  async function load() {
    setLoading(true)
    const [{ data: drData }, { data: supData }, { data: clientData }, { data: itemData }, { data: poData }] = await Promise.all([
      supabase.from('dr_logs').select('*').order('dr_date', { ascending: false }),
      supabase.from('suppliers').select('id, company_name').order('company_name'),
      supabase.from('clients').select('id, company_name').order('company_name'),
      supabase.from('items').select('item_code, item_name, unit_of_measure').eq('status', 'active').order('item_name'),
      supabase.from('purchase_orders').select('po_number').not('po_number', 'is', null).order('created_at', { ascending: false }),
    ])
    setLogs(drData ?? [])
    setSuppliers(supData ?? [])
    setClients(clientData ?? [])
    setItemOptions((itemData ?? []) as ItemOption[])
    setPoNumbers((poData ?? []).map((p: any) => p.po_number).filter(Boolean))

    const { data: poItemsData } = await supabase
      .from('po_items')
      .select('item_name, unit_of_measure, quantity, purchase_orders!inner(po_number)')
      .not('purchase_orders.po_number', 'is', null)
    if (poItemsData) {
      const map: Record<string, { item_name: string; unit: string; quantity: number }[]> = {}
      for (const row of poItemsData as any[]) {
        const poNum = row.purchase_orders?.po_number
        if (!poNum) continue
        if (!map[poNum]) map[poNum] = []
        map[poNum].push({ item_name: row.item_name, unit: row.unit_of_measure, quantity: Number(row.quantity) })
      }
      setPoItemsMap(map)
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

  const filtered = logs.filter(l => {
    const matchSearch =
      l.dr_number.toLowerCase().includes(search.toLowerCase()) ||
      (l.supplier_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (l.po_number ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || l.status === statusFilter
    return matchSearch && matchStatus
  })

  function toggleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  function openAdd() {
    setEditing(null)
    setForm(emptyForm())
    setItems([emptyItem()])
    setDrActiveTab('form')
    setOpen(true)
  }

  async function openEdit(log: DRLog) {
    setEditing(log)
    setForm({
      dr_number: log.dr_number,
      dr_date: log.dr_date,
      supplier_id: log.supplier_id ?? '',
      supplier_name: log.supplier_name ?? '',
      po_number: log.po_number ?? '',
      remarks: log.remarks ?? '',
      status: log.status,
      received_by_name: log.received_by_name ?? '',
    })
    const existing = getItems(log.dr_number)
    setItems(existing.length > 0 ? existing : [emptyItem()])
    setDrActiveTab('form')
    setOpen(true)
  }

  function handleClientChange(clientId: string | null) {
    const client = clients.find(c => c.id === clientId)
    setForm(f => ({ ...f, supplier_id: clientId ?? '', supplier_name: client?.company_name ?? '' }))
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
    const payload = {
      dr_number: drNumber,
      dr_date: form.dr_date,
      supplier_id: form.supplier_id || null,
      supplier_name: form.supplier_name || null,
      po_number: form.po_number || null,
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
        {open ? (
          <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); setForm(emptyForm()); setItems([emptyItem()]) }}>
            <X className="h-4 w-4 mr-2" />Cancel
          </Button>
        ) : (
          <Button onClick={openAdd} className="bg-red-600 hover:bg-red-700">
            <Plus className="h-4 w-4 mr-2" /> New DR Log
          </Button>
        )}
      </div>

      {!open && (<>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total DRs', count: counts.total,    color: 'text-foreground' },
          { label: 'Received',  count: counts.received, color: 'text-green-600' },
          { label: 'Partial',   count: counts.partial,  color: 'text-yellow-600' },
          { label: 'Rejected',  count: counts.rejected, color: 'text-red-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <div className={`text-2xl font-bold ${s.color}`}>{loading ? '—' : s.count}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'all')}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="returned">Returned</SelectItem>
          </SelectContent>
        </Select>
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-4 w-4 text-red-600" /> Delivery Receipt Log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {viewMode === 'by-dr' ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Date</TableHead>
                    <TableHead>DR Number</TableHead>
                    <TableHead>Delivered To</TableHead>
                    <TableHead className="text-right">Total Qty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        No DR logs found. Click <strong>New DR Log</strong> to add one.
                      </TableCell>
                    </TableRow>
                  ) : filtered.map(log => {
                    const sc = STATUS_CFG[log.status] ?? STATUS_CFG.received
                    const isExpanded = expandedId === log.id
                    const logItems = getItems(log.dr_number)
                    const totalQty = getTotalQty(log.dr_number)

                    return (
                      <>
                        <TableRow
                          key={log.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleExpand(log.id)}
                        >
                          <TableCell className="pr-0">
                            {isExpanded
                              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {format(parseISO(log.dr_date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="font-mono text-sm font-semibold text-red-600">{log.dr_number}</TableCell>
                          <TableCell className="text-sm font-medium">{log.supplier_name ?? '—'}</TableCell>
                          <TableCell className="text-right font-medium text-sm">{totalQty}</TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.cls}`}>{sc.label}</span>
                          </TableCell>
                          <TableCell onClick={e => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent">
                                <MoreHorizontal className="h-4 w-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEdit(log)}>Edit</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(log.id)}>Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>

                        {isExpanded && (
                          <TableRow key={`${log.id}-expanded`} className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={7} className="py-3 px-6">
                              <div className="space-y-3">
                                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                                  {log.po_number && <span>PO: <span className="font-mono text-foreground">{log.po_number}</span></span>}
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
                const allItemsFlat = filtered.flatMap(log =>
                  getItems(log.dr_number).map(item => ({ ...item, log }))
                )
                return (
                  <Table>
                    <TableHeader>
                      <TableRow>
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
                          <TableCell colSpan={7} className="text-center py-10">
                            <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ) : allItemsFlat.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                            No item records found.
                          </TableCell>
                        </TableRow>
                      ) : allItemsFlat.map((row, i) => {
                        const sc = STATUS_CFG[row.log.status] ?? STATUS_CFG.received
                        return (
                          <TableRow key={`${row.id ?? i}-flat`}>
                            <TableCell className="font-mono text-sm font-semibold text-red-600">{row.dr_number}</TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              {format(parseISO(row.log.dr_date), 'MMM d, yyyy')}
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
                      <Input placeholder="e.g. DR-2025-00001" value={form.dr_number}
                        onChange={e => setForm(f => ({ ...f, dr_number: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>DR Date <span className="text-destructive">*</span></Label>
                      <Input type="date" value={form.dr_date}
                        onChange={e => setForm(f => ({ ...f, dr_date: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Delivered To</Label>
                    <Select value={form.supplier_id} onValueChange={handleClientChange}>
                      <SelectTrigger><SelectValue placeholder="Select client / delivered to" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">— None —</SelectItem>
                        {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>PO Reference</Label>
                      <Select value={form.po_number} onValueChange={v => setForm(f => ({ ...f, po_number: v ?? '' }))}>
                        <SelectTrigger><SelectValue placeholder="Select PO…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">— None —</SelectItem>
                          {poNumbers.map(po => <SelectItem key={po} value={po}>{po}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {form.po_number && poItemsMap[form.po_number]?.length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full h-7 text-xs mt-1"
                          onClick={() => setItems(poItemsMap[form.po_number].map(i => ({ dr_number: '', item_name: i.item_name, unit: i.unit, quantity: String(i.quantity) })))}
                        >
                          Load from PO
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v ?? 'received' }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="received">Received</SelectItem>
                          <SelectItem value="partial">Partial</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                          <SelectItem value="returned">Returned</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Received By</Label>
                    <Input placeholder="Name of person who received" value={form.received_by_name}
                      onChange={e => setForm(f => ({ ...f, received_by_name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Remarks</Label>
                    <Textarea rows={3} className="resize-y" placeholder="Notes, discrepancies, condition of goods…" value={form.remarks}
                      onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">Delivery Items</p>
                  <div className="space-y-2">
                    <div className="grid grid-cols-[80px_90px_1fr_32px] gap-2 text-xs font-medium text-muted-foreground px-1">
                      <span>Qty</span><span>Unit</span><span>Item Description</span><span />
                    </div>
                    {items.map((item, i) => (
                      <div key={i} className="grid grid-cols-[80px_90px_1fr_32px] gap-2 items-center">
                        <Input
                          type="number" min={0} placeholder="0"
                          value={item.quantity}
                          onChange={e => updateItem(i, 'quantity', e.target.value)}
                          className="h-8 text-sm"
                        />
                        <div className="h-8 flex items-center px-2 text-sm bg-muted/30 rounded border text-muted-foreground truncate">
                          {item.unit || '—'}
                        </div>
                        <Select
                          value={item.item_name}
                          onValueChange={val => {
                            const selected = itemOptions.find(it => it.item_name === val)
                            setItems(prev => prev.map((it, idx) => idx === i
                              ? { ...it, item_name: val ?? '', unit: selected?.unit_of_measure || it.unit }
                              : it))
                          }}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Select item…" />
                          </SelectTrigger>
                          <SelectContent>
                            {itemOptions.map(it => (
                              <SelectItem key={it.item_code} value={it.item_name}>
                                {it.item_name} <span className="text-xs text-muted-foreground ml-1">({it.unit_of_measure})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <button
                          type="button"
                          onClick={() => removeItemRow(i)}
                          className="h-8 w-8 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
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
                    <Button type="button" variant="outline" size="sm" onClick={handlePrint} className="h-7 px-2 text-xs gap-1">
                      <Printer className="h-3.5 w-3.5" /> Print
                    </Button>
                  </div>
                  <div ref={printRef} className="border rounded-lg bg-white text-[11px] p-4 shadow-sm space-y-3 font-sans">
                    {/* Header: logo LEFT | company name + address RIGHT */}
                    <div className="flex justify-between items-start border-b pb-3">
                      <div>
                        <img src="/cdsc-logo.jpg" alt="CDSC" className="h-12 w-12 rounded object-cover" />
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
                          <div className="text-[9px] font-semibold uppercase text-gray-400 mt-1.5 mb-0.5">PO Reference</div>
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
                        <div className="text-gray-800">{form.dr_date ? new Date(form.dr_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</div>
                      </div>
                    </div>

                    {/* Items table */}
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-red-700 text-white">
                          <th className="text-left px-1.5 py-1">#</th>
                          <th className="text-right px-1.5 py-1">Qty</th>
                          <th className="text-left px-1.5 py-1">Unit</th>
                          <th className="text-left px-1.5 py-1">Item Description</th>
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
                              <td className="px-1.5 py-1 text-right font-medium">{Number(item.quantity) || '—'}</td>
                              <td className="px-1.5 py-1 text-gray-500">{item.unit || '—'}</td>
                              <td className="px-1.5 py-1">{item.item_name}</td>
                            </tr>
                          ) : null
                        ))}
                      </tbody>
                    </table>

                    {/* Footer info */}
                    <div className="grid grid-cols-2 gap-3 text-[10px]">
                      {form.received_by_name && (
                        <div>
                          <span className="text-gray-400">Received By: </span>
                          <span className="font-medium">{form.received_by_name}</span>
                        </div>
                      )}
                      {form.status && (
                        <div>
                          <span className="text-gray-400">Status: </span>
                          <span className="font-medium capitalize">{form.status}</span>
                        </div>
                      )}
                    </div>

                    {form.remarks && (
                      <div className="border-t pt-2 text-[10px]">
                        <span className="text-gray-400 font-semibold">Remarks: </span>{form.remarks}
                      </div>
                    )}

                    {/* Signatures */}
                    <div className="grid grid-cols-2 gap-4 border-t pt-3 mt-2">
                      <div className="text-center">
                        <div className="border-b border-gray-400 mb-1 h-6" />
                        <div className="text-[9px] text-gray-400 uppercase">Delivered By</div>
                      </div>
                      <div className="text-center">
                        <div className="border-b border-gray-400 mb-1 h-6" />
                        <div className="text-[9px] text-gray-400 uppercase">Received By</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
              <Button variant="outline" onClick={() => { setOpen(false); setEditing(null) }}>Cancel</Button>
              <Button onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : editing ? 'Update DR Log' : 'Save DR Log'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
    </div>
  )
}
