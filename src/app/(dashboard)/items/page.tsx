'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Search, MoreHorizontal, Upload, Download, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

const mockItems = [
  { id: '1', item_code: 'ITM-001', item_name: 'Bond Paper A4 (500 sheets)', category: 'Office Supplies', brand: 'Navigator', unit_of_measure: 'Ream', cost: 250, reorder_level: 50, quantity_on_hand: 120, status: 'active' },
  { id: '2', item_code: 'ITM-002', item_name: 'Printer Toner HP 85A', category: 'IT Equipment', brand: 'HP', unit_of_measure: 'Piece', cost: 1800, reorder_level: 10, quantity_on_hand: 8, status: 'active' },
  { id: '3', item_code: 'ITM-003', item_name: 'Ballpen Black', category: 'Office Supplies', brand: 'Pilot', unit_of_measure: 'Box', cost: 120, reorder_level: 20, quantity_on_hand: 3, status: 'active' },
  { id: '4', item_code: 'ITM-004', item_name: 'USB Flash Drive 32GB', category: 'IT Equipment', brand: 'Kingston', unit_of_measure: 'Piece', cost: 250, reorder_level: 15, quantity_on_hand: 0, status: 'active' },
  { id: '5', item_code: 'ITM-005', item_name: 'Office Chair', category: 'Furniture', brand: 'La-Z-Boy', unit_of_measure: 'Piece', cost: 8500, reorder_level: 2, quantity_on_hand: 5, status: 'active' },
]

function getStockStatus(qty: number, reorder: number) {
  if (qty === 0) return { label: 'Out of Stock', variant: 'destructive' as const }
  if (qty <= reorder * 0.5) return { label: 'Critical', variant: 'destructive' as const }
  if (qty <= reorder) return { label: 'Low Stock', variant: 'default' as const }
  return { label: 'In Stock', variant: 'outline' as const }
}

export default function ItemsPage() {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = mockItems.filter(i =>
    i.item_name.toLowerCase().includes(search.toLowerCase()) ||
    i.item_code.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Item Master List</h2>
          <p className="text-muted-foreground text-sm">Manage inventory items, stock levels and reorder settings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Upload className="h-4 w-4 mr-1" />Import</Button>
          <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Export</Button>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Item</Button>
        </div>
      </div>

      {/* Stock Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-5 pb-4"><div className="text-2xl font-bold">248</div><div className="text-sm text-muted-foreground">Total Items</div></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><div className="text-2xl font-bold text-green-600">210</div><div className="text-sm text-muted-foreground">In Stock</div></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><div className="text-2xl font-bold text-yellow-600">23</div><div className="text-sm text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5 inline mr-1" />Low Stock</div></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><div className="text-2xl font-bold text-red-600">8</div><div className="text-sm text-muted-foreground">Critical</div></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><div className="text-2xl font-bold text-red-700">7</div><div className="text-sm text-muted-foreground">Out of Stock</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Item List</CardTitle>
            <div className="flex gap-2">
              <Select defaultValue="all">
                <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="office">Office Supplies</SelectItem>
                  <SelectItem value="it">IT Equipment</SelectItem>
                  <SelectItem value="consumables">Consumables</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search items..." className="pl-9 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Code</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>UOM</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">On Hand</TableHead>
                <TableHead className="text-right">Reorder</TableHead>
                <TableHead>Stock Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(item => {
                const stockStatus = getStockStatus(item.quantity_on_hand, item.reorder_level)
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs font-medium text-primary">{item.item_code}</TableCell>
                    <TableCell className="font-medium">{item.item_name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{item.category}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.brand}</TableCell>
                    <TableCell className="text-sm">{item.unit_of_measure}</TableCell>
                    <TableCell className="text-right font-medium">₱{item.cost.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold">{item.quantity_on_hand.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">{item.reorder_level}</TableCell>
                    <TableCell>
                      <Badge variant={stockStatus.variant} className="text-xs">{stockStatus.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-accent">
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Edit Item</DropdownMenuItem>
                          <DropdownMenuItem>View Stock Card</DropdownMenuItem>
                          <DropdownMenuItem>Stock Movement</DropdownMenuItem>
                          <DropdownMenuItem>Generate Barcode</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">Archive</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Item</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1">
              <Label>Item Code *</Label>
              <Input placeholder="Auto-generated" disabled />
            </div>
            <div className="space-y-1">
              <Label>Barcode</Label>
              <Input placeholder="Scan or enter barcode" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Item Name *</Label>
              <Input placeholder="Bond Paper A4 (500 sheets)" />
            </div>
            <div className="space-y-1">
              <Label>Category *</Label>
              <Select><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Office Supplies</SelectItem>
                  <SelectItem value="it">IT Equipment</SelectItem>
                  <SelectItem value="cons">Consumables</SelectItem>
                  <SelectItem value="uniform">Uniforms</SelectItem>
                  <SelectItem value="fixed">Fixed Assets</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Brand</Label>
              <Input placeholder="Navigator, HP, Pilot..." />
            </div>
            <div className="space-y-1">
              <Label>Unit of Measure *</Label>
              <Select><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="piece">Piece</SelectItem>
                  <SelectItem value="box">Box</SelectItem>
                  <SelectItem value="ream">Ream</SelectItem>
                  <SelectItem value="set">Set</SelectItem>
                  <SelectItem value="unit">Unit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Cost *</Label>
              <Input type="number" placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label>Reorder Level</Label>
              <Input type="number" placeholder="10" />
            </div>
            <div className="space-y-1">
              <Label>Minimum Stock</Label>
              <Input type="number" placeholder="5" />
            </div>
            <div className="space-y-1">
              <Label>Maximum Stock</Label>
              <Input type="number" placeholder="100" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Description</Label>
              <Textarea placeholder="Item description..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => { toast.success('Item saved'); setOpen(false) }}>Save Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
