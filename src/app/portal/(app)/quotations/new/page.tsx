'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, ChevronLeft, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { getErrorMessage } from '@/lib/error-message'

interface RequestItem {
  item_name: string
  quantity: string
  unit: string
  remarks: string
}

interface CatalogItem {
  item_name: string
  unit_of_measure: string | null
}

function blankItem(): RequestItem {
  return { item_name: '', quantity: '1', unit: '', remarks: '' }
}

function cleanText(s: string) {
  return s.replace(/\s+/g, ' ').trim()
}

export default function NewQuotationRequestPage() {
  const supabase = createClient()
  const router = useRouter()
  const [clientId, setClientId] = useState<string | null>(null)
  const [clientName, setClientName] = useState('')
  const [subject, setSubject] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<RequestItem[]>([blankItem()])
  const [submitting, setSubmitting] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [catalog, setCatalog] = useState<CatalogItem[]>([])

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const [{ data: clientRow }, { data: itemData }] = await Promise.all([
        supabase.from('clients').select('id, company_name').eq('auth_user_id', session.user.id).single(),
        supabase.from('items').select('item_name, unit_of_measure').eq('status', 'active').order('item_name'),
      ])
      if (clientRow) { setClientId(clientRow.id); setClientName(clientRow.company_name) }
      setCatalog((itemData ?? []).map((c: CatalogItem) => ({ ...c, item_name: cleanText(c.item_name) })))
    }
    init()
  }, [])

  function updateItem(i: number, patch: Partial<RequestItem>) {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, ...patch } : item))
  }

  function selectCatalogItem(i: number, itemName: string) {
    if (!itemName) { updateItem(i, { item_name: '', unit: '' }); return }
    const found = catalog.find(c => c.item_name === itemName)
    updateItem(i, { item_name: itemName, unit: found?.unit_of_measure ?? '' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim()) { toast.error('Subject is required'); return }
    if (!clientId) { toast.error('Client account not linked'); return }
    const filledItems = items.filter(it => it.item_name.trim())
    if (filledItems.length === 0) { toast.error('Add at least one item'); return }
    setSubmitting(true)
    try {
      const requestNumber = `RFQ-${Date.now().toString().slice(-8)}`
      const { data: reqData, error: reqErr } = await supabase
        .from('quotation_requests')
        .insert({
          request_number: requestNumber,
          client_id: clientId,
          client_name: clientName,
          subject: subject.trim(),
          notes: notes.trim() || null,
          status: 'pending',
        })
        .select('id')
        .single()
      if (reqErr) throw reqErr
      if (reqData?.id) {
        const itemRows = filledItems.map(it => ({
          request_id: reqData.id,
          item_name: it.item_name,
          quantity: parseFloat(it.quantity) || 1,
          unit: it.unit || null,
          remarks: it.remarks.trim() || null,
        }))
        const { error: itemErr } = await supabase.from('quotation_request_items').insert(itemRows)
        if (itemErr) toast.error(`Items: ${getErrorMessage(itemErr)}`)
      }
      toast.success('Request for quotation submitted!')
      router.push('/portal/quotations')
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to submit request'))
    }
    setSubmitting(false)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link href="/portal/quotations" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ChevronLeft className="h-4 w-4" /> Back to Quotations
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Request for Quotation</h1>
        <p className="text-sm text-gray-500 mt-1">Tell us what you need and we&apos;ll send you a formal price quotation.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Request details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Request Details</h2>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Quote for Q1 Office Supplies"
              className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Additional Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Budget, timeline, delivery requirements, special instructions..."
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Items to Quote</h2>
              <p className="text-xs text-gray-400 mt-0.5">Select from catalog — or type a custom item name</p>
            </div>
            <button type="button"
              onClick={() => setItems(p => [...p, blankItem()])}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add Item
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, i) => {
              const isCatalog = catalog.some(c => c.item_name === item.item_name)
              return (
                <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-500">Item Description</label>
                    <select
                      value={isCatalog ? item.item_name : ''}
                      onChange={e => selectCatalogItem(i, e.target.value)}
                      className="w-full h-9 px-2.5 rounded-md border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                      <option value="">— Select from catalog —</option>
                      {catalog.map(c => (
                        <option key={c.item_name} value={c.item_name}>{c.item_name}</option>
                      ))}
                    </select>
                    <input
                      value={item.item_name}
                      onChange={e => updateItem(i, { item_name: e.target.value })}
                      placeholder="Or type a custom item name…"
                      className="w-full h-8 px-2.5 rounded-md border border-gray-200 text-xs bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-[80px_1fr_1fr_36px] gap-2 items-end">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500">Qty</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => updateItem(i, { quantity: e.target.value })}
                        className="w-full h-9 px-2.5 rounded-md border border-gray-300 text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500">Unit</label>
                      <input
                        value={item.unit}
                        onChange={e => updateItem(i, { unit: e.target.value })}
                        placeholder="e.g. pcs"
                        className="w-full h-9 px-2.5 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500">Remarks</label>
                      <input
                        value={item.remarks}
                        onChange={e => updateItem(i, { remarks: e.target.value })}
                        placeholder="Optional"
                        className="w-full h-9 px-2.5 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      {items.length > 1 ? (
                        <button type="button"
                          onClick={() => setItems(p => p.filter((_, idx) => idx !== i))}
                          className="h-9 w-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : <div className="h-9 w-9" />}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button type="button"
            onClick={() => setShowCancelConfirm(true)}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={submitting}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit Request
          </button>
        </div>
      </form>

      {/* Discard confirmation modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => { if (e.target === e.currentTarget) setShowCancelConfirm(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-bold text-gray-900">Discard this request?</h3>
              <button onClick={() => setShowCancelConfirm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-700">You have unsaved changes. If you leave now, this request will not be submitted.</p>
            </div>
            <div className="px-6 pb-5 flex gap-3 justify-end border-t pt-3">
              <button onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Keep Editing
              </button>
              <button onClick={() => router.push('/portal/quotations')}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
