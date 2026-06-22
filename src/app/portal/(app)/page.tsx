'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import Link from 'next/link'
import {
  ShoppingCart, Clock, Truck, CheckCircle2, Plus, Package,
  ChevronRight, Loader2, FileText,
} from 'lucide-react'

interface SalesOrder {
  id: string
  so_number: string | null
  client_po_number: string | null
  so_date: string | null
  created_at: string
  status: string
  total_amount: number
}

const STATUS: Record<string, { label: string; cls: string }> = {
  draft:      { label: 'Pending Review', cls: 'bg-yellow-100 text-yellow-700' },
  confirmed:  { label: 'Confirmed',      cls: 'bg-blue-100 text-blue-700' },
  processing: { label: 'In Progress',    cls: 'bg-indigo-100 text-indigo-700' },
  shipped:    { label: 'Shipped',        cls: 'bg-purple-100 text-purple-700' },
  delivered:  { label: 'Delivered',      cls: 'bg-green-100 text-green-700' },
  cancelled:  { label: 'Cancelled',      cls: 'bg-red-100 text-red-700' },
}

export default function PortalDashboard() {
  const supabase = createClient()
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [clientName, setClientName] = useState('')
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', session.user.id).single()
      setUserName(profile?.full_name ?? session.user.email?.split('@')[0] ?? '')
      const { data: clientRow } = await supabase.from('clients').select('company_name').eq('auth_user_id', session.user.id).single()
      if (clientRow) {
        setClientName(clientRow.company_name)
        const { data } = await supabase
          .from('sales_orders')
          .select('id, so_number, client_po_number, so_date, created_at, status, total_amount')
          .eq('client_name', clientRow.company_name)
          .order('created_at', { ascending: false })
        setOrders(data ?? [])
      }
      setLoading(false)
    }
    init()
  }, [])

  const total     = orders.length
  const pending   = orders.filter(o => o.status === 'draft').length
  const active    = orders.filter(o => ['confirmed', 'processing', 'shipped'].includes(o.status)).length
  const delivered = orders.filter(o => o.status === 'delivered').length
  const recent    = orders.slice(0, 5)

  const stats = [
    { label: 'Total Orders',    value: total,     icon: ShoppingCart,  color: 'text-gray-700',   bg: 'bg-gray-100' },
    { label: 'Pending Review',  value: pending,   icon: Clock,         color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'In Progress',     value: active,    icon: Truck,         color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: 'Delivered',       value: delivered, icon: CheckCircle2,  color: 'text-green-600',  bg: 'bg-green-50' },
  ]

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back{clientName ? `, ${clientName}` : userName ? `, ${userName}` : ''}!
        </h1>
        <p className="text-sm text-gray-500 mt-1">Here's an overview of your orders with CDSC Industrial Supply.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className={`inline-flex items-center justify-center h-10 w-10 rounded-lg ${s.bg} mb-3`}>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <div className={`text-3xl font-bold ${s.color}`}>{loading ? '—' : s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Link href="/portal/requests/new"
          className="group flex items-center gap-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl p-5 transition-all shadow-sm hover:shadow-md">
          <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Plus className="h-6 w-6" />
          </div>
          <div>
            <div className="font-semibold">New Purchase Order</div>
            <div className="text-sm text-red-100 mt-0.5">Submit a request for products or services</div>
          </div>
          <ChevronRight className="h-5 w-5 ml-auto opacity-60 group-hover:opacity-100 transition-opacity" />
        </Link>

        <Link href="/portal/inventory"
          className="group flex items-center gap-4 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-xl p-5 transition-all">
          <div className="h-12 w-12 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <Package className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-900">Browse Catalog</div>
            <div className="text-sm text-gray-500 mt-0.5">View available products and supplies</div>
          </div>
          <ChevronRight className="h-5 w-5 ml-auto text-gray-300 group-hover:text-gray-500 transition-colors" />
        </Link>
      </div>

      {/* Recent Orders */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Recent Orders</h2>
          <Link href="/portal/requests" className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1">
            View all <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : recent.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-14 text-center">
            <FileText className="h-9 w-9 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-medium">No orders yet</p>
            <p className="text-gray-400 text-xs mt-1">Submit your first purchase order to get started.</p>
            <Link href="/portal/requests/new"
              className="mt-4 inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <Plus className="h-4 w-4" /> New Order
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {recent.map(o => {
              const st = STATUS[o.status] ?? { label: o.status, cls: 'bg-gray-100 text-gray-600' }
              const date = o.so_date ?? o.created_at
              return (
                <Link key={o.id} href="/portal/requests"
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-900">
                        {o.client_po_number ?? o.so_number ?? 'Order'}
                      </span>
                      {o.so_number && o.client_po_number && (
                        <span className="text-xs text-gray-400">{o.so_number}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {format(new Date(date), 'MMM d, yyyy')}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {o.total_amount > 0 && (
                      <span className="text-sm font-semibold text-gray-700 hidden sm:block">
                        ₱{o.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
