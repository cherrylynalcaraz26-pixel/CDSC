'use client'

// Pull Outs → Client Records. Pulls out every Delivery Receipt (DR Logs) and
// Charge Sales Invoice (CSI Monitoring) per client and prints a records
// confirmation letter for each one: account summary, open invoices for
// collection, a conforme block, and Annex A (CSIs) / Annex B (DRs). A master
// list with review notes prints in front when several clients are printed.
//
// Clients are matched to the client master by a normalised name (case,
// punctuation and Inc./Corp. suffixes ignored). Names that do not match stay
// as their own group and are flagged in the review notes so nothing is dropped.

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { loadLetterhead, letterheadHtml, type LetterheadCompany } from '@/lib/letterhead'
import { registration } from '@/lib/site-content'
import { useSearchContext } from '@/context/search-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertTriangle, FileText, Loader2, Mail, Printer, RefreshCw } from 'lucide-react'
import { ClientRecordsEmailDialog } from '@/components/pull-outs/client-records-email'

// ── Data ───────────────────────────────────────────────────────────────────

type CsiRow = { id: number; si_number: string | null; si_date: string | null; po_number: string | null; dr_number: string | null; client_name: string | null; amount: number | null; collection_status: string | null }
type DrRow = { id: string; dr_number: string; dr_date: string | null; po_number: string | null; supplier_name: string | null; status: string | null; received_by_name: string | null }
type DrItemRow = { id: number; dr_number: string | null; quantity: number | null }
type ClientRow = { id: string; company_name: string; email: string | null; contact_person: string | null; position: string | null; address: string | null; city: string | null; province: string | null; status: string | null }

type CsiStatus = 'collected' | 'open' | 'cancelled'
export interface Invoice { si: string; date: string; po: string; dr: string; lines: number; amount: number; status: CsiStatus; raw: string | null }
export interface Delivery { dr: string; date: string; po: string; lines: number; qty: number; accepted: string; status: string }
export interface ClientRecord {
  key: string
  name: string
  inMaster: boolean
  email: string
  contact: string
  position: string
  address: string
  invoices: Invoice[]
  deliveries: Delivery[]
  from: string
  to: string
}

const SUFFIX = /\b(incorporated|inc|corporation|corp|company|co|ltd|opc|the|philippines|phils?)\b/g
export const nameKey = (s: string) =>
  s.toLowerCase().replace(/&/g, ' and ').replace(/dev'?t/g, 'development').replace(/[^a-z0-9 ]/g, ' ').replace(SUFFIX, ' ').replace(/\s+/g, ' ').trim()

function csiStatus(raw: string | null, untagged: 'open' | 'collected'): CsiStatus {
  if (raw === 'cancelled') return 'cancelled'
  if (raw === 'collected') return 'collected'
  if (raw === 'for_collection' || raw === 'missing') return 'open'
  return untagged
}

function build(csi: CsiRow[], drs: DrRow[], drItems: DrItemRow[], clients: ClientRow[], untagged: 'open' | 'collected') {
  const master = new Map(clients.map(c => [nameKey(c.company_name), c]))
  const groups = new Map<string, ClientRecord>()
  const unmatched = new Set<string>()
  const slot = (rawName: string) => {
    const k = nameKey(rawName)
    if (!groups.has(k)) {
      const c = master.get(k)
      if (!c) unmatched.add(rawName.trim())
      groups.set(k, {
        key: k, name: c?.company_name ?? rawName.trim(), inMaster: !!c, email: c?.email?.trim() ?? '',
        contact: c?.contact_person ?? '', position: c?.position ?? '',
        address: [c?.address, c?.city, c?.province].filter(Boolean).join(', '),
        invoices: [], deliveries: [], from: '', to: '',
      })
    }
    return groups.get(k)!
  }

  // CSIs: one invoice per SI number (records are one row per line item).
  const bySi = new Map<string, CsiRow[]>()
  let noClientCsi = 0, noClientCsiCancelled = 0
  const noClientSeen = new Set<string>()
  for (const r of csi) {
    if (!r.client_name?.trim()) {
      const k = r.si_number || `#${r.id}`
      if (!noClientSeen.has(k)) { noClientSeen.add(k); noClientCsi++; if (r.collection_status === 'cancelled') noClientCsiCancelled++ }
      continue
    }
    const k = `${nameKey(r.client_name)}|${r.si_number?.trim() || `${r.si_date}|nosi`}`
    if (!bySi.has(k)) bySi.set(k, [])
    bySi.get(k)!.push(r)
  }
  let noSiNo = 0
  for (const rows of bySi.values()) {
    const f = rows[0]
    if (!f.si_number?.trim()) noSiNo++
    slot(f.client_name!).invoices.push({
      si: f.si_number?.trim() || '(no SI no.)', date: f.si_date ?? '', po: f.po_number ?? '', dr: f.dr_number ?? '',
      lines: rows.length, amount: rows.reduce((s, r) => s + (Number(r.amount) || 0), 0),
      status: csiStatus(f.collection_status, untagged), raw: f.collection_status,
    })
  }

  // DRs: the client is stored in dr_logs.supplier_name.
  const qty = new Map<string, { lines: number; qty: number }>()
  for (const i of drItems) {
    if (!i.dr_number) continue
    const q = qty.get(i.dr_number) ?? { lines: 0, qty: 0 }
    q.lines++; q.qty += Number(i.quantity) || 0
    qty.set(i.dr_number, q)
  }
  let noClientDr = 0
  for (const d of drs) {
    if (!d.supplier_name?.trim()) { noClientDr++; continue }
    const q = qty.get(d.dr_number) ?? { lines: 0, qty: 0 }
    slot(d.supplier_name).deliveries.push({
      dr: d.dr_number, date: d.dr_date ?? '', po: d.po_number ?? '', lines: q.lines, qty: q.qty,
      accepted: d.received_by_name ?? '', status: d.status ?? 'received',
    })
  }

  const records = [...groups.values()].map(g => {
    g.invoices.sort((a, b) => a.date.localeCompare(b.date) || a.si.localeCompare(b.si, undefined, { numeric: true }))
    g.deliveries.sort((a, b) => a.date.localeCompare(b.date) || a.dr.localeCompare(b.dr, undefined, { numeric: true }))
    const dates = [...g.invoices.map(i => i.date), ...g.deliveries.map(d => d.date)].filter(Boolean).sort()
    g.from = dates[0] ?? ''; g.to = dates[dates.length - 1] ?? ''
    return g
  }).sort((a, b) => a.name.localeCompare(b.name))

  const withRecords = new Set(records.map(r => r.key))
  const noRecords = clients.filter(c => c.status !== 'inactive' && !withRecords.has(nameKey(c.company_name))).map(c => c.company_name)
  const untaggedCount = records.reduce((s, r) => s + r.invoices.filter(i => !i.raw || i.raw === 'active').length, 0)
  return { records, notes: { noClientCsi, noClientCsiCancelled, noClientDr, unmatched: [...unmatched].sort(), noRecords, noSiNo, untaggedCount } }
}
type Notes = ReturnType<typeof build>['notes']

export function summarize(r: ClientRecord) {
  const active = r.invoices.filter(i => i.status !== 'cancelled')
  const collected = active.filter(i => i.status === 'collected')
  const open = active.filter(i => i.status === 'open')
  const cancelled = r.invoices.filter(i => i.status === 'cancelled')
  const recDr = r.deliveries.filter(d => d.status === 'received' || d.status === 'partial')
  const sum = (xs: Invoice[]) => xs.reduce((s, i) => s + i.amount, 0)
  return {
    active: active.length, activeAmt: sum(active),
    collected: collected.length, collectedAmt: sum(collected),
    open: open.length, openAmt: sum(open), openList: open,
    cancelled: cancelled.length, cancelledAmt: sum(cancelled),
    drs: recDr.length, drQty: recDr.reduce((s, d) => s + d.qty, 0),
    drCancelled: r.deliveries.filter(d => d.status === 'cancelled').length,
    drOther: r.deliveries.filter(d => d.status === 'rejected' || d.status === 'returned').length,
  }
}

// ── Formatting ─────────────────────────────────────────────────────────────

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
export const amt = (n: number) => n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const php = (n: number) => 'PHP ' + amt(n)
const qtyFmt = (n: number) => n.toLocaleString('en-PH', { maximumFractionDigits: 3 })
const d = (s: string, f: string) => (s ? format(new Date(s.slice(0, 10) + 'T00:00:00'), f) : '—')
const shortDate = (s: string) => d(s, 'dd MMM yyyy')
export const longDate = (s: string) => d(s, 'MMMM d, yyyy')
const dash = (s: string) => esc(s.trim() || '—')
const STATUS_LABEL: Record<CsiStatus, string> = { collected: 'Collected', open: 'For Collection', cancelled: 'Cancelled' }
const DR_LABEL: Record<string, string> = { received: 'Received', partial: 'Partial', rejected: 'Rejected', returned: 'Returned', cancelled: 'Cancelled' }

export interface LetterOptions { date: string; signatory: string; title: string; days: number; refBase: string }
export const refNo = (o: LetterOptions, n: number) => `${o.refBase}-${String(n).padStart(3, '0')}`

export const STYLE = `
  @page{size:A4;margin:16mm 16mm 14mm}
  *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;font-size:11.5px;line-height:1.5;color:#111;margin:0}
  .page{page-break-after:always}.page:last-child{page-break-after:auto}
  .brk{page-break-before:always}
  h1{font-size:15px;letter-spacing:1.5px;text-align:center;margin:14px 0 2px}
  h2{font-size:12px;letter-spacing:.8px;margin:18px 0 6px}
  .sub{text-align:center;font-size:10.5px;color:#555;margin-bottom:14px}
  p{margin:0 0 9px;text-align:justify}
  .to{margin:10px 0 14px}.to b{display:block}
  table{width:100%;border-collapse:collapse;margin:4px 0 8px;font-size:10.5px}
  th{background:#E8112D;color:#fff;font-size:9.5px;text-transform:uppercase;letter-spacing:.3px;padding:5px 6px;text-align:left}
  td{padding:4px 6px;border-bottom:1px solid #e5e7eb;vertical-align:top}
  .c{text-align:center}.r{text-align:right;white-space:nowrap}.muted{color:#888}.grey td{color:#9ca3af}
  tr.tot td{font-weight:700;border-top:2px solid #111;border-bottom:0}
  .ind td:first-child{padding-left:22px}
  .note{font-style:italic;color:#555;font-size:10px}
  .sig{margin-top:14px}.keep,.sig,.conf,tr,.to{page-break-inside:avoid;break-inside:avoid}h2{page-break-after:avoid;break-after:avoid}.sig .line{border-top:1px solid #111;width:240px;margin-top:36px;padding-top:3px}
  .conf{margin-top:24px;border:1.5px solid #111;padding:12px 14px;page-break-inside:avoid}
  .conf b.h{display:block;letter-spacing:1px;margin-bottom:6px}
  .conf .opt{margin:4px 0}.conf .blank{border-bottom:1px solid #111;height:18px;margin:4px 0}
  .conf .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:26px}
  .conf .grid div{border-top:1px solid #111;padding-top:3px;font-size:9.5px;color:#444}
  ul{margin:4px 0 0 18px;padding:0}li{margin:0 0 5px}
`

export function masterListHtml(rs: ClientRecord[], o: LetterOptions, notes: Notes | null) {
  const rows = rs.map((r, n) => {
    const s = summarize(r)
    return `<tr><td class="c">${n + 1}</td><td>${esc(r.name)}</td><td>${esc(refNo(o, n + 1))}</td><td class="c">${s.active}</td><td class="r">${amt(s.activeAmt)}</td><td class="c">${s.open}</td><td class="r">${amt(s.openAmt)}</td><td class="c">${s.drs}</td></tr>`
  }).join('')
  const t = rs.map(summarize).reduce((a, s) => ({ c: a.c + s.active, amt: a.amt + s.activeAmt, o: a.o + s.open, oa: a.oa + s.openAmt, dr: a.dr + s.drs }), { c: 0, amt: 0, o: 0, oa: 0, dr: 0 })
  const periods = rs.map((r, n) => `<tr><td class="c">${n + 1}</td><td>${esc(r.name)}</td><td>${r.from ? `${longDate(r.from)} to ${longDate(r.to)}` : '—'}</td><td>${esc(refNo(o, n + 1))}</td></tr>`).join('')
  const ns: string[] = []
  if (notes) {
    if (notes.noRecords.length) ns.push(`Clients with no DR or CSI on record (no letter generated): ${esc(notes.noRecords.join(', '))}.`)
    if (notes.noClientCsi) ns.push(`${notes.noClientCsi} CSI number${notes.noClientCsi === 1 ? '' : 's'} in the system ${notes.noClientCsi === 1 ? 'has' : 'have'} no client name (${notes.noClientCsiCancelled} cancelled). These are not included in any letter. Tag them to the right client in CSI Monitoring if they belong to one.`)
    if (notes.noClientDr) ns.push(`${notes.noClientDr} DR${notes.noClientDr === 1 ? '' : 's'} ${notes.noClientDr === 1 ? 'has' : 'have'} no client assigned. Not included.`)
    if (notes.unmatched.length) ns.push(`Names not found in the client master (printed as recorded, no address on file): ${esc(notes.unmatched.join(', '))}. Correct the name in CSI Monitoring / DR Logs or add the client.`)
    const noAddr = rs.filter(r => !r.contact && !r.address).map(r => r.name)
    if (noAddr.length) ns.push(`No contact person or address on file for: ${esc(noAddr.join(', '))}. These letters are addressed to Purchasing / Accounts Payable. Complete the client record before printing if needed.`)
    if (notes.noSiNo) ns.push(`${notes.noSiNo} CSI${notes.noSiNo === 1 ? '' : 's'} ${notes.noSiNo === 1 ? 'has' : 'have'} no SI number recorded and ${notes.noSiNo === 1 ? 'is' : 'are'} listed as "(no SI no.)".`)
    if (notes.untaggedCount) ns.push(`${notes.untaggedCount} invoice${notes.untaggedCount === 1 ? ' has' : 's have'} no collection status (Active). They were treated as the option selected when printing. Tag them in CSI Monitoring for an exact statement.`)
    ns.push('DR quantities are totals of all line items per DR. CSI amounts are as recorded in CSI Monitoring.')
  }
  return `<div class="page">
    <h1>CLIENT RECORDS MASTER LIST</h1>
    <div class="sub">Delivery Receipts and Charge Sales Invoices per client &nbsp;|&nbsp; As of ${esc(longDate(o.date))}</div>
    <table><thead><tr><th class="c">#</th><th>Client</th><th>Ref. No.</th><th class="c">CSIs</th><th class="r">Total Invoiced (PHP)</th><th class="c">Open</th><th class="r">Open Amount (PHP)</th><th class="c">DRs</th></tr></thead>
      <tbody>${rows}<tr class="tot"><td></td><td>Total</td><td></td><td class="c">${t.c}</td><td class="r">${amt(t.amt)}</td><td class="c">${t.o}</td><td class="r">${amt(t.oa)}</td><td class="c">${t.dr}</td></tr></tbody></table>
    <h2>COVERAGE PERIOD PER CLIENT</h2>
    <table><thead><tr><th class="c">#</th><th>Client</th><th>Period Covered</th><th>Ref. No.</th></tr></thead><tbody>${periods}</tbody></table>
    ${ns.length ? `<h2>NOTES FOR REVIEW BEFORE SENDING</h2><ul>${ns.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
  </div>`
}

export function letterHtml(r: ClientRecord, ref: string, o: LetterOptions, header: string, company: string, note = '') {
  const s = summarize(r)
  const period = r.from ? `${longDate(r.from)} to ${longDate(r.to)}` : 'the records on file'
  const addressee = r.contact
    ? `<b>${esc(r.contact)}</b>${r.position ? `<div>${esc(r.position)}</div>` : ''}<b>${esc(r.name)}</b>`
    : `<b>${esc(r.name)}</b><div><i>Attention: Purchasing / Accounts Payable</i></div>`
  const status = s.open
    ? `<p>Our records show <b>${s.open} invoice${s.open === 1 ? '' : 's'}</b> still open for collection, amounting to <b>${php(s.openAmt)}</b>. ${s.open === 1 ? 'This is' : 'These are'} itemized in Section 2 below. We would appreciate settlement of ${s.open === 1 ? 'this invoice' : 'these invoices'}, or advice on ${s.open === 1 ? 'its' : 'their'} current processing status, at your earliest convenience.</p>`
    : s.active
      ? '<p>Based on our records, all active invoices on this list have been collected. Thank you for your consistent and timely settlement.</p>'
      : '<p>There are no active invoices on record for this period.</p>'
  const openRows = s.openList.map((i, n) => `<tr><td class="c">${n + 1}</td><td>${esc(i.si)}</td><td>${shortDate(i.date)}</td><td>${dash(i.po)}</td><td>${dash(i.dr)}</td><td class="r">${amt(i.amount)}</td><td>For Collection</td></tr>`).join('')
  const csiRows = r.invoices.map((i, n) => `<tr${i.status === 'cancelled' ? ' class="grey"' : ''}><td class="c">${n + 1}</td><td>${esc(i.si)}</td><td>${shortDate(i.date)}</td><td>${dash(i.po)}</td><td>${dash(i.dr)}</td><td class="c">${i.lines}</td><td class="r">${amt(i.amount)}</td><td>${STATUS_LABEL[i.status]}</td></tr>`).join('')
  const drRows = r.deliveries.map((x, n) => `<tr${x.status === 'cancelled' ? ' class="grey"' : ''}><td class="c">${n + 1}</td><td>${esc(x.dr)}</td><td>${shortDate(x.date)}</td><td>${dash(x.po)}</td><td class="c">${x.lines}</td><td class="r">${qtyFmt(x.qty)}</td><td>${dash(x.accepted)}</td><td>${esc(DR_LABEL[x.status] ?? x.status)}</td></tr>`).join('')
  const sub = `<div class="sub" style="text-align:left">${esc(r.name)} &nbsp;|&nbsp; Ref. No. ${esc(ref)}</div>`

  return `<div class="page">
    ${header}
    <p>${esc(longDate(o.date))}</p>
    <p>Ref. No.: <b>${esc(ref)}</b></p>
    <div class="to">${addressee}${r.address ? `<div>${esc(r.address)}</div>` : ''}</div>
    <p><b>Subject: Summary of Delivery Receipts and Charge Sales Invoices on Record</b></p>
    <p>Dear ${r.contact ? esc(r.contact) : 'Sir/Madam'},</p>
    <p>As part of our records review, we have pulled out all Delivery Receipts (DR) and Charge Sales Invoices (CSI) issued by ${esc(company)} to ${esc(r.name)} covering the period ${esc(period)}. The complete list is attached to this letter as Annex A (CSI) and Annex B (DR).</p>
    <p>We ask that your team check this list against your own receiving and payables records. If anything does not match, please let us know the specific document number and the difference so we can reconcile it on our side.</p>
    ${status}
    ${note.trim() ? note.trim().split(/\n{2,}/).map(x => `<p>${esc(x).replace(/\n/g, '<br/>')}</p>`).join('') : ''}
    <p>Kindly sign the conforme at the end of this letter and return a copy within ${esc(numberWords(o.days))} (${o.days}) days from receipt. If we do not receive a response within that period, we will treat the attached records as confirmed.</p>

    <h2>1. ACCOUNT SUMMARY</h2>
    <table><thead><tr><th>Particulars</th><th class="c" style="width:70px">Count</th><th class="r" style="width:150px">Amount (PHP) / Qty</th></tr></thead><tbody>
      <tr><td>Charge Sales Invoices issued (active)</td><td class="c">${s.active}</td><td class="r">${amt(s.activeAmt)}</td></tr>
      <tr class="ind"><td>Collected</td><td class="c">${s.collected}</td><td class="r">${amt(s.collectedAmt)}</td></tr>
      <tr class="ind"><td>Open for collection</td><td class="c">${s.open}</td><td class="r">${amt(s.openAmt)}</td></tr>
      <tr><td>Cancelled CSIs (excluded from totals)</td><td class="c">${s.cancelled}</td><td class="r">${amt(s.cancelledAmt)}</td></tr>
      <tr><td>Delivery Receipts on record (received)</td><td class="c">${s.drs}</td><td class="r">${qtyFmt(s.drQty)} units</td></tr>
      ${s.drOther ? `<tr><td>Rejected / returned DRs</td><td class="c">${s.drOther}</td><td class="r">—</td></tr>` : ''}
      <tr><td>Cancelled DRs</td><td class="c">${s.drCancelled}</td><td class="r">—</td></tr>
    </tbody></table>

    <h2>2. OPEN INVOICES FOR COLLECTION</h2>
    ${s.open ? `<table><thead><tr><th class="c">#</th><th>CSI No.</th><th>CSI Date</th><th>PO No.</th><th>DR Ref.</th><th class="r">Amount (PHP)</th><th>Status</th></tr></thead>
      <tbody>${openRows}<tr class="tot"><td></td><td></td><td></td><td></td><td>Total</td><td class="r">${amt(s.openAmt)}</td><td></td></tr></tbody></table>`
      : '<p class="note">None. All active invoices are recorded as collected.</p>'}

    <div class="sig keep"><p style="margin-top:14px">Thank you for your continued partnership.</p>Respectfully yours,
      <div class="line"><b>${esc(o.signatory || 'Authorized Representative')}</b><div>${esc(o.title || 'Authorized Representative')}</div><div>${esc(company)}</div></div>
    </div>

    <div class="conf">
      <b class="h">CONFORME</b>
      <div>We have reviewed the attached list of DRs and CSIs (Ref. No. ${esc(ref)}) and:</div>
      <div class="opt">&#9744;&nbsp; Confirm the records as stated.</div>
      <div class="opt">&#9744;&nbsp; Confirm the records, subject to the exceptions noted below / attached.</div>
      <div>Exceptions:</div><div class="blank"></div><div class="blank"></div>
      <div class="grid"><div>Signature over printed name</div><div>Position</div><div>Date</div></div>
      <div style="margin-top:6px;font-size:9.5px;color:#444">For: ${esc(r.name)}</div>
    </div>

    <div class="brk"></div>
    <h2>ANNEX A. CHARGE SALES INVOICES (${r.invoices.length})</h2>${sub}
    ${r.invoices.length ? `<table><thead><tr><th class="c">#</th><th>CSI No.</th><th>CSI Date</th><th>PO No.</th><th>DR Ref.</th><th class="c">Lines</th><th class="r">Amount (PHP)</th><th>Status</th></tr></thead>
      <tbody>${csiRows}<tr class="tot"><td></td><td></td><td></td><td></td><td>Active total</td><td></td><td class="r">${amt(s.activeAmt)}</td><td></td></tr></tbody></table>
      <p class="note">Cancelled invoices are shown in grey and are excluded from the total.</p>`
      : '<p class="note">No Charge Sales Invoices are logged under this client in CSI Monitoring.</p>'}

    <h2>ANNEX B. DELIVERY RECEIPTS (${r.deliveries.length})</h2>${sub}
    ${r.deliveries.length ? `<table><thead><tr><th class="c">#</th><th>DR No.</th><th>DR Date</th><th>PO / SO No.</th><th class="c">Lines</th><th class="r">Total Qty</th><th>Client Accepted</th><th>Status</th></tr></thead>
      <tbody>${drRows}<tr class="tot"><td></td><td></td><td></td><td>Received total</td><td></td><td class="r">${qtyFmt(s.drQty)}</td><td></td><td></td></tr></tbody></table>`
      : '<p class="note">No Delivery Receipts are logged under this client in the DR register. Deliveries may be referenced on the CSIs in Annex A.</p>'}
  </div>`
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']
function numberWords(n: number) {
  if (n <= 20) return WORDS[n]
  if (n === 30) return 'thirty'
  if (n === 45) return 'forty-five'
  if (n === 60) return 'sixty'
  return String(n)
}

/** Letterhead block and company name used on every printed / emailed letter. */
export async function loadDocHeader() {
  const [lh, { data: co }] = await Promise.all([loadLetterhead(), createClient().from('system_settings').select('*').single()])
  return {
    header: letterheadHtml(lh, co as LetterheadCompany | null),
    company: (co as LetterheadCompany | null)?.company_name || 'CDSC Industrial Supply',
  }
}


// ── Component ──────────────────────────────────────────────────────────────

export function ClientRecords() {
  const supabase = createClient()
  const { query } = useSearchContext()
  const [raw, setRaw] = useState<{ csi: CsiRow[]; drs: DrRow[]; drItems: DrItemRow[]; clients: ClientRow[] } | null>(null)
  const [reload, setReload] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [untagged, setUntagged] = useState<'open' | 'collected'>('open')
  const [printing, setPrinting] = useState(false)
  const [emailFor, setEmailFor] = useState<ClientRecord | null>(null)
  const [opts, setOpts] = useState<LetterOptions>(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    return { date: today, signatory: registration.proprietor, title: 'Proprietor', days: 15, refBase: `CDSC-CRS-${format(new Date(), 'yyyy-MM')}` }
  })

  useEffect(() => {
    let on = true
    Promise.all([
      fetchAllRows<CsiRow>((f, t) => supabase.from('csi_records').select('id, si_number, si_date, po_number, dr_number, client_name, amount, collection_status').order('id').range(f, t) as unknown as PromiseLike<{ data: CsiRow[] | null }>),
      fetchAllRows<DrRow>((f, t) => supabase.from('dr_logs').select('id, dr_number, dr_date, po_number, supplier_name, status, received_by_name').order('id').range(f, t) as unknown as PromiseLike<{ data: DrRow[] | null }>),
      fetchAllRows<DrItemRow>((f, t) => supabase.from('dr_log_items').select('id, dr_number, quantity').order('id').range(f, t) as unknown as PromiseLike<{ data: DrItemRow[] | null }>),
      supabase.from('clients').select('id, company_name, email, contact_person, position, address, city, province, status').order('company_name'),
    ]).then(([csi, drs, drItems, cl]) => {
      if (on) setRaw({ csi, drs, drItems, clients: (cl.data ?? []) as ClientRow[] })
    })
    return () => { on = false }
  }, [reload]) // eslint-disable-line react-hooks/exhaustive-deps

  const built = useMemo(() => raw ? build(raw.csi, raw.drs, raw.drItems, raw.clients, untagged) : null, [raw, untagged])
  const records = useMemo(() => built?.records ?? [], [built])
  const q = query.trim().toLowerCase()
  const shown = q ? records.filter(r => r.name.toLowerCase().includes(q)) : records
  const refOf = useMemo(() => new Map(records.map((r, n) => [r.key, refNo(opts, n + 1)])), [records, opts])

  const set = <K extends keyof LetterOptions>(k: K, v: LetterOptions[K]) => setOpts(p => ({ ...p, [k]: v }))
  const toggle = (k: string) => setSelected(p => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const allShown = shown.length > 0 && shown.every(r => selected.has(r.key))

  async function print(list: ClientRecord[], withMaster: boolean) {
    if (!list.length) return
    const win = window.open('', '_blank', 'width=960,height=1000')
    if (!win) return
    setPrinting(true)
    const { header, company } = await loadDocHeader()
    setPrinting(false)
    // Reference numbers follow the full master list, so a reprint of one client keeps its number.
    const ordered = records.filter(r => list.some(x => x.key === r.key))
    const body = (withMaster ? masterListHtml(ordered, opts, ordered.length === records.length ? built!.notes : null) : '')
      + ordered.map(r => letterHtml(r, refOf.get(r.key)!, opts, header, company)).join('')
    const title = ordered.length === 1 ? `Client Records ${refOf.get(ordered[0].key)} ${ordered[0].name}` : `Client Records ${opts.refBase}`
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(title)}</title><style>${STYLE}</style></head><body>${body}</body></html>`)
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 700)
  }

  if (!built) return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Pulling out DRs and CSIs…</div>

  const n = built.notes
  const flags = [
    n.noClientCsi ? `${n.noClientCsi} CSI(s) have no client` : '',
    n.noClientDr ? `${n.noClientDr} DR(s) have no client` : '',
    n.unmatched.length ? `${n.unmatched.length} name(s) not in client master` : '',
    n.untaggedCount ? `${n.untaggedCount} invoice(s) with no collection status` : '',
  ].filter(Boolean)
  const totals = records.map(summarize).reduce((a, s) => ({ c: a.c + s.active, amt: a.amt + s.activeAmt, o: a.o + s.open, oa: a.oa + s.openAmt, dr: a.dr + s.drs }), { c: 0, amt: 0, o: 0, oa: 0, dr: 0 })
  const sel = records.filter(r => selected.has(r.key))

  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div className="space-y-1.5"><Label>Letter Date (as of)</Label><Input type="date" value={opts.date} onChange={e => set('date', e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Ref. No. Series</Label><Input value={opts.refBase} onChange={e => set('refBase', e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Signatory</Label><Input value={opts.signatory} onChange={e => set('signatory', e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Position</Label><Input value={opts.title} onChange={e => set('title', e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Reply Within (days)</Label><Input type="number" min={1} value={opts.days} onChange={e => set('days', Math.max(1, Number(e.target.value) || 15))} /></div>
        <div className="space-y-1.5">
          <Label>Untagged CSIs count as</Label>
          <Select value={untagged} onValueChange={v => setUntagged((v ?? 'open') as 'open' | 'collected')}>
            <SelectTrigger className="w-full"><span className="text-sm">{untagged === 'open' ? 'Open for collection' : 'Collected'}</span></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open for collection</SelectItem>
              <SelectItem value="collected">Collected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {flags.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div><b>Review before sending:</b> {flags.join(' · ')}. Full notes print on the master list.</div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {records.length} clients · {totals.c} CSIs · {php(totals.amt)} invoiced · <span className="font-medium text-amber-700">{totals.o} open · {php(totals.oa)}</span> · {totals.dr} DRs
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setReload(k => k + 1)}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Refresh</Button>
          <Button variant="outline" size="sm" disabled={!sel.length || printing} onClick={() => print(sel, sel.length > 1)}>
            <Printer className="mr-1.5 h-3.5 w-3.5" />Print Selected ({sel.length})
          </Button>
          <Button size="sm" disabled={!records.length || printing} onClick={() => print(records, true)} className="bg-[#E8112D] hover:bg-[#D10F28]">
            {printing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1.5 h-3.5 w-3.5" />}Master List + All Letters
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"><Checkbox checked={allShown} onCheckedChange={() => setSelected(allShown ? new Set() : new Set(shown.map(r => r.key)))} /></TableHead>
            <TableHead className="w-8">#</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Ref. No.</TableHead>
            <TableHead>Period Covered</TableHead>
            <TableHead className="text-center">CSIs</TableHead>
            <TableHead className="text-right">Total Invoiced (PHP)</TableHead>
            <TableHead className="text-center">Open</TableHead>
            <TableHead className="text-right">Open Amount (PHP)</TableHead>
            <TableHead className="text-center">DRs</TableHead>
            <TableHead className="w-40" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.length === 0 ? (
            <TableRow><TableCell colSpan={11} className="py-10 text-center text-muted-foreground">No DRs or CSIs on record.</TableCell></TableRow>
          ) : shown.map(r => {
            const s = summarize(r)
            return (
              <TableRow key={r.key}>
                <TableCell><Checkbox checked={selected.has(r.key)} onCheckedChange={() => toggle(r.key)} /></TableCell>
                <TableCell className="text-muted-foreground">{records.indexOf(r) + 1}</TableCell>
                <TableCell>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.contact ? r.contact : 'Attn: Purchasing / AP'}{r.address ? ` · ${r.address}` : ''}
                    {!r.inMaster && <span className="ml-1 text-amber-700">· not in client master</span>}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap font-mono text-xs">{refOf.get(r.key)}</TableCell>
                <TableCell className="whitespace-nowrap text-xs">{r.from ? `${shortDate(r.from)} – ${shortDate(r.to)}` : '—'}</TableCell>
                <TableCell className="text-center tabular-nums">{s.active}{s.cancelled ? <span className="text-xs text-muted-foreground"> +{s.cancelled}✕</span> : null}</TableCell>
                <TableCell className="text-right tabular-nums">{amt(s.activeAmt)}</TableCell>
                <TableCell className={`text-center tabular-nums ${s.open ? 'font-semibold text-amber-700' : 'text-muted-foreground'}`}>{s.open}</TableCell>
                <TableCell className={`text-right tabular-nums ${s.open ? 'font-semibold text-amber-700' : 'text-muted-foreground'}`}>{amt(s.openAmt)}</TableCell>
                <TableCell className="text-center tabular-nums">{s.drs}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" disabled={printing} onClick={() => print([r], false)} title="Print records letter">
                      <Printer className="mr-1 h-3.5 w-3.5" />Letter
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEmailFor(r)} title="Email the letter to the client">
                      <Mail className="mr-1 h-3.5 w-3.5" />Email
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {emailFor && (
        <ClientRecordsEmailDialog record={emailFor} refNo={refOf.get(emailFor.key)!} opts={opts} onClose={() => setEmailFor(null)} />
      )}
    </div>
  )
}
