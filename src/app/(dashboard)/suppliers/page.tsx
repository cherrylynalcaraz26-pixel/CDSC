'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Search, MoreHorizontal, Building2, Star, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'

const mockSuppliers = [
  { id: '1', supplier_code: 'SUP-001', company_name: 'ABC Trading Corporation', contact_person: 'Juan Reyes', mobile_number: '09171234567', email: 'abc@trading.com', tin: '123-456-789-000', vat_registered: true, supplier_category: 'Office Supplies', payment_terms: '30 days', lead_time_days: 7, status: 'active', rating: 4.8 },
  { id: '2', supplier_code: 'SUP-002', company_name: 'XYZ Technology Inc.', contact_person: 'Maria Santos', mobile_number: '09189876543', email: 'xyz@tech.com', tin: '987-654-321-000', vat_registered: true, supplier_category: 'IT Equipment', payment_terms: '15 days', lead_time_days: 14, status: 'active', rating: 4.2 },
  { id: '3', supplier_code: 'SUP-003', company_name: 'DEF General Supply', contact_person: 'Pedro Dela Cruz', mobile_number: '09201112222', email: 'def@supply.com', tin: '456-789-123-000', vat_registered: false, supplier_category: 'Consumables', payment_terms: 'COD', lead_time_days: 3, status: 'active', rating: 3.9 },
]

interface SupplierFormData {
  company_name: string
  contact_person: string
  mobile_number: string
  email: string
  address: string
  tin: string
  vat_registered: string
  supplier_category: string
  payment_terms: string
  lead_time_days: string
  atc_code: string
  ewt_rate: string
  vat_classification: string
}

export default function SuppliersPage() {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<SupplierFormData>({
    company_name: '', contact_person: '', mobile_number: '', email: '',
    address: '', tin: '', vat_registered: 'true', supplier_category: '',
    payment_terms: '30 days', lead_time_days: '7', atc_code: '', ewt_rate: '2',
    vat_classification: 'vatable',
  })

  const filtered = mockSuppliers.filter(s =>
    s.company_name.toLowerCase().includes(search.toLowerCase()) ||
    s.supplier_code.toLowerCase().includes(search.toLowerCase())
  )

  function handleSave() {
    toast.success('Supplier saved successfully')
    setOpen(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Supplier Management</h2>
          <p className="text-muted-foreground text-sm">Manage supplier information, performance and tax details</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Supplier
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5 pb-4"><div className="text-2xl font-bold">24</div><div className="text-sm text-muted-foreground">Total Suppliers</div></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><div className="text-2xl font-bold text-green-600">21</div><div className="text-sm text-muted-foreground">Active</div></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><div className="text-2xl font-bold text-blue-600">18</div><div className="text-sm text-muted-foreground">VAT Registered</div></CardContent></Card>
        <Card><CardContent className="pt-5 pb-4"><div className="text-2xl font-bold">4.5<span className="text-sm text-yellow-500 ml-1">★</span></div><div className="text-sm text-muted-foreground">Avg Rating</div></CardContent></Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">Supplier List</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search suppliers..." className="pl-9 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Company Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>TIN</TableHead>
                <TableHead>VAT</TableHead>
                <TableHead>Terms</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs font-medium text-primary">{s.supplier_code}</TableCell>
                  <TableCell>
                    <div className="font-medium">{s.company_name}</div>
                    <div className="text-xs text-muted-foreground">{s.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{s.contact_person}</div>
                    <div className="text-xs text-muted-foreground">{s.mobile_number}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{s.supplier_category}</Badge></TableCell>
                  <TableCell className="text-xs font-mono">{s.tin}</TableCell>
                  <TableCell>
                    {s.vat_registered
                      ? <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200">VAT Reg</Badge>
                      : <Badge variant="outline" className="text-xs">Non-VAT</Badge>}
                  </TableCell>
                  <TableCell className="text-sm">{s.payment_terms}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">{s.rating}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-accent">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem>View Purchase History</DropdownMenuItem>
                        <DropdownMenuItem>Supplier Ledger</DropdownMenuItem>
                        <DropdownMenuItem>Performance Report</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Archive</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Supplier Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Add Supplier</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2">
            {/* Company Info */}
            <div>
              <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Company Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <Label>Company Name *</Label>
                  <Input placeholder="ABC Trading Corporation" value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Contact Person *</Label>
                  <Input placeholder="Juan Reyes" value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Mobile Number *</Label>
                  <Input placeholder="09171234567" value={form.mobile_number} onChange={e => setForm(f => ({ ...f, mobile_number: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Email *</Label>
                  <Input type="email" placeholder="supplier@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Category *</Label>
                  <Select value={form.supplier_category} onValueChange={v => setForm(f => ({ ...f, supplier_category: v ?? f.supplier_category }))}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Office Supplies">Office Supplies</SelectItem>
                      <SelectItem value="IT Equipment">IT Equipment</SelectItem>
                      <SelectItem value="Consumables">Consumables</SelectItem>
                      <SelectItem value="General Merchandise">General Merchandise</SelectItem>
                      <SelectItem value="Services">Services</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Address *</Label>
                  <Input placeholder="123 Supplier St., Makati City" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Payment Terms</Label>
                  <Select value={form.payment_terms} onValueChange={v => setForm(f => ({ ...f, payment_terms: v ?? f.payment_terms }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COD">COD</SelectItem>
                      <SelectItem value="7 days">7 Days</SelectItem>
                      <SelectItem value="15 days">15 Days</SelectItem>
                      <SelectItem value="30 days">30 Days</SelectItem>
                      <SelectItem value="60 days">60 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Lead Time (Days)</Label>
                  <Input type="number" placeholder="7" value={form.lead_time_days} onChange={e => setForm(f => ({ ...f, lead_time_days: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* BIR Tax Info */}
            <div>
              <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">BIR / Tax Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>TIN</Label>
                  <Input placeholder="123-456-789-000" value={form.tin} onChange={e => setForm(f => ({ ...f, tin: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>VAT Registration</Label>
                  <Select value={form.vat_registered} onValueChange={v => setForm(f => ({ ...f, vat_registered: v ?? f.vat_registered }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">VAT Registered</SelectItem>
                      <SelectItem value="false">Non-VAT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>VAT Classification</Label>
                  <Select value={form.vat_classification} onValueChange={v => setForm(f => ({ ...f, vat_classification: v ?? f.vat_classification }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vatable">Vatable (12%)</SelectItem>
                      <SelectItem value="vat_exempt">VAT Exempt</SelectItem>
                      <SelectItem value="zero_rated">Zero Rated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>ATC Code</Label>
                  <Input placeholder="WC010" value={form.atc_code} onChange={e => setForm(f => ({ ...f, atc_code: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>EWT Rate (%)</Label>
                  <Select value={form.ewt_rate} onValueChange={v => setForm(f => ({ ...f, ewt_rate: v ?? f.ewt_rate }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1% — Goods</SelectItem>
                      <SelectItem value="2">2% — Services</SelectItem>
                      <SelectItem value="5">5% — Professional Services</SelectItem>
                      <SelectItem value="10">10% — Professional (Income ≥ 720K)</SelectItem>
                      <SelectItem value="15">15% — Prof. (Income ≥ 720K alt)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Supplier</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
