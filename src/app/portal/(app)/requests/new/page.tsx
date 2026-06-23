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
  unit_price: string
}

interface CatalogItem {
  item_name: string
  item_code: string | null
  unit_of_measure: string | null
  selling_price: number | null
}

function blankItem(): Item {
  return { description: '', quantity: '1', unit: 'pcs', unit_price: '' }
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
  const [catalog, setCatalog] = useState<CatalogItem[]>([])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: clientRow } = await supabase
        .from('clients').select('id, company_name').eq('auth_user_id', session.user.id).single()
      if (clientRow) { setClientId(clientRow.id); setClientName(clientRow.company_name) }
      const { data: itemData } = await supabase
        .from('items')
        .select('item_name, item_code, unit_of_measure, selling_price')
        .eq('status', 'active')
        .order('item_name')
      setCatalog((itemData ?? []) as CatalogItem[])
    }
    init()
  }, [])

  function setItem(i: number, k: keyof Item, v: string) {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [k]: v } : item))
  }

  function selectCatalogItem(i: number, itemName: string) {
    const found = catalog.find(c => c.item_name === itemName)
    setItems(prev => prev.map((item, idx) => idx === i ? {
      ...item,
      description: itemName,
      unit: found?.unit_of_measure || item.unit,
      unit_price: found?.selling_price != null ? String(found.selling_price) : item.unit_price,
    } : item))
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
          total_amount: filledItems.reduce((s, it) => s + (parseFloat(it.unit_price) || 0) * (parseFloat(it.quantity) || 1), 0),
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
          unit_price: parseFloat(it.unit_price) || 0,
          total_amount: (parseFloat(it.unit_price) || 0) * (parseFloat(it.quantity) || 1),
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

  const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
  const orderTotal = items.reduce((s, it) => s + (parseFloat(it.unit_price) || 0) * (parseFloat(it.quantity) || 0), 0)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
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
              <p className="text-xs text-gray-400 mt-0.5">Select from catalog or type a custom item name</p>
            </div>
            <button type="button"
              onClick={() => setItems(p => [...p, blankItem()])}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add Item
            </button>
          </div>

          {/* Column headers — desktop only */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_80px_100px_110px_36px] gap-2 px-1 mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>Description</span>
            <span className="text-center">Qty</span>
            <span>Unit</span>
            <span className="text-right">Unit Price</span>
            <span />
          </div>

          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_80px_100px_110px_36px] gap-2 items-start p-3 sm:p-2 rounded-lg bg-gray-50 border border-gray-100">

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 sm:hidden font-medium">Description</label>
                  {catalog.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      <select
                        value={catalog.some(c => c.item_name === item.description) ? item.description : ''}
                        onChange={e => {
                          if (e.target.value) selectCatalogItem(i, e.target.value)
                          else setItem(i, 'description', '')
                        }}
                        className="w-full h-9 px-2.5 rounded-md border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                        <option value="">— Select from catalog —</option>
                        {catalog.map(c => (
                          <option key={c.item_name} value={c.item_name}>{c.item_name}</option>
                        ))}
                      </select>
                      <input
                        value={item.description}
                        onChange={e => setItem(i, 'description', e.target.value)}
                        placeholder="Or type a custom item…"
                        className="w-full h-8 px-2.5 rounded-md border border-gray-200 text-xs text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>
                  ) : (
                    <input
                      value={item.description}
                      onChange={e => setItem(i, 'description', e.target.value)}
                      placeholder="Item name or product description"
                      className="w-full h-9 px-2.5 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  )}
                </div>

                {/* Quantity */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 sm:hidden font-medium">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={e => setItem(i, 'quantity', e.target.value)}
                    className="w-full h-9 px-2.5 rounded-md border border-gray-300 text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                {/* Unit */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 sm:hidden font-medium">Unit</label>
                  <select
                    value={item.unit}
                    onChange={e => setItem(i, 'unit', e.target.value)}
                    className="w-full h-9 px-2.5 rounded-md border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    {item.unit && !UNITS.includes(item.unit) && (
                      <option value={item.unit}>{item.unit}</option>
                    )}
                  </select>
                </div>

                {/* Unit Price */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 sm:hidden font-medium">Unit Price (₱)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={e => setItem(i, 'unit_price', e.target.value)}
                    placeholder="0.00"
                    className="w-full h-9 px-2.5 rounded-md border border-gray-300 text-sm text-right focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                {/* Delete */}
                <div className="flex sm:justify-center sm:pt-0">
                  {items.length > 1 ? (
                    <button type="button"
                      onClick={() => setItems(p => p.filter((_, idx) => idx !== i))}
                      className="h-9 w-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : <div className="h-9 w-9" />}
                </div>

              </div>
            ))}
          </div>

          {/* Order total */}
          {orderTotal > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
              <div className="text-sm space-y-1 min-w-[180px]">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span><span>{fmt(orderTotal)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 border-t pt-1.5">
                  <span>Total</span><span className="text-red-600">{fmt(orderTotal)}</span>
                </div>
              </div>
            </div>
          )}
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
