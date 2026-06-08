'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  Package, ShoppingCart, Truck, AlertTriangle, XCircle,
  FileText, RotateCcw, TrendingUp, DollarSign, Boxes,
} from 'lucide-react'

const COLORS = ['#dc2626', '#f97316', '#eab308', '#22c55e', '#3b82f6']

interface KPI {
  totalItems: number
  activeSuppliers: number
  lowStock: number
  outOfStock: number
  openPOs: number
  pendingPRs: number
  totalStockValue: number
}

function StatCard({ title, value, icon: Icon, sub, color }: { title: string; value: string | number; icon: any; sub?: string; color?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color ?? 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const supabase = createClient()
  const [kpi, setKpi] = useState<KPI>({ totalItems: 0, activeSuppliers: 0, lowStock: 0, outOfStock: 0, openPOs: 0, pendingPRs: 0, totalStockValue: 0 })
  const [categoryData, setCategoryData] = useState<{ name: string; value: number }[]>([])
  const [recentPOs, setRecentPOs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [items, suppliers, stockLevels, pos, prs, categories] = await Promise.all([
        supabase.from('items').select('id, status, cost, reorder_level, category_id'),
        supabase.from('suppliers').select('id, is_active'),
        supabase.from('stock_levels').select('item_id, quantity_on_hand'),
        supabase.from('purchase_orders').select('id, status, total_amount, po_number, created_at, supplier:suppliers(company_name)'),
        supabase.from('purchase_requests').select('id, status'),
        supabase.from('categories').select('id, category_name'),
      ])

      const allItems = items.data ?? []
      const allStock = stockLevels.data ?? []

      // Map quantity per item
      const qtyMap: Record<string, number> = {}
      for (const s of allStock) {
        qtyMap[s.item_id] = (qtyMap[s.item_id] ?? 0) + s.quantity_on_hand
      }

      const activeItems = allItems.filter(i => i.status === 'active')
      const lowStock = activeItems.filter(i => {
        const qty = qtyMap[i.id] ?? 0
        return qty > 0 && qty <= (i.reorder_level ?? 0)
      }).length
      const outOfStock = activeItems.filter(i => (qtyMap[i.id] ?? 0) === 0).length
      const totalStockValue = activeItems.reduce((s, i) => s + (qtyMap[i.id] ?? 0) * (i.cost ?? 0), 0)

      const allPOs = pos.data ?? []
      const allPRs = prs.data ?? []
      const allSuppliers = suppliers.data ?? []
      const allCats = categories.data ?? []

      setKpi({
        totalItems: activeItems.length,
        activeSuppliers: allSuppliers.filter(s => s.is_active).length,
        lowStock,
        outOfStock,
        openPOs: allPOs.filter(p => ['draft', 'sent', 'approved'].includes(p.status)).length,
        pendingPRs: allPRs.filter(p => p.status === 'pending').length,
        totalStockValue,
      })

      // Category distribution
      const catCount: Record<string, number> = {}
      for (const item of activeItems) {
        const catName = allCats.find(c => c.id === item.category_id)?.category_name ?? 'Uncategorized'
        catCount[catName] = (catCount[catName] ?? 0) + 1
      }
      setCategoryData(
        Object.entries(catCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, value]) => ({ name, value }))
      )

      setRecentPOs(allPOs.slice(0, 8))
      setLoading(false)
    }
    load()
  }, [])

  const fmt = (v: number) => `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground text-sm">Business overview — live data</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <StatCard title="Total Items" value={loading ? '—' : kpi.totalItems} icon={Package} />
        <StatCard title="Active Suppliers" value={loading ? '—' : kpi.activeSuppliers} icon={TrendingUp} />
        <StatCard title="Stock Value" value={loading ? '—' : fmt(kpi.totalStockValue)} icon={DollarSign} color="text-green-600" />
        <StatCard title="Low Stock" value={loading ? '—' : kpi.lowStock} icon={AlertTriangle} color="text-yellow-500" sub="Below reorder level" />
        <StatCard title="Out of Stock" value={loading ? '—' : kpi.outOfStock} icon={XCircle} color="text-red-600" sub="Zero inventory" />
        <StatCard title="Open POs" value={loading ? '—' : kpi.openPOs} icon={ShoppingCart} sub="Pending orders" />
        <StatCard title="Pending PRs" value={loading ? '—' : kpi.pendingPRs} icon={FileText} sub="Awaiting approval" />
      </div>

      {/* Charts + Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Items by Category</CardTitle>
            <CardDescription className="text-xs">Top 5 categories</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent POs */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Purchase Orders</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">PO #</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Supplier</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Amount</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-xs">Loading…</td></tr>
                ) : recentPOs.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-6 text-muted-foreground text-xs">No purchase orders yet</td></tr>
                ) : recentPOs.map((po: any) => (
                  <tr key={po.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{po.po_number}</td>
                    <td className="px-4 py-2 text-xs">{po.supplier?.company_name ?? '—'}</td>
                    <td className="px-4 py-2 text-right text-xs font-medium">{fmt(po.total_amount ?? 0)}</td>
                    <td className="px-4 py-2">
                      <Badge variant="secondary" className="text-xs">{po.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
