'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { FileText, Plus, Clock, CheckCircle2, XCircle, Loader2, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { format } from 'date-fns'

interface Request {
  id: string
  request_number: string
  subject: string
  status: string
  priority: string
  created_at: string
}

const STATUS_STYLE: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-700',
  reviewing:  'bg-blue-100 text-blue-700',
  approved:   'bg-green-100 text-green-700',
  rejected:   'bg-red-100 text-red-700',
  completed:  'bg-gray-100 text-gray-600',
}

export default function PortalDashboard() {
  const supabase = createClient()
  const router = useRouter()
  const [requests, setRequests] = useState<Request[]>([])
  const [clientName, setClientName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .single()
      setClientName(profile?.full_name ?? '')

      const { data: clientRow } = await supabase
        .from('clients')
        .select('id')
        .eq('auth_user_id', session.user.id)
        .single()

      if (clientRow) {
        const { data } = await supabase
          .from('client_requests')
          .select('id, request_number, subject, status, priority, created_at')
          .eq('client_id', clientRow.id)
          .order('created_at', { ascending: false })
          .limit(5)
        setRequests(data ?? [])
      }
      setLoading(false)
    }
    init()
  }, [])

  const pending = requests.filter(r => r.status === 'pending').length
  const approved = requests.filter(r => r.status === 'approved').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome{clientName ? `, ${clientName}` : ''}!</h1>
        <p className="text-muted-foreground mt-1">Submit and track your purchase requests to CDSC Industrial Supply.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Requests', value: requests.length, icon: FileText, color: 'text-blue-600' },
          { label: 'Pending Review', value: pending, icon: Clock, color: 'text-yellow-600' },
          { label: 'Approved', value: approved, icon: CheckCircle2, color: 'text-green-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3">
              <div className={`text-2xl font-bold ${s.color}`}>{loading ? '—' : s.value}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <s.icon className="h-3 w-3" /> {s.label}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick action */}
      <Card className="border-dashed border-2 border-red-200 bg-red-50/50">
        <CardContent className="pt-5 pb-5 flex items-center justify-between">
          <div>
            <div className="font-semibold text-red-700">New Purchase Request</div>
            <div className="text-sm text-muted-foreground mt-0.5">Submit a request for products or services</div>
          </div>
          <Link href="/portal/requests/new" className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors shrink-0">
            <Plus className="h-4 w-4" />New Request
          </Link>
        </CardContent>
      </Card>

      {/* Recent requests */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Recent Requests</h2>
          <Link href="/portal/requests" className="text-sm text-red-600 hover:underline flex items-center gap-1">
            View all <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No requests yet. Submit your first purchase request above.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {requests.map(r => (
              <Link key={r.id} href={`/portal/requests`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="py-3 px-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{r.subject}</div>
                      <div className="text-xs text-muted-foreground">{r.request_number} · {format(new Date(r.created_at), 'MMM d, yyyy')}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLE[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {r.status}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
