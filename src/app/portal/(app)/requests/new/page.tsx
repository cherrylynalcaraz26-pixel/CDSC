'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2, ChevronLeft, Send, AlertTriangle, X, Search, Package, ImagePlus, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { uploadImageToDrive } from '@/lib/upload-image'

const MAX_LINE_ITEMS = 50

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
  image_url: string | null
}

interface BrandOption { id: string; name: string }
interface UOMOption { id: string; code: string; name: string }
interface AttributeOption { id: string; name: string; data_type: string; options: string[] | null }
interface SuggestionImage { file: File; preview: string }

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

function blankCustomForm() {
  return { item_name: '', description: '', brand: '', unit_of_measure: '', selling_price: '', notes: '' }
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
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [sysInfo, setSysInfo] = useState<SysInfo | null>(null)
  const [itemSearchIdx, setItemSearchIdx] = useState<number | null>(null)
  const [itemQuery, setItemQuery] = useState('')

  // Custom item suggestion modal
  const [brandList, setBrandList] = useState<BrandOption[]>([])
  const [uomList, setUomList] = useState<UOMOption[]>([])
  const [attributeList, setAttributeList] = useState<AttributeOption[]>([])
  const [customModalIdx, setCustomModalIdx] = useState<number | null>(null)
  const [customForm, setCustomForm] = useState(blankCustomForm())
  const [customAttrTypeId, setCustomAttrTypeId] = useState('')
  const [customAttrValue, setCustomAttrValue] = useState('')
  const [customImages, setCustomImages] = useState<SuggestionImage[]>([])
  const [submittingCustom, setSubmittingCustom] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const [{ data: clientRow }, { data: sys }, { data: itemData }, { data: brandData }, { data: uomData }, { data: attrData }] = await Promise.all([
        supabase.from('clients').select('id, company_name').eq('auth_user_id', session.user.id).single(),
        supabase.from('system_settings').select('company_name, address, phone, email, logo_url, tin').single(),
        supabase.from('items').select('item_name, item_code, unit_of_measure, selling_price, image_url').eq('status', 'active').order('item_name'),
        supabase.from('brands').select('id, name').eq('is_active', true).order('name'),
        supabase.from('uom_list').select('id, code, name').eq('is_active', true).order('code'),
        supabase.from('attributes').select('id, name, data_type, options').eq('is_active', true).order('name'),
      ])
      if (clientRow) { setClientId(clientRow.id); setClientName(clientRow.company_name) }
      if (sys) setSysInfo(sys as SysInfo)
      setCatalog((itemData ?? []).map((c: CatalogItem) => ({ ...c, item_name: cleanText(c.item_name) })))
      setBrandList(brandData ?? [])
      setUomList(uomData ?? [])
      setAttributeList((attrData ?? []) as AttributeOption[])
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

  function clearCustom(i: number) {
    updateItem(i, { is_custom: false, description: '', unit: '', unit_price: '' })
  }

  function openCustomModal(i: number) {
    setCustomModalIdx(i)
    setCustomForm(blankCustomForm())
    setCustomAttrTypeId('')
    setCustomAttrValue('')
    setCustomImages([])
  }

  function handleCustomImagesSelect(files: File[]) {
    setCustomImages(prev => [...prev, ...files.map(file => ({ file, preview: URL.createObjectURL(file) }))].slice(0, 3))
  }

  function removeCustomImage(idx: number) {
    setCustomImages(prev => prev.filter((_, i) => i !== idx))
  }

  const customAttrType = attributeList.find(a => a.id === customAttrTypeId) ?? null
  const customAttrHasOptions = customAttrType?.data_type === 'select' && (customAttrType.options?.length ?? 0) > 0

  async function submitCustomModal() {
    if (customModalIdx === null) return
    if (!customForm.item_name.trim()) { toast.error('Item name is required'); return }
    if (!clientId) { toast.error('Client account not linked'); return }
    setSubmittingCustom(true)
    try {
      const imageUrls: string[] = []
      for (const img of customImages) {
        const uploaded = await uploadImageToDrive(img.file, { displayName: `${customForm.item_name.trim()}-${imageUrls.length + 1}`, folder: 'ItemSuggestions' })
        imageUrls.push(uploaded)
      }
      const { error } = await supabase.from('item_suggestions').insert({
        client_id: clientId,
        client_name: clientName,
        item_name: customForm.item_name.trim(),
        description: customForm.description.trim() || null,
        brand: customForm.brand || null,
        unit_of_measure: customForm.unit_of_measure || null,
        attribute: customAttrValue || null,
        selling_price: customForm.selling_price ? parseFloat(customForm.selling_price) : null,
        image_urls: imageUrls,
        notes: customForm.notes.trim() || null,
        status: 'pending',
      })
      if (error) throw error
      updateItem(customModalIdx, {
        is_custom: true,
        description: customForm.item_name.trim(),
        unit: customForm.unit_of_measure || '',
        unit_price: '',
      })
      toast.success('Item suggestion sent to CDSC for review')
      setCustomModalIdx(null)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit item suggestion')
    }
    setSubmittingCustom(false)
  }

  function handleLineCountChange(value: string) {
    const n = parseInt(value, 10)
    if (!n || n < 1) return
    const capped = Math.min(n, MAX_LINE_ITEMS)
    setItems(prev => capped > prev.length
      ? [...prev, ...Array.from({ length: capped - prev.length }, blankItem)]
      : prev.slice(0, capped))
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
      const { data: soData, error: soErr } = await supabase
        .from('sales_orders')
        .insert({
          so_date: today,
          client_id: clientId,
          client_name: clientName,
          client_po_number: subject.trim(),
          remarks: notes.trim() || null,
          status: 'draft',
          show_in_portal: true,
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
  const filteredCatalog = itemQuery.trim()
    ? catalog.filter(c => c.item_name.toLowerCase().includes(itemQuery.toLowerCase()))
    : catalog

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
                Custom items aren&apos;t in our catalog yet — details were sent to CDSC for review, and pricing will be confirmed before this order is processed.
              </div>
            </div>
          )}

          {/* Items */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">Items Requested</h2>
                <p className="text-xs text-gray-400 mt-0.5">Select from catalog, search inventory, or mark as custom</p>
                <p className="text-xs text-amber-600 mt-0.5">Selling prices shown are indicative and may change upon order confirmation.</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600 whitespace-nowrap">No. of Line Items</label>
                <input
                  type="number"
                  min={1}
                  max={MAX_LINE_ITEMS}
                  value={items.length}
                  onChange={e => handleLineCountChange(e.target.value)}
                  className="w-16 h-8 px-2 rounded-md border border-gray-300 text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className={`rounded-xl border p-3 ${item.is_custom ? 'border-amber-300 bg-amber-50/40' : 'border-gray-100 bg-gray-50'}`}>
                  {item.is_custom && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 mb-2">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Custom item — submitted to CDSC for review. Pricing and availability to be confirmed.
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 items-end">
                    <div className="flex-1 min-w-[280px] space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-medium text-gray-500">Item Description</label>
                        <button type="button"
                          onClick={() => item.is_custom ? clearCustom(i) : openCustomModal(i)}
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-md border shrink-0 transition-colors ${item.is_custom ? 'border-amber-400 bg-amber-100 text-amber-800 hover:bg-amber-200' : 'border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
                          {item.is_custom ? 'Remove' : 'Custom'}
                        </button>
                      </div>
                      {item.is_custom ? (
                        <div className="h-9 flex items-center px-2.5 rounded-md border border-amber-300 bg-white text-sm text-amber-900 truncate">
                          {item.description}
                        </div>
                      ) : (
                        <div className="flex gap-1.5">
                          <select
                            value={item.description}
                            onChange={e => selectCatalogItem(i, e.target.value)}
                            className="flex-1 min-w-0 h-9 px-2.5 rounded-md border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                            <option value="">— Select from catalog —</option>
                            {catalog.map(c => (
                              <option key={c.item_name} value={c.item_name}>{c.item_name}</option>
                            ))}
                          </select>
                          <button type="button"
                            onClick={() => { setItemSearchIdx(i); setItemQuery('') }}
                            title="Search inventory"
                            className="h-9 w-9 shrink-0 flex items-center justify-center rounded-md border border-gray-300 text-gray-500 hover:bg-gray-100 transition-colors">
                            <Search className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="w-16 shrink-0 space-y-1">
                      <label className="text-xs font-medium text-gray-500">Qty</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => updateItem(i, { quantity: e.target.value })}
                        className="w-full h-9 px-2.5 rounded-md border border-gray-300 text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>

                    <div className="w-20 shrink-0 space-y-1">
                      <label className="text-xs font-medium text-gray-500">Unit</label>
                      <div className={`h-9 flex items-center px-2.5 rounded-md border text-sm ${item.unit ? 'border-gray-200 bg-gray-100 text-gray-700' : 'border-dashed border-gray-200 text-gray-400 bg-white'}`}>
                        {item.unit || '—'}
                      </div>
                    </div>

                    <div className="w-28 shrink-0 space-y-1">
                      <label className="text-xs font-medium text-gray-500">Selling Price</label>
                      {item.is_custom ? (
                        <div className="h-9 flex items-center px-2.5 rounded-md border border-dashed border-amber-200 text-xs text-amber-600 bg-amber-50">
                          To be confirmed
                        </div>
                      ) : (
                        <div className={`h-9 flex items-center px-2.5 rounded-md border text-sm font-medium ${item.unit_price ? 'border-gray-200 bg-gray-100 text-gray-800' : 'border-dashed border-gray-200 text-gray-400 bg-white'}`}>
                          {item.unit_price ? `₱${parseFloat(item.unit_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—'}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0">
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
              ))}
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
              onClick={() => setShowCancelConfirm(true)}
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

      {/* Discard confirmation modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => { if (e.target === e.currentTarget) setShowCancelConfirm(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-bold text-gray-900">Discard this order?</h3>
              <button onClick={() => setShowCancelConfirm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-700">You have unsaved changes. If you leave now, this order will not be submitted.</p>
            </div>
            <div className="px-6 pb-5 flex gap-3 justify-end border-t pt-3">
              <button onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Keep Editing
              </button>
              <button onClick={() => router.push('/portal/requests')}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item search modal */}
      {itemSearchIdx !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => { if (e.target === e.currentTarget) setItemSearchIdx(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '80vh' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Package className="h-4 w-4 text-red-600" /> Choose an Item
              </h3>
              <button onClick={() => setItemSearchIdx(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-3 border-b shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  autoFocus
                  value={itemQuery}
                  onChange={e => setItemQuery(e.target.value)}
                  placeholder="Search items…"
                  className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y">
              {filteredCatalog.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">No items found</div>
              ) : filteredCatalog.map(c => (
                <button key={c.item_name} type="button"
                  onClick={() => { selectCatalogItem(itemSearchIdx, c.item_name); setItemSearchIdx(null) }}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 text-left transition-colors">
                  <div className="h-10 w-10 rounded-lg border bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                    {c.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image_url} alt={c.item_name} className="h-full w-full object-contain p-1" />
                    ) : (
                      <Package className="h-4 w-4 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{c.item_name}</div>
                    <div className="text-xs text-gray-400">{c.unit_of_measure || '—'}</div>
                  </div>
                  <div className="text-sm font-semibold text-red-600 shrink-0">
                    {c.selling_price != null ? fmt(c.selling_price) : '—'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Custom item suggestion modal */}
      {customModalIdx !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => { if (e.target === e.currentTarget && !submittingCustom) setCustomModalIdx(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '90vh' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-red-600" /> Suggest a Custom Item
              </h3>
              <button onClick={() => setCustomModalIdx(null)} disabled={submittingCustom} className="text-gray-400 hover:text-gray-600 disabled:opacity-40">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <p className="text-xs text-gray-500">
                Not in our catalog? Tell us what you need and our team will review it — accepted items get added to our catalog for future orders.
              </p>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Item Name <span className="text-red-500">*</span></label>
                <input
                  autoFocus
                  value={customForm.item_name}
                  onChange={e => setCustomForm(p => ({ ...p, item_name: e.target.value }))}
                  placeholder="e.g. Industrial Safety Helmet"
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Description</label>
                <textarea
                  rows={2}
                  value={customForm.description}
                  onChange={e => setCustomForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Specs, size, color, model number, etc."
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Brand</label>
                  <select
                    value={customForm.brand}
                    onChange={e => setCustomForm(p => ({ ...p, brand: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                    <option value="">— None —</option>
                    {brandList.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Unit of Measure</label>
                  <select
                    value={customForm.unit_of_measure}
                    onChange={e => setCustomForm(p => ({ ...p, unit_of_measure: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                    <option value="">— Select —</option>
                    {uomList.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Attribute</label>
                  <select
                    value={customAttrTypeId}
                    onChange={e => { setCustomAttrTypeId(e.target.value); setCustomAttrValue('') }}
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                    <option value="">— None —</option>
                    {attributeList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                {customAttrTypeId && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">{customAttrType?.name} Value</label>
                    {customAttrHasOptions ? (
                      <select
                        value={customAttrValue}
                        onChange={e => setCustomAttrValue(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500">
                        <option value="">— Select —</option>
                        {customAttrType?.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      <input
                        value={customAttrValue}
                        onChange={e => setCustomAttrValue(e.target.value)}
                        placeholder={`Enter ${customAttrType?.name ?? 'value'}…`}
                        className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Suggested Selling Price (₱)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={customForm.selling_price}
                  onChange={e => setCustomForm(p => ({ ...p, selling_price: e.target.value }))}
                  placeholder="Optional — your expected price"
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Pictures</label>
                <div className="flex flex-wrap items-center gap-2">
                  {customImages.map((img, idx) => (
                    <div key={idx} className="relative h-16 w-16 rounded-lg border bg-gray-50 overflow-hidden shrink-0 group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.preview} alt={`Picture ${idx + 1}`} className="h-full w-full object-contain p-1" />
                      <button
                        type="button"
                        onClick={() => removeCustomImage(idx)}
                        className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                  {customImages.length < 3 && (
                    <button
                      type="button"
                      onClick={() => document.getElementById('custom-item-picture-input')?.click()}
                      className="h-16 w-16 rounded-lg border border-dashed flex items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors shrink-0"
                    >
                      <ImagePlus className="h-4 w-4" />
                    </button>
                  )}
                  <input
                    id="custom-item-picture-input"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) handleCustomImagesSelect(files); e.target.value = '' }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Notes for CDSC</label>
                <textarea
                  rows={2}
                  value={customForm.notes}
                  onChange={e => setCustomForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Urgency, sourcing hints, or anything else we should know"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t shrink-0 flex justify-end gap-2">
              <button type="button" onClick={() => setCustomModalIdx(null)} disabled={submittingCustom}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40">
                Cancel
              </button>
              <button type="button" onClick={submitCustomModal} disabled={submittingCustom}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
                {submittingCustom ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit for Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
