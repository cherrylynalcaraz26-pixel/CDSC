'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { getErrorMessage } from '@/lib/error-message'
import {
  Plus, MoreHorizontal, Cpu, ArrowRightLeft, Eye, History,
  RotateCcw, Trash2, Loader2, CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useSearchContext } from '@/context/search-context'

type AssetStatus = 'active' | 'transferred' | 'returned' | 'disposed'

const STATUS_CFG: Record<AssetStatus, { label: string; cls: string }> = {
  active:      { label: 'Active',      cls: 'bg-green-100 text-green-700' },
  transferred: { label: 'Transferred', cls: 'bg-blue-100 text-blue-700' },
  returned:    { label: 'Returned',    cls: 'bg-yellow-100 text-yellow-700' },
  disposed:    { label: 'Disposed',    cls: 'bg-red-100 text-red-700' },
}

const ASSET_CATEGORIES = [
  'IT Equipment', 'Furniture', 'Machinery', 'Vehicle', 'Office Equipment',
  'Tools', 'Communication Equipment', 'Safety Equipment', 'Other',
]

interface Profile { id: string; full_name: string; department: string | null }
interface Asset {
  id: string
  asset_number: string | null
  asset_category: string | null
  item_name: string | null
  serial_number: string | null
  purchase_date: string | null
  purchase_cost: number
  assigned_to: string | null
  department: string | null
  date_issued: string | null
  date_returned: string | null
  status: AssetStatus
  remarks: string | null
  profile?: Profile | null
}
interface AssetHistoryRow {
  id: string; action: string; notes: string | null; created_at: string
  performed_by?: Profile | null
}

const emptyForm = () => ({
  asset_category: '', item_name: '', serial_number: '',
  purchase_date: '', purchase_cost: '', assigned_to: '',
  department: '', date_issued: '', remarks: '',
})

export default function AssetsPage() {
  const supabase = createClient()
  const { query: search } = useSearchContext()
  const [assets, setAssets] = useState<Asset[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  // Dialogs
  const [issueOpen, setIssueOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm())

  const [viewAsset, setViewAsset] = useState<Asset | null>(null)
  const [transferAsset, setTransferAsset] = useState<Asset | null>(null)
  const [transferTo, setTransferTo] = useState('')
  const [transferDept, setTransferDept] = useState('')
  const [returnAsset, setReturnAsset] = useState<Asset | null>(null)
  const [returnDate, setReturnDate] = useState('')
  const [historyAsset, setHistoryAsset] = useState<Asset | null>(null)
  const [history, setHistory] = useState<AssetHistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  async function load() {
    setLoading(true)
    const [{ data: aData }, { data: pData }] = await Promise.all([
      supabase.from('assets').select('*, profile:profiles!assets_assigned_to_fkey(id, full_name, department)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, department').eq('status', 'active').order('full_name'),
    ])
    setAssets((aData ?? []) as Asset[])
    setProfiles(pData ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = assets.filter(a =>
    (a.item_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (a.asset_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (a.profile?.full_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const counts = {
    total: assets.length,
    active: assets.filter(a => a.status === 'active').length,
    available: assets.filter(a => a.status === 'active' && !a.assigned_to).length,
    totalCost: assets.reduce((s, a) => s + (a.purchase_cost ?? 0), 0),
  }

  async function issueAsset() {
    if (!form.item_name.trim()) { toast.error('Item name required'); return }
    setSaving(true)
    const { error } = await supabase.from('assets').insert({
      asset_category: form.asset_category || null,
      item_name: form.item_name.trim(),
      serial_number: form.serial_number || null,
      purchase_date: form.purchase_date || null,
      purchase_cost: parseFloat(form.purchase_cost) || 0,
      assigned_to: form.assigned_to || null,
      department: form.department || null,
      date_issued: form.date_issued || null,
      remarks: form.remarks || null,
      status: 'active',
    })
    if (error) { toast.error(getErrorMessage(error)); setSaving(false); return }
    toast.success('Asset issued successfully')
    setIssueOpen(false)
    setForm(emptyForm())
    load()
    setSaving(false)
  }

  async function transferAssetAction() {
    if (!transferAsset) return
    const { error } = await supabase.from('assets').update({
      assigned_to: transferTo || null,
      department: transferDept || transferAsset.department,
      status: 'transferred',
    }).eq('id', transferAsset.id)
    if (error) { toast.error(getErrorMessage(error)); return }
    toast.success('Asset transferred')
    setTransferAsset(null)
    load()
  }

  async function returnAssetAction() {
    if (!returnAsset) return
    const { error } = await supabase.from('assets').update({
      date_returned: returnDate || new Date().toISOString().split('T')[0],
      status: 'returned',
      assigned_to: null,
    }).eq('id', returnAsset.id)
    if (error) { toast.error(getErrorMessage(error)); return }
    toast.success('Asset returned')
    setReturnAsset(null)
    load()
  }

  async function disposeAsset(id: string) {
    const { error } = await supabase.from('assets').update({ status: 'disposed' }).eq('id', id)
    if (error) toast.error(getErrorMessage(error))
    else { toast.success('Asset disposed'); load() }
  }

  async function loadHistory(asset: Asset) {
    setHistoryAsset(asset)
    setHistoryLoading(true)
    const { data } = await supabase
      .from('asset_history')
      .select('id, action, notes, created_at, performed_by:profiles(id, full_name, department)')
      .eq('asset_id', asset.id)
      .order('created_at', { ascending: false })
    setHistory((data ?? []) as unknown as AssetHistoryRow[])
    setHistoryLoading(false)
  }

  const sf = (k: string) => (v: string) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Asset Accountability</h2>
          <p className="text-muted-foreground text-sm">Track fixed assets, assignments, transfers and disposals</p>
        </div>
        <Button onClick={() => { setForm(emptyForm()); setIssueOpen(true) }} className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-2" />Issue Asset
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold">{loading ? '—' : counts.total}</div>
          <div className="text-sm text-muted-foreground">Total Assets</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold text-green-600">{loading ? '—' : counts.active}</div>
          <div className="text-sm text-muted-foreground">Active / Assigned</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold text-blue-600">{loading ? '—' : counts.available}</div>
          <div className="text-sm text-muted-foreground">Available (Unassigned)</div>
        </CardContent></Card>
        <Card><CardContent className="pt-5 pb-4">
          <div className="text-2xl font-bold">₱{loading ? '—' : (counts.totalCost / 1000).toFixed(0) + 'K'}</div>
          <div className="text-sm text-muted-foreground">Total Asset Value</div>
        </CardContent></Card>
      </div>

      <Card className="overflow-visible">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Cpu className="h-4 w-4" />Asset List</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table containerClassName="overflow-x-clip">
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Asset No.</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Serial No.</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Date Issued</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                  {search ? 'No assets match your search.' : 'No assets yet. Click Issue Asset to add one.'}
                </TableCell></TableRow>
              ) : filtered.map(asset => {
                const sCfg = STATUS_CFG[asset.status] ?? STATUS_CFG.active
                return (
                  <TableRow key={asset.id}>
                    <TableCell className="font-mono text-xs font-semibold text-red-600">{asset.asset_number ?? '—'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{asset.asset_category ?? '—'}</Badge></TableCell>
                    <TableCell className="font-medium text-sm">{asset.item_name ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{asset.serial_number ?? '—'}</TableCell>
                    <TableCell className="text-sm">
                      {asset.profile?.full_name ?? (asset.assigned_to ? '—' : <span className="text-muted-foreground italic">Unassigned</span>)}
                    </TableCell>
                    <TableCell className="text-sm">{asset.department ?? '—'}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {asset.date_issued ? format(new Date(asset.date_issued), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ₱{(asset.purchase_cost ?? 0).toLocaleString('en-PH')}
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sCfg.cls}`}>{sCfg.label}</span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setViewAsset(asset)}>
                            <Eye className="mr-2 h-4 w-4" />View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => loadHistory(asset)}>
                            <History className="mr-2 h-4 w-4" />Asset History
                          </DropdownMenuItem>
                          {asset.status === 'active' && (
                            <DropdownMenuItem onClick={() => {
                              setTransferAsset(asset)
                              setTransferTo(asset.assigned_to ?? '')
                              setTransferDept(asset.department ?? '')
                            }} className="text-blue-600">
                              <ArrowRightLeft className="mr-2 h-4 w-4" />Transfer Asset
                            </DropdownMenuItem>
                          )}
                          {asset.status === 'active' && (
                            <DropdownMenuItem onClick={() => {
                              setReturnAsset(asset)
                              setReturnDate(new Date().toISOString().split('T')[0])
                            }} className="text-yellow-600">
                              <RotateCcw className="mr-2 h-4 w-4" />Return Asset
                            </DropdownMenuItem>
                          )}
                          {asset.status !== 'disposed' && (
                            <DropdownMenuItem onClick={() => disposeAsset(asset.id)} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />Dispose Asset
                            </DropdownMenuItem>
                          )}
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

      {/* ── Issue Asset Dialog ── */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Issue Asset</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Item Name / Description <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. Laptop Dell Inspiron 15" value={form.item_name} onChange={e => setForm(p => ({ ...p, item_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.asset_category} onValueChange={v => sf('asset_category')(v ?? '')}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{ASSET_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Serial Number</Label>
              <Input placeholder="Serial / model number" value={form.serial_number} onChange={e => setForm(p => ({ ...p, serial_number: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Purchase Date</Label>
              <Input type="date" value={form.purchase_date} onChange={e => setForm(p => ({ ...p, purchase_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Purchase Cost (₱)</Label>
              <Input type="number" min={0} step="0.01" placeholder="0.00" value={form.purchase_cost} onChange={e => setForm(p => ({ ...p, purchase_cost: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Assign To</Label>
              <Select value={form.assigned_to} onValueChange={v => {
                const val = v ?? ''
                const p = profiles.find(x => x.id === val)
                setForm(prev => ({ ...prev, assigned_to: val, department: p?.department ?? prev.department }))
              }}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Unassigned —</SelectItem>
                  {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input placeholder="Department" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Date Issued</Label>
              <Input type="date" value={form.date_issued} onChange={e => setForm(p => ({ ...p, date_issued: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Remarks</Label>
              <Textarea rows={2} placeholder="Optional notes…" value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueOpen(false)}>Cancel</Button>
            <Button onClick={issueAsset} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Issue Asset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View Details Dialog ── */}
      <Dialog open={!!viewAsset} onOpenChange={() => setViewAsset(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Asset Details</DialogTitle></DialogHeader>
          {viewAsset && (
            <div className="space-y-3 py-2 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {[
                  ['Asset Number', viewAsset.asset_number ?? '—'],
                  ['Category', viewAsset.asset_category ?? '—'],
                  ['Item Name', viewAsset.item_name ?? '—'],
                  ['Serial Number', viewAsset.serial_number ?? '—'],
                  ['Purchase Date', viewAsset.purchase_date ? format(new Date(viewAsset.purchase_date), 'MMM d, yyyy') : '—'],
                  ['Purchase Cost', `₱${(viewAsset.purchase_cost ?? 0).toLocaleString('en-PH')}`],
                  ['Assigned To', viewAsset.profile?.full_name ?? '—'],
                  ['Department', viewAsset.department ?? '—'],
                  ['Date Issued', viewAsset.date_issued ? format(new Date(viewAsset.date_issued), 'MMM d, yyyy') : '—'],
                  ['Date Returned', viewAsset.date_returned ? format(new Date(viewAsset.date_returned), 'MMM d, yyyy') : '—'],
                  ['Status', STATUS_CFG[viewAsset.status]?.label ?? viewAsset.status],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div className="text-xs text-muted-foreground">{k}</div>
                    <div className="font-medium">{v}</div>
                  </div>
                ))}
              </div>
              {viewAsset.remarks && (
                <div>
                  <div className="text-xs text-muted-foreground">Remarks</div>
                  <div>{viewAsset.remarks}</div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewAsset(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Transfer Asset Dialog ── */}
      <Dialog open={!!transferAsset} onOpenChange={() => setTransferAsset(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" />Transfer Asset</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Reassign <strong>{transferAsset?.item_name}</strong> to a new holder.</p>
            <div className="space-y-1.5">
              <Label>Transfer To</Label>
              <Select value={transferTo} onValueChange={v => {
                const val = v ?? ''
                setTransferTo(val)
                const p = profiles.find(x => x.id === val)
                if (p?.department) setTransferDept(p.department)
              }}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Unassigned —</SelectItem>
                  {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input value={transferDept} onChange={e => setTransferDept(e.target.value)} placeholder="Department" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferAsset(null)}>Cancel</Button>
            <Button onClick={transferAssetAction} className="bg-red-600 hover:bg-red-700">Confirm Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Return Asset Dialog ── */}
      <Dialog open={!!returnAsset} onOpenChange={() => setReturnAsset(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><RotateCcw className="h-4 w-4" />Return Asset</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Mark <strong>{returnAsset?.item_name}</strong> as returned.</p>
            <div className="space-y-1.5">
              <Label>Date Returned</Label>
              <Input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnAsset(null)}>Cancel</Button>
            <Button onClick={returnAssetAction} className="bg-red-600 hover:bg-red-700">
              <CheckCircle2 className="h-4 w-4 mr-2" />Confirm Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Asset History Dialog ── */}
      <Dialog open={!!historyAsset} onOpenChange={() => setHistoryAsset(null)}>
        <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="h-4 w-4" />Asset History — {historyAsset?.item_name}</DialogTitle></DialogHeader>
          {historyLoading ? (
            <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></div>
          ) : history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No history recorded for this asset.</p>
          ) : (
            <div className="space-y-2 py-2">
              {history.map(h => (
                <div key={h.id} className="flex gap-3 text-sm border-l-2 border-muted pl-3">
                  <div className="flex-1">
                    <div className="font-medium capitalize">{h.action}</div>
                    {h.notes && <div className="text-muted-foreground text-xs mt-0.5">{h.notes}</div>}
                    {h.performed_by && <div className="text-xs text-muted-foreground">by {(h.performed_by as any).full_name}</div>}
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(h.created_at), 'MMM d, yyyy')}
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryAsset(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
