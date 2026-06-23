'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Package, Loader2, Search, AlertTriangle, ArrowDownCircle, ArrowUpCircle,
  SlidersHorizontal, History, ChevronDown, ChevronUp, X, Check
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface StockRow {
  id: string
  item_name: string
  item_code: string | null
  unit: string | null
  quantity_on_hand: number
  low_stock_threshold: number
}

interface TxRow {
  id: string
  item_name: string
  unit: string | null
  transaction_type: string
  quantity: number
  issued_to: string | null
  department: string | null
  notes: string | null
  reference_no: string | null
  created_at: string
}

type ModalType = 'receive' | 'issue' | 'adjust' | null

export default function PortalStockPage() {
  const supabase = createClient()
  const router = useRouter()
  const [clientId, setClientId] = useState<string | null>(null)
  const [stock, setStock] = useState<StockRow[]>([])
  const [transactions, setTransactions] = useState<TxRow[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalType>(null)
  const [selectedItem, setSelectedItem] = useState<StockRow | null>(null)
  const [historyItem, setHistoryItem] = useState<StockRow | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [thresholdItem, setThresholdItem] = useState<StockRow | null>(null)

  // Item search dropdown state
  const [itemSearch, setItemSearch] = useState('')
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false)

  // Form fields
  const [txItemName, setTxItemName] = useState('')
  const [txUnit, setTxUnit] = useState('')
  const [txQty, setTxQty] = useState('1')
  const [txIssuedTo, setTxIssuedTo] = useState('')
  const [txDepartment, setTxDepartment] = useState('')
  const [txNotes, setTxNotes] = useState('')
  const [txRef, setTxRef] = useState('')
  const [newThreshold, setNewThreshold] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: clientRow } = await supabase.from('clients').select('id').eq('auth_user_id', session.user.id).single()
      if (!clientRow) { router.push('/login'); return }
      setClientId(clientRow.id)
      await fetchData(clientRow.id)
    }
    init()
  }, [])

  async function fetchData(cid: string) {
    setLoading(true)
    const [{ data: stockData }, { data: txData }, { data: deptData }] = await Promise.all([
      supabase.from('client_inventory').select('*').eq('client_id', cid).order('item_name'),
      supabase.from('client_inventory_transactions').select('*').eq('client_id', cid).order('created_at', { ascending: false }).limit(100),
      supabase.from('client_departments').select('name').eq('client_id', cid).order('name'),
    ])
    setStock(stockData ?? [])
    setTransactions(txData ?? [])
    setDepartments((deptData ?? []).map((d: any) => d.name))
    setLoading(false)
  }

  function openModal(type: ModalType, item?: StockRow) {
    setModal(type)
    setSelectedItem(item ?? null)
    setTxItemName(item?.item_name ?? '')
    setTxUnit(item?.unit ?? '')
    setTxQty('1')
    setTxIssuedTo('')
    setTxDepartment('')
    setTxNotes('')
    setTxRef('')
    setItemSearch(item?.item_name ?? '')
    setItemDropdownOpen(false)
  }

  function selectStockItem(item: StockRow) {
    setTxItemName(item.item_name)
    setTxUnit(item.unit ?? '')
    setItemSearch(item.item_name)
    setItemDropdownOpen(false)
  }

  const filteredStockItems = stock.filter(s =>
    !itemSearch || s.item_name.toLowerCase().includes(itemSearch.toLowerCase())
  )

  async function submitTransaction() {
    if (!clientId) return
    const qty = parseFloat(txQty)
    if (!txItemName.trim()) { toast.error('Item is required'); return }
    if (!qty || qty <= 0) { toast.error('Quantity must be greater than 0'); return }
    if (modal === 'issue' && !txIssuedTo.trim()) { toast.error('Care of is required'); return }
    setSubmitting(true)
    try {
      const { error } = await supabase.from('client_inventory_transactions').insert({
        client_id: clientId,
        item_name: txItemName.trim(),
        unit: txUnit.trim() || null,
        transaction_type: modal === 'receive' ? 'received' : modal === 'issue' ? 'issued' : 'adjusted',
        quantity: qty,
        issued_to: txIssuedTo.trim() || null,
        department: txDepartment.trim() || null,
        notes: txNotes.trim() || null,
        reference_no: txRef.trim() || null,
      })
      if (error) throw error
      toast.success(modal === 'receive' ? 'Stock received!' : modal === 'issue' ? 'Item issued!' : 'Stock adjusted!')
      setModal(null)
      await fetchData(clientId)
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save transaction')
    }
    setSubmitting(false)
  }

  async function saveThreshold() {
    if (!clientId || !thresholdItem) return
    const val = parseFloat(newThreshold)
    if (isNaN(val) || val < 0) { toast.error('Enter a valid threshold'); return }
    const { error } = await supabase.from('client_inventory')
      .update({ low_stock_threshold: val })
      .eq('id', thresholdItem.id)
    if (error) { toast.error(error.message); return }
    toast.success('Threshold updated')
    setThresholdItem(null)
    await fetchData(clientId!)
  }

  const filtered = stock.filter(s =>
    !search || s.item_name.toLowerCase().includes(search.toLowerCase())
  )

  const lowStockItems = stock.filter(s => s.quantity_on_hand <= s.low_stock_threshold)
  const itemHistory = historyItem
    ? transactions.filter(t => t.item_name === historyItem.item_name)
    : []

  const txTypeStyle: Record<string, string> = {
    received: 'bg-green-100 text-green-700',
    issued:   'bg-orange-100 text-orange-700',
    adjusted: 'bg-blue-100 text-blue-700',
  }

  // Item picker component used inside modals
  function ItemPicker() {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Item *</label>
        <div className="relative">
          <div className="relative flex items-center">
            <Search className="absolute left-3 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              value={itemSearch}
              onChange={e => { setItemSearch(e.target.value); setTxItemName(''); setItemDropdownOpen(true) }}
              onFocus={() => setItemDropdownOpen(true)}
              placeholder="Search item…"
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            {txItemName && <Check className="absolute right-3 h-4 w-4 text-green-600" />}
          </div>
          {itemDropdownOpen && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredStockItems.length === 0 ? (
                <div className="px-3 py-2 text-xs text-gray-400">No items found</div>
              ) : filteredStockItems.map(s => {
                const isOut = s.quantity_on_hand === 0
                const isLow = !isOut && s.quantity_on_hand <= s.low_stock_threshold
                const isNew = s.quantity_on_hand > s.low_stock_threshold * 3 && s.quantity_on_hand <= 10
                return (
                  <button
                    key={s.id}
                    type="button"
                    onMouseDown={() => selectStockItem(s)}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 flex items-center justify-between gap-2 border-b border-gray-50 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 truncate">{s.item_name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-gray-400">{s.quantity_on_hand} {s.unit ?? 'pcs'}</span>
                        {isOut && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">Out of Stock</span>}
                        {isLow && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">Low Stock</span>}
                        {modal === 'receive' && isOut && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">New Order Needed</span>}
                      </div>
                    </div>
                    {(isOut || isLow) && <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${isOut ? 'text-red-500' : 'text-amber-500'}`} />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Stock</h1>
          <p className="text-sm text-gray-500 mt-1">Track your inventory and issue items to employees.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => openModal('receive')}
            className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            <ArrowDownCircle className="h-4 w-4" /> Receive Stock
          </button>
          <button
            onClick={() => openModal('issue')}
            className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            <ArrowUpCircle className="h-4 w-4" /> Issue Item
          </button>
        </div>
      </div>

      {/* Low stock alerts */}
      {!loading && lowStockItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-sm font-semibold text-amber-800">
              {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} at or below low-stock threshold
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockItems.map(s => (
              <span key={s.id} className="text-xs bg-amber-100 text-amber-800 border border-amber-200 px-2 py-1 rounded-lg font-medium">
                {s.item_name} — {s.quantity_on_hand} {s.unit ?? 'pcs'} left
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <div className="text-xl font-bold text-gray-900">{loading ? '—' : stock.length}</div>
          <div className="text-xs text-gray-500">Total Items</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <div className="text-xl font-bold text-green-600">{loading ? '—' : stock.filter(s => s.quantity_on_hand > s.low_stock_threshold).length}</div>
          <div className="text-xs text-gray-500">Adequate Stock</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <div className="text-xl font-bold text-amber-600">{loading ? '—' : lowStockItems.length}</div>
          <div className="text-xs text-gray-500">Low Stock</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <div className="text-xl font-bold text-gray-900">{loading ? '—' : transactions.length}</div>
          <div className="text-xs text-gray-500">Transactions</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search items..."
          className="w-full h-10 pl-9 pr-4 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
      </div>

      {/* Stock table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Item</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">On Hand</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide hidden sm:table-cell">Low Stock At</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto" />
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400 text-sm">
                {search ? 'No items match your search.' : 'No stock yet. Use "Receive Stock" to add your first item.'}
              </td></tr>
            ) : filtered.map(s => {
              const isLow = s.quantity_on_hand <= s.low_stock_threshold
              const isOut = s.quantity_on_hand === 0
              return (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 text-sm">{s.item_name}</div>
                    {s.item_code && <div className="text-xs text-gray-400">{s.item_code}</div>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn('text-sm font-bold', isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-900')}>
                      {s.quantity_on_hand}
                    </span>
                    <span className="text-xs text-gray-400 ml-1">{s.unit ?? 'pcs'}</span>
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <button
                      onClick={() => { setThresholdItem(s); setNewThreshold(String(s.low_stock_threshold)) }}
                      className="text-xs text-gray-500 hover:text-red-600 underline underline-offset-2">
                      {s.low_stock_threshold} {s.unit ?? 'pcs'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      isOut ? 'bg-red-100 text-red-700' : isLow ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                    )}>
                      {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setHistoryItem(s); setHistoryOpen(true) }}
                        title="View history"
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                        <History className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => openModal('receive', s)}
                        title="Receive stock"
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors">
                        <ArrowDownCircle className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => openModal('issue', s)}
                        title="Issue item"
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors">
                        <ArrowUpCircle className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => openModal('adjust', s)}
                        title="Adjust quantity"
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Recent transactions */}
      {transactions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            onClick={() => setHistoryOpen(h => !h)}>
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">Transaction History</span>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{transactions.length}</span>
            </div>
            {historyOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </button>
          {historyOpen && !historyItem && (
            <div className="border-t">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Item</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Care of / Dept / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.slice(0, 30).map(t => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                        {format(new Date(t.created_at), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-medium text-gray-900">{t.item_name}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', txTypeStyle[t.transaction_type] ?? 'bg-gray-100 text-gray-600')}>
                          {t.transaction_type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-xs font-bold text-gray-800">
                        {t.transaction_type === 'issued' ? '-' : '+'}{t.quantity} {t.unit ?? ''}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500 hidden sm:table-cell">
                        {t.issued_to && <span className="font-medium text-gray-700">{t.issued_to}</span>}
                        {t.department && <span className="ml-1 text-gray-400">({t.department})</span>}
                        {(t.issued_to || t.department) && t.notes && ' — '}
                        {t.notes}
                        {t.reference_no && <span className="ml-1 text-gray-400">({t.reference_no})</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Transaction modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white rounded-t-2xl">
              <h3 className="font-bold text-gray-900">
                {modal === 'receive' ? '📥 Receive Stock' : modal === 'issue' ? '📤 Issue Item' : '⚖️ Adjust Stock'}
              </h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {modal === 'adjust' && (
                <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                  Adjust sets the quantity on hand to the exact number you enter.
                </p>
              )}

              <ItemPicker />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    {modal === 'adjust' ? 'New Quantity *' : 'Quantity *'}
                  </label>
                  <input
                    type="number" min="0" step="1"
                    value={txQty}
                    onChange={e => setTxQty(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Unit</label>
                  <input
                    value={txUnit}
                    readOnly
                    placeholder="Auto from item"
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
              </div>

              {modal === 'issue' && (<>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Care of *</label>
                  <input
                    value={txIssuedTo}
                    onChange={e => setTxIssuedTo(e.target.value)}
                    placeholder="Name of person"
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Department</label>
                  {departments.length > 0 ? (
                    <select
                      value={txDepartment}
                      onChange={e => setTxDepartment(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                    >
                      <option value="">— Select department —</option>
                      {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  ) : (
                    <input
                      value={txDepartment}
                      onChange={e => setTxDepartment(e.target.value)}
                      placeholder="Department name"
                      className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  )}
                </div>
              </>)}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Reference No.</label>
                <input
                  value={txRef}
                  onChange={e => setTxRef(e.target.value)}
                  placeholder="DR No., PO No., etc."
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Notes</label>
                <input
                  value={txNotes}
                  onChange={e => setTxNotes(e.target.value)}
                  placeholder="Optional notes..."
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3 justify-end sticky bottom-0 bg-white pt-3 border-t">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={submitTransaction}
                disabled={submitting}
                className={cn(
                  'inline-flex items-center gap-2 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-60',
                  modal === 'receive' ? 'bg-green-600 hover:bg-green-700' :
                  modal === 'issue' ? 'bg-orange-500 hover:bg-orange-600' :
                  'bg-blue-600 hover:bg-blue-700'
                )}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {modal === 'receive' ? 'Receive' : modal === 'issue' ? 'Issue' : 'Adjust'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item history modal */}
      {historyItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <div>
                <h3 className="font-bold text-gray-900">{historyItem.item_name}</h3>
                <p className="text-xs text-gray-500">Transaction history</p>
              </div>
              <button onClick={() => setHistoryItem(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {itemHistory.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">No transactions yet for this item.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Date</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500">Type</th>
                      <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500">Qty</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {itemHistory.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                          {format(new Date(t.created_at), 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', txTypeStyle[t.transaction_type] ?? 'bg-gray-100 text-gray-600')}>
                            {t.transaction_type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs font-bold">
                          {t.transaction_type === 'issued' ? '-' : t.transaction_type === 'adjusted' ? '' : '+'}{t.quantity}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">
                          {t.issued_to && <div className="font-medium">→ {t.issued_to}</div>}
                          {t.department && <div className="text-gray-400">{t.department}</div>}
                          {t.notes && <div className="text-gray-400">{t.notes}</div>}
                          {t.reference_no && <div className="text-gray-400">{t.reference_no}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Threshold modal */}
      {thresholdItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-bold text-gray-900">Set Low Stock Alert</h3>
              <button onClick={() => setThresholdItem(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm text-gray-600">
                Alert when <strong>{thresholdItem.item_name}</strong> drops to or below:
              </p>
              <input
                type="number" min="0"
                value={newThreshold}
                onChange={e => setNewThreshold(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="px-6 pb-5 flex gap-3 justify-end">
              <button onClick={() => setThresholdItem(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={saveThreshold} className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2 rounded-lg">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
