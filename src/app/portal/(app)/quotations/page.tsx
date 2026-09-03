'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { Loader2, FileText, ChevronDown, ChevronUp, Package, CheckCircle, Clock, XCircle, Send, Plus, ClipboardList, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { undoToast } from '@/lib/undo-toast'
import { useSearchContext } from '@/context/search-context'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { RfqFlowStepper } from '@/components/quotation/rfq-flow'
import { getErrorMessage } from '@/lib/error-message'

interface QuoteItem {
  id: string
  item_name: string
  quantity: number
  unit: string | null
  unit_price: number
  selling_price: number | null
  total_amount: number
}

interface Quotation {
  id: string
  quote_number: string | null
  quote_date: string | null
  valid_until: string | null
  client_name: string | null
  subject: string | null
  subtotal: number
  vat_amount: number
  ewt_amount: number
  total_amount: number
  notes: string | null
  status: string
  created_at: string
  quotation_items: QuoteItem[]
}

interface RequestItem {
  id: string
  item_name: string
  quantity: number
  unit: string | null
  unit_price: number | null
  remarks: string | null
}

interface QuotationRequest {
  id: string
  request_number: string
  subject: string
  notes: string | null
  status: string
  quotation_id: string | null
  quote_number: string | null
  created_at: string
  reviewed_at: string | null
  quotation_request_items: RequestItem[]
}

const STATUS: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  sent:     { label: 'Pending Review', cls: 'bg-blue-100 text-blue-700 border-blue-200',   icon: <Send className="h-3 w-3" /> },
  accepted: { label: 'Accepted',       cls: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle className="h-3 w-3" /> },
  declined: { label: 'Declined',       cls: 'bg-red-100 text-red-600 border-red-200',       icon: <XCircle className="h-3 w-3" /> },
  expired:  { label: 'Expired',        cls: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <Clock className="h-3 w-3" /> },
}

const FILTERS = [
  { value: '',         label: 'All' },
  { value: 'sent',     label: 'Pending Review' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired',  label: 'Expired' },
]

const RFQ_STATUS: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending:    { label: 'Request',          cls: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <Clock className="h-3 w-3" /> },
  processing: { label: 'Reviewing',        cls: 'bg-blue-100 text-blue-700 border-blue-200',       icon: <Eye className="h-3 w-3" /> },
  quoted:     { label: 'Sending Quotation', cls: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: <Send className="h-3 w-3" /> },
  done:       { label: 'Done',             cls: 'bg-green-100 text-green-700 border-green-200',    icon: <CheckCircle className="h-3 w-3" /> },
  declined:   { label: 'Declined',         cls: 'bg-red-100 text-red-600 border-red-200',           icon: <XCircle className="h-3 w-3" /> },
}

export default function PortalQuotations() {
  const supabase = createClient()
  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [requests, setRequests] = useState<QuotationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const { query: search } = useSearchContext()
  const [filter, setFilter] = useState('')
  const [rfqFilter, setRfqFilter] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [expandedReq, setExpandedReq] = useState<Set<string>>(new Set())
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: clientRow } = await supabase
        .from('clients').select('id, company_name').eq('auth_user_id', session.user.id).single()
      if (clientRow) {
        const [{ data }, { data: reqData }] = await Promise.all([
          supabase
            .from('quotations')
            .select('id, quote_number, quote_date, valid_until, client_name, subject, subtotal, vat_amount, ewt_amount, total_amount, notes, status, created_at, quotation_items(id, item_name, quantity, unit, unit_price, selling_price, total_amount)')
            .eq('client_name', clientRow.company_name)
            .neq('status', 'draft')
            .order('created_at', { ascending: false }),
          supabase
            .from('quotation_requests')
            .select('id, request_number, subject, notes, status, quotation_id, quote_number, created_at, reviewed_at, quotation_request_items(id, item_name, quantity, unit, unit_price, remarks)')
            .eq('client_id', clientRow.id)
            .order('created_at', { ascending: false }),
        ])
        setQuotations((data ?? []) as unknown as Quotation[])
        setRequests((reqData ?? []) as unknown as QuotationRequest[])
      }
      setLoading(false)
    }
    init()
  }, [])

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleExpandReq(id: string) {
    setExpandedReq(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function updateStatus(id: string, status: 'accepted' | 'declined') {
    setUpdatingId(id)
    const prevStatus = quotations.find(q => q.id === id)?.status
    const { error } = await supabase.from('quotations').update({ status }).eq('id', id)
    if (error) toast.error(getErrorMessage(error))
    else {
      setQuotations(prev => prev.map(q => q.id === id ? { ...q, status } : q))
      undoToast(status === 'accepted' ? 'Quotation accepted' : 'Quotation declined', async () => {
        if (!prevStatus) return
        await supabase.from('quotations').update({ status: prevStatus }).eq('id', id)
        setQuotations(prev => prev.map(q => q.id === id ? { ...q, status: prevStatus } : q))
      })
    }
    setUpdatingId(null)
  }

  const filtered = quotations.filter(q => {
    const s = search.toLowerCase()
    const matchSearch = !s ||
      (q.quote_number ?? '').toLowerCase().includes(s) ||
      (q.subject ?? '').toLowerCase().includes(s) ||
      (q.notes ?? '').toLowerCase().includes(s) ||
      (q.client_name ?? '').toLowerCase().includes(s) ||
      (q.status ? (STATUS[q.status]?.label ?? q.status).toLowerCase().includes(s) : false) ||
      q.quotation_items.some(i => i.item_name.toLowerCase().includes(s) || (i.unit ?? '').toLowerCase().includes(s))
    const matchFilter = !filter || q.status === filter
    return matchSearch && matchFilter
  })

  const filteredRequests = requests.filter(r => {
    const s = search.toLowerCase()
    const matchSearch = !s ||
      r.request_number.toLowerCase().includes(s) ||
      r.subject.toLowerCase().includes(s) ||
      (r.notes ?? '').toLowerCase().includes(s) ||
      (RFQ_STATUS[r.status]?.label ?? r.status).toLowerCase().includes(s) ||
      r.quotation_request_items.some(i => i.item_name.toLowerCase().includes(s))
    const matchFilter = !rfqFilter || r.status === rfqFilter
    return matchSearch && matchFilter
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotations</h1>
          <p className="text-sm text-gray-500 mt-0.5">Quotations issued to you, and your requests for pricing</p>
        </div>
        <Link href="/portal/quotations/new"
          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          <Plus className="h-4 w-4" /> Request a Quotation
        </Link>
      </div>

      <Tabs defaultValue="quotations">
        <TabsList>
          <TabsTrigger value="quotations" className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />Quotations
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />My Requests
            {!loading && requests.length > 0 && (
              <span className="ml-1 text-[10px] opacity-70">{requests.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quotations" className="space-y-6 mt-4">
      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={cn(
              'px-3.5 py-1.5 text-sm rounded-lg font-medium transition-colors',
              filter === f.value
                ? 'bg-red-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            )}>
            {f.label}
            {f.value === '' && !loading && (
              <span className="ml-1.5 text-xs opacity-70">{quotations.length}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <FileText className="h-9 w-9 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">
            {filter ? 'No quotations with this status.' : 'No quotations yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(q => {
            const st = STATUS[q.status] ?? { label: q.status, cls: 'bg-gray-100 text-gray-600 border-gray-200', icon: null }
            const date = q.quote_date ?? q.created_at
            const isOpen = expanded.has(q.id)
            const hasItems = q.quotation_items?.length > 0
            const hasVat = (q.vat_amount ?? 0) > 0
            const hasEwt = (q.ewt_amount ?? 0) > 0

            return (
              <div key={q.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm font-mono">
                          {q.quote_number ?? 'Quotation'}
                        </span>
                        <span className={cn('text-xs px-2.5 py-0.5 rounded-full font-medium border flex items-center gap-1', st.cls)}>
                          {st.icon}{st.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-xs text-gray-400">
                          Issued {format(new Date(date), 'MMM d, yyyy')}
                        </span>
                        {q.valid_until && (
                          <span className="text-xs text-gray-400">
                            Valid until {format(new Date(q.valid_until), 'MMM d, yyyy')}
                          </span>
                        )}
                        {q.total_amount > 0 && (
                          <span className="text-sm font-semibold text-red-600">
                            ₱{q.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                      {q.subject && (
                        <p className="text-xs text-gray-600 mt-1 font-medium">{q.subject}</p>
                      )}
                      {q.notes && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{q.notes}</p>
                      )}
                    </div>
                    {hasItems && (
                      <button
                        onClick={() => toggleExpand(q.id)}
                        className="shrink-0 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                        {isOpen ? (
                          <><ChevronUp className="h-3.5 w-3.5" />Hide items</>
                        ) : (
                          <><ChevronDown className="h-3.5 w-3.5" />View items</>
                        )}
                      </button>
                    )}
                  </div>
                  {q.status === 'sent' && (
                    <div className="flex gap-2 justify-end mt-3 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => updateStatus(q.id, 'declined')}
                        disabled={updatingId === q.id}
                        className="inline-flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 disabled:opacity-60 text-gray-700 text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors">
                        {updatingId === q.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                        Mark as Declined
                      </button>
                      <button
                        onClick={() => updateStatus(q.id, 'accepted')}
                        disabled={updatingId === q.id}
                        className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors">
                        {updatingId === q.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                        Mark as Accepted
                      </button>
                    </div>
                  )}
                </div>

                {isOpen && hasItems && (
                  <div className="border-t border-gray-100 bg-gray-50">
                    <div className="px-5 py-3">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <Package className="h-3 w-3" />Items
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-gray-400">
                              <th className="text-left pb-2 font-medium pr-4">Item</th>
                              <th className="text-right pb-2 font-medium pr-4">Qty</th>
                              <th className="text-left pb-2 font-medium pr-4">Unit</th>
                              <th className="text-right pb-2 font-medium pr-4">Unit Price</th>
                              <th className="text-right pb-2 font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {q.quotation_items.map(item => {
                              const price = item.selling_price ?? item.unit_price
                              return (
                                <tr key={item.id}>
                                  <td className="py-2 pr-4 font-medium text-gray-800">{item.item_name}</td>
                                  <td className="py-2 pr-4 text-right text-gray-600">{item.quantity}</td>
                                  <td className="py-2 pr-4 text-gray-500">{item.unit ?? '—'}</td>
                                  <td className="py-2 pr-4 text-right text-gray-600">
                                    {price > 0 ? `₱${price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                                  </td>
                                  <td className="py-2 text-right font-semibold text-gray-800">
                                    {item.total_amount > 0
                                      ? `₱${item.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                                      : '—'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      {/* Totals */}
                      <div className="flex justify-end mt-3">
                        <div className="w-52 space-y-1 text-xs">
                          <div className="flex justify-between text-gray-500">
                            <span>Subtotal</span>
                            <span>₱{q.subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                          </div>
                          {hasVat && (
                            <div className="flex justify-between text-gray-500">
                              <span>VAT (12%)</span>
                              <span className="text-blue-600">₱{q.vat_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}
                          {hasEwt && (
                            <div className="flex justify-between text-gray-500">
                              <span>EWT</span>
                              <span className="text-red-600">−₱{q.ewt_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-gray-200 pt-1 font-bold text-sm text-gray-900">
                            <span>Total</span>
                            <span className="text-red-600">₱{q.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-6 mt-4">
          {/* RFQ Filter tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {[{ value: '', label: 'All' }, ...Object.entries(RFQ_STATUS).map(([value, cfg]) => ({ value, label: cfg.label }))].map(f => (
              <button key={f.value} onClick={() => setRfqFilter(f.value)}
                className={cn(
                  'px-3.5 py-1.5 text-sm rounded-lg font-medium transition-colors',
                  rfqFilter === f.value
                    ? 'bg-red-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                )}>
                {f.label}
                {f.value === '' && !loading && (
                  <span className="ml-1.5 text-xs opacity-70">{requests.length}</span>
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
              <ClipboardList className="h-9 w-9 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">
                {rfqFilter ? 'No requests with this status.' : 'No requests for quotation yet.'}
              </p>
              {!rfqFilter && (
                <Link href="/portal/quotations/new"
                  className="mt-4 inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                  <Plus className="h-4 w-4" /> Submit your first request
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map(r => {
                const isOpen = expandedReq.has(r.id)
                const hasItems = r.quotation_request_items?.length > 0
                const hasPricing = r.quotation_request_items?.some(i => i.unit_price != null)

                return (
                  <div key={r.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm font-mono">
                              {r.request_number}
                            </span>
                          </div>
                          <div className="mt-2">
                            <RfqFlowStepper status={r.status} variant="client" compact />
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className="text-xs text-gray-400">
                              Submitted {format(new Date(r.created_at), 'MMM d, yyyy')}
                            </span>
                            {r.quote_number && r.status !== 'pending' && r.status !== 'processing' && (
                              <span className="text-xs font-semibold text-indigo-700">
                                Quotation {r.quote_number} sent — see it in the Quotations tab
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mt-1 font-medium">{r.subject}</p>
                          {r.notes && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{r.notes}</p>
                          )}
                        </div>
                        {hasItems && (
                          <button
                            onClick={() => toggleExpandReq(r.id)}
                            className="shrink-0 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                            {isOpen ? (
                              <><ChevronUp className="h-3.5 w-3.5" />Hide items</>
                            ) : (
                              <><ChevronDown className="h-3.5 w-3.5" />View items</>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {isOpen && hasItems && (
                      <div className="border-t border-gray-100 bg-gray-50">
                        <div className="px-5 py-3">
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <Package className="h-3 w-3" />Items Requested
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-xs text-gray-400">
                                  <th className="text-left pb-2 font-medium pr-4">Item</th>
                                  <th className="text-right pb-2 font-medium pr-4">Qty</th>
                                  <th className="text-left pb-2 font-medium pr-4">Unit</th>
                                  {hasPricing && <th className="text-right pb-2 font-medium pr-4">Quoted Price</th>}
                                  <th className="text-left pb-2 font-medium">Remarks</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {r.quotation_request_items.map(item => (
                                  <tr key={item.id}>
                                    <td className="py-2 pr-4 font-medium text-gray-800">{item.item_name}</td>
                                    <td className="py-2 pr-4 text-right text-gray-600">{item.quantity}</td>
                                    <td className="py-2 pr-4 text-gray-500">{item.unit ?? '—'}</td>
                                    {hasPricing && (
                                      <td className="py-2 pr-4 text-right text-gray-600">
                                        {item.unit_price != null ? `₱${item.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                                      </td>
                                    )}
                                    <td className="py-2 text-gray-500">{item.remarks ?? '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
