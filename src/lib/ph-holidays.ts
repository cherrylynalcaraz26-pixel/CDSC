// =====================================================
// Philippine holidays — proclaimed lists per year, with a
// rule-based fallback for years not yet proclaimed.
//
// Sources (update each September when the next year's
// proclamation is released, and when Eid dates are declared):
//  2025 — Proc. 727 (s. 2024); Eid'l Fitr Proc. 839; Eid'l Adha Proc. 911;
//         Election Day Proc. 878
//  2026 — Proc. 1006 (s. 2025); Eid'l Fitr Proc. 1189; Eid'l Adha Proc. 1264;
//         NCR ASEAN Summit Proc. 1447
//  2027 — Proc. 1427 (s. 2026); Eid dates not yet declared
// =====================================================

export type HolidayType =
  | 'regular'          // regular holiday — non-working
  | 'special'          // special (non-working) day — nationwide
  | 'special-working'  // special (working) day — offices open
  | 'local'            // special non-working day for a locality only

export type PhHoliday = {
  date: string        // YYYY-MM-DD
  name: string
  type: HolidayType
  scope?: string      // locality for 'local' days, e.g. 'NCR'
  estimated?: boolean // rule-based — no proclamation yet
}

type Entry = [date: string, name: string, type: HolidayType, scope?: string]

const PROCLAIMED: Record<number, Entry[]> = {
  2025: [
    ['2025-01-01', "New Year's Day", 'regular'],
    ['2025-01-29', 'Chinese New Year', 'special'],
    ['2025-04-01', "Eid'l Fitr", 'regular'],
    ['2025-04-09', 'Araw ng Kagitingan', 'regular'],
    ['2025-04-17', 'Maundy Thursday', 'regular'],
    ['2025-04-18', 'Good Friday', 'regular'],
    ['2025-04-19', 'Black Saturday', 'special'],
    ['2025-05-01', 'Labor Day', 'regular'],
    ['2025-05-12', 'National & Local Elections', 'special'],
    ['2025-06-06', "Eid'l Adha", 'regular'],
    ['2025-06-12', 'Independence Day', 'regular'],
    ['2025-08-21', 'Ninoy Aquino Day', 'special'],
    ['2025-08-25', 'National Heroes Day', 'regular'],
    ['2025-10-31', "All Saints' Day Eve", 'special'],
    ['2025-11-01', "All Saints' Day", 'special'],
    ['2025-11-30', 'Bonifacio Day', 'regular'],
    ['2025-12-08', 'Feast of the Immaculate Conception', 'special'],
    ['2025-12-24', 'Christmas Eve', 'special'],
    ['2025-12-25', 'Christmas Day', 'regular'],
    ['2025-12-30', 'Rizal Day', 'regular'],
    ['2025-12-31', 'Last Day of the Year', 'special'],
  ],
  2026: [
    ['2026-01-01', "New Year's Day", 'regular'],
    ['2026-02-17', 'Chinese New Year', 'special'],
    ['2026-02-25', 'EDSA People Power Anniversary', 'special-working'],
    ['2026-03-20', "Eid'l Fitr", 'regular'],
    ['2026-04-02', 'Maundy Thursday', 'regular'],
    ['2026-04-03', 'Good Friday', 'regular'],
    ['2026-04-04', 'Black Saturday', 'special'],
    ['2026-04-09', 'Araw ng Kagitingan', 'regular'],
    ['2026-05-01', 'Labor Day', 'regular'],
    ['2026-05-27', "Eid'l Adha", 'regular'],
    ['2026-06-12', 'Independence Day', 'regular'],
    ['2026-08-21', 'Ninoy Aquino Day', 'special'],
    ['2026-08-31', 'National Heroes Day', 'regular'],
    ['2026-11-01', "All Saints' Day", 'special'],
    ['2026-11-02', "All Souls' Day", 'special'],
    ['2026-11-16', 'ASEAN Summit', 'local', 'NCR'],
    ['2026-11-17', 'ASEAN Summit', 'local', 'NCR'],
    ['2026-11-18', 'ASEAN Summit', 'local', 'NCR'],
    ['2026-11-30', 'Bonifacio Day', 'regular'],
    ['2026-12-08', 'Feast of the Immaculate Conception', 'special'],
    ['2026-12-24', 'Christmas Eve', 'special'],
    ['2026-12-25', 'Christmas Day', 'regular'],
    ['2026-12-30', 'Rizal Day', 'regular'],
    ['2026-12-31', 'Last Day of the Year', 'special'],
  ],
  2027: [
    ['2027-01-01', "New Year's Day", 'regular'],
    ['2027-02-06', 'Chinese New Year', 'special'],
    ['2027-02-25', 'EDSA People Power Anniversary', 'special-working'],
    ['2027-03-25', 'Maundy Thursday', 'regular'],
    ['2027-03-26', 'Good Friday', 'regular'],
    ['2027-03-27', 'Black Saturday', 'special'],
    ['2027-04-09', 'Araw ng Kagitingan', 'regular'],
    ['2027-05-01', 'Labor Day', 'regular'],
    ['2027-06-12', 'Independence Day', 'regular'],
    ['2027-08-21', 'Ninoy Aquino Day', 'special'],
    ['2027-08-30', 'National Heroes Day', 'regular'],
    ['2027-11-01', "All Saints' Day", 'special'],
    ['2027-11-02', "All Souls' Day", 'special'],
    ['2027-11-30', 'Bonifacio Day', 'regular'],
    ['2027-12-08', 'Feast of the Immaculate Conception', 'special'],
    ['2027-12-24', 'Christmas Eve', 'special'],
    ['2027-12-25', 'Christmas Day', 'regular'],
    ['2027-12-30', 'Rizal Day', 'regular'],
    ['2027-12-31', 'Last Day of the Year', 'special'],
  ],
}

// Years whose Eid'l Fitr / Eid'l Adha dates have been proclaimed.
const EID_DECLARED = new Set([2025, 2026])

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Western (Gregorian) Easter Sunday — anonymous Gregorian algorithm.
export function easterSunday(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(y, month - 1, day)
}

// Estimate for a year with no proclamation yet: statutory holidays under
// EO 292 / RA 9492 as amended, Holy Week from Easter, plus the special days
// that have been declared every year recently. Chinese New Year and Eid are
// omitted — they need an official date.
function estimated(y: number): Entry[] {
  const easter = easterSunday(y)
  const offset = (n: number) => iso(new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() + n))
  const lastMonAug = new Date(y, 7, 31)
  while (lastMonAug.getDay() !== 1) lastMonAug.setDate(lastMonAug.getDate() - 1)
  return [
    [`${y}-01-01`, "New Year's Day", 'regular'],
    [offset(-3), 'Maundy Thursday', 'regular'],
    [offset(-2), 'Good Friday', 'regular'],
    [offset(-1), 'Black Saturday', 'special'],
    [`${y}-04-09`, 'Araw ng Kagitingan', 'regular'],
    [`${y}-05-01`, 'Labor Day', 'regular'],
    [`${y}-06-12`, 'Independence Day', 'regular'],
    [`${y}-08-21`, 'Ninoy Aquino Day', 'special'],
    [iso(lastMonAug), 'National Heroes Day', 'regular'],
    [`${y}-11-01`, "All Saints' Day", 'special'],
    [`${y}-11-02`, "All Souls' Day", 'special'],
    [`${y}-11-30`, 'Bonifacio Day', 'regular'],
    [`${y}-12-08`, 'Feast of the Immaculate Conception', 'special'],
    [`${y}-12-24`, 'Christmas Eve', 'special'],
    [`${y}-12-25`, 'Christmas Day', 'regular'],
    [`${y}-12-30`, 'Rizal Day', 'regular'],
    [`${y}-12-31`, 'Last Day of the Year', 'special'],
  ]
}

const cache = new Map<number, PhHoliday[]>()

export function holidaysForYear(y: number): PhHoliday[] {
  let list = cache.get(y)
  if (!list) {
    const proclaimed = PROCLAIMED[y]
    const entries = proclaimed ?? estimated(y)
    list = entries
      .map(([date, name, type, scope]) => ({ date, name, type, scope, ...(proclaimed ? {} : { estimated: true }) }))
      .sort((a, b) => a.date.localeCompare(b.date))
    cache.set(y, list)
  }
  return list
}

export type HolidayYearInfo = { proclaimed: boolean; eidDeclared: boolean }
export function holidayYearInfo(y: number): HolidayYearInfo {
  return { proclaimed: y in PROCLAIMED, eidDeclared: EID_DECLARED.has(y) }
}

export function holidaysBetween(start: string, end: string): PhHoliday[] {
  const out: PhHoliday[] = []
  for (let y = Number(start.slice(0, 4)); y <= Number(end.slice(0, 4)); y++) {
    out.push(...holidaysForYear(y).filter(h => h.date >= start && h.date <= end))
  }
  return out
}

// Nationwide holidays on a date (excludes locality-only days and special working days).
export function nonWorkingHolidayOn(date: string): PhHoliday | undefined {
  return holidaysForYear(Number(date.slice(0, 4)))
    .find(h => h.date === date && (h.type === 'regular' || h.type === 'special'))
}
