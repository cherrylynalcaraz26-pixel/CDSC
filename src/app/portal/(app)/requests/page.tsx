'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Loader2, FileText, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import Link from 'next/link'
import { format } from 'date-fns'

interface Request {
  id: string
  request_number: string
  subject: string
  message: string | null
  status: string
  priority: string
  created_at: string
}

const STATUS_STYLE: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  reviewing: 'bg-blue-100 text-blue-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  completed: 'bg-gray-100 text-gray-600',
}

const PRIORITY_STYLE: Record<string, string> = {
  low:    'bg-gray-100 text-gray-500',
  normal: 'bg-blue-50 text-blue-600',
  high:   'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
}

export default function PortalRequests() {
  const supabase = createClient()
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [clientId, setClientId] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: clientRow } = await supabase
        .from('clients')
        .select('id')
        .eq('auth_user_id', session.user.id)
        .single()
      if (clientRow) {
        setClientId(clientRow.id)
        const { data } = await supabase
          .from('client_requests')
          .select('id, request_number, subject, message, status, priority, created_at')
          .eq('client_id', clientRow.id)
          .order('created_at', { ascending: false })
        setRequests(data ?? [])
      }
      setLoading(false)
    }
    init()
  }, [])

  const filtered = filterStatus ? requests.filter(r => r.status === filterStatus) : requests

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Requests</h1>
          <p className="text-muted-foreground text-sm mt-0.5">All your purchase requests to CDSC</p>
        </div>
        <Link href="/portal/requests/new" className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors">
          <Plus className="h-4 w-4" />New Request
        </Link>
      </div>

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

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">{filterStatus ? 'No requests with this status.' : 'No requests yet.'}</p>
            {!filterStatus && <Link href="/portal/requests/new" className="mt-4 inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors">Submit your first request</Link>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <Card key={r.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{r.subject}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLE[r.status] ?? 'bg-gray-100 text-gray-600'}`}>{r.status}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PRIORITY_STYLE[r.priority] ?? ''}`}>{r.priority}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{r.request_number} · Submitted {format(new Date(r.created_at), 'MMM d, yyyy h:mm a')}</div>
                    {r.message && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{r.message}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
