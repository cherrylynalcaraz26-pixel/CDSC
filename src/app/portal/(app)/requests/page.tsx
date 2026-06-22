'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Loader2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import Link from 'next/link'
import { format } from 'date-fns'

interface SalesOrder {
  id: string
  so_number: string | null
  so_date: string | null
  created_at: string
  client_po_number: string | null
  status: string
  total_amount: number
  remarks: string | null
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  draft:      { label: 'Pending Review', cls: 'bg-yellow-100 text-yellow-700' },
  confirmed:  { label: 'Confirmed',      cls: 'bg-blue-100 text-blue-700' },
  processing: { label: 'In Progress',    cls: 'bg-indigo-100 text-indigo-700' },
  shipped:    { label: 'Shipped',        cls: 'bg-purple-100 text-purple-700' },
  delivered:  { label: 'Delivered',      cls: 'bg-green-100 text-green-700' },
  cancelled:  { label: 'Cancelled',      cls: 'bg-red-100 text-red-700' },
}

export default function PortalRequests() {
  const supabase = createClient()
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [clientName, setClientName] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: clientRow } = await supabase
        .from('clients')
        .select('id, company_name')
        .eq('auth_user_id', session.user.id)
        .single()
      if (clientRow) {
        setClientName(clientRow.company_name)
        const { data } = await supabase
          .from('sales_orders')
          .select('id, so_number, so_date, created_at, client_po_number, status, total_amount, remarks')
          .eq('client_name', clientRow.company_name)
          .order('created_at', { ascending: false })
        setOrders(data ?? [])
      }
      setLoading(false)
    }
    init()
  }, [])

  const filtered = filterStatus ? orders.filter(o => o.status === filterStatus) : orders

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Orders</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Purchase requests you have submitted to CDSC</p>
        </div>
        <Link href="/portal/requests/new" className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors">
          <Plus className="h-4 w-4" />New Request
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <Select value={filterStatus || '_all'} onValueChange={(v: string | null) => setFilterStatus(!v || v === '_all' ? '' : v)}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="All status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Status</SelectItem>
            <SelectItem value="draft">Pending Review</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="processing">In Progress</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} order{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">{filterStatus ? 'No orders with this status.' : 'No orders yet.'}</p>
            {!filterStatus && (
              <Link href="/portal/requests/new" className="mt-4 inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors">
                Submit your first request
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(o => {
            const st = STATUS_STYLE[o.status] ?? { label: o.status, cls: 'bg-gray-100 text-gray-600' }
            const date = o.so_date ?? o.created_at
            return (
              <Card key={o.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{o.client_po_number ?? o.so_number ?? '—'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {o.so_number} · Submitted {format(new Date(date), 'MMM d, yyyy')}
                      </div>
                      {o.remarks && <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{o.remarks}</p>}
                      {o.total_amount > 0 && (
                        <div className="text-sm font-semibold text-red-600 mt-1">
                          ₱{o.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
