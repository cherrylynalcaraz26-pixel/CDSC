// Standard name and address structure used across the system:
//   Name    → First Name, Middle Name, Last Name
//   Address → Address No., Street, Barangay, Municipality, City
//
// The split parts are stored in their own columns (see migration 037), and the
// existing single columns (contact_person, full_name, address) are still written
// with the joined value so reports, PDFs, BIR forms and search keep working.

export type PersonName = { first: string; middle: string; last: string }
export type Address = { no: string; street: string; barangay: string; municipality: string; city: string }

export const emptyName = (): PersonName => ({ first: '', middle: '', last: '' })
export const emptyAddress = (): Address => ({ no: '', street: '', barangay: '', municipality: '', city: '' })

const clean = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ')

/** "Juan" + "Santos" + "dela Cruz" → "Juan Santos dela Cruz" */
export function joinName(n: PersonName): string {
  return [n.first, n.middle, n.last].map(clean).filter(Boolean).join(' ')
}

// Filipino surname particles that belong to the last name ("dela Cruz", "de los Santos").
const PARTICLES = new Set(['de', 'del', 'dela', 'della', 'delos', 'de los', 'de la', 'san', 'sta', 'sta.', 'santa', 'santo', 'sto', 'sto.', 'van', 'von', 'da', 'di', 'la', 'los', 'las'])

/** Best-effort split of an old single-field name so it can be edited in the new fields. */
export function splitLegacyName(full: string | null | undefined): PersonName {
  const parts = clean(full).split(' ').filter(Boolean)
  if (parts.length === 0) return emptyName()
  if (parts.length === 1) return { first: parts[0], middle: '', last: '' }
  // Walk back from the end, pulling particles into the last name.
  let lastStart = parts.length - 1
  while (lastStart - 1 > 0 && PARTICLES.has(parts[lastStart - 1].toLowerCase())) lastStart--
  return { first: parts.slice(0, lastStart).join(' '), middle: '', last: parts.slice(lastStart).join(' ') }
}

/** "113", "San Isidro Rd", "San Isidro Sur", "Sto. Tomas", "Batangas" → "113 San Isidro Rd, Brgy. San Isidro Sur, Sto. Tomas, Batangas" */
export function joinAddress(a: Address, { includeCity = true } = {}): string {
  const line1 = [clean(a.no), clean(a.street)].filter(Boolean).join(' ')
  const brgy = clean(a.barangay)
  return [
    line1,
    brgy ? (/^(brgy|barangay)\b/i.test(brgy) ? brgy : `Brgy. ${brgy}`) : '',
    clean(a.municipality),
    includeCity ? clean(a.city) : '',
  ].filter(Boolean).join(', ')
}

type Row = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** Reads split name columns (with an optional prefix like "contact_"), falling back to the legacy single field. */
export function nameFromRow(row: Row, prefix: string, legacyKey: string): PersonName {
  const n = { first: str(row[`${prefix}first_name`]), middle: str(row[`${prefix}middle_name`]), last: str(row[`${prefix}last_name`]) }
  return n.first || n.middle || n.last ? n : splitLegacyName(str(row[legacyKey]))
}

/** Split name → DB columns. */
export function nameColumns(n: PersonName, prefix = '') {
  return {
    [`${prefix}first_name`]: clean(n.first) || null,
    [`${prefix}middle_name`]: clean(n.middle) || null,
    [`${prefix}last_name`]: clean(n.last) || null,
  }
}

/** Reads split address columns, falling back to putting the legacy address in Street so nothing is lost. */
export function addressFromRow(row: Row, legacyKey = 'address'): Address {
  const a = {
    no: str(row.address_no), street: str(row.street), barangay: str(row.barangay),
    municipality: str(row.municipality), city: str(row.city),
  }
  if (a.no || a.street || a.barangay || a.municipality) return a
  return { ...a, street: str(row[legacyKey]) }
}

/** Split address → DB columns. */
export function addressColumns(a: Address) {
  return {
    address_no: clean(a.no) || null,
    street: clean(a.street) || null,
    barangay: clean(a.barangay) || null,
    municipality: clean(a.municipality) || null,
    city: clean(a.city) || null,
  }
}
