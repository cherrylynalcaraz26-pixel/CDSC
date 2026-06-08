'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Warehouse, ArrowRightLeft, SlidersHorizontal, ClipboardCheck } from 'lucide-react'
import { toast } from 'sonner'

const warehouses = [
  { id: 'wh1', code: 'WH-MAIN', name: 'Main Warehouse', items: 148, total_value: 1850000, manager: 'Jose Manalo' },
  { id: 'wh2', code: 'WH-IT', name: 'IT Storage Room', items: 52, total_value: 420000, manager: 'Lisa Reyes' },
  { id: 'wh3', code: 'WH-SUPPLY', name: 'Office Supply Room', items: 48, total_value: 85000, manager: 'Ana Cruz' },
]

const transfers = [
  { id: 't1', transfer_number: 'TRF-2025-0012', from: 'Main Warehouse', to: 'IT Storage Room', items: 3, date: '2025-06-07', status: 'completed' },
  { id: 't2', transfer_number: 'TRF-2025-0011', from: 'Main Warehouse', to: 'Office Supply Room', items: 8, date: '2025-06-05', status: 'completed' },
]

const adjustments = [
  { id: 'a1', number: 'ADJ-2025-0003', warehouse: 'Main Warehouse', items: 4, reason: 'Physical count variance', date: '2025-06-06', status: 'pending' },
  { id: 'a2', number: 'ADJ-2025-0002', warehouse: 'IT Storage Room', items: 2, reason: 'Damaged items disposal', date: '2025-05-30', status: 'approved' },
]

export default function WarehousePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Warehouse Management</h2>
          <p className="text-muted-foreground text-sm">Multi-warehouse inventory, transfers and adjustments</p>
        </div>
      </div>

      {/* Warehouse Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {warehouses.map(wh => (
          <Card key={wh.id} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-xs text-primary mb-1">{wh.code}</div>
                  <div className="font-bold">{wh.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">Manager: {wh.manager}</div>
                </div>
                <Warehouse className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded p-2">
                  <div className="text-lg font-bold">{wh.items}</div>
                  <div className="text-xs text-muted-foreground">Item Types</div>
                </div>
                <div className="bg-muted/50 rounded p-2">
                  <div className="text-lg font-bold">₱{(wh.total_value / 1000).toFixed(0)}K</div>
                  <div className="text-xs text-muted-foreground">Stock Value</div>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => toast.info(`Viewing ${wh.name}`)}>
                View Stock
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="transfers">
        <TabsList>
          <TabsTrigger value="transfers"><ArrowRightLeft className="h-4 w-4 mr-1" />Stock Transfers</TabsTrigger>
          <TabsTrigger value="adjustments"><SlidersHorizontal className="h-4 w-4 mr-1" />Adjustments</TabsTrigger>
          <TabsTrigger value="cycle"><ClipboardCheck className="h-4 w-4 mr-1" />Cycle Count</TabsTrigger>
        </TabsList>
        <TabsContent value="transfers">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">Stock Transfer History</CardTitle>
                <Button size="sm" onClick={() => toast.info('Create stock transfer')}>New Transfer</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transfer No.</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs text-primary">{t.transfer_number}</TableCell>
                      <TableCell className="text-sm">{t.from}</TableCell>
                      <TableCell className="text-sm">{t.to}</TableCell>
                      <TableCell className="text-sm">{t.items}</TableCell>
                      <TableCell className="text-sm">{t.date}</TableCell>
                      <TableCell><Badge variant={t.status === 'completed' ? 'outline' : 'default'} className="text-xs">✓ {t.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="adjustments">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base">Stock Adjustments</CardTitle>
                <Button size="sm" onClick={() => toast.info('Create adjustment')}>New Adjustment</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustments.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs text-primary">{a.number}</TableCell>
                      <TableCell className="text-sm">{a.warehouse}</TableCell>
                      <TableCell className="text-sm">{a.items}</TableCell>
                      <TableCell className="text-sm">{a.reason}</TableCell>
                      <TableCell className="text-sm">{a.date}</TableCell>
                      <TableCell><Badge variant={a.status === 'approved' ? 'outline' : 'secondary'} className="text-xs">{a.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="cycle">
          <Card>
            <CardContent className="pt-6 pb-6 text-center">
              <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Physical Inventory / Cycle Count</p>
              <p className="text-sm text-muted-foreground mt-1">Start a new cycle count to reconcile physical vs system inventory</p>
              <Button className="mt-4" onClick={() => toast.info('Starting cycle count wizard...')}>Start Cycle Count</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
