'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Calculator, TrendingUp, Receipt, FileText, DollarSign } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'

interface Summary {
  totalPO: number
  totalReceived: number
  totalEWT: number
  totalVAT: number
  pendingPayables: number
}

export default function AccountingPage() {
  const supabase = createClient()
  const [summary, setSummary] = useState<Summary>({ totalPO: 0, totalReceived: 0, totalEWT: 0, totalVAT: 0, pendingPayables: 0 })
  const [recentPOs, setRecentPOs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const now = new Date()
      const [pos, rrs] = await Promise.all([
        supabase.from('purchase_orders').select('total_amount, ewt_amount, vat_amount, status').gte('created_at', startOfMonth(now).toISOString()),
        supabase.from('receiving_reports').select('total_amount').gte('created_at', startOfMonth(now).toISOString()),
      ])
      const poData = pos.data ?? []
      const rrData = rrs.data ?? []
      setSummary({
        totalPO: poData.reduce((s: number, p: any) => s + (p.total_amount ?? 0), 0),
        totalReceived: rrData.reduce((s: number, r: any) => s + (r.total_amount ?? 0), 0),
        totalEWT: poData.reduce((s: number, p: any) => s + (p.ewt_amount ?? 0), 0),
        totalVAT: poData.reduce((s: number, p: any) => s + (p.vat_amount ?? 0), 0),
        pendingPayables: poData.filter((p: any) => p.status === 'approved' || p.status === 'sent').reduce((s: number, p: any) => s + (p.total_amount ?? 0), 0),
      })

      const { data: recent } = await supabase
        .from('purchase_orders')
        .select('po_number, supplier:suppliers(company_name), total_amount, vat_amount, ewt_amount, status, created_at')
        .order('created_at', { ascending: false })
        .limit(10)
      setRecentPOs(recent ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const fmt = (v: number) => `₱${v.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

  const cards = [
    { title: 'PO Amount (This Month)', value: fmt(summary.totalPO), icon: FileText, color: 'text-blue-600' },
    { title: 'Total Received (This Month)', value: fmt(summary.totalReceived), icon: TrendingUp, color: 'text-green-600' },
    { title: 'Pending Payables', value: fmt(summary.pendingPayables), icon: DollarSign, color: 'text-orange-600' },
    { title: 'EWT Withheld', value: fmt(summary.totalEWT), icon: Receipt, color: 'text-purple-600' },
    { title: 'Input VAT', value: fmt(summary.totalVAT), icon: Calculator, color: 'text-red-600' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Accounting Overview</h1>
        <p className="text-muted-foreground text-sm">Current month — {format(new Date(), 'MMMM yyyy')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {cards.map(card => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{loading ? '—' : card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Purchase Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Gross Amount</TableHead>
                <TableHead className="text-right">VAT (12%)</TableHead>
                <TableHead className="text-right">EWT</TableHead>
                <TableHead className="text-right">Net Payable</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : recentPOs.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No purchase orders yet</TableCell></TableRow>
              ) : recentPOs.map((po: any) => {
                const gross = po.total_amount ?? 0
                const vat = po.vat_amount ?? 0
                const ewt = po.ewt_amount ?? 0
                const net = gross - ewt
                return (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono text-sm">{po.po_number}</TableCell>
                    <TableCell>{po.supplier?.company_name ?? '—'}</TableCell>
                    <TableCell className="text-right">{fmt(gross)}</TableCell>
                    <TableCell className="text-right text-blue-600">{fmt(vat)}</TableCell>
                    <TableCell className="text-right text-red-600">({fmt(ewt)})</TableCell>
                    <TableCell className="text-right font-medium">{fmt(net)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{po.status}</Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
