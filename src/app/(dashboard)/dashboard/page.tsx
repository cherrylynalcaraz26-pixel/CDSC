'use client'

import { KPICard } from '@/components/dashboard/kpi-card'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  Package, ShoppingCart, Truck, AlertTriangle, XCircle,
  FileText, Clock, RotateCcw, CheckCircle2, TrendingUp,
  Cpu, FileBarChart, DollarSign, Boxes,
} from 'lucide-react'

// Mock data — replace with Supabase queries
const monthlyPurchases = [
  { month: 'Jan', amount: 120000 }, { month: 'Feb', amount: 98000 },
  { month: 'Mar', amount: 145000 }, { month: 'Apr', amount: 132000 },
  { month: 'May', amount: 178000 }, { month: 'Jun', amount: 156000 },
]

const categoryStock = [
  { name: 'Office Supplies', value: 35 }, { name: 'IT Equipment', value: 25 },
  { name: 'Consumables', value: 20 }, { name: 'Uniforms', value: 12 },
  { name: 'Fixed Assets', value: 8 },
]

const COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626']

const topItems = [
  { name: 'Bond Paper A4', qty: 150, value: 12000 },
  { name: 'Printer Toner', qty: 45, value: 54000 },
  { name: 'USB Flash Drive', qty: 80, value: 16000 },
  { name: 'Office Chair', qty: 12, value: 96000 },
  { name: 'Laptop', qty: 8, value: 320000 },
]

const supplierPerformance = [
  { supplier: 'ABC Trading', onTime: 95, quality: 98 },
  { supplier: 'XYZ Corp', onTime: 88, quality: 92 },
  { supplier: 'DEF Supply', onTime: 72, quality: 85 },
  { supplier: 'GHI Store', onTime: 91, quality: 96 },
]

const pendingApprovals = [
  { id: 'PR-2025-00012', type: 'Purchase Request', requestor: 'Juan Dela Cruz', dept: 'IT', date: '2025-06-08', priority: 'high' },
  { id: 'PR-2025-00011', type: 'Purchase Request', requestor: 'Maria Santos', dept: 'Admin', date: '2025-06-07', priority: 'normal' },
  { id: 'ER-2025-00034', type: 'Employee Request', requestor: 'Pedro Reyes', dept: 'Operations', date: '2025-06-07', priority: 'urgent' },
  { id: 'ADJ-2025-0003', type: 'Stock Adjustment', requestor: 'Ana Lopez', dept: 'Warehouse', date: '2025-06-06', priority: 'normal' },
]

const birStatus = [
  { form: '2550Q', period: 'Q2 2025', due: '2025-07-25', status: 'pending' },
  { form: '1601-EQ', period: 'May 2025', due: '2025-06-10', status: 'due_soon' },
  { form: '1601-FQ', period: 'Q1 2025', due: '2025-04-15', status: 'filed' },
  { form: '0619-E', period: 'May 2025', due: '2025-06-10', status: 'due_soon' },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Executive Dashboard</h2>
          <p className="text-muted-foreground text-sm">Welcome back! Here&apos;s your business overview.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">Export Report</Button>
          <Button size="sm">Refresh</Button>
        </div>
      </div>

      {/* KPI Cards — Row 1: Inventory */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Inventory Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <KPICard title="Total Inventory Value" value="₱2.4M" icon={DollarSign} trend={8} variant="default" />
          <KPICard title="Total Stock On Hand" value="4,832" subtitle="units across all warehouses" icon={Boxes} />
          <KPICard title="Low Stock Items" value="23" subtitle="Below reorder level" icon={AlertTriangle} variant="warning" />
          <KPICard title="Critical Stock" value="8" subtitle="Below minimum level" icon={AlertTriangle} variant="danger" />
          <KPICard title="Out of Stock" value="3" subtitle="Zero inventory" icon={XCircle} variant="danger" />
        </div>
      </div>

      {/* KPI Cards — Row 2: Transactions */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Pending Transactions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
          <KPICard title="Purchase Requests" value="7" subtitle="Awaiting approval" icon={FileText} variant="warning" />
          <KPICard title="Purchase Orders" value="12" subtitle="Open orders" icon={ShoppingCart} />
          <KPICard title="Receiving Reports" value="5" subtitle="Pending receipt" icon={Truck} />
          <KPICard title="Pending Returns" value="2" subtitle="Supplier returns" icon={RotateCcw} variant="warning" />
        </div>
      </div>

      {/* Charts Row */}
      <Tabs defaultValue="purchases" className="space-y-4">
        <TabsList>
          <TabsTrigger value="purchases">Monthly Purchases</TabsTrigger>
          <TabsTrigger value="category">Stock by Category</TabsTrigger>
          <TabsTrigger value="suppliers">Supplier Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="purchases">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Purchase Trend</CardTitle>
              <CardDescription>Total purchase amount per month (₱)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyPurchases}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis tickFormatter={v => `₱${(v / 1000).toFixed(0)}K`} className="text-xs" />
                  <Tooltip formatter={(v: number) => [`₱${v.toLocaleString()}`, 'Purchases']} />
                  <Bar dataKey="amount" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="category">
          <Card>
            <CardHeader>
              <CardTitle>Stock Distribution by Category</CardTitle>
              <CardDescription>Percentage of inventory value per category</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={categoryStock} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {categoryStock.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers">
          <Card>
            <CardHeader>
              <CardTitle>Supplier Performance Score</CardTitle>
              <CardDescription>On-time delivery and quality rating (%)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={supplierPerformance} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} className="text-xs" />
                  <YAxis dataKey="supplier" type="category" width={100} className="text-xs" />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Legend />
                  <Bar dataKey="onTime" name="On-Time Delivery" fill="#2563eb" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="quality" name="Quality Rating" fill="#059669" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bottom Row: Top Items + Pending Approvals + BIR */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Top Purchased Items */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Top Purchased Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-4 text-xs">{i + 1}</span>
                    <span className="font-medium truncate max-w-[140px]">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">₱{item.value.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{item.qty} units</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingApprovals.map((item) => (
                <div key={item.id} className="flex items-start justify-between text-sm gap-2">
                  <div>
                    <div className="font-medium text-xs text-primary">{item.id}</div>
                    <div className="text-muted-foreground text-xs">{item.requestor} • {item.dept}</div>
                  </div>
                  <Badge variant={item.priority === 'urgent' ? 'destructive' : item.priority === 'high' ? 'default' : 'secondary'} className="text-xs shrink-0">
                    {item.priority}
                  </Badge>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="w-full mt-4">View All Approvals</Button>
          </CardContent>
        </Card>

        {/* BIR Filing Status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileBarChart className="h-4 w-4" /> BIR Filing Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {birStatus.map((item) => (
                <div key={item.form} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold">Form {item.form}</div>
                    <div className="text-xs text-muted-foreground">{item.period} • Due: {item.due}</div>
                  </div>
                  <Badge variant={
                    item.status === 'filed' ? 'outline' :
                    item.status === 'due_soon' ? 'destructive' : 'secondary'
                  } className="text-xs">
                    {item.status === 'filed' ? '✓ Filed' : item.status === 'due_soon' ? 'Due Soon' : 'Pending'}
                  </Badge>
                </div>
              ))}
            </div>
            <Button size="sm" className="w-full mt-4">BIR Filing Ready Check</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
