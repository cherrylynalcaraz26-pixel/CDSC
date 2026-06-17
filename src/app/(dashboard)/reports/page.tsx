'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  FileText, Package, ShoppingCart, Truck, Cpu, Calculator,
  FileSpreadsheet, Download, Loader2, TrendingUp, Users, BoxesIcon,
} from 'lucide-react'
import { toast } from 'sonner'

function exportCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (v: string | number | null | undefined) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

interface Stats {
  items: number; suppliers: number; clients: number
  prs: number; pos: number; drLogs: number; csiRecords: number
}

export default function ReportsPage() {
  const supabase = createClient()
  const [stats, setStats] = useState<Stats | null>(null)
  const [period, setPeriod] = useState('all')
  const [generating, setGenerating] = useState<string | null>(null)

  useEffect(() => {
    async function loadStats() {
      const [items, suppliers, clients, prs, pos, drLogs, csiRecords] = await Promise.all([
        supabase.from('items').select('id', { count: 'exact', head: true }),
        supabase.from('suppliers').select('id', { count: 'exact', head: true }),
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('purchase_requests').select('id', { count: 'exact', head: true }),
        supabase.from('purchase_orders').select('id', { count: 'exact', head: true }),
        supabase.from('dr_logs').select('id', { count: 'exact', head: true }),
        supabase.from('csi_records').select('id', { count: 'exact', head: true }),
      ])
      setStats({
        items: items.count ?? 0, suppliers: suppliers.count ?? 0, clients: clients.count ?? 0,
        prs: prs.count ?? 0, pos: pos.count ?? 0, drLogs: drLogs.count ?? 0, csiRecords: csiRecords.count ?? 0,
      })
    }
    loadStats()
  }, [])

  async function generateReport(key: string, skipStateManagement = false) {
    if (!skipStateManagement) setGenerating(key)
    try {
      if (key === 'inventory') {
        const { data } = await supabase.from('items').select('item_code, item_name, unit_of_measure, cost, status').order('item_name')
        if (data) exportCSV('inventory-report.csv', ['Item Code','Item Name','Unit','Cost','Status'], data.map(r => [r.item_code, r.item_name, r.unit_of_measure, r.cost, r.status]))
        else toast.error('No data')
      } else if (key === 'purchase_history') {
        const { data } = await supabase.from('purchase_orders').select('po_number, po_date, subtotal, vat_amount, ewt_amount, net_payable, status, supplier:suppliers(company_name)').order('po_date', { ascending: false })
        if (data) exportCSV('purchase-history.csv', ['PO Number','Date','Supplier','Subtotal','VAT','EWT','Net Payable','Status'], data.map((r: any) => [r.po_number, r.po_date, r.supplier?.company_name, r.subtotal, r.vat_amount, r.ewt_amount, r.net_payable, r.status]))
        else toast.error('No data')
      } else if (key === 'purchase_requests') {
        const { data } = await supabase.from('purchase_requests').select('pr_number, date, created_at, department, priority, purpose, status').order('created_at', { ascending: false })
        if (data) exportCSV('purchase-requests.csv', ['PR Number','Date','Department','Priority','Purpose','Status'], data.map(r => [r.pr_number, r.date ?? r.created_at, r.department, r.priority, r.purpose, r.status]))
        else toast.error('No data')
      } else if (key === 'dr_logs') {
        const { data } = await supabase.from('dr_logs').select('dr_number, date, delivered_to, status').order('date', { ascending: false })
        if (data) exportCSV('dr-logs.csv', ['DR Number','Date','Delivered To','Status'], data.map(r => [r.dr_number, r.date, r.delivered_to, r.status]))
        else toast.error('No data')
      } else if (key === 'suppliers') {
        const { data } = await supabase.from('suppliers').select('supplier_code, company_name, contact_person, email, mobile_number, tin, supplier_category, payment_terms').order('company_name')
        if (data) exportCSV('suppliers.csv', ['Code','Company','Contact','Email','Mobile','TIN','Category','Payment Terms'], data.map(r => [r.supplier_code, r.company_name, r.contact_person, r.email, r.mobile_number, r.tin, r.supplier_category, r.payment_terms]))
        else toast.error('No data')
      } else if (key === 'clients') {
        const { data } = await supabase.from('clients').select('client_code, company_name, contact_person, email, client_type, credit_limit, status').order('company_name')
        if (data) exportCSV('clients.csv', ['Code','Company','Contact','Email','Type','Credit Limit','Status'], data.map(r => [r.client_code, r.company_name, r.contact_person, r.email, r.client_type, r.credit_limit, r.status]))
        else toast.error('No data')
      } else if (key === 'csi') {
        const { data } = await supabase.from('csi_records').select('si_number, date, client_name, item_name, quantity, unit').order('date', { ascending: false })
        if (data) exportCSV('csi-records.csv', ['SI Number','Date','Client','Item','Qty','Unit'], data.map(r => [r.si_number, r.date, r.client_name, r.item_name, r.quantity, r.unit]))
        else toast.error('No data')
      } else {
        toast.info('This report is coming soon')
      }
    } catch (e) {
      toast.error('Export failed')
    }
    if (!skipStateManagement) setGenerating(null)
  }

  async function downloadAll() {
    setGenerating('all')
    const keys = ['inventory', 'purchase_history', 'purchase_requests', 'dr_logs', 'suppliers', 'clients', 'csi']
    for (const key of keys) {
      await generateReport(key, true)
      await new Promise(r => setTimeout(r, 400))
    }
    setGenerating(null)
    toast.success('All reports downloaded')
  }

  const reportGroups = [
    {
      group: 'Inventory Reports',
      icon: Package,
      reports: [
        { key: 'inventory', name: 'Inventory / Item List', description: 'All active items with cost and unit', formats: ['CSV'] },
        { key: 'stock_card', name: 'Stock Card', description: 'Item movement history per item', formats: ['CSV'] },
        { key: 'low_stock', name: 'Low Stock Report', description: 'Items below reorder level', formats: ['CSV'] },
      ],
    },
    {
      group: 'Purchasing Reports',
      icon: ShoppingCart,
      reports: [
        { key: 'purchase_history', name: 'Purchase History (PO)', description: 'All purchase orders', formats: ['CSV'] },
        { key: 'purchase_requests', name: 'Purchase Request Report', description: 'All PRs with approval status', formats: ['CSV'] },
        { key: 'suppliers', name: 'Supplier List', description: 'All suppliers with details', formats: ['CSV'] },
      ],
    },
    {
      group: 'Warehouse Reports',
      icon: Truck,
      reports: [
        { key: 'dr_logs', name: 'DR Logs', description: 'All delivery receipts', formats: ['CSV'] },
        { key: 'csi', name: 'CSI Records', description: 'All CSI charge records', formats: ['CSV'] },
        { key: 'receiving', name: 'Receiving History', description: 'All receiving reports', formats: ['CSV'] },
      ],
    },
    {
      group: 'Client Reports',
      icon: Users,
      reports: [
        { key: 'clients', name: 'Client List', description: 'All clients with details', formats: ['CSV'] },
        { key: 'sales_orders', name: 'Sales Orders', description: 'All sales orders', formats: ['CSV'] },
      ],
    },
    {
      group: 'Accounting & BIR Reports',
      icon: Calculator,
      reports: [
        { key: 'vat_summary', name: 'VAT Summary Report', description: 'Input/Output VAT by period', formats: ['CSV'] },
        { key: 'ewt_summary', name: 'EWT Summary Report', description: 'Expanded withholding tax totals', formats: ['CSV'] },
        { key: 'alphalist', name: 'Alphalist Report', description: 'Supplier alphalist for BIR', formats: ['CSV'] },
        { key: 'slsp', name: 'SLSP Report', description: 'Summary List of Purchases', formats: ['CSV'] },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Reports Center</h2>
          <p className="text-muted-foreground text-sm">Generate and export system reports as CSV</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={downloadAll} disabled={generating === 'all'} variant="outline" className="gap-2">
            {generating === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download All CSV
          </Button>
          <Select value={period} onValueChange={v => setPeriod(v ?? 'all')}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Items', value: stats.items, icon: Package, color: 'text-blue-600' },
            { label: 'Suppliers', value: stats.suppliers, icon: Truck, color: 'text-orange-600' },
            { label: 'Clients', value: stats.clients, icon: Users, color: 'text-purple-600' },
            { label: 'PRs', value: stats.prs, icon: FileText, color: 'text-yellow-600' },
            { label: 'POs', value: stats.pos, icon: ShoppingCart, color: 'text-green-600' },
            { label: 'DR Logs', value: stats.drLogs, icon: BoxesIcon, color: 'text-teal-600' },
            { label: 'CSI Records', value: stats.csiRecords, icon: TrendingUp, color: 'text-red-600' },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-3">
                <div className={`text-xl font-bold ${s.color}`}>{s.value.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <s.icon className="h-3 w-3" />{s.label}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-6">
        {reportGroups.map(group => (
          <Card key={group.group}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <group.icon className="h-4 w-4" />{group.group}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.reports.map(report => (
                  <div key={report.key} className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors gap-3">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{report.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{report.description}</div>
                      <div className="flex gap-1 mt-2">
                        {report.formats.map(fmt => (
                          <Badge key={fmt} variant="outline" className="text-xs h-5">{fmt}</Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 shrink-0"
                      onClick={() => generateReport(report.key)}
                      disabled={generating === report.key}
                    >
                      {generating === report.key
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Download className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
