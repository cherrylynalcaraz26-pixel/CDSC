'use client'

// Income Tax (1701Q / 1701) estimate from the books — the CDSC counterpart of the
// CHEM app's "ITR (Income Tax) + SAWT" tab. Quarterly returns are cumulative
// (year-to-date), so each column is Jan 1 → end of that quarter.
//
// Sole proprietor (individual), TRAIN graduated rates from 2023:
//   ≤250k 0 · 250k–400k 15% · 400k–800k 22.5k+20% · 800k–2M 102.5k+25%
//   2M–8M 402.5k+30% · >8M 2.2025M+35%
// Two deduction methods are shown side by side: itemized (actual expenses) and
// the Optional Standard Deduction (40% of gross sales). The election is made on
// the first quarterly return of the year and applies to the whole year.

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { fetchLedgerLines, lineDate, type LedgerLine, type COAAccount } from '@/lib/ledger'

const peso = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const r2 = (n: number) => Math.round(n * 100) / 100

export function graduatedTax(ti: number): number {
  if (ti <= 250_000) return 0
  if (ti <= 400_000) return r2((ti - 250_000) * 0.15)
  if (ti <= 800_000) return r2(22_500 + (ti - 400_000) * 0.20)
  if (ti <= 2_000_000) return r2(102_500 + (ti - 800_000) * 0.25)
  if (ti <= 8_000_000) return r2(402_500 + (ti - 2_000_000) * 0.30)
  return r2(2_202_500 + (ti - 8_000_000) * 0.35)
}

const NON_DEDUCTIBLE = new Set(['5910']) // BIR tax payments — income tax isn't deductible

export function IncomeTaxEstimate({ isCorporate }: { isCorporate: boolean }) {
  const supabase = createClient()
  const [lines, setLines] = useState<LedgerLine[] | null>(null)
  const [coa, setCoa] = useState<COAAccount[]>([])
  const [year, setYear] = useState(new Date().getFullYear())

  useEffect(() => {
    let active = true
    Promise.all([
      fetchLedgerLines(supabase),
      supabase.from('chart_of_accounts').select('account_code,account_name,account_type,normal_balance,is_header'),
    ]).then(([l, { data }]) => { if (active) { setLines(l); setCoa((data ?? []) as COAAccount[]) } })
    return () => { active = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const cols = useMemo(() => {
    if (!lines) return []
    const type = (code: string) => coa.find(a => a.account_code === code)?.account_type ?? ({ '4': 'revenue', '5': 'expense', '6': 'expense' } as Record<string, string>)[code[0]] ?? ''
    const periods = isCorporate
      ? [['Q1', '03-31'], ['Q2', '06-30'], ['Q3', '09-30'], ['Annual', '12-31']]
      : [['Q1 (1701Q)', '03-31'], ['Q2 (1701Q)', '06-30'], ['Q3 (1701Q)', '09-30'], ['Annual (1701)', '12-31']]
    return periods.map(([label, end]) => {
      const to = `${year}-${end}`
      const ytd = lines.filter(l => { const d = lineDate(l); return d >= `${year}-01-01` && d <= to })
      let sales = 0, cogs = 0, opex = 0, cwt = 0
      for (const l of ytd) {
        const t = type(l.account_code)
        if (t === 'revenue') sales += l.credit - l.debit
        else if (t === 'expense' && !NON_DEDUCTIBLE.has(l.account_code)) {
          if (l.account_code === '5100') cogs += l.debit - l.credit
          else opex += l.debit - l.credit
        }
        if (l.account_code === '1120') cwt += l.debit // 2307s received from clients (SAWT)
      }
      const grossIncome = sales - cogs
      const tiItemized = Math.max(0, grossIncome - opex)
      const tiOsd = Math.max(0, isCorporate ? grossIncome * 0.6 : sales * 0.6)
      const tax = (ti: number) => isCorporate ? r2(ti * 0.25) : graduatedTax(ti)
      const taxItemized = tax(tiItemized), taxOsd = tax(tiOsd)
      return {
        label, sales: r2(sales), cogs: r2(cogs), grossIncome: r2(grossIncome), opex: r2(opex), cwt: r2(cwt),
        tiItemized: r2(tiItemized), taxItemized, payItemized: r2(Math.max(0, taxItemized - cwt)),
        tiOsd: r2(tiOsd), taxOsd, payOsd: r2(Math.max(0, taxOsd - cwt)),
      }
    })
  }, [lines, coa, year, isCorporate])

  if (!lines) return <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>

  const annual = cols[cols.length - 1]
  const better = annual && annual.taxOsd < annual.taxItemized ? 'osd' : 'itemized'
  const rows: [string, keyof (typeof cols)[number], string?][] = [
    ['Gross sales (VAT-exclusive)', 'sales'],
    ['Less: Cost of goods sold', 'cogs'],
    ['Gross income', 'grossIncome', 'font-semibold'],
    ['Less: Operating expenses (itemized)', 'opex'],
    ['Taxable income — Itemized', 'tiItemized', 'font-semibold'],
    ['Income tax due — Itemized', 'taxItemized', 'font-semibold'],
    [isCorporate ? 'Taxable income — OSD (60% of gross income)' : 'Taxable income — OSD (60% of gross sales)', 'tiOsd', 'font-semibold'],
    ['Income tax due — OSD', 'taxOsd', 'font-semibold'],
    ['Less: Creditable tax withheld (2307s, SAWT)', 'cwt'],
    ['Tax payable — Itemized (before prior-quarter payments)', 'payItemized', 'font-bold'],
    ['Tax payable — OSD (before prior-quarter payments)', 'payOsd', 'font-bold'],
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Income Tax — {isCorporate ? '1702Q / 1702-RT' : '1701Q / 1701'} estimate</p>
          <p className="text-xs text-muted-foreground">Year-to-date from posted journal entries. Quarterly returns are cumulative; subtract what you paid in earlier quarters.</p>
        </div>
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="h-9 w-28"><span className="text-sm">{year}</span></SelectTrigger>
          <SelectContent>{[0, 1, 2].map(i => { const y = new Date().getFullYear() - i; return <SelectItem key={y} value={String(y)}>{y}</SelectItem> })}</SelectContent>
        </Select>
      </div>

      {annual && (
        <div className="rounded-xl bg-[#F84400]/10 px-4 py-3 text-sm">
          Based on the books so far, <b>{better === 'osd' ? 'the Optional Standard Deduction (OSD)' : 'itemized deductions'}</b> gives the lower tax for {year}
          {' '}({peso(Math.min(annual.taxOsd, annual.taxItemized))} vs {peso(Math.max(annual.taxOsd, annual.taxItemized))}). The method is chosen on the first quarterly return and applies all year.
        </div>
      )}

      <Card><CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/60 text-xs">
              <tr><th className="px-3 py-2 text-left font-semibold">Year-to-date</th>{cols.map(c => <th key={c.label} className="px-3 py-2 text-right font-semibold">{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map(([label, key, cls]) => (
                <tr key={key} className={key === 'tiItemized' || key === 'tiOsd' || key === 'payItemized' ? 'shadow-[inset_0_1px_0_rgba(0,0,0,0.06)]' : ''}>
                  <td className={`px-3 py-1.5 ${cls ?? 'text-muted-foreground'}`}>{label}</td>
                  {cols.map(c => <td key={c.label} className={`px-3 py-1.5 text-right tabular-nums ${cls ?? ''}`}>{peso(c[key] as number)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent></Card>
      <p className="text-[11px] text-muted-foreground">
        {isCorporate ? 'Regular corporate rate 25% shown (20% applies if taxable income ≤ ₱5M and total assets ≤ ₱100M). ' : 'TRAIN graduated rates for individuals (2023 onward). The 8% option is not available to VAT-registered taxpayers. '}
        Account 5910 (BIR Tax Payments) is excluded from deductions. This is an estimate for planning — confirm figures with your accountant before filing.
      </p>
    </div>
  )
}
