'use client'

// Audit trail of who created, edited or voided a books-of-accounts record —
// required documentation for a BIR Computerized Accounting System. Shown in
// User Management (as in the CHEM app) to the roles the audit_logs RLS allows.

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Search, ShieldAlert, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/error-message'
import { toast } from 'sonner'

export const AUDIT_VISIBLE_ROLES = ['super_admin', 'admin', 'auditor']

interface AuditLogEntry {
  id: string
  user_id: string | null
  action: string
  table_name: string
  record_id: string | null
  new_values: Record<string, unknown> | null
  created_at: string
}

const ACTION_CLS: Record<string, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  void: 'bg-red-100 text-red-700',
  delete: 'bg-red-100 text-red-700',
}

export function AuditLog() {
  const supabase = createClient()
  const [state, setState] = useState<'checking' | 'denied' | 'ready'>('checking')
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [emails, setEmails] = useState<Record<string, string>>({})
  const [q, setQ] = useState('')
  const [action, setAction] = useState('all')

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = user ? await supabase.from('profiles').select('role').eq('id', user.id).single() : { data: null }
      if (!active) return
      if (!profile || !AUDIT_VISIBLE_ROLES.includes((profile as { role: string }).role)) { setState('denied'); return }
      const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500)
      if (!active) return
      if (error) toast.error(getErrorMessage(error))
      const rows = (data ?? []) as AuditLogEntry[]
      setEntries(rows)
      const ids = [...new Set(rows.map(r => r.user_id).filter((x): x is string => !!x))]
      if (ids.length) {
        const { data: ps } = await supabase.from('profiles').select('id, email, full_name').in('id', ids)
        if (active) setEmails(Object.fromEntries((ps ?? []).map((p: { id: string; email: string | null; full_name: string | null }) => [p.id, p.full_name || p.email || p.id])))
      }
      setState('ready')
    })()
    return () => { active = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => entries.filter(e => {
    if (action !== 'all' && e.action !== action) return false
    const s = q.trim().toLowerCase()
    if (!s) return true
    return [e.table_name, e.action, e.record_id, e.user_id ? emails[e.user_id] : 'system', JSON.stringify(e.new_values ?? {})]
      .some(v => (v ?? '').toLowerCase().includes(s))
  }), [entries, action, q, emails])

  function exportCsv() {
    const rows = [['When', 'User', 'Action', 'Table', 'Record'], ...shown.map(e => [
      new Date(e.created_at).toLocaleString('en-PH'), e.user_id ? emails[e.user_id] ?? e.user_id : 'System', e.action, e.table_name, e.record_id ?? '',
    ])]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = 'Audit_Log.csv'; a.click(); URL.revokeObjectURL(url)
  }

  if (state === 'checking') return <div className="py-12 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
  if (state === 'denied') {
    return (
      <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
        <ShieldAlert className="mx-auto mb-2 h-6 w-6 opacity-50" />Audit logs are visible to Super-Admin, Admin and Auditor roles only.
      </CardContent></Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-9 pl-8" placeholder="Search user, table, record…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {['all', 'create', 'update', 'void'].map(a => (
          <button key={a} type="button" onClick={() => setAction(a)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${action === a ? 'bg-[#E8112D] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}>
            {a === 'all' ? 'All actions' : a}
          </button>
        ))}
        <Button variant="outline" size="sm" className="ml-auto" onClick={exportCsv}><Download className="mr-1.5 h-3.5 w-3.5" />Export CSV</Button>
      </div>
      <Card><CardContent className="p-0">
        <Table containerClassName="max-h-[560px] overflow-y-auto">
          <TableHeader className="sticky top-0 z-10 bg-background"><TableRow>
            <TableHead>When</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead><TableHead>Table</TableHead><TableHead>Record</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {shown.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No activity logged.</TableCell></TableRow>
            ) : shown.map(e => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap text-xs">{new Date(e.created_at).toLocaleString('en-PH')}</TableCell>
                <TableCell className="text-sm">{e.user_id ? emails[e.user_id] ?? e.user_id.slice(0, 8) : 'System'}</TableCell>
                <TableCell><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium uppercase ${ACTION_CLS[e.action] ?? 'bg-gray-100 text-gray-600'}`}>{e.action}</span></TableCell>
                <TableCell className="text-sm capitalize">{e.table_name.replace(/_/g, ' ')}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{e.record_id ? e.record_id.slice(0, 8) : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
      <p className="text-xs text-muted-foreground">Showing the latest {entries.length} changes to Collections, Disbursements and other books-of-accounts records.</p>
    </div>
  )
}
