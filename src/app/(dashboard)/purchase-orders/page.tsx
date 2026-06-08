'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { MoreHorizontal, Printer, Eye } from 'lucide-react'

const mockPOs = [
  { id: '1', po_number: 'PO-2025-00045', pr_number: 'PR-2025-00009', supplier: 'ABC Trading Corporation', po_date: '2025-06-05', delivery_date: '2025-06-12', subtotal: 40178.57, vat_amount: 4821.43, ewt: 803.57, total_amount: 45000, net_payable: 44196.43, status: 'open', items: 5 },
  { id: '2', po_number: 'PO-2025-00044', pr_number: 'PR-2025-00008', supplier: 'XYZ Technology Inc.', po_date: '2025-06-03', delivery_date: '2025-06-17', subtotal: 67857.14, vat_amount: 8142.86, ewt: 1357.14, total_amount: 76000, net_payable: 74642.86, status: 'partially_delivered', items: 3 },
  { id: '3', po_number: 'PO-2025-00043', pr_number: null, supplier: 'DEF General Supply', po_date: '2025-05-28', delivery_date: '2025-06-01', subtotal: 15178.57, vat_amount: 1821.43, ewt: 303.57, total_amount: 17000, net_payable: 16696.43, status: 'completed', items: 8 },
]

const STATUS_MAP = {
  open: { label: 'Open', variant: 'default' },
  partially_delivered: { label: 'Partial Delivery', variant: 'secondary' },
  completed: { label: 'Completed', variant: 'outline' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
} as const

export default function PurchaseOrdersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Purchase Orders</h2>
          <p className="text-muted-foreground text-sm">Manage purchase orders, track deliveries and supplier payments</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5 pb-4"><div className="text-2xl font-bold">₱2.1M</div><div className="text-sm text-muted-foreground">Total PO This Month</div></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><div className="text-2xl font-bold text-blue-600">12</div><div className="text-sm text-muted-foreground">Open Orders</div></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><div className="text-2xl font-bold text-yellow-600">5</div><div className="text-sm text-muted-foreground">Partial Delivery</div></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><div className="text-2xl font-bold text-green-600">28</div><div className="text-sm text-muted-foreground">Completed</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Purchase Order List</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>PR Ref</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>PO Date</TableHead>
                <TableHead>Delivery Date</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">VAT (12%)</TableHead>
                <TableHead className="text-right">EWT</TableHead>
                <TableHead className="text-right">Net Payable</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockPOs.map(po => (
                <TableRow key={po.id}>
                  <TableCell className="font-mono text-xs font-semibold text-primary">{po.po_number}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{po.pr_number ?? '—'}</TableCell>
                  <TableCell className="font-medium text-sm">{po.supplier}</TableCell>
                  <TableCell className="text-sm">{po.po_date}</TableCell>
                  <TableCell className="text-sm">{po.delivery_date}</TableCell>
                  <TableCell className="text-right text-sm">₱{po.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right text-sm text-blue-600">₱{po.vat_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right text-sm text-red-700">₱{po.ewt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-right font-semibold">₱{po.net_payable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_MAP[po.status as keyof typeof STATUS_MAP].variant} className="text-xs">
                      {STATUS_MAP[po.status as keyof typeof STATUS_MAP].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Eye className="mr-2 h-4 w-4" />View PO</DropdownMenuItem>
                        <DropdownMenuItem><Printer className="mr-2 h-4 w-4" />Print PO</DropdownMenuItem>
                        <DropdownMenuItem>Create Receiving Report</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Cancel PO</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tax Computation Legend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Tax Computation Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground">Gross Amount:</span> <span className="font-medium">₱45,000.00</span></div>
            <div><span className="text-muted-foreground">÷ 1.12 (VAT Excl.):</span> <span className="font-medium">₱40,178.57</span></div>
            <div><span className="text-muted-foreground">Input VAT (12%):</span> <span className="font-medium text-blue-600">₱4,821.43</span></div>
            <div><span className="text-muted-foreground">EWT (2% of excl.):</span> <span className="font-medium text-red-700">₱803.57</span></div>
            <Separator className="col-span-4" />
            <div><span className="text-muted-foreground">Total Amount:</span> <span className="font-medium">₱45,000.00</span></div>
            <div><span className="text-muted-foreground">Less: EWT:</span> <span className="font-medium text-red-700">− ₱803.57</span></div>
            <div><span className="text-muted-foreground">Net Payable:</span> <span className="font-bold text-primary">₱44,196.43</span></div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
