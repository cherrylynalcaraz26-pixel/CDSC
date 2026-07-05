'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, ChevronLeft, Send, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface Item {
  description: string
  quantity: string
  unit: string
  unit_price: string
  is_custom: boolean
}

interface CatalogItem {
  item_name: string
  item_code: string | null
  unit_of_measure: string | null
  selling_price: number | null
}

interface SysInfo {
  company_name: string
  address: string | null
  phone: string | null
  email: string | null
  logo_url: string | null
  tin: string | null
}

function blankItem(): Item {
  return { description: '', quantity: '1', unit: '', unit_price: '', is_custom: false }
}

// Catalog item names sometimes carry double spaces from data entry —
// normalize to one clean line before showing them.
function cleanText(s: string) {
  return s.replace(/\s+/g, ' ').trim()
}

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
  const [sysInfo, setSysInfo] = useState<SysInfo | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const [{ data: clientRow }, { data: sys }, { data: itemData }] = await Promise.all([
        supabase.from('clients').select('id, company_name').eq('auth_user_id', session.user.id).single(),
        supabase.from('system_settings').select('company_name, address, phone, email, logo_url, tin').single(),
        supabase.from('items').select('item_name, item_code, unit_of_measure, selling_price').eq('status', 'active').order('item_name'),
      ])
      if (clientRow) { setClientId(clientRow.id); setClientName(clientRow.company_name) }
      if (sys) setSysInfo(sys as SysInfo)
      setCatalog((itemData ?? []).map((c: CatalogItem) => ({ ...c, item_name: cleanText(c.item_name) })))
    }
    init()
  }, [])

  function updateItem(i: number, patch: Partial<Item>) {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, ...patch } : item))
  }

  function selectCatalogItem(i: number, itemName: string) {
    if (!itemName) {
      updateItem(i, { description: '', unit: '', unit_price: '', is_custom: false })
      return
    }
    const found = catalog.find(c => c.item_name === itemName)
    updateItem(i, {
      description: itemName,
      unit: found?.unit_of_measure ?? '',
      unit_price: found?.selling_price != null ? String(found.selling_price) : '',
      is_custom: false,
    })
  }

  function setCustomDescription(i: number, val: string) {
    const inCatalog = catalog.some(c => c.item_name === val)
    if (inCatalog) {
      selectCatalogItem(i, val)
    } else {
      updateItem(i, { description: val, unit: items[i].unit, unit_price: '', is_custom: val.trim().length > 0 })
    }
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
          unit: it.unit || null,
          unit_price: parseFloat(it.unit_price) || 0,
          selling_price: it.is_custom ? null : (parseFloat(it.unit_price) || null),
          total_amount: (parseFloat(it.unit_price) || 0) * (parseFloat(it.quantity) || 1),
          is_custom: it.is_custom,
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
  const customCount = items.filter(it => it.is_custom && it.description.trim()).length

  function buildPreviewHtml(): string {
    const fmtN = (n: number) => n.toLocaleString('en-PH', { minimumFractionDigits: 2 })
    const filledItems = items.filter(it => it.description.trim())
    const total = filledItems.reduce((s, it) => s + (parseFloat(it.unit_price) || 0) * (parseFloat(it.quantity) || 1), 0)
    const todayStr = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    const logoUrl = sysInfo?.logo_url ?? '/cdsc-logo.jpg'
    const rows = filledItems.map((it, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
        <td style="padding:4px 6px;color:#9ca3af;text-align:center">${i + 1}</td>
        <td style="padding:4px 6px">${it.description}${it.is_custom ? ' <span style="font-size:8px;font-weight:700;background:#fef3c7;color:#92400e;border:1px solid #fcd34d;border-radius:3px;padding:1px 4px;vertical-align:middle">CUSTOM</span>' : ''}</td>
        <td style="padding:4px 6px;text-align:center">${it.quantity}</td>
        <td style="padding:4px 6px;text-align:center;color:#6b7280">${it.unit || '—'}</td>
        <td style="padding:4px 6px;text-align:right">${it.unit_price ? `₱${fmtN(parseFloat(it.unit_price))}` : it.is_custom ? '<span style="color:#d97706">TBD</span>' : '—'}</td>
        <td style="padding:4px 6px;text-align:right;font-weight:600">${it.is_custom ? '<span style="color:#d97706">—</span>' : it.unit_price ? `₱${fmtN((parseFloat(it.unit_price) || 0) * (parseFloat(it.quantity) || 1))}` : '—'}</td>
      </tr>`).join('')
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;padding:24px;color:#1f2937}
      table{border-collapse:collapse;width:100%}
    </style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:1px solid #e5e7eb;margin-bottom:14px">
      <img src="${logoUrl}" style="width:52px;height:52px;object-fit:cover;border-radius:4px"/>
      <div style="text-align:right">
        <div style="font-size:13px;font-weight:bold;color:#b91c1c;margin-bottom:2px">${sysInfo?.company_name ?? 'CDSC Industrial Supply'}</div>
        <div style="font-size:9px;color:#6b7280">
          ${sysInfo?.address ? `<div>${sysInfo.address}</div>` : ''}
          ${sysInfo?.phone || sysInfo?.email ? `<div>${[sysInfo?.phone, sysInfo?.email].filter(Boolean).join(' | ')}</div>` : ''}
          ${sysInfo?.tin ? `<div>TIN: ${sysInfo.tin}</div>` : ''}
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding-bottom:12px;border-bottom:1px solid #e5e7eb;margin-bottom:14px">
      <div>
        <div style="font-size:9px;font-weight:600;color:#9ca3af;text-transform:uppercase;margin-bottom:2px">Bill To</div>
        <div style="font-weight:bold">${clientName || '—'}</div>
        ${subject ? `<div style="margin-top:6px"><div style="font-size:9px;font-weight:600;color:#9ca3af;text-transform:uppercase">PO Reference</div><div>${subject}</div></div>` : ''}
        ${notes ? `<div style="margin-top:6px"><div style="font-size:9px;font-weight:600;color:#9ca3af;text-transform:uppercase">Remarks</div><div style="font-size:10px">${notes}</div></div>` : ''}
      </div>
      <div style="display:flex;align-items:center;justify-content:center">
        <div style="font-size:16px;font-weight:900;color:#b91c1c;text-transform:uppercase;text-align:center;letter-spacing:2px">Purchase<br/>Order</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:9px;font-weight:600;color:#9ca3af;text-transform:uppercase">Date</div>
        <div>${todayStr}</div>
      </div>
    </div>
    <table style="margin-bottom:8px">
      <thead><tr style="background:#b91c1c;color:#fff">
        <th style="padding:5px 6px;text-align:center;width:28px">#</th>
        <th style="padding:5px 6px;text-align:left">Item Description</th>
        <th style="padding:5px 6px;text-align:center;width:44px">QTY</th>
        <th style="padding:5px 6px;text-align:center;width:52px">Unit</th>
        <th style="padding:5px 6px;text-align:right;width:76px">Unit Price</th>
        <th style="padding:5px 6px;text-align:right;width:76px">Total</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="6" style="padding:16px;text-align:center;color:#9ca3af;font-style:italic">Add items to see preview</td></tr>'}</tbody>
    </table>
    ${total > 0 ? `
    <div style="display:flex;justify-content:flex-end;margin-bottom:20px">
      <div style="width:180px">
        ${customCount > 0 ? `<div style="font-size:9px;color:#d97706;text-align:right;margin-bottom:4px">* Excludes custom items (TBD)</div>` : ''}
        <div style="border-top:1px solid #e5e7eb;padding-top:4px;display:flex;justify-content:space-between;font-weight:bold;font-size:12px">
          <span>Total</span><span style="color:#b91c1c">₱${fmtN(total)}</span>
        </div>
      </div>
    </div>` : ''}
    </body></html>`
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <Link href="/portal/requests" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ChevronLeft className="h-4 w-4" /> Back to My Orders
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Purchase Order</h1>
        <p className="text-sm text-gray-500 mt-1">Submit a request for products or services to CDSC Industrial Supply.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT: Form */}
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

          {/* Custom item warning banner */}
          {customCount > 0 && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <span className="font-semibold">{customCount} custom item{customCount !== 1 ? 's' : ''}</span> in this order.
                Custom items are not in our catalog — our team will review pricing and availability before confirming.
              </div>
            </div>
          )}

          {/* Items */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">Items Requested</h2>
                <p className="text-xs text-gray-400 mt-0.5">Select from catalog — or type a custom item name below the dropdown</p>
                <p className="text-xs text-amber-600 mt-0.5">Selling prices shown are indicative and may change upon order confirmation.</p>
              </div>
              <button type="button"
                onClick={() => setItems(p => [...p, blankItem()])}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors">
                <Plus className="h-3.5 w-3.5" /> Add Item
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, i) => {
                const isCatalog = !item.is_custom && !!item.description
                return (
                  <div key={i} className={`rounded-xl border p-4 space-y-3 ${item.is_custom ? 'border-amber-300 bg-amber-50/40' : 'border-gray-100 bg-gray-50'}`}>
                    {item.is_custom && (
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Custom item — not found in catalog. Unit and pricing to be confirmed by CDSC.
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-500">Item Description</label>
                      <select
                        value={isCatalog ? item.description : ''}
                        onChange={e => selectCatalogItem(i, e.target.value)}
                        className="w-full h-9 px-2.5 rounded-md border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                        <option value="">— Select from catalog —</option>
                        {catalog.map(c => (
                          <option key={c.item_name} value={c.item_name}>{c.item_name}</option>
                        ))}
                      </select>
                      <input
                        value={item.description}
                        onChange={e => setCustomDescription(i, e.target.value)}
                        placeholder="Or type a custom item name…"
                        className={`w-full h-8 px-2.5 rounded-md border text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent ${item.is_custom ? 'border-amber-300 bg-white text-amber-900' : 'border-gray-200 text-gray-600 bg-white'}`}
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
                        <label className="text-xs font-medium text-gray-500">
                          Unit {isCatalog && <span className="text-gray-400 font-normal">(auto)</span>}
                        </label>
                        {item.is_custom ? (
                          <input
                            value={item.unit}
                            onChange={e => updateItem(i, { unit: e.target.value })}
                            placeholder="e.g. pcs"
                            className="w-full h-9 px-2.5 rounded-md border border-amber-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                        ) : (
                          <div className={`h-9 flex items-center px-2.5 rounded-md border text-sm ${item.unit ? 'border-gray-200 bg-gray-100 text-gray-700' : 'border-dashed border-gray-200 text-gray-400 bg-white'}`}>
                            {item.unit || '—'}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-500">
                          Unit Price {isCatalog && <span className="text-gray-400 font-normal">(selling price)</span>}
                          {item.is_custom && <span className="text-amber-600 font-normal"> (TBD)</span>}
                        </label>
                        {item.is_custom ? (
                          <div className="h-9 flex items-center px-2.5 rounded-md border border-dashed border-amber-200 text-sm text-amber-600 bg-amber-50">
                            To be confirmed
                          </div>
                        ) : (
                          <div className={`h-9 flex items-center px-2.5 rounded-md border text-sm font-medium ${item.unit_price ? 'border-gray-200 bg-gray-100 text-gray-800' : 'border-dashed border-gray-200 text-gray-400 bg-white'}`}>
                            {item.unit_price ? `₱${parseFloat(item.unit_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                          </div>
                        )}
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

            {orderTotal > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                <div className="text-sm space-y-1 min-w-[180px]">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal</span><span>{fmt(orderTotal)}</span>
                  </div>
                  {customCount > 0 && (
                    <div className="text-xs text-amber-600 text-right">* Excludes custom items (TBD)</div>
                  )}
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

        {/* RIGHT: Live Preview */}
        <div className="hidden lg:block sticky top-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Live Preview</p>
          <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm bg-white">
            <iframe
              srcDoc={buildPreviewHtml()}
              style={{ width: '100%', minHeight: '560px', border: 'none', display: 'block' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
