'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { CheckCircle2, XCircle, AlertTriangle, Download, FileBarChart, Zap, FileText } from 'lucide-react'
import { toast } from 'sonner'

const birForms = [
  { form: '0619-E', description: 'Expanded Withholding Tax (Monthly)', period: 'May 2025', due: '2025-06-10', status: 'due_soon', amount: 12450 },
  { form: '0619-F', description: 'Final Withholding Tax (Monthly)', period: 'May 2025', due: '2025-06-10', status: 'due_soon', amount: 3200 },
  { form: '1601-EQ', description: 'Expanded Withholding Tax (Quarterly)', period: 'Q1 2025', due: '2025-04-30', status: 'filed', amount: 38750 },
  { form: '1601-FQ', description: 'Final Withholding Tax (Quarterly)', period: 'Q1 2025', due: '2025-04-30', status: 'filed', amount: 9600 },
  { form: '2550Q', description: 'Value Added Tax (Quarterly)', period: 'Q2 2025', due: '2025-07-25', status: 'pending', amount: 0 },
  { form: '1702Q', description: 'Income Tax (Quarterly)', period: 'Q1 2025', due: '2025-05-29', status: 'filed', amount: 145000 },
]

const readinessChecks = [
  { check: 'All suppliers have TIN on file', status: 'pass', detail: '24/24 suppliers' },
  { check: 'All VAT transactions have proper classification', status: 'pass', detail: '156 transactions' },
  { check: 'EWT rates assigned to suppliers', status: 'warning', detail: '2 suppliers missing ATC code' },
  { check: 'Input VAT supported by ORs/invoices', status: 'pass', detail: '98% compliance' },
  { check: 'Alphalist data complete', status: 'warning', detail: '2 payees missing TIN' },
  { check: 'SLSP purchases data complete', status: 'pass', detail: 'Q1 2025 complete' },
]

const ewtSummary = [
  { supplier: 'ABC Trading Corporation', tin: '123-456-789-000', atc: 'WC010', gross: 450000, vat_excl: 401785.71, ewt_rate: 2, ewt: 8035.71 },
  { supplier: 'XYZ Technology Inc.', tin: '987-654-321-000', atc: 'WC158', gross: 320000, vat_excl: 285714.29, ewt_rate: 2, ewt: 5714.29 },
  { supplier: 'DEF General Supply', tin: '456-789-123-000', atc: 'WC010', gross: 85000, vat_excl: 75892.86, ewt_rate: 1, ewt: 758.93 },
]

const vatSummary = [
  { month: 'Jan 2025', gross_purchases: 820000, input_vat: 88071.43, output_vat: 0, net_vat: 88071.43 },
  { month: 'Feb 2025', gross_purchases: 640000, input_vat: 68571.43, output_vat: 0, net_vat: 68571.43 },
  { month: 'Mar 2025', gross_purchases: 950000, input_vat: 101785.71, output_vat: 0, net_vat: 101785.71 },
]

const readinessScore = Math.round((readinessChecks.filter(c => c.status === 'pass').length / readinessChecks.length) * 100)

export default function BIRPage() {
  const [activeTab, setActiveTab] = useState('overview')

  function exportAlphalist() { toast.success('Alphalist exported to Excel') }
  function exportSLSP() { toast.success('SLSP exported to Excel/CSV') }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">BIR Compliance Module</h2>
          <p className="text-muted-foreground text-sm">Philippine BIR filing management, tax computation, and alphalist generation</p>
        </div>
        <Button className="gap-2" onClick={() => toast.success('Filing readiness check completed!')}>
          <Zap className="h-4 w-4" /> BIR Filing Ready Check
        </Button>
      </div>

      {/* Readiness Score */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-5">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">{readinessScore}%</div>
              <div className="text-sm text-muted-foreground">Filing Ready</div>
            </div>
            <div className="flex-1">
              <Progress value={readinessScore} className="h-3 mb-3" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {readinessChecks.map(check => (
                  <div key={check.check} className="flex items-start gap-2 text-xs">
                    {check.status === 'pass'
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                      : check.status === 'warning'
                      ? <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
                      : <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                    }
                    <div>
                      <div className="font-medium">{check.check}</div>
                      <div className="text-muted-foreground">{check.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Filing Calendar</TabsTrigger>
          <TabsTrigger value="ewt">EWT Summary</TabsTrigger>
          <TabsTrigger value="vat">VAT Summary</TabsTrigger>
          <TabsTrigger value="alphalist">Alphalist</TabsTrigger>
          <TabsTrigger value="slsp">SLSP</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">BIR Filing Calendar 2025</CardTitle>
              <CardDescription>Track all BIR form due dates and filing status</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Form</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {birForms.map(form => (
                    <TableRow key={`${form.form}-${form.period}`}>
                      <TableCell className="font-mono font-bold text-primary">{form.form}</TableCell>
                      <TableCell className="text-sm">{form.description}</TableCell>
                      <TableCell className="text-sm">{form.period}</TableCell>
                      <TableCell className="text-sm font-medium">{form.due}</TableCell>
                      <TableCell className="text-right font-medium">{form.amount ? `₱${form.amount.toLocaleString()}` : '—'}</TableCell>
                      <TableCell>
                        <Badge variant={
                          form.status === 'filed' ? 'outline' :
                          form.status === 'due_soon' ? 'destructive' : 'secondary'
                        } className="text-xs">
                          {form.status === 'filed' ? '✓ Filed' : form.status === 'due_soon' ? '⚠ Due Soon' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {form.status !== 'filed' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs"
                            onClick={() => toast.success(`Form ${form.form} marked as filed`)}>
                            Mark Filed
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ewt">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Expanded Withholding Tax (EWT) Summary</CardTitle>
                  <CardDescription>BIR Form 0619-E / 1601-EQ computation</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => toast.success('EWT summary exported')}>
                  <Download className="h-4 w-4 mr-1" />Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>TIN</TableHead>
                    <TableHead>ATC</TableHead>
                    <TableHead className="text-right">Gross Amount</TableHead>
                    <TableHead className="text-right">VAT Excl. Amount</TableHead>
                    <TableHead className="text-right">EWT Rate</TableHead>
                    <TableHead className="text-right">EWT Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ewtSummary.map(row => (
                    <TableRow key={row.supplier}>
                      <TableCell className="font-medium text-sm">{row.supplier}</TableCell>
                      <TableCell className="font-mono text-xs">{row.tin}</TableCell>
                      <TableCell className="font-mono text-xs">{row.atc}</TableCell>
                      <TableCell className="text-right">₱{row.gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">₱{row.vat_excl.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">{row.ewt_rate}%</TableCell>
                      <TableCell className="text-right font-semibold text-red-700">₱{row.ewt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={3}>TOTAL</TableCell>
                    <TableCell className="text-right">₱{ewtSummary.reduce((s, r) => s + r.gross, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">₱{ewtSummary.reduce((s, r) => s + r.vat_excl, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right text-red-700">₱{ewtSummary.reduce((s, r) => s + r.ewt, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vat">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">VAT Summary — BIR Form 2550Q</CardTitle>
                  <CardDescription>Input VAT from purchases by month</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => toast.success('VAT summary exported')}>
                  <Download className="h-4 w-4 mr-1" />Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Gross Purchases</TableHead>
                    <TableHead className="text-right">Input VAT (12%)</TableHead>
                    <TableHead className="text-right">Output VAT</TableHead>
                    <TableHead className="text-right">Net VAT Payable</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vatSummary.map(row => (
                    <TableRow key={row.month}>
                      <TableCell className="font-medium">{row.month}</TableCell>
                      <TableCell className="text-right">₱{row.gross_purchases.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right text-blue-600">₱{row.input_vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">₱{row.output_vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-semibold">₱{row.net_vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>Q1 TOTAL</TableCell>
                    <TableCell className="text-right">₱{vatSummary.reduce((s, r) => s + r.gross_purchases, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right text-blue-600">₱{vatSummary.reduce((s, r) => s + r.input_vat, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">₱0.00</TableCell>
                    <TableCell className="text-right">₱{vatSummary.reduce((s, r) => s + r.net_vat, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alphalist">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Supplier Alphalist</CardTitle>
                  <CardDescription>Annual list of suppliers with withholding tax — required for BIR submission</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={exportAlphalist}><Download className="h-4 w-4 mr-1" />Export Excel</Button>
                  <Button size="sm" variant="outline" onClick={() => toast.success('Alphalist exported to CSV')}><Download className="h-4 w-4 mr-1" />Export CSV</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Supplier Name</TableHead>
                    <TableHead>TIN</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>ATC</TableHead>
                    <TableHead className="text-right">Total Payments</TableHead>
                    <TableHead className="text-right">Total EWT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ewtSummary.map((row, i) => (
                    <TableRow key={row.supplier}>
                      <TableCell className="text-sm text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium text-sm">{row.supplier}</TableCell>
                      <TableCell className="font-mono text-xs">{row.tin}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">Makati City, Metro Manila</TableCell>
                      <TableCell className="font-mono text-xs">{row.atc}</TableCell>
                      <TableCell className="text-right">₱{row.gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-semibold text-red-700">₱{row.ewt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="slsp">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Summary List of Purchases (SLSP)</CardTitle>
                  <CardDescription>Required quarterly submission — all VAT purchases from suppliers</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={exportSLSP}><Download className="h-4 w-4 mr-1" />Export Excel</Button>
                  <Button size="sm" variant="outline" onClick={() => toast.success('SLSP exported to CSV')}><Download className="h-4 w-4 mr-1" />Export CSV</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground mb-4">
                <strong className="text-foreground">Period:</strong> Q1 2025 (January — March) &nbsp;|&nbsp;
                <strong className="text-foreground">Total VAT Purchases:</strong> ₱2,410,000 &nbsp;|&nbsp;
                <strong className="text-foreground">Total Input VAT:</strong> ₱258,428.57
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>TIN</TableHead>
                    <TableHead>OR/Invoice No.</TableHead>
                    <TableHead className="text-right">Gross Amount</TableHead>
                    <TableHead className="text-right">VAT Amount</TableHead>
                    <TableHead className="text-right">Net of VAT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-sm">Jan 2025</TableCell>
                    <TableCell className="text-sm">ABC Trading</TableCell>
                    <TableCell className="font-mono text-xs">123-456-789-000</TableCell>
                    <TableCell className="font-mono text-xs">SI-2025-1234</TableCell>
                    <TableCell className="text-right">₱180,000.00</TableCell>
                    <TableCell className="text-right text-blue-600">₱19,285.71</TableCell>
                    <TableCell className="text-right">₱160,714.29</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm">Jan 2025</TableCell>
                    <TableCell className="text-sm">XYZ Technology</TableCell>
                    <TableCell className="font-mono text-xs">987-654-321-000</TableCell>
                    <TableCell className="font-mono text-xs">SI-2025-0987</TableCell>
                    <TableCell className="text-right">₱640,000.00</TableCell>
                    <TableCell className="text-right text-blue-600">₱68,571.43</TableCell>
                    <TableCell className="text-right">₱571,428.57</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
