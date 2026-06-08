'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { FileText, Package, ShoppingCart, Truck, Cpu, Calculator, FileSpreadsheet, Download } from 'lucide-react'
import { toast } from 'sonner'

const reportGroups = [
  {
    group: 'Inventory Reports',
    icon: Package,
    reports: [
      { name: 'Inventory Report', description: 'Current stock levels all items', formats: ['PDF', 'Excel'] },
      { name: 'Stock Card', description: 'Item movement history per item', formats: ['PDF', 'Excel'] },
      { name: 'Stock Movement Report', description: 'All inventory transactions', formats: ['PDF', 'Excel'] },
      { name: 'Low Stock Report', description: 'Items below reorder level', formats: ['PDF', 'Excel'] },
      { name: 'Critical Stock Report', description: 'Items below minimum level', formats: ['PDF'] },
      { name: 'Inventory Valuation', description: 'Total value of all inventory', formats: ['PDF', 'Excel'] },
    ],
  },
  {
    group: 'Purchasing Reports',
    icon: ShoppingCart,
    reports: [
      { name: 'Purchase History', description: 'All purchases by period', formats: ['PDF', 'Excel'] },
      { name: 'Purchase Summary', description: 'Summary by supplier/category', formats: ['PDF', 'Excel'] },
      { name: 'Supplier Purchases', description: 'Purchases per supplier', formats: ['PDF', 'Excel'] },
      { name: 'Purchase Request Report', description: 'All PRs with approval status', formats: ['PDF', 'Excel'] },
    ],
  },
  {
    group: 'Warehouse Reports',
    icon: Truck,
    reports: [
      { name: 'Receiving History', description: 'All receiving reports', formats: ['PDF', 'Excel'] },
      { name: 'Return History', description: 'Supplier returns and resolutions', formats: ['PDF', 'Excel'] },
      { name: 'Stock Transfer Report', description: 'Inter-warehouse transfers', formats: ['PDF', 'Excel'] },
    ],
  },
  {
    group: 'Asset Reports',
    icon: Cpu,
    reports: [
      { name: 'Asset Accountability Report', description: 'All assigned assets by employee', formats: ['PDF', 'Excel'] },
      { name: 'Asset By Department', description: 'Assets grouped by department', formats: ['PDF'] },
    ],
  },
  {
    group: 'Accounting & BIR Reports',
    icon: Calculator,
    reports: [
      { name: 'VAT Summary Report', description: 'Input/Output VAT by period', formats: ['PDF', 'Excel'] },
      { name: 'EWT Summary Report', description: 'Expanded withholding tax totals', formats: ['PDF', 'Excel'] },
      { name: 'Alphalist Report', description: 'Supplier alphalist for BIR', formats: ['Excel', 'CSV'] },
      { name: 'SLSP Report', description: 'Summary List of Purchases', formats: ['Excel', 'CSV'] },
      { name: 'Purchase Book', description: 'Book of accounts — purchases', formats: ['PDF', 'Excel'] },
      { name: 'General Journal', description: 'All journal entries', formats: ['PDF', 'Excel'] },
      { name: 'Expense Summary', description: 'Total expenses by category', formats: ['PDF', 'Excel'] },
      { name: 'Supplier Ledger', description: 'Per supplier account history', formats: ['PDF', 'Excel'] },
    ],
  },
]

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Reports Center</h2>
        <p className="text-muted-foreground text-sm">Generate and export all system reports in PDF or Excel format</p>
      </div>

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
                  <div key={report.name} className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors gap-3">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{report.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{report.description}</div>
                      <div className="flex gap-1 mt-2">
                        {report.formats.map(fmt => (
                          <Badge key={fmt} variant="outline" className="text-xs h-5">{fmt}</Badge>
                        ))}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-accent">
                          <Download className="h-3.5 w-3.5" />
                        </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {report.formats.map(fmt => (
                          <DropdownMenuItem key={fmt} onClick={() => toast.success(`${report.name} exported as ${fmt}`)}>
                            {fmt === 'PDF' ? <FileText className="mr-2 h-4 w-4" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                            Export as {fmt}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
