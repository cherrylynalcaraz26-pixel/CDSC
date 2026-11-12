// BIR Compliance Calendar — deadline engine for CDSC Industrial Supply.
// Adapted from the CHEM app's lib/bir/complianceCalendar.ts.
//
// CDSC files as a SOLE PROPRIETOR (individual taxpayer), VAT-registered, calendar
// year, manual / eBIRForms filer. The form set adapts to the Company Tax Profile
// in Settings (VAT vs non-VAT, individual vs corporation, withholding agent,
// employees), and any form can be switched on/off under "Applicable Forms".
//
// Due dates that fall on a weekend, a regular holiday or a nationwide special
// non-working day roll to the next working day (src/lib/ph-holidays.ts).
// Locality-only days (e.g. NCR) don't move deadlines — CDSC is in Batangas.
//
// Period labels match what bir_filings.tax_period has always stored:
//   monthly "October 2026" · quarterly "Q3 2026" · annual "TY 2026".

import { nonWorkingHolidayOn } from '@/lib/ph-holidays'

export type DeadlineCategory = 'VAT' | 'Percentage Tax' | 'Withholding' | 'Income Tax' | 'Annual Info' | 'Books'
export type Frequency = 'Monthly' | 'Quarterly' | 'Annual'

export interface BirDeadline {
  key: string            // `${form}|${period}` — matches bir_filings (form_type, tax_period)
  form: string           // e.g. '2550Q'
  title: string
  frequency: Frequency
  period: string         // 'October 2026' | 'Q3 2026' | 'TY 2026'
  short: string          // cell label: 'Oct' | 'Q3' | 'TY'
  periodStart: string    // YYYY-MM-DD
  periodEnd: string
  statutoryDate: string  // before weekend/holiday roll
  due: string            // effective deadline
  movedBecause: string[] // e.g. ['Sat', 'Bonifacio Day']
  category: DeadlineCategory
  note?: string
  applicable: boolean
}

export interface TaxProfile {
  vatRegistered: boolean
  isCorporate: boolean
  withholdingAgent: boolean // withholds EWT from suppliers (TWA, or pays rent/professional fees)
  hasEmployees: boolean
}

/** Forms that apply to a business with this profile (before any manual override). */
export function defaultApplicableForms(p: TaxProfile): string[] {
  const forms = ['Books', 'Inventory']
  forms.push(p.vatRegistered ? '2550Q' : '2551Q')
  forms.push(...(p.isCorporate ? ['1702Q', '1702-RT', 'eAFS'] : ['1701Q', '1701', 'eAFS']))
  if (p.withholdingAgent) forms.push('0619-E', '1601-EQ', '2307', '1604-E')
  if (p.hasEmployees) forms.push('1601-C', '1604-C', '2316')
  return forms
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const ymd = (y: number, m: number, d: number) => new Date(y, m - 1, d) // m is 1-based
const lastDayOf = (y: number, m: number) => new Date(y, m, 0).getDate()

/** Rolls forward past weekends and nationwide non-working holidays. */
export function nextWorkingDay(d: Date): { date: Date; skipped: string[] } {
  const r = new Date(d)
  const skipped: string[] = []
  for (;;) {
    const dow = r.getDay()
    if (dow === 0 || dow === 6) skipped.push(dow === 0 ? 'Sun' : 'Sat')
    else {
      const h = nonWorkingHolidayOn(toISODate(r))
      if (!h) break
      skipped.push(h.name)
    }
    r.setDate(r.getDate() + 1)
  }
  return { date: r, skipped }
}

/**
 * Every obligation whose COVERED period falls in tax year `y` (due dates run from
 * Feb of y to Apr of y+1). `applicable` decides which are flagged as applying.
 */
export function obligationsForTaxYear(y: number, applicable: string[], p: TaxProfile): BirDeadline[] {
  const out: BirDeadline[] = []
  const add = (
    form: string, title: string, frequency: Frequency, period: string, short: string,
    start: Date, end: Date, statutory: Date, category: DeadlineCategory, note?: string,
  ) => {
    const { date, skipped } = nextWorkingDay(statutory)
    out.push({
      key: `${form}|${period}`, form, title, frequency, period, short,
      periodStart: toISODate(start), periodEnd: toISODate(end),
      statutoryDate: toISODate(statutory), due: toISODate(date), movedBecause: skipped,
      category, note, applicable: applicable.includes(form),
    })
  }

  // ── Monthly ─────────────────────────────────────────────
  for (let m = 1; m <= 12; m++) {
    const period = `${MONTH_LONG[m - 1]} ${y}`
    const start = ymd(y, m, 1), end = ymd(y, m, lastDayOf(y, m))
    const [ny, nm] = m === 12 ? [y + 1, 1] : [y, m + 1]
    add('1601-C', 'Withholding Tax on Compensation', 'Monthly', period, MON[m - 1], start, end,
      m === 12 ? ymd(ny, 1, 15) : ymd(ny, nm, 10), 'Withholding', 'December return is due January 15.')
    // 0619-E covers the first two months of each quarter; the 3rd month goes on the 1601-EQ.
    if (m % 3 !== 0) {
      add('0619-E', 'Monthly Remittance of Expanded Withholding Tax', 'Monthly', period, MON[m - 1], start, end,
        ymd(ny, nm, 10), 'Withholding')
    }
  }

  // ── Quarterly ───────────────────────────────────────────
  for (let q = 1; q <= 4; q++) {
    const period = `Q${q} ${y}`
    const endM = q * 3
    const start = ymd(y, endM - 2, 1), end = ymd(y, endM, lastDayOf(y, endM))
    const [ny, nm] = q === 4 ? [y + 1, 1] : [y, endM + 1]

    if (p.vatRegistered || applicable.includes('2550Q')) {
      add('2550Q', 'Quarterly VAT Return', 'Quarterly', period, `Q${q}`, start, end, ymd(ny, nm, 25), 'VAT',
        'File with the Summary List of Sales & Purchases (SLSP).')
    }
    if (!p.vatRegistered || applicable.includes('2551Q')) {
      add('2551Q', 'Quarterly Percentage Tax Return', 'Quarterly', period, `Q${q}`, start, end, ymd(ny, nm, 25), 'Percentage Tax')
    }
    add('2307', 'Issue BIR 2307 to Payees', 'Quarterly', period, `Q${q}`, start, end, ymd(ny, nm, 20), 'Withholding',
      'Certificates of creditable tax withheld — due 20 days after quarter-end.')
    add('1601-EQ', 'Quarterly EWT Return + QAP', 'Quarterly', period, `Q${q}`, start, end, ymd(ny, nm, lastDayOf(ny, nm)), 'Withholding',
      'Attach the Quarterly Alphalist of Payees (QAP).')
    // Quarterly income tax covers Q1–Q3 only; Q4 is on the annual return.
    if (q < 4) {
      if (p.isCorporate || applicable.includes('1702Q')) {
        const due = new Date(end); due.setDate(due.getDate() + 60)
        add('1702Q', 'Quarterly Income Tax Return (Corporation)', 'Quarterly', period, `Q${q}`, start, end, due, 'Income Tax',
          'Due 60 days after quarter-end. Attach SAWT for 2307s received.')
      }
      if (!p.isCorporate || applicable.includes('1701Q')) {
        const due = [ymd(y, 5, 15), ymd(y, 8, 15), ymd(y, 11, 15)][q - 1]
        add('1701Q', 'Quarterly Income Tax Return (Individual / Sole Prop)', 'Quarterly', period, `Q${q}`, start, end, due, 'Income Tax',
          'Q1 May 15 · Q2 Aug 15 · Q3 Nov 15. Attach SAWT for 2307s received.')
      }
    }
  }

  // ── Annual (tax year y, due in y+1) ─────────────────────
  const n = y + 1
  const period = `TY ${y}`
  const start = ymd(y, 1, 1), end = ymd(y, 12, 31)
  add('Books', 'Submit Bound Loose-leaf / CAS Books', 'Annual', period, 'TY', start, end, ymd(n, 1, 15), 'Books',
    'Loose-leaf or computerized books only — within 15 days after year-end.')
  add('Inventory', 'Submit Inventory List', 'Annual', period, 'TY', start, end, ymd(n, 1, 30), 'Books',
    'Year-end inventory list — within 30 days after year-end.')
  add('1604-C', 'Annual Info Return — Compensation + Alphalist', 'Annual', period, 'TY', start, end, ymd(n, 1, 31), 'Annual Info')
  add('2316', 'Issue BIR 2316 to Employees', 'Annual', period, 'TY', start, end, ymd(n, 1, 31), 'Annual Info')
  add('1604-E', 'Annual Info Return — Expanded Withholding', 'Annual', period, 'TY', start, end, ymd(n, 3, 1), 'Annual Info')
  if (p.isCorporate || applicable.includes('1702-RT')) {
    add('1702-RT', 'Annual Income Tax Return (Corporation)', 'Annual', period, 'TY', start, end, ymd(n, 4, 15), 'Income Tax',
      'Attach audited financial statements.')
  }
  if (!p.isCorporate || applicable.includes('1701')) {
    add('1701', 'Annual Income Tax Return (Individual / Sole Prop)', 'Annual', period, 'TY', start, end, ymd(n, 4, 15), 'Income Tax',
      'Attach financial statements (audited if gross sales exceed ₱3M).')
  }
  add('eAFS', 'Upload AFS & Attachments via eAFS', 'Annual', period, 'TY', start, end, ymd(n, 4, 30), 'Income Tax',
    'Within 15 days after the annual income tax return deadline.')

  return out
}

/** Applicable deadlines whose effective due date falls within [start, end] (YYYY-MM-DD). */
export function deadlinesBetween(start: string, end: string, applicable: string[], p: TaxProfile): BirDeadline[] {
  const y0 = Number(start.slice(0, 4)) - 1 // last year's annual returns are due this year
  const y1 = Number(end.slice(0, 4))
  const all: BirDeadline[] = []
  for (let y = y0; y <= y1; y++) all.push(...obligationsForTaxYear(y, applicable, p))
  return all
    .filter(d => d.applicable && d.due >= start && d.due <= end)
    .sort((a, b) => a.due.localeCompare(b.due) || a.form.localeCompare(b.form))
}

/** Every form the engine knows, for the Applicable Forms editor. */
export function allBirForms(p: TaxProfile): { form: string; title: string; category: DeadlineCategory; frequency: Frequency }[] {
  const everything = ['1601-C', '0619-E', '2550Q', '2551Q', '2307', '1601-EQ', '1702Q', '1701Q', 'Books', 'Inventory', '1604-C', '2316', '1604-E', '1702-RT', '1701', 'eAFS']
  const seen = new Map<string, { form: string; title: string; category: DeadlineCategory; frequency: Frequency }>()
  for (const d of obligationsForTaxYear(2026, everything, p)) {
    if (!seen.has(d.form)) seen.set(d.form, { form: d.form, title: d.title, category: d.category, frequency: d.frequency })
  }
  return [...seen.values()]
}

export const DUE_SOON_DAYS = 10
