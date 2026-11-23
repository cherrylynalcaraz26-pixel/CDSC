'use client'

// Email history for Pull Outs → Client Records. Lists every records letter
// emailed (or attempted) per client, with the recipients, subject, message
// and figures at the time of sending. "View Letter" reopens the letter exactly
// as it was attached; "Send Again" opens the email dialog with current data.

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/error-message'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { ArrowLeft, FileText, History, Loader2, Mail, Search } from 'lucide-react'
import { amt, STYLE } from '@/components/pull-outs/client-records'

export interface EmailLogSummary { client_key: string; sent_at: string; status: 'sent' | 'failed' }

interface EmailLog {
  id: string
  client_key: string
  client_name: string
  ref_no: string | null
  letter_date: string | null
  period_from: string | null
  period_to: string | null
  recipients: string
  subject: string
  body: string | null
  attachment_name: string | null
  csi_count: number | null
  invoiced_amount: number | null
  open_count: number | null
  open_amount: number | null
  dr_count: number | null
  status: 'sent' | 'failed'
  error: string | null
  sent_by_name: string | null
  sent_at: string
}

const COLS = 'id, client_key, client_name, ref_no, letter_date, period_from, period_to, recipients, subject, body, attachment_name, csi_count, invoiced_amount, open_count, open_amount, dr_count, status, error, sent_by_name, sent_at'
const dt = (s: string) => format(new Date(s), 'dd MMM yyyy, h:mm a')
const dOnly = (s: string | null) => (s ? format(new Date(s + 'T00:00:00'), 'dd MMM yyyy') : '—')

/** Per-client sent count and latest send, for the Client Records table. */
export function summarizeLog(rows: EmailLogSummary[]) {
  const by = new Map<string, { count: number; last: string; lastStatus: 'sent' | 'failed'; lastSent: string | null }>()
  for (const r of rows) {
    const c = by.get(r.client_key) ?? { count: 0, last: '', lastStatus: r.status, lastSent: null }
    if (r.status === 'sent') {
      c.count++
      if (!c.lastSent || r.sent_at > c.lastSent) c.lastSent = r.sent_at
    }
    if (r.sent_at > c.last) { c.last = r.sent_at; c.lastStatus = r.status }
    by.set(r.client_key, c)
  }
  return by
}

export function ClientRecordsHistory({ clientKey, onClose, onResend }: {
  /** Open filtered to one client; omit for all clients. */
  clientKey?: string
  onClose: () => void
  /** Open the email dialog for this client again (current figures). Omitted when the client is no longer on the list. */
  onResend?: (clientKey: string) => void
}) {
  const [rows, setRows] = useState<EmailLog[] | null>(null)
  const [client, setClient] = useState(clientKey ?? 'all')
  const [status, setStatus] = useState<'all' | 'sent' | 'failed'>('all')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<EmailLog | null>(null)
  const [viewing, setViewing] = useState(false)

  useEffect(() => {
    let on = true
    createClient().from('client_record_emails').select(COLS).order('sent_at', { ascending: false }).limit(2000)
      .then(({ data, error }) => {
        if (!on) return
        if (error) toast.error(getErrorMessage(error, 'Could not load email history. Has migration 045 been applied?'))
        setRows((data ?? []) as EmailLog[])
      })
    return () => { on = false }
  }, [])

  const clients = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of rows ?? []) if (!m.has(r.client_key)) m.set(r.client_key, r.client_name)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [rows])

  const shown = (rows ?? []).filter(r => {
    if (client !== 'all' && r.client_key !== client) return false
    if (status !== 'all' && r.status !== status) return false
    const s = q.trim().toLowerCase()
    if (!s) return true
    return [r.client_name, r.ref_no, r.recipients, r.subject, r.sent_by_name].some(v => (v ?? '').toLowerCase().includes(s))
  })
  const clientName = client === 'all' ? null : (clients.find(c => c[0] === client)?.[1] ?? null)

  async function viewLetter(r: EmailLog) {
    const win = window.open('', '_blank', 'width=960,height=1000')
    if (!win) return
    setViewing(true)
    const { data, error } = await createClient().from('client_record_emails').select('letter_html').eq('id', r.id).single()
    setViewing(false)
    if (error || !data?.letter_html) { win.close(); toast.error('The letter for this email was not saved.'); return }
    const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(r.attachment_name ?? r.ref_no ?? 'Letter')}</title><style>${STYLE}</style></head><body>${data.letter_html}</body></html>`)
    win.document.close()
  }

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent size="landscape">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-[#E8112D]" />Email History{clientName ? ` · ${clientName}` : ''}
          </DialogTitle>
        </DialogHeader>

        {open ? (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setOpen(null)}><ArrowLeft className="mr-1.5 h-4 w-4" />Back to list</Button>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <div className="grid grid-cols-[90px_1fr] gap-y-1.5 text-sm">
                  <span className="text-muted-foreground">Client</span><span className="font-medium">{open.client_name}</span>
                  <span className="text-muted-foreground">Sent</span><span>{dt(open.sent_at)}{open.sent_by_name ? ` by ${open.sent_by_name}` : ''}</span>
                  <span className="text-muted-foreground">To</span><span className="break-all">{open.recipients}</span>
                  <span className="text-muted-foreground">Subject</span><span>{open.subject}</span>
                  <span className="text-muted-foreground">Attachment</span><span>{open.attachment_name ?? '—'}</span>
                  <span className="text-muted-foreground">Status</span>
                  <span>{open.status === 'sent' ? <Badge className="bg-green-100 text-green-800">Sent</Badge> : <Badge className="bg-red-100 text-red-700">Failed</Badge>}{open.error ? <span className="ml-2 text-xs text-red-700">{open.error}</span> : null}</span>
                </div>
                <div className="max-h-[42vh] overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">{open.body || '(no message)'}</div>
              </div>
              <div className="space-y-3">
                <div className="rounded-lg border p-3 text-sm">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Letter as sent</p>
                  <div className="grid grid-cols-[1fr_auto] gap-y-1">
                    <span className="text-muted-foreground">Ref. No.</span><span className="font-mono text-xs">{open.ref_no ?? '—'}</span>
                    <span className="text-muted-foreground">Letter date</span><span>{dOnly(open.letter_date)}</span>
                    <span className="text-muted-foreground">Period</span><span className="text-right">{dOnly(open.period_from)} – {dOnly(open.period_to)}</span>
                    <span className="text-muted-foreground">CSIs</span><span>{open.csi_count ?? 0} · {amt(Number(open.invoiced_amount ?? 0))}</span>
                    <span className="text-muted-foreground">Open</span><span className={open.open_count ? 'font-semibold text-amber-700' : ''}>{open.open_count ?? 0} · {amt(Number(open.open_amount ?? 0))}</span>
                    <span className="text-muted-foreground">DRs</span><span>{open.dr_count ?? 0}</span>
                  </div>
                </div>
                <Button variant="outline" className="w-full" disabled={viewing} onClick={() => viewLetter(open)}>
                  {viewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}View Letter
                </Button>
                {onResend && (
                  <Button className="w-full bg-[#E8112D] hover:bg-[#D10F28]" onClick={() => onResend(open.client_key)}>
                    <Mail className="mr-2 h-4 w-4" />Send Again (current figures)
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Search ref. no., recipient, subject, sender" value={q} onChange={e => setQ(e.target.value)} />
              </div>
              <Select value={client} onValueChange={v => setClient(v ?? 'all')}>
                <SelectTrigger className="h-9 w-[240px]"><span className="truncate text-sm">{clientName ?? 'All clients'}</span></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {clients.map(([k, n]) => <SelectItem key={k} value={k}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={v => setStatus((v ?? 'all') as typeof status)}>
                <SelectTrigger className="h-9 w-[130px]"><span className="text-sm">{status === 'all' ? 'All status' : status === 'sent' ? 'Sent' : 'Failed'}</span></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="max-h-[60vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sent</TableHead>
                    {client === 'all' && <TableHead>Client</TableHead>}
                    <TableHead>Ref. No.</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="text-right">Open (PHP)</TableHead>
                    <TableHead>Sent By</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows === null ? (
                    <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</TableCell></TableRow>
                  ) : shown.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No emails sent yet.</TableCell></TableRow>
                  ) : shown.map(r => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setOpen(r)}>
                      <TableCell className="whitespace-nowrap text-xs">{dt(r.sent_at)}</TableCell>
                      {client === 'all' && <TableCell className="font-medium">{r.client_name}</TableCell>}
                      <TableCell className="whitespace-nowrap font-mono text-xs">{r.ref_no ?? '—'}</TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs" title={r.recipients}>{r.recipients}</TableCell>
                      <TableCell className="max-w-[240px] truncate text-xs" title={r.subject}>{r.subject}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{r.open_count ? `${r.open_count} · ${amt(Number(r.open_amount ?? 0))}` : '0'}</TableCell>
                      <TableCell className="text-xs">{r.sent_by_name ?? '—'}</TableCell>
                      <TableCell>{r.status === 'sent' ? <Badge className="bg-green-100 text-green-800">Sent</Badge> : <Badge className="bg-red-100 text-red-700" title={r.error ?? ''}>Failed</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">{shown.length} email{shown.length === 1 ? '' : 's'}. Click a row for the message and the letter as sent.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
