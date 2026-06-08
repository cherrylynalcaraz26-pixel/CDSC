'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, MoreHorizontal, Cpu, ArrowRightLeft } from 'lucide-react'

const mockAssets = [
  { id: '1', asset_number: 'AST-2025-001', asset_category: 'IT Equipment', item_name: 'Laptop Dell Inspiron 15', serial_number: 'DL-INSP-2025-001', assigned_to: 'Juan Dela Cruz', department: 'IT', date_issued: '2025-01-15', purchase_cost: 45000, status: 'active' },
  { id: '2', asset_number: 'AST-2025-002', asset_category: 'IT Equipment', item_name: 'Monitor LG 24"', serial_number: 'LG-MON-2025-002', assigned_to: 'Maria Santos', department: 'Finance', date_issued: '2025-02-01', purchase_cost: 12500, status: 'active' },
  { id: '3', asset_number: 'AST-2024-045', asset_category: 'Furniture', item_name: 'Executive Office Chair', serial_number: null, assigned_to: 'Pedro Reyes', department: 'Admin', date_issued: '2024-11-10', purchase_cost: 8500, status: 'active' },
  { id: '4', asset_number: 'AST-2024-038', asset_category: 'IT Equipment', item_name: 'Printer HP LaserJet', serial_number: 'HP-LJ-2024-038', assigned_to: null, department: null, date_issued: null, purchase_cost: 22000, status: 'returned' },
]

export default function AssetsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Asset Accountability</h2>
          <p className="text-muted-foreground text-sm">Track fixed assets, assignments, transfers and disposals</p>
        </div>
        <Button><Plus className="h-4 w-4 mr-2" />Issue Asset</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5 pb-4"><div className="text-2xl font-bold">142</div><div className="text-sm text-muted-foreground">Total Assets</div></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><div className="text-2xl font-bold text-green-600">128</div><div className="text-sm text-muted-foreground">Active / Assigned</div></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><div className="text-2xl font-bold text-blue-600">8</div><div className="text-sm text-muted-foreground">Available (Unassigned)</div></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><div className="text-2xl font-bold">₱3.2M</div><div className="text-sm text-muted-foreground">Total Asset Value</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Cpu className="h-4 w-4" />Asset List</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset No.</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Serial No.</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Date Issued</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockAssets.map(asset => (
                <TableRow key={asset.id}>
                  <TableCell className="font-mono text-xs font-semibold text-primary">{asset.asset_number}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{asset.asset_category}</Badge></TableCell>
                  <TableCell className="font-medium text-sm">{asset.item_name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{asset.serial_number ?? '—'}</TableCell>
                  <TableCell className="text-sm">{asset.assigned_to ?? <span className="text-muted-foreground italic">Unassigned</span>}</TableCell>
                  <TableCell className="text-sm">{asset.department ?? '—'}</TableCell>
                  <TableCell className="text-sm">{asset.date_issued ?? '—'}</TableCell>
                  <TableCell className="text-right font-medium">₱{asset.purchase_cost.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={asset.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                      {asset.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-accent"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Accountability Form</DropdownMenuItem>
                        <DropdownMenuItem><ArrowRightLeft className="mr-2 h-4 w-4" />Transfer Asset</DropdownMenuItem>
                        <DropdownMenuItem>Return Asset</DropdownMenuItem>
                        <DropdownMenuItem>Asset History</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Dispose Asset</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
