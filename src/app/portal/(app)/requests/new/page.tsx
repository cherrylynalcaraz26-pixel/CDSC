'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, ChevronLeft, Send } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface Item {
  description: string
  quantity: string
  unit: string
}

function blankItem(): Item {
  return { description: '', quantity: '1', unit: 'pcs' }
}

const UNITS = ['pcs', 'sets', 'boxes', 'rolls', 'liters', 'kg', 'meters', 'bags', 'pairs', 'units']

export default function NewRequestPage() {
  const supabase = createClient()
  const router = useRouter()
  const [clientId, setClientId] = useState<string | null>(null)
  const [clientName, setClientName] = useState('')
  const [subject, setSubject] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<Item[]>([blankItem()])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/portal/login'); return }
      const { data: clientRow } = await supabase
        .from('clients').select('id, company_name').eq('auth_user_id', session.user.id).single()
      if (clientRow) { setClientId(clientRow.id); setClientName(clientRow.company_name) }
    }
    init()
  }, [])

  function setItem(i: number, k: keyof Item, v: string) {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [k]: v } : item))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim()) { toast.error('Purchase reference is required'); return }
    if (!clientId) { toast.error('Client account not linked'); return }
    const filledItems = items.filter(it => it.description.trim())
    if (filledItems.length === 0) { toast.error('Add at least one item'); return }
    setSubmitting(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const soNumber = `SO-P-${Date.now().toString().slice(-8)}`
      const { data: soData, error: soErr } = await supabase
        .from('sales_orders')
        .insert({
          so_number: soNumber,
          so_date: today,
          client_id: clientId,
          client_name: clientName,
          client_po_number: subject.trim(),
          remarks: notes.trim() || null,
          status: 'draft',
          total_amount: 0,
        })
        .select('id')
        .single()
      if (soErr) throw soErr
      if (soData?.id) {
        const itemRows = filledItems.map(it => ({
          so_id: soData.id,
          item_name: it.description,
          quantity: parseFloat(it.quantity) || 1,
          unit: it.unit,
          unit_price: 0,
          total_amount: 0,
        }))
        const { error: itemErr } = await supabase.from('so_items').insert(itemRows)
        if (itemErr) toast.error(`Items: ${itemErr.message}`)
      }
      toast.success('Order submitted successfully!')
      router.push('/portal/requests')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to submit order')
    }
    setSubmitting(false)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="/portal/requests" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ChevronLeft className="h-4 w-4" /> Back to My Orders
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Purchase Order</h1>
        <p className="text-sm text-gray-500 mt-1">Submit a request for products or services to CDSC Industrial Supply.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Order details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Order Details</h2>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              Purchase Reference / PO Number <span className="text-red-500">*</span>
            </label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g. PO-2024-001 or Project XYZ Supplies"
              className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Additional Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Delivery requirements, project details, special instructions..."
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Items Requested</h2>
              <p className="text-xs text-gray-400 mt-0.5">List the specific products or supplies needed</p>
            </div>
            <button type="button"
              onClick={() => setItems(p => [...p, blankItem()])}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add Item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="flex gap-2 items-start p-3 rounded-lg bg-gray-50 border border-gray-100">
                <div className="flex-1 grid grid-cols-12 gap-2">
                  <div className="col-span-12 sm:col-span-6">
                    <label className="text-xs text-gray-500 mb-1 block">Description</label>
                    <input
                      value={item.description}
                      onChange={e => setItem(i, 'description', e.target.value)}
                      placeholder="Item name or product description"
                      className="w-full h-9 px-2.5 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                  <div className="col-span-5 sm:col-span-3">
                    <label className="text-xs text-gray-500 mb-1 block">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={e => setItem(i, 'quantity', e.target.value)}
                      className="w-full h-9 px-2.5 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                  <div className="col-span-7 sm:col-span-3">
                    <label className="text-xs text-gray-500 mb-1 block">Unit</label>
                    <select
                      value={item.unit}
                      onChange={e => setItem(i, 'unit', e.target.value)}
                      className="w-full h-9 px-2.5 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                {items.length > 1 && (
                  <button type="button"
                    onClick={() => setItems(p => p.filter((_, idx) => idx !== i))}
                    className="mt-5 h-9 w-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button type="button"
            onClick={() => router.push('/portal/requests')}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={submitting}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit Order
          </button>
        </div>
      </form>
    </div>
  )
}
