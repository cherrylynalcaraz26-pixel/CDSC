'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { useRouter, useSearchParams } from 'next/navigation'
import { getErrorMessage } from '@/lib/error-message'
import {
  Package, Loader2, Search, AlertTriangle, ArrowDownCircle, ArrowUpCircle,
  SlidersHorizontal, History, ChevronDown, ChevronUp, X, Check, Plus, Truck, CheckCircle2,
  MoreHorizontal, Undo2, Printer, FileText, Mail,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useSearchContext } from '@/context/search-context'
import { sendEmail } from '@/lib/send-email'

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

interface DRRow {
  id: string
  dr_number: string
  dr_date: string
  status: string
  po_number: string | null
  items: { item_name: string; unit: string | null; quantity: number }[]
}

type ModalType = 'receive' | 'issue' | 'adjust' | null

function PortalStockPageContent() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [clientId, setClientId] = useState<string | null>(null)
  const [clientName, setClientName] = useState<string>('')
  const [showCsiInPortal, setShowCsiInPortal] = useState(true)
  const [stock, setStock] = useState<StockRow[]>([])
  const [transactions, setTransactions] = useState<TxRow[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [availableDRs, setAvailableDRs] = useState<DRRow[]>([])
  const [loading, setLoading] = useState(true)
  const { query: search } = useSearchContext()
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

  // DR selection for receive modal
  const [selectedDR, setSelectedDR] = useState<DRRow | null>(null)
  const [refMode, setRefMode] = useState<'dr' | 'manual'>('manual')

  // PO-based bulk receive
  const [selectedPO, setSelectedPO] = useState('')
  const [bulkSelectedItems, setBulkSelectedItems] = useState<{ item_name: string; unit: string | null; quantity: number; dr_number: string }[]>([])
  const [bulkSubmitting, setBulkSubmitting] = useState(false)

  // Add department modal
  const [addDeptOpen, setAddDeptOpen] = useState(false)
  const [newDeptName, setNewDeptName] = useState('')
  const [savingDept, setSavingDept] = useState(false)

  // Action dropdown per row
  const [openActionId, setOpenActionId] = useState<string | null>(null)
  const [actionDropdownPos, setActionDropdownPos] = useState<{ top: number; right: number } | null>(null)

  // Report
  const [reportOpen, setReportOpen] = useState(false)
  const [csiRecords, setCsiRecords] = useState<{ si_number: string; si_date: string; item_name: string; unit: string | null; quantity: number; unit_price: number; amount: number; dr_number: string | null }[]>([])
  const [userEmail, setUserEmail] = useState('')
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)

  // Issue slip (shown after issue submit)
  const [issuedSlip, setIssuedSlip] = useState<{ item_name: string; unit: string | null; quantity: number; issued_to: string; department: string; notes: string; reference_no: string; date: string } | null>(null)
  // Receive slip (shown after receive submit)
  const [receivedSlip, setReceivedSlip] = useState<{ items: { item_name: string; unit: string | null; quantity: number }[]; reference_no: string; notes: string; date: string; new_totals: Record<string, number> } | null>(null)

  // Undo transaction
  const [undoingId, setUndoingId] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUserEmail(session.user.email ?? '')
      const { data: clientRow } = await supabase.from('clients').select('id, company_name, show_csi_in_portal').eq('auth_user_id', session.user.id).single()
      if (!clientRow) { router.push('/login'); return }
      setClientId(clientRow.id)
      setClientName((clientRow as any).company_name ?? '')
      setShowCsiInPortal((clientRow as any).show_csi_in_portal !== false)
      await fetchData(clientRow.id, (clientRow as any).company_name ?? '', (clientRow as any).show_csi_in_portal !== false)
      const drParam = searchParams?.get('dr')
      if (drParam) {
        openModal('receive')
      }
    }
    init()
  }, [])

  async function fetchData(cid: string, cname?: string, csiVisible?: boolean) {
    setLoading(true)
    const companyName = cname ?? clientName
    // Fetch visible SO numbers for this client (only show_in_portal = true)
    const { data: visibleSOData } = companyName
      ? await supabase.from('sales_orders').select('so_number').eq('client_name', companyName).eq('show_in_portal', true)
      : { data: [] as any[] }
    const visibleSONumbers = (visibleSOData ?? []).map((s: any) => s.so_number).filter(Boolean) as string[]

    const [{ data: stockData }, { data: txData }, { data: deptData }, { data: drData }] = await Promise.all([
      supabase.from('client_inventory').select('*').eq('client_id', cid).order('item_name'),
      supabase.from('client_inventory_transactions').select('*').eq('client_id', cid).order('created_at', { ascending: false }).limit(100),
      supabase.from('client_departments').select('name').eq('client_id', cid).order('name'),
      companyName && visibleSONumbers.length > 0
        ? supabase.from('dr_logs').select('id,dr_number,dr_date,status,po_number').eq('supplier_name', companyName).in('status', ['received', 'partial']).in('po_number', visibleSONumbers).order('dr_date', { ascending: false }).limit(50)
        : Promise.resolve({ data: [] as any[] }),
    ])
    setStock(stockData ?? [])
    setTransactions(txData ?? [])
    setDepartments((deptData ?? []).map((d: any) => d.name))
    const drNums = (drData ?? []).map((d: any) => d.dr_number).filter(Boolean)
    let drItemsFetched: any[] = []
    if (drNums.length > 0) {
      const { data: drItemsFetch } = await supabase.from('dr_log_items').select('dr_number,item_name,unit,quantity').in('dr_number', drNums)
      drItemsFetched = drItemsFetch ?? []
    }

    const drs: DRRow[] = (drData ?? []).map((d: any) => ({
      id: d.id, dr_number: d.dr_number, dr_date: d.dr_date, status: d.status, po_number: d.po_number ?? null,
      items: drItemsFetched.filter((i: any) => i.dr_number === d.dr_number).map((i: any) => ({ item_name: i.item_name, unit: i.unit ?? null, quantity: Number(i.quantity) })),
    }))
    setAvailableDRs(drs)

    const showCsi = csiVisible !== undefined ? csiVisible : showCsiInPortal
    if (companyName && showCsi) {
      const csiData = await fetchAllRows((from, to) => supabase
        .from('csi_records')
        .select('si_number,si_date,item_name,unit,quantity,unit_price,amount,dr_number')
        .eq('client_name', companyName)
        .eq('show_in_portal', true)
        .order('si_date', { ascending: false })
        .order('si_number')
        .order('id')
        .range(from, to))
      setCsiRecords(csiData)
    } else {
      setCsiRecords([])
    }

    setLoading(false)
  }

  async function addDepartment() {
    if (!clientId || !newDeptName.trim()) return
    setSavingDept(true)
    const { error } = await supabase.from('client_departments').insert({ client_id: clientId, name: newDeptName.trim() })
    if (error) { toast.error(getErrorMessage(error)); setSavingDept(false); return }
    toast.success('Department added')
    setNewDeptName('')
    setAddDeptOpen(false)
    setSavingDept(false)
    await fetchData(clientId)
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
    setSelectedDR(null)
    setRefMode('manual')
    setSelectedPO('')
    setBulkSelectedItems([])
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
      if (modal === 'issue') {
        setIssuedSlip({
          item_name: txItemName.trim(),
          unit: txUnit.trim() || null,
          quantity: qty,
          issued_to: txIssuedTo.trim(),
          department: txDepartment.trim(),
          notes: txNotes.trim(),
          reference_no: txRef.trim(),
          date: new Date().toISOString(),
        })
        setModal(null)
      } else if (modal === 'receive') {
        await fetchData(clientId)
        const updatedItem = stock.find(s => s.item_name === txItemName.trim())
        setReceivedSlip({
          items: [{ item_name: txItemName.trim(), unit: txUnit.trim() || null, quantity: qty }],
          reference_no: txRef.trim(),
          notes: txNotes.trim(),
          date: new Date().toISOString(),
          new_totals: { [txItemName.trim()]: (updatedItem?.quantity_on_hand ?? 0) },
        })
        setModal(null)
        return
      } else {
        toast.success('Stock adjusted!')
        setModal(null)
      }
      await fetchData(clientId)
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to save transaction'))
    }
    setSubmitting(false)
  }

  async function submitBulkTransactions() {
    if (!clientId || bulkSelectedItems.length === 0) return
    setBulkSubmitting(true)
    try {
      const rows = bulkSelectedItems.map(it => ({
        client_id: clientId,
        item_name: it.item_name,
        unit: it.unit || null,
        transaction_type: 'received',
        quantity: it.quantity,
        reference_no: it.dr_number,
        notes: `From PO ${selectedPO}`,
      }))
      const { error } = await supabase.from('client_inventory_transactions').insert(rows)
      if (error) throw error
      await fetchData(clientId)
      const newTotals: Record<string, number> = {}
      for (const it of bulkSelectedItems) {
        const found = stock.find(s => s.item_name === it.item_name)
        newTotals[it.item_name] = found?.quantity_on_hand ?? 0
      }
      setReceivedSlip({
        items: bulkSelectedItems.map(it => ({ item_name: it.item_name, unit: it.unit, quantity: it.quantity })),
        reference_no: `PO ${selectedPO}`,
        notes: '',
        date: new Date().toISOString(),
        new_totals: newTotals,
      })
      setModal(null)
      setSelectedPO('')
      setBulkSelectedItems([])
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to save transactions'))
    }
    setBulkSubmitting(false)
  }

  async function undoTransaction(tx: TxRow) {
    if (!clientId) return
    setUndoingId(tx.id)
    try {
      // Stock quantity is maintained by a DB trigger that only fires on INSERT,
      // so deleting a transaction alone doesn't restore the quantity. Insert a
      // counter-transaction to reverse the stock effect, then delete that row too —
      // otherwise the history is left with a misleading opposite-type entry
      // (e.g. undoing a "received" used to leave an "issued" record behind).
      if (tx.transaction_type === 'received' || tx.transaction_type === 'issued') {
        const reverseType = tx.transaction_type === 'received' ? 'issued' : 'received'
        const { data: reversal, error: revErr } = await supabase.from('client_inventory_transactions').insert({
          client_id: clientId,
          item_name: tx.item_name,
          unit: tx.unit || null,
          transaction_type: reverseType,
          quantity: tx.quantity,
          notes: `Undo of ${tx.transaction_type} transaction`,
          reference_no: tx.reference_no || null,
        }).select('id').single()
        if (revErr) throw revErr
        if (reversal?.id) {
          await supabase.from('client_inventory_transactions').delete().eq('id', reversal.id)
        }
      }
      // Delete the original transaction record
      const { error: delErr } = await supabase.from('client_inventory_transactions').delete().eq('id', tx.id)
      if (delErr) throw delErr
      toast.success('Transaction undone')
      await fetchData(clientId)
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to undo transaction'))
    }
    setUndoingId(null)
  }

  async function saveThreshold() {
    if (!clientId || !thresholdItem) return
    const val = parseFloat(newThreshold)
    if (isNaN(val) || val < 0) { toast.error('Enter a valid threshold'); return }
    const { error } = await supabase.from('client_inventory')
      .update({ low_stock_threshold: val })
      .eq('id', thresholdItem.id)
    if (error) { toast.error(getErrorMessage(error)); return }
    toast.success('Threshold updated')
    setThresholdItem(null)
    await fetchData(clientId!)
  }

  const filtered = stock.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.item_name.toLowerCase().includes(q) ||
      (s.unit ?? '').toLowerCase().includes(q)
  })

  const lowStockItems = stock.filter(s => s.quantity_on_hand <= s.low_stock_threshold)
  const totalOnHand = stock.reduce((s, i) => s + (i.quantity_on_hand ?? 0), 0)
  // DRs already fully received into stock (via a prior "Receive Stock" action) are hidden
  // from the DR picker so the same delivery can't be received twice.
  const receivedDRNumbers = new Set(
    transactions.filter(t => t.transaction_type === 'received' && t.reference_no).map(t => t.reference_no)
  )
  const receivableDRs = availableDRs.filter(d => !receivedDRNumbers.has(d.dr_number))
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
            onClick={() => setReportOpen(v => !v)}
            disabled={stock.length === 0}
            className={cn(
              'inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg border transition-colors',
              reportOpen
                ? 'border-red-300 text-red-600 bg-red-50 hover:bg-red-100'
                : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
            )}>
            <FileText className="h-4 w-4" /> {reportOpen ? 'Close Report' : 'Generate Report'}
          </button>
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <div className="text-xl font-bold text-gray-900">{loading ? '—' : stock.length}</div>
          <div className="text-xs text-gray-500">Total Items</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <div className="text-xl font-bold text-gray-900">{loading ? '—' : totalOnHand.toLocaleString('en-PH')}</div>
          <div className="text-xs text-gray-500">Total On Hand</div>
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

      {/* Inline Stock Report */}
      {reportOpen && (() => {
        const today = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
        const inStock = stock.filter(s => s.quantity_on_hand > s.low_stock_threshold)
        const lowStock = stock.filter(s => s.quantity_on_hand > 0 && s.quantity_on_hand <= s.low_stock_threshold)
        const outOfStock = stock.filter(s => s.quantity_on_hand === 0)
        const fmtPeso = (v: number) => '₱' + v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })

        // Built from the report data using plain HTML/CSS (not a clone of the live DOM) —
        // the on-screen preview's styling comes from Tailwind utility classes, which don't
        // exist in a blank print window, so cloning it rendered unstyled.
        function buildStockReportHtml() {
          const cardsHtml = [
            { label: 'Total Items', value: stock.length, cls: '' },
            { label: 'Total On Hand', value: totalOnHand.toLocaleString('en-PH'), cls: '' },
            { label: 'In Stock', value: inStock.length, cls: 'green' },
            { label: 'Low Stock', value: lowStock.length, cls: 'amber' },
            { label: 'Out of Stock', value: outOfStock.length, cls: 'red' },
          ].map(c => `<div class="card"><div class="card-label">${c.label}</div><div class="card-val ${c.cls}">${c.value}</div></div>`).join('')

          const stockRowsHtml = stock.length === 0
            ? `<tr><td colspan="6" style="text-align:center;padding:24px;color:#9ca3af;font-style:italic">No stock records.</td></tr>`
            : stock.map((s, i) => {
              const isOut = s.quantity_on_hand === 0
              const isLow = !isOut && s.quantity_on_hand <= s.low_stock_threshold
              const qtyColor = isOut ? '#dc2626' : isLow ? '#d97706' : '#15803d'
              const statusLabel = isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'
              const statusCls = isOut ? 'badge-red' : isLow ? 'badge-amber' : 'badge-green'
              return `<tr>
                <td>${i + 1}</td>
                <td style="font-weight:600;color:#1f2937">${s.item_name}</td>
                <td>${s.unit ?? 'pcs'}</td>
                <td class="r" style="font-weight:700;color:${qtyColor}">${s.quantity_on_hand}</td>
                <td class="r">${s.low_stock_threshold}</td>
                <td style="text-align:center"><span class="badge ${statusCls}">${statusLabel}</span></td>
              </tr>`
            }).join('')

          const siGroups: { si_number: string; si_date: string; items: typeof csiRecords; total: number }[] = []
          const seen = new Set<string>()
          for (const r of csiRecords) {
            if (!seen.has(r.si_number)) {
              seen.add(r.si_number)
              const grpItems = csiRecords.filter(x => x.si_number === r.si_number)
              siGroups.push({ si_number: r.si_number, si_date: r.si_date, items: grpItems, total: grpItems.reduce((s, x) => s + (Number(x.amount) || 0), 0) })
            }
          }
          const grandTotal = csiRecords.reduce((s, r) => s + (Number(r.amount) || 0), 0)
          const csiRowsHtml = siGroups.flatMap((g, gi) => g.items.map((item, ii) => `<tr${gi % 2 === 1 ? ' style="background:#f9fafb"' : ''}>
            <td style="color:#6b7280;white-space:nowrap">${ii === 0 ? fmtDate(g.si_date) : ''}</td>
            <td style="font-family:monospace;font-weight:600;color:#dc2626">${ii === 0 ? g.si_number : ''}</td>
            <td>${item.item_name}</td>
            <td>${item.unit ?? '—'}</td>
            <td class="r">${Number(item.quantity)}</td>
            <td class="r">${item.unit_price ? fmtPeso(Number(item.unit_price)) : '—'}</td>
            <td class="r">${item.amount ? fmtPeso(Number(item.amount)) : '—'}</td>
          </tr>`)).join('')

          const csiSectionHtml = csiRecords.length === 0 ? '' : `
            <div style="margin-top:32px">
              <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #e5e7eb">
                <div><div style="font-size:13px;font-weight:800;color:#1f2937">CSI Issued</div><div style="font-size:9px;color:#9ca3af;margin-top:2px">Charge Sales Invoices issued to ${clientName}</div></div>
                <div style="text-align:right"><div style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px">Total Invoiced</div><div style="font-size:15px;font-weight:800;color:#dc2626">${fmtPeso(grandTotal)}</div></div>
              </div>
              <table>
                <thead><tr class="csi-head">
                  <th>Date</th><th>SI Number</th><th>Item Description</th><th style="width:60px">Unit</th>
                  <th class="r" style="width:60px">Qty</th><th class="r" style="width:90px">Unit Price</th><th class="r" style="width:90px">Amount</th>
                </tr></thead>
                <tbody>${csiRowsHtml}</tbody>
                <tfoot><tr><td colspan="6" class="r" style="font-weight:700">Grand Total</td><td class="r" style="font-weight:700;color:#dc2626">${fmtPeso(grandTotal)}</td></tr></tfoot>
              </table>
            </div>`

          return `<!DOCTYPE html><html><head><title>Stock Report - ${clientName}</title><style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; background: #fff; color: #111; padding: 32px; }
            .accent { background: #dc2626; height: 5px; border-radius: 3px; margin-bottom: 20px; }
            .letterhead { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid #e5e7eb; }
            .cards { display: grid; grid-template-columns: repeat(5,1fr); gap: 10px; margin-bottom: 18px; }
            .card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 14px; background: #f9fafb; }
            .card-label { font-size: 9px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
            .card-val { font-size: 20px; font-weight: 700; margin-top: 3px; color: #1f2937; }
            .card-val.green { color: #15803d; } .card-val.amber { color: #d97706; } .card-val.red { color: #dc2626; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 4px; }
            th { background: #1f2937; color: #fff; text-align: left; padding: 7px 10px; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
            th.csi-head { background: #b91c1c; }
            th.r { text-align: right; }
            td { padding: 6px 10px; border-bottom: 1px solid #f3f4f6; }
            td.r { text-align: right; }
            tr:nth-child(even) td { background: #f9fafb; }
            tfoot td { font-weight: 700; background: #f3f4f6; border-top: 2px solid #d1d5db; }
            .badge { font-size: 9px; padding: 2px 8px; border-radius: 999px; font-weight: 600; }
            .badge-green { background: #dcfce7; color: #15803d; } .badge-amber { background: #fef3c7; color: #b45309; } .badge-red { background: #fee2e2; color: #dc2626; }
            .note { margin-top: 20px; padding-top: 10px; border-top: 1px solid #f3f4f6; font-size: 9px; color: #9ca3af; display: flex; justify-content: space-between; }
            @media print { @page { margin: 12mm; size: A4 landscape; } }
          </style></head><body>
            <div class="accent"></div>
            <div class="letterhead">
              <div><img src="/cdsc-logo.jpg" style="height:50px;width:auto;display:block;margin-bottom:4px;" /><div style="font-size:11px;font-weight:600;color:#374151">CDSC Industrial Supply</div></div>
              <div style="text-align:right"><div style="font-size:15px;font-weight:700">Stock Report</div><div style="font-size:10px;color:#9ca3af;margin-top:2px">As of ${today}</div></div>
            </div>
            <div style="margin-bottom:14px"><div style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:2px">Client</div><div style="font-size:18px;font-weight:700">${clientName}</div></div>
            <div class="cards">${cardsHtml}</div>
            <table>
              <thead><tr>
                <th style="width:24px">#</th><th>Item Description</th><th style="width:70px">Unit</th>
                <th class="r" style="width:80px">On Hand</th><th class="r" style="width:80px">Low Stock At</th><th style="width:90px;text-align:center">Status</th>
              </tr></thead>
              <tbody>${stockRowsHtml}</tbody>
            </table>
            ${csiSectionHtml}
            <div class="note">
              <span>Stock levels reflect current on-hand quantities as of the report date.</span>
              <span>Generated ${today} &middot; CDSC Inventory System</span>
            </div>
          </body></html>`
        }

        return (
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b flex-wrap">
              <FileText className="h-4 w-4 text-red-600 shrink-0" />
              <span className="font-semibold text-sm text-gray-800 shrink-0">Stock Report</span>
              <button
                className="ml-auto inline-flex items-center gap-1.5 border border-gray-300 hover:bg-gray-100 text-gray-700 text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors shrink-0"
                onClick={() => { setEmailTo(userEmail); setEmailDialogOpen(true) }}
              >
                <Mail className="h-4 w-4" /> Email Report
              </button>
              <button
                className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors shrink-0"
                onClick={() => {
                  const win = window.open('', '_blank', 'width=1000,height=800')
                  if (!win) return
                  win.document.write(buildStockReportHtml())
                  win.document.close()
                  win.focus()
                  setTimeout(() => { win.print() }, 400)
                }}
              >
                <Printer className="h-4 w-4" /> Print / Save PDF
              </button>
              {emailDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => { if (e.target === e.currentTarget && !sendingEmail) setEmailDialogOpen(false) }}>
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
                    <div className="flex items-center justify-between px-6 py-4 border-b">
                      <h3 className="font-bold text-gray-900">Email Stock Report</h3>
                      <button onClick={() => setEmailDialogOpen(false)} disabled={sendingEmail} className="text-gray-400 hover:text-gray-600 disabled:opacity-40">
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="px-6 py-4 space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">Send to</label>
                      <input
                        type="email"
                        value={emailTo}
                        onChange={e => setEmailTo(e.target.value)}
                        placeholder="you@company.com"
                        className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>
                    <div className="px-6 pb-5 flex gap-3 justify-end border-t pt-3">
                      <button onClick={() => setEmailDialogOpen(false)} disabled={sendingEmail}
                        className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">
                        Cancel
                      </button>
                      <button
                        disabled={sendingEmail || !emailTo.trim()}
                        onClick={async () => {
                          setSendingEmail(true)
                          try {
                            await sendEmail({
                              to: emailTo.trim(),
                              subject: `Stock Report - ${clientName}`,
                              body: `Please find attached the stock report for ${clientName} as of ${today}.`,
                              printHtml: buildStockReportHtml(),
                              pdfFilename: `Stock_Report_${clientName.replace(/\s+/g, '_')}.pdf`,
                            })
                            toast.success('Stock report emailed')
                            setEmailDialogOpen(false)
                          } catch (err) {
                            toast.error(getErrorMessage(err, 'Failed to send email'))
                          }
                          setSendingEmail(false)
                        }}
                        className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
                        {sendingEmail && <Loader2 className="h-4 w-4 animate-spin" />}
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Report body */}
            <div className="bg-white p-8">
              <div className="h-1 bg-red-600 rounded-full mb-6" />
              <div className="flex justify-between items-start mb-6 pb-5 border-b border-gray-200">
                <div>
                  <img src="/cdsc-logo.jpg" alt="CDSC" className="h-12 w-auto object-contain" />
                  <div className="text-xs font-semibold text-gray-700 mt-1">CDSC Industrial Supply</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold text-gray-800">Stock Report</div>
                  <div className="text-xs text-gray-400 mt-0.5">As of {today}</div>
                </div>
              </div>
              <div className="mb-5">
                <div className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-0.5">Client</div>
                <div className="text-xl font-bold text-gray-900">{clientName}</div>
              </div>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                {[
                  { label: 'Total Items',    value: stock.length,                     cls: 'text-gray-800' },
                  { label: 'Total On Hand',  value: totalOnHand.toLocaleString('en-PH'), cls: 'text-gray-800' },
                  { label: 'In Stock',       value: inStock.length,                   cls: 'text-green-700' },
                  { label: 'Low Stock',      value: lowStock.length,                  cls: 'text-amber-600' },
                  { label: 'Out of Stock',   value: outOfStock.length,                cls: 'text-red-600' },
                ].map(c => (
                  <div key={c.label} className="border border-gray-200 rounded-lg px-4 py-3 bg-gray-50">
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{c.label}</div>
                    <div className={`text-2xl font-bold mt-1 ${c.cls}`}>{c.value}</div>
                  </div>
                ))}
              </div>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-gray-800 text-white">
                      <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase tracking-wide w-8">#</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase tracking-wide">Item Description</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase tracking-wide w-20">Unit</th>
                      <th className="px-3 py-2.5 text-right font-semibold text-[10px] uppercase tracking-wide w-24">On Hand</th>
                      <th className="px-3 py-2.5 text-right font-semibold text-[10px] uppercase tracking-wide w-24">Low Stock At</th>
                      <th className="px-3 py-2.5 text-center font-semibold text-[10px] uppercase tracking-wide w-24">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock.map((s, i) => {
                      const isOut = s.quantity_on_hand === 0
                      const isLow = !isOut && s.quantity_on_hand <= s.low_stock_threshold
                      return (
                        <tr key={s.id} className={i % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="px-3 py-2 text-gray-400 border-b border-gray-100">{i + 1}</td>
                          <td className="px-3 py-2 font-medium text-gray-800 border-b border-gray-100">{s.item_name}</td>
                          <td className="px-3 py-2 text-gray-500 border-b border-gray-100">{s.unit ?? 'pcs'}</td>
                          <td className={`px-3 py-2 text-right font-bold border-b border-gray-100 ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-green-700'}`}>{s.quantity_on_hand}</td>
                          <td className="px-3 py-2 text-right text-gray-500 border-b border-gray-100">{s.low_stock_threshold}</td>
                          <td className="px-3 py-2 text-center border-b border-gray-100">
                            <span className={cn(
                              'text-[10px] px-2 py-0.5 rounded-full font-semibold',
                              isOut ? 'bg-red-100 text-red-700' : isLow ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                            )}>
                              {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {/* CSI Issued section */}
              {csiRecords.length > 0 && (() => {
                const siGroups: { si_number: string; si_date: string; dr_number: string | null; items: typeof csiRecords; total: number }[] = []
                const seen = new Set<string>()
                for (const r of csiRecords) {
                  if (!seen.has(r.si_number)) {
                    seen.add(r.si_number)
                    const grpItems = csiRecords.filter(x => x.si_number === r.si_number)
                    siGroups.push({ si_number: r.si_number, si_date: r.si_date, dr_number: r.dr_number, items: grpItems, total: grpItems.reduce((s, x) => s + (Number(x.amount) || 0), 0) })
                  }
                }
                const grandTotal = csiRecords.reduce((s, r) => s + (Number(r.amount) || 0), 0)
                const fmtPeso = (v: number) => '₱' + v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                return (
                  <div className="mt-8">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                      <div>
                        <div className="text-sm font-bold text-gray-800">CSI Issued</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">Charge Sales Invoices issued to {clientName}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-gray-400 uppercase tracking-wider">Total Invoiced</div>
                        <div className="text-base font-bold text-red-600">{fmtPeso(grandTotal)}</div>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse min-w-[500px]">
                        <thead>
                          <tr className="bg-red-700 text-white">
                            <th className="px-3 py-2 text-left font-semibold text-[10px] uppercase tracking-wide">Date</th>
                            <th className="px-3 py-2 text-left font-semibold text-[10px] uppercase tracking-wide">SI Number</th>
                            <th className="px-3 py-2 text-left font-semibold text-[10px] uppercase tracking-wide">Item Description</th>
                            <th className="px-3 py-2 text-left font-semibold text-[10px] uppercase tracking-wide w-16">Unit</th>
                            <th className="px-3 py-2 text-right font-semibold text-[10px] uppercase tracking-wide w-16">Qty</th>
                            <th className="px-3 py-2 text-right font-semibold text-[10px] uppercase tracking-wide w-24">Unit Price</th>
                            <th className="px-3 py-2 text-right font-semibold text-[10px] uppercase tracking-wide w-24">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {siGroups.map((g, gi) => (
                            g.items.map((item, ii) => (
                              <tr key={`${g.si_number}-${ii}`} className={gi % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-3 py-1.5 border-b border-gray-100 text-gray-500 whitespace-nowrap">{ii === 0 ? fmtDate(g.si_date) : ''}</td>
                                <td className="px-3 py-1.5 border-b border-gray-100 font-mono font-semibold text-red-600">{ii === 0 ? g.si_number : ''}</td>
                                <td className="px-3 py-1.5 border-b border-gray-100 text-gray-800">{item.item_name}</td>
                                <td className="px-3 py-1.5 border-b border-gray-100 text-gray-500">{item.unit ?? '—'}</td>
                                <td className="px-3 py-1.5 border-b border-gray-100 text-right font-medium">{Number(item.quantity)}</td>
                                <td className="px-3 py-1.5 border-b border-gray-100 text-right">{item.unit_price ? fmtPeso(Number(item.unit_price)) : '—'}</td>
                                <td className="px-3 py-1.5 border-b border-gray-100 text-right font-medium">{item.amount ? fmtPeso(Number(item.amount)) : '—'}</td>
                              </tr>
                            ))
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-gray-300 bg-gray-50">
                            <td colSpan={6} className="px-3 py-2 text-right font-bold text-gray-700 text-xs">Grand Total</td>
                            <td className="px-3 py-2 text-right font-bold text-red-600 text-xs">{fmtPeso(grandTotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )
              })()}

              <div className="mt-8 pt-4 border-t border-gray-100 text-[10px] text-gray-400 flex justify-between flex-wrap gap-2">
                <span>Stock levels reflect current on-hand quantities as of the report date.</span>
                <span>Generated {today} · CDSC Inventory System</span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Stock table — hidden when report is open */}
      {!reportOpen && <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
              const isSelected = historyItem?.id === s.id
              return (
                <tr
                  key={s.id}
                  onClick={() => { setHistoryItem(isSelected ? null : s); setHistoryOpen(true) }}
                  className={cn('cursor-pointer transition-colors', isSelected ? 'bg-indigo-50 border-l-2 border-indigo-500' : 'hover:bg-gray-50')}
                >
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
                  <td className="px-4 py-3 text-center hidden sm:table-cell" onClick={e => e.stopPropagation()}>
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
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <div className="relative inline-block">
                      <button
                        onClick={e => {
                          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                          if (openActionId === s.id) {
                            setOpenActionId(null)
                            setActionDropdownPos(null)
                          } else {
                            setOpenActionId(s.id)
                            setActionDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                          }
                        }}
                        className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>}

      {/* Action dropdown portal — rendered fixed so it escapes overflow:hidden containers */}
      {openActionId && actionDropdownPos && (() => {
        const s = stock.find((x: StockRow) => x.id === openActionId)
        if (!s) return null
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => { setOpenActionId(null); setActionDropdownPos(null) }} />
            <div
              className="fixed z-50 w-48 bg-white border border-gray-200 rounded-xl shadow-xl py-1 text-sm"
              style={{ top: actionDropdownPos.top, right: actionDropdownPos.right }}>
              <button onClick={() => { setHistoryItem(s); setHistoryOpen(true); setOpenActionId(null); setActionDropdownPos(null); setTimeout(() => document.getElementById('tx-history-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-gray-700 hover:bg-gray-50">
                <History className="h-3.5 w-3.5 text-indigo-500" /> View History
              </button>
              <button onClick={() => { openModal('receive', s); setOpenActionId(null); setActionDropdownPos(null) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-gray-700 hover:bg-gray-50">
                <ArrowDownCircle className="h-3.5 w-3.5 text-green-600" /> Receive Stock
              </button>
              <button onClick={() => { openModal('issue', s); setOpenActionId(null); setActionDropdownPos(null) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-gray-700 hover:bg-gray-50">
                <ArrowUpCircle className="h-3.5 w-3.5 text-orange-500" /> Issue Item
              </button>
              <button onClick={() => { openModal('adjust', s); setOpenActionId(null); setActionDropdownPos(null) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-gray-700 hover:bg-gray-50">
                <SlidersHorizontal className="h-3.5 w-3.5 text-blue-500" /> Adjust Stock
              </button>
            </div>
          </>
        )
      })()}

      {/* Transaction History — hidden when report is open */}
      {!reportOpen && transactions.length > 0 && (
        <div id="tx-history-section" className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            onClick={() => { setHistoryOpen(h => !h); if (historyOpen) setHistoryItem(null) }}>
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-gray-500" />
              {historyItem ? (
                <>
                  <span className="text-sm font-semibold text-indigo-700">{historyItem.item_name}</span>
                  <span className="text-xs text-indigo-400">— history</span>
                  <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">{itemHistory.length}</span>
                </>
              ) : (
                <>
                  <span className="text-sm font-semibold text-gray-700">Transaction History</span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{transactions.length}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {historyItem && (
                <span
                  role="button"
                  onClick={e => { e.stopPropagation(); setHistoryItem(null) }}
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-gray-100">
                  <X className="h-3 w-3" /> Clear
                </span>
              )}
              {historyOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            </div>
          </button>
          {historyOpen && (
            <div className="border-t">
              {(() => {
                const rows = historyItem ? itemHistory : transactions.slice(0, 30)
                return (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                        {!historyItem && <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Item</th>}
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase">Qty</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Care of / Dept / Notes</th>
                        <th className="px-4 py-2.5 w-16" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-400">No transactions yet for this item.</td></tr>
                      ) : rows.map(t => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                            {format(new Date(t.created_at), 'MMM d, yyyy')}
                          </td>
                          {!historyItem && <td className="px-4 py-2.5 text-xs font-medium text-gray-900">{t.item_name}</td>}
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
                          <td className="px-4 py-2.5 text-right">
                            <button
                              onClick={() => undoTransaction(t)}
                              disabled={undoingId === t.id}
                              title="Undo this transaction"
                              className="inline-flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors disabled:opacity-40">
                              {undoingId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
                              Undo
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              })()}
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

              {/* Accept from Delivery — PO-based or single DR (already-received DRs are excluded so they can't be double-received) */}
              {modal === 'receive' && receivableDRs.length > 0 && (() => {
                const poNumbers = [...new Set(receivableDRs.map(d => d.po_number).filter(Boolean) as string[])]
                const poDRs = selectedPO ? receivableDRs.filter(d => d.po_number === selectedPO) : []
                const allPOItems = poDRs.flatMap(dr => dr.items.map(it => ({ ...it, dr_number: dr.dr_number })))

                function toggleBulkItem(it: { item_name: string; unit: string | null; quantity: number; dr_number: string }) {
                  setBulkSelectedItems(prev => {
                    const key = `${it.dr_number}:${it.item_name}`
                    const exists = prev.some(x => `${x.dr_number}:${x.item_name}` === key)
                    return exists ? prev.filter(x => `${x.dr_number}:${x.item_name}` !== key) : [...prev, it]
                  })
                }

                return (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5" /> Accept from Delivery
                    </label>

                    {poNumbers.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-xs text-gray-500 font-medium">By PO Number (multi-item)</div>
                        <select
                          value={selectedPO}
                          onChange={e => { setSelectedPO(e.target.value); setBulkSelectedItems([]) }}
                          className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                        >
                          <option value="">— Select PO Number —</option>
                          {poNumbers.map(po => (
                            <option key={po} value={po}>{po} ({availableDRs.filter(d => d.po_number === po).length} DR{availableDRs.filter(d => d.po_number === po).length !== 1 ? 's' : ''})</option>
                          ))}
                        </select>
                        {selectedPO && allPOItems.length > 0 && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1.5">
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-xs font-semibold text-green-700">Items for PO {selectedPO}:</div>
                              <button type="button" onClick={() => setBulkSelectedItems(allPOItems)}
                                className="text-xs text-green-700 hover:text-green-800 font-medium underline underline-offset-2">
                                Select All
                              </button>
                            </div>
                            {allPOItems.map((it, idx) => {
                              const key = `${it.dr_number}:${it.item_name}`
                              const isSelected = bulkSelectedItems.some(x => `${x.dr_number}:${x.item_name}` === key)
                              return (
                                <button key={idx} type="button"
                                  onClick={() => toggleBulkItem(it)}
                                  className={cn('w-full flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg border transition-colors text-left',
                                    isSelected ? 'border-green-500 bg-green-100' : 'border-green-200 bg-white hover:bg-green-50')}>
                                  <div>
                                    <span className="font-medium text-gray-800">{it.item_name}</span>
                                    <span className="ml-2 text-gray-400 font-mono text-[10px]">{it.dr_number}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-500">{it.quantity} {it.unit ?? 'pcs'}</span>
                                    {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                                  </div>
                                </button>
                              )
                            })}
                            {bulkSelectedItems.length > 0 && (
                              <div className="pt-1 flex justify-end">
                                <button type="button" onClick={submitBulkTransactions} disabled={bulkSubmitting}
                                  className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-4 py-1.5 rounded-lg disabled:opacity-60">
                                  {bulkSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                  Receive {bulkSelectedItems.length} Item{bulkSelectedItems.length !== 1 ? 's' : ''}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        {selectedPO && allPOItems.length === 0 && (
                          <p className="text-xs text-gray-400 italic">No items found for this PO.</p>
                        )}
                      </div>
                    )}

                  </div>
                )
              })()}

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
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Department</label>
                    <button type="button" onClick={() => setAddDeptOpen(true)}
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium px-2 py-0.5 rounded-md hover:bg-red-50 transition-colors">
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  </div>
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
                      placeholder="Department name (or click + Add)"
                      className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  )}
                </div>
              </>)}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Reference No.</label>
                  {receivableDRs.length > 0 && (
                    <div className="flex rounded-md overflow-hidden border border-gray-200 text-xs">
                      <button type="button" onClick={() => setRefMode('dr')}
                        className={cn('px-2 py-0.5 font-medium transition-colors', refMode === 'dr' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>
                        DR
                      </button>
                      <button type="button" onClick={() => setRefMode('manual')}
                        className={cn('px-2 py-0.5 font-medium transition-colors border-l border-gray-200', refMode === 'manual' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>
                        Manual
                      </button>
                    </div>
                  )}
                </div>
                {refMode === 'dr' && receivableDRs.length > 0 ? (
                  <select value={txRef} onChange={e => setTxRef(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
                    <option value="">— Select DR —</option>
                    {receivableDRs.map(dr => (
                      <option key={dr.dr_number} value={dr.dr_number}>DR {dr.dr_number} ({dr.dr_date ? new Date(dr.dr_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : ''})</option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={txRef}
                    onChange={e => setTxRef(e.target.value)}
                    placeholder="DR No., PO No., etc."
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                )}
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

      {/* Add Department modal */}
      {addDeptOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={e => { if (e.target === e.currentTarget) setAddDeptOpen(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-bold text-gray-900">Add Department</h3>
              <button onClick={() => setAddDeptOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Department Name *</label>
                <input
                  value={newDeptName}
                  onChange={e => setNewDeptName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addDepartment() }}
                  placeholder="e.g. Operations, Engineering"
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 pb-5 flex gap-3 justify-end border-t pt-3">
              <button onClick={() => setAddDeptOpen(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={addDepartment} disabled={savingDept || !newDeptName.trim()}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-60">
                {savingDept && <Loader2 className="h-4 w-4 animate-spin" />}
                Add Department
              </button>
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

      {/* Receive Slip modal */}
      {receivedSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" /> Stock Received
              </h3>
              <button onClick={() => setReceivedSlip(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="bg-green-50 border border-green-100 rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Date</span>
                  <span className="font-medium text-gray-800">{format(new Date(receivedSlip.date), 'MMM d, yyyy — h:mm a')}</span>
                </div>
                {receivedSlip.reference_no && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Reference</span>
                    <span className="font-medium text-gray-800">{receivedSlip.reference_no}</span>
                  </div>
                )}
                <div className="border-t border-green-200 pt-3 space-y-2">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    {receivedSlip.items.length} Item{receivedSlip.items.length !== 1 ? 's' : ''} Received
                  </div>
                  {receivedSlip.items.map((it, i) => (
                    <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-green-200">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{it.item_name}</div>
                        <div className="text-xs text-gray-400">New total: {receivedSlip.new_totals[it.item_name] ?? '—'} {it.unit ?? 'pcs'}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-bold text-green-700">+{it.quantity}</div>
                        <div className="text-xs text-gray-400">{it.unit ?? 'pcs'}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {receivedSlip.notes && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Notes</span>
                    <span className="font-medium text-gray-800 text-right max-w-[60%]">{receivedSlip.notes}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 pb-5">
              <button
                onClick={() => setReceivedSlip(null)}
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issue Slip modal */}
      {issuedSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" /> Item Issued
              </h3>
              <button onClick={() => setIssuedSlip(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Date</span>
                  <span className="font-medium text-gray-800">{format(new Date(issuedSlip.date), 'MMM d, yyyy — h:mm a')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Item</span>
                  <span className="font-semibold text-gray-900">{issuedSlip.item_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Quantity</span>
                  <span className="font-bold text-orange-700">{issuedSlip.quantity} {issuedSlip.unit ?? 'pcs'}</span>
                </div>
                {issuedSlip.issued_to && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Care of</span>
                    <span className="font-medium text-gray-800">{issuedSlip.issued_to}</span>
                  </div>
                )}
                {issuedSlip.department && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Department</span>
                    <span className="font-medium text-gray-800">{issuedSlip.department}</span>
                  </div>
                )}
                {issuedSlip.reference_no && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Reference</span>
                    <span className="font-medium text-gray-800">{issuedSlip.reference_no}</span>
                  </div>
                )}
                {issuedSlip.notes && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Notes</span>
                    <span className="font-medium text-gray-800 text-right max-w-[60%]">{issuedSlip.notes}</span>
                  </div>
                )}
              </div>
            </div>
            {(() => {
              const itemTxs = transactions.filter(t => t.item_name === issuedSlip.item_name).slice(0, 8)
              if (!itemTxs.length) return null
              return (
                <div className="px-6 pb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Transaction History</p>
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    {itemTxs.map((t, idx) => (
                      <div key={t.id} className={`flex items-center justify-between px-3 py-2 text-xs ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded-full font-medium capitalize ${
                            t.transaction_type === 'received' ? 'bg-green-100 text-green-700' :
                            t.transaction_type === 'issued' ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>{t.transaction_type}</span>
                          {t.issued_to && <span className="text-gray-500 truncate max-w-[80px]">{t.issued_to}</span>}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-semibold text-gray-800">{t.quantity} {t.unit ?? 'pcs'}</span>
                          <span className="text-gray-400 ml-2">{format(new Date(t.created_at), 'MMM d')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
            <div className="px-6 pb-5 flex gap-3 justify-end border-t pt-3">
              <button
                onClick={() => {
                  const w = window.open('', '_blank')
                  if (!w) return
                  w.document.write(`<html><body style="font-family:sans-serif;padding:24px;max-width:320px">
                    <h2 style="margin:0 0 4px">Issue Slip</h2>
                    <p style="color:#666;margin:0 0 16px;font-size:13px">${format(new Date(issuedSlip.date), 'MMM d, yyyy — h:mm a')}</p>
                    <table style="width:100%;border-collapse:collapse;font-size:13px">
                      <tr><td style="padding:4px 0;color:#888">Item</td><td style="text-align:right;font-weight:600">${issuedSlip.item_name}</td></tr>
                      <tr><td style="padding:4px 0;color:#888">Quantity</td><td style="text-align:right;font-weight:700;color:#c2410c">${issuedSlip.quantity} ${issuedSlip.unit ?? 'pcs'}</td></tr>
                      ${issuedSlip.issued_to ? `<tr><td style="padding:4px 0;color:#888">Care of</td><td style="text-align:right">${issuedSlip.issued_to}</td></tr>` : ''}
                      ${issuedSlip.department ? `<tr><td style="padding:4px 0;color:#888">Dept</td><td style="text-align:right">${issuedSlip.department}</td></tr>` : ''}
                      ${issuedSlip.reference_no ? `<tr><td style="padding:4px 0;color:#888">Ref</td><td style="text-align:right">${issuedSlip.reference_no}</td></tr>` : ''}
                      ${issuedSlip.notes ? `<tr><td style="padding:4px 0;color:#888">Notes</td><td style="text-align:right">${issuedSlip.notes}</td></tr>` : ''}
                    </table>
                  </body></html>`)
                  w.document.close()
                  setTimeout(() => { w.focus(); w.print(); w.close() }, 500)
                }}
                className="inline-flex items-center gap-1.5 text-sm text-gray-600 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50">
                <Printer className="h-3.5 w-3.5" /> Print Slip
              </button>
              <button onClick={() => setIssuedSlip(null)}
                className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2 rounded-lg">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PortalStockPage() {
  return (
    <Suspense fallback={null}>
      <PortalStockPageContent />
    </Suspense>
  )
}
