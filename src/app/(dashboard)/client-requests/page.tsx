'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Loader2, MoreHorizontal, FileText, Clock, CheckCircle2,
  XCircle, Eye, ChevronDown, ChevronRight, Package,
} from 'lucide-react'
import { useSearchContext } from '@/context/search-context'
import { Card, CardContent } from '@/components/ui/card'
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { format } from 'date-fns'

interface RequestItem {
  description: string
  quantity: string
  unit: string
  remarks: string
}

interface ClientRequest {
  id: string
  request_number: string
  client_id: string
  client_name: string
  subject: string
  message: string | null
  items: RequestItem[]
  status: string
  priority: string
  notes: string | null
  created_at: string
  updated_at: string
}

const STATUS_STYLE: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  reviewing: 'bg-blue-100 text-blue-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  completed: 'bg-gray-100 text-gray-600',
}

const PRIORITY_STYLE: Record<string, string> = {
  low:    'text-gray-500',
  normal: 'text-blue-600',
  high:   'text-orange-500 font-semibold',
  urgent: 'text-red-600 font-bold',
}

export default function ClientRequestsPage() {
  const supabase = createClient()
  const { query: search } = useSearchContext()
  const [requests, setRequests] = useState<ClientRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [viewing, setViewing] = useState<ClientRequest | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [internalNotes, setInternalNotes] = useState('')

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('client_requests')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    else setRequests(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function updateStatus(id: string, status: string, notes?: string) {
    setUpdatingStatus(true)
    const { error } = await supabase.from('client_requests').update({
      status,
      notes: notes ?? null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) toast.error(error.message)
    else {
      toast.success(`Request marked as ${status}`)
      setViewing(null)
      load()
    }
    setUpdatingStatus(false)
  }

  const filtered = requests.filter(r => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      r.subject.toLowerCase().includes(q) ||
      r.client_name.toLowerCase().includes(q) ||
      r.request_number.toLowerCase().includes(q)
    const matchStatus = !filterStatus || r.status === filterStatus
    return matchSearch && matchStatus
  })

  const pending = requests.filter(r => r.status === 'pending').length
  const reviewing = requests.filter(r => r.status === 'reviewing').length
  const approved = requests.filter(r => r.status === 'approved').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
          <FileText className="h-5 w-5 text-orange-500" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold leading-none">Client Requests</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Purchase requests submitted by clients via the portal</p>
        </div>
        {pending > 0 && (
          <span className="ml-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pending} new</span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: requests.length, color: '' },
          { label: 'Pending', value: pending, color: 'text-yellow-600' },
          { label: 'Reviewing', value: reviewing, color: 'text-blue-600' },
          { label: 'Approved', value: approved, color: 'text-green-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <div className={`text-2xl font-bold ${s.color}`}>{loading ? '—' : s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={filterStatus || '_all'} onValueChange={(v: string | null) => setFilterStatus(!v || v === '_all' ? '' : v)}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder="All status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="reviewing">Reviewing</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} request{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Request</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
              </TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                {search || filterStatus ? 'No requests match your filters.' : 'No client requests yet.'}
              </TableCell></TableRow>
            ) : filtered.map(r => (
              <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => { setViewing(r); setInternalNotes(r.notes ?? '') }}>
                <TableCell>
                  <div className="font-medium text-sm">{r.subject}</div>
                  <div className="text-xs text-muted-foreground">{r.request_number}</div>
                </TableCell>
                <TableCell className="text-sm">{r.client_name}</TableCell>
                <TableCell>
                  <span className={`text-sm capitalize ${PRIORITY_STYLE[r.priority] ?? ''}`}>{r.priority}</span>
                </TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLE[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {r.status}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {format(new Date(r.created_at), 'MMM d, yyyy')}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent" onClick={e => e.stopPropagation()}>
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={e => { e.stopPropagation(); setViewing(r); setInternalNotes(r.notes ?? '') }}>
                        <Eye className="h-3.5 w-3.5 mr-2" /> View Details
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={e => { e.stopPropagation(); updateStatus(r.id, 'reviewing') }}>
                        <Clock className="h-3.5 w-3.5 mr-2" /> Mark Reviewing
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={e => { e.stopPropagation(); updateStatus(r.id, 'approved') }}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Approve
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={e => { e.stopPropagation(); updateStatus(r.id, 'rejected') }} className="text-destructive">
                        <XCircle className="h-3.5 w-3.5 mr-2" /> Reject
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* View Request Dialog */}
      <Dialog open={!!viewing} onOpenChange={o => !o && setViewing(null)}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {viewing?.request_number}
            </DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLE[viewing.status] ?? ''}`}>{viewing.status}</span>
                <span className={`text-xs capitalize font-medium ${PRIORITY_STYLE[viewing.priority] ?? ''}`}>{viewing.priority} priority</span>
                <span className="text-xs text-muted-foreground ml-auto">{format(new Date(viewing.created_at), 'MMM d, yyyy h:mm a')}</span>
              </div>

              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Client</div>
                <div className="font-medium">{viewing.client_name}</div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Subject</div>
                <div className="font-semibold text-base">{viewing.subject}</div>
              </div>

              {viewing.message && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Message</div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewing.message}</p>
                </div>
              )}

              {viewing.items && viewing.items.length > 0 && viewing.items.some(it => it.description) && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Items Requested</div>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Description</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Qty</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Unit</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewing.items.filter(it => it.description).map((it, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-3 py-2">{it.description}</td>
                            <td className="px-3 py-2 text-right">{it.quantity}</td>
                            <td className="px-3 py-2 text-muted-foreground">{it.unit}</td>
                            <td className="px-3 py-2 text-muted-foreground">{it.remarks || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Internal Notes</Label>
                <Textarea
                  rows={3}
                  value={internalNotes}
                  onChange={e => setInternalNotes(e.target.value)}
                  placeholder="Add internal notes about this request..."
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
            <Button variant="outline" disabled={updatingStatus} onClick={() => viewing && updateStatus(viewing.id, 'reviewing', internalNotes)}>
              <Clock className="h-3.5 w-3.5 mr-1.5" /> Mark Reviewing
            </Button>
            <Button disabled={updatingStatus} onClick={() => viewing && updateStatus(viewing.id, 'approved', internalNotes)}
              className="bg-green-600 hover:bg-green-700">
              {updatingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
              Approve
            </Button>
            <Button variant="destructive" disabled={updatingStatus} onClick={() => viewing && updateStatus(viewing.id, 'rejected', internalNotes)}>
              <XCircle className="h-3.5 w-3.5 mr-1.5" /> Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
