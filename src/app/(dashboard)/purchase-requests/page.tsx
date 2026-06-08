'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Plus, MoreHorizontal, CheckCircle2, XCircle, ArrowRight,
  Trash2, Mail, Eye, Printer, ArrowRightLeft, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

type PRStatus = 'draft' | 'submitted' | 'dept_approved' | 'admin_approved' | 'purchasing_approved' | 'rejected' | 'converted_to_po'

const STATUS_CFG: Record<PRStatus, { label: string; cls: string }> = {
  draft:               { label: 'Draft',           cls: 'bg-gray-100 text-gray-600' },
  submitted:           { label: 'Submitted',        cls: 'bg-blue-100 text-blue-700' },
  dept_approved:       { label: 'Dept Approved',    cls: 'bg-yellow-100 text-yellow-700' },
  admin_approved:      { label: 'Admin Approved',   cls: 'bg-orange-100 text-orange-700' },
  purchasing_approved: { label: 'Purch Approved',   cls: 'bg-purple-100 text-purple-700' },
  rejected:            { label: 'Rejected',         cls: 'bg-red-100 text-red-700' },
  converted_to_po:     { label: 'Converted to PO',  cls: 'bg-green-100 text-green-700' },
}

const PRIORITY_CLS: Record<string, string> = {
  low:    'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-700',
  high:   'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

const WORKFLOW_STEPS = ['Draft', 'Submitted', 'Dept Approved', 'Admin Approved', 'Purch Approved', 'Convert to PO']

interface PR {
  id: string
  pr_number: string | null
  date: string | null
  created_at: string
  department: string | null
  priority: string
  purpose: string | null
  status: PRStatus
}

interface PRLine {
  item_name: string
  quantity: string
  unit: string
  estimated_cost: string
}

const emptyLine = (): PRLine => ({ item_name: '', quantity: '', unit: 'piece', estimated_cost: '' })

export default function PurchaseRequestsPage() {
  const supabase = createClient()
  const [prs, setPRs] = useState<PR[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Email dialog
  const [emailId, setEmailId] = useState<string | null>(null)
  const [emailRecipient, setEmailRecipient] = useState('')

  // Form state
  const [dept, setDept] = useState('')
  const [priority, setPriority] = useState('normal')
  const [purpose, setPurpose] = useState('')
  const [lines, setLines] = useState<PRLine[]>([emptyLine()])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('purchase_requests')
      .select('id, pr_number, date, created_at, department, priority, purpose, status')
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    else setPRs((data ?? []) as PR[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const totalEstimated = lines.reduce(
    (sum, l) => sum + (parseFloat(l.estimated_cost) || 0) * (parseFloat(l.quantity) || 0), 0
  )

  function resetForm() {
    setDept(''); setPriority('normal'); setPurpose(''); setLines([emptyLine()])
  }

  async function submitPR(asDraft: boolean) {
    if (!dept) { toast.error('Department is required'); return }
    if (!purpose.trim()) { toast.error('Purpose is required'); return }
    setSaving(true)
    const { error } = await supabase.from('purchase_requests').insert({
      department: dept,
      priority,
      purpose: purpose.trim(),
      status: asDraft ? 'draft' : 'submitted',
    })
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success(asDraft ? 'Saved as draft' : 'Purchase request submitted for approval')
    setOpen(false)
    resetForm()
    load()
    setSaving(false)
  }

  async function updateStatus(id: string, status: PRStatus) {
    const { error } = await supabase.from('purchase_requests').update({ status }).eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success(`Status → ${STATUS_CFG[status].label}`); load() }
  }

  async function deletePR(id: string) {
    const { error } = await supabase.from('purchase_requests').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Purchase request deleted'); load() }
  }

  function openEmail(pr: PR) { setEmailId(pr.id); setEmailRecipient('') }

  function confirmSendEmail() {
    if (!emailRecipient.trim()) { toast.error('Enter a recipient email'); return }
    const pr = prs.find(p => p.id === emailId)
    if (!pr) return
    const subject = encodeURIComponent(`Purchase Request ${pr.pr_number ?? ''} — ${STATUS_CFG[pr.status]?.label}`)
    const body = encodeURIComponent(
      `Dear Team,\n\nPlease see details for Purchase Request ${pr.pr_number ?? 'N/A'}.\n\n` +
      `Department: ${pr.department ?? '—'}\nPriority: ${pr.priority}\n` +
      `Purpose: ${pr.purpose ?? '—'}\nStatus: ${STATUS_CFG[pr.status]?.label}\n\n` +
      `Best regards,\nCDSC Industrial Supply`
    )
    window.location.href = `mailto:${emailRecipient.trim()}?subject=${subject}&body=${body}`
    toast.success(`Email client opened for ${emailRecipient}`)
    setEmailId(null)
  }

  const counts = {
    draft:     prs.filter(p => p.status === 'draft').length,
    pending:   prs.filter(p => ['submitted','dept_approved','admin_approved'].includes(p.status)).length,
    approved:  prs.filter(p => p.status === 'purchasing_approved').length,
    converted: prs.filter(p => p.status === 'converted_to_po').length,
    rejected:  prs.filter(p => p.status === 'rejected').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Purchase Requests</h2>
          <p className="text-muted-foreground text-sm">Create and track purchase requests through the approval workflow</p>
        </div>
        <Button onClick={() => { resetForm(); setOpen(true) }} className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-2" />New Request
        </Button>
      </div>

      {/* Workflow steps */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-1">
            {WORKFLOW_STEPS.map((step, i) => (
              <div key={step} className="flex items-center gap-1 flex-1">
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div className="h-8 w-8 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-bold">{i + 1}</div>
                  <span className="text-xs text-center text-muted-foreground leading-tight">{step}</span>
                </div>
                {i < WORKFLOW_STEPS.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mb-4" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Status summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Draft',          count: counts.draft,     color: 'text-muted-foreground' },
          { label: 'Pending Approval', count: counts.pending, color: 'text-yellow-600' },
          { label: 'Purch Approved', count: counts.approved,  color: 'text-purple-600' },
          { label: 'Converted to PO',count: counts.converted, color: 'text-green-600' },
          { label: 'Rejected',       count: counts.rejected,  color: 'text-red-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <div className={`text-2xl font-bold ${s.color}`}>{loading ? '—' : s.count}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* PR List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Purchase Request List</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PR Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Priority</TableHead>
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
              ) : prs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No purchase requests yet. Click <strong>New Request</strong> to create one.
                  </TableCell>
                </TableRow>
              ) : prs.map(pr => {
                const sCfg = STATUS_CFG[pr.status] ?? STATUS_CFG.draft
                const pCls = PRIORITY_CLS[pr.priority] ?? PRIORITY_CLS.normal
                const displayDate = pr.date ?? pr.created_at
                return (
                  <TableRow key={pr.id}>
                    <TableCell className="font-mono text-xs font-semibold text-red-600">
                      {pr.pr_number ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {displayDate ? format(new Date(displayDate), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{pr.department ?? '—'}</span>
                    </TableCell>
                    <TableCell className="text-sm max-w-[220px] truncate">{pr.purpose ?? '—'}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pCls}`}>{pr.priority}</span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sCfg.cls}`}>{sCfg.label}</span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          {/* Always available */}
                          <DropdownMenuItem onClick={() => toast.info(`PR: ${pr.pr_number ?? pr.id}`)}>
                            <Eye className="mr-2 h-4 w-4" />View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEmail(pr)}>
                            <Mail className="mr-2 h-4 w-4" />Send Email
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.print()}>
                            <Printer className="mr-2 h-4 w-4" />Print PR
                          </DropdownMenuItem>

                          {/* Workflow actions based on status */}
                          {pr.status === 'draft' && (
                            <DropdownMenuItem onClick={() => updateStatus(pr.id, 'submitted')} className="text-blue-600">
                              <ArrowRight className="mr-2 h-4 w-4" />Submit for Approval
                            </DropdownMenuItem>
                          )}
                          {pr.status === 'submitted' && (<>
                            <DropdownMenuItem onClick={() => updateStatus(pr.id, 'dept_approved')} className="text-green-600">
                              <CheckCircle2 className="mr-2 h-4 w-4" />Dept Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(pr.id, 'rejected')} className="text-destructive">
                              <XCircle className="mr-2 h-4 w-4" />Reject
                            </DropdownMenuItem>
                          </>)}
                          {pr.status === 'dept_approved' && (<>
                            <DropdownMenuItem onClick={() => updateStatus(pr.id, 'admin_approved')} className="text-orange-600">
                              <CheckCircle2 className="mr-2 h-4 w-4" />Admin Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(pr.id, 'rejected')} className="text-destructive">
                              <XCircle className="mr-2 h-4 w-4" />Reject
                            </DropdownMenuItem>
                          </>)}
                          {pr.status === 'admin_approved' && (<>
                            <DropdownMenuItem onClick={() => updateStatus(pr.id, 'purchasing_approved')} className="text-purple-600">
                              <CheckCircle2 className="mr-2 h-4 w-4" />Purchasing Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(pr.id, 'rejected')} className="text-destructive">
                              <XCircle className="mr-2 h-4 w-4" />Reject
                            </DropdownMenuItem>
                          </>)}
                          {pr.status === 'purchasing_approved' && (
                            <DropdownMenuItem onClick={() => updateStatus(pr.id, 'converted_to_po')} className="text-green-600">
                              <ArrowRightLeft className="mr-2 h-4 w-4" />Convert to PO
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuItem onClick={() => deletePR(pr.id)} className="text-destructive">
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

      {/* ── New PR Dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">New Purchase Request</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Header fields */}
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">Request Details</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>PR Number</Label>
                  <Input value="Auto-generated" disabled className="bg-muted text-muted-foreground" />
                </div>
                <div className="space-y-1.5">
                  <Label>Department <span className="text-destructive">*</span></Label>
                  <Select value={dept} onValueChange={v => setDept(v ?? '')}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      {['Administration','IT','Finance','HR','Operations','Purchasing','Warehouse','Sales'].map(d =>
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Priority <span className="text-destructive">*</span></Label>
                  <Select value={priority} onValueChange={v => setPriority(v ?? 'normal')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Purpose / Justification <span className="text-destructive">*</span></Label>
                <Textarea
                  placeholder="Describe the purpose and reason for this purchase request…"
                  rows={3}
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                />
              </div>
            </div>

            {/* Line items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1 flex-1">Requested Items</p>
                <Button type="button" variant="outline" size="sm" className="ml-4 shrink-0" onClick={() => setLines(p => [...p, emptyLine()])}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add Row
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Item / Description</TableHead>
                      <TableHead className="text-xs w-24">Qty</TableHead>
                      <TableHead className="text-xs w-32">Unit</TableHead>
                      <TableHead className="text-xs w-36">Est. Unit Cost (₱)</TableHead>
                      <TableHead className="text-xs w-28 text-right pr-4">Line Total</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, i) => {
                      const lineTotal = (parseFloat(line.estimated_cost) || 0) * (parseFloat(line.quantity) || 0)
                      return (
                        <TableRow key={i}>
                          <TableCell className="p-1.5">
                            <Input
                              placeholder="Item name or description"
                              className="h-8 text-sm"
                              value={line.item_name}
                              onChange={e => setLines(p => p.map((l, idx) => idx === i ? { ...l, item_name: e.target.value } : l))}
                            />
                          </TableCell>
                          <TableCell className="p-1.5">
                            <Input
                              type="number" min={1} placeholder="1" className="h-8 text-sm"
                              value={line.quantity}
                              onChange={e => setLines(p => p.map((l, idx) => idx === i ? { ...l, quantity: e.target.value } : l))}
                            />
                          </TableCell>
                          <TableCell className="p-1.5">
                            <Select value={line.unit} onValueChange={v => setLines(p => p.map((l, idx) => idx === i ? { ...l, unit: v ?? l.unit } : l))}>
                              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {['piece','box','ream','set','unit','pack','kg','ltr','mtr','roll'].map(u =>
                                  <SelectItem key={u} value={u}>{u}</SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-1.5">
                            <Input
                              type="number" min={0} step="0.01" placeholder="0.00" className="h-8 text-sm"
                              value={line.estimated_cost}
                              onChange={e => setLines(p => p.map((l, idx) => idx === i ? { ...l, estimated_cost: e.target.value } : l))}
                            />
                          </TableCell>
                          <TableCell className="p-1.5 text-right text-sm font-medium pr-4">
                            ₱{lineTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="p-1.5">
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                              onClick={() => setLines(p => p.filter((_, idx) => idx !== i))}
                              disabled={lines.length === 1}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end text-sm font-semibold">
                Total Estimated:&nbsp;
                <span className="text-red-600 ml-1">
                  ₱{totalEstimated.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="secondary" onClick={() => submitPR(true)} disabled={saving}>Save as Draft</Button>
            <Button onClick={() => submitPR(false)} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting…</>
                : 'Submit for Approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Send Email Dialog ── */}
      <Dialog open={!!emailId} onOpenChange={() => setEmailId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-red-600" />Send PR by Email
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Opens your email client with the PR details pre-filled. Enter the recipient's address below.
            </p>
            <div className="space-y-1.5">
              <Label>Recipient Email <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                placeholder="approver@cdsc.com"
                value={emailRecipient}
                onChange={e => setEmailRecipient(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmSendEmail()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailId(null)}>Cancel</Button>
            <Button onClick={confirmSendEmail} className="bg-red-600 hover:bg-red-700">
              <Mail className="h-4 w-4 mr-2" />Open Email Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
