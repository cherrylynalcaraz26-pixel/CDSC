'use client'

// Pull Out Authorization Letter — the formal letter CDSC's representative brings
// to the site (e.g. KEPI) so the person in charge can release the items.
// Prepared in a small dialog (date, addressee, representative, signatory…),
// then printed on CDSC letterhead with the full list of items and an
// acknowledgment block for the site to sign on release.

import { useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { driveImageSrc } from '@/lib/upload-image'
import { registration } from '@/lib/site-content'
import { FileSignature, Printer } from 'lucide-react'

export interface LetterPullOut {
  pull_out_number: string | null
  location_name: string
  pickup_address: string | null
  contact_person: string | null
  reference_no: string | null
  scheduled_date: string | null
  assigned_to: string | null
  vehicle: string | null
  reasonLabel: string
  items?: { item_name: string; quantity: number; unit: string | null; condition: string | null }[]
}

interface Company {
  company_name?: string | null
  address?: string | null
  city?: string | null
  province?: string | null
  phone?: string | null
  mobile?: string | null
  email?: string | null
  tin?: string | null
  logo_url?: string | null
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const nl2br = (s: string) => esc(s).replace(/\n/g, '<br/>')
const longDate = (d: string) => (d ? format(new Date(d + 'T00:00:00'), 'MMMM d, yyyy') : '')

export function initialDraft(r: LetterPullOut) {
  const today = format(new Date(), 'yyyy-MM-dd')
  return {
    date: today,
    pickup_date: r.scheduled_date ?? today,
    recipient: r.contact_person ?? '',
    recipient_title: r.contact_person ? '' : 'The Person-in-Charge / Warehouse Officer',
    representative: r.assigned_to ?? '',
    representative_title: 'Authorized Representative',
    id_presented: '',
    signatory: registration.proprietor,
    signatory_title: 'Proprietor',
    note: '',
  }
}
type Draft = ReturnType<typeof initialDraft>

export function letterHtml(r: LetterPullOut, d: Draft, co: Company) {
  const company = co.company_name || 'CDSC Industrial Supply'
  const address = [co.address, co.city, co.province].filter(Boolean).join(', ')
  const contacts = [co.phone || co.mobile, co.email].filter(Boolean).join(' · ')
  const items = r.items ?? []
  const totalQty = items.reduce((s, i) => s + Number(i.quantity || 0), 0)
  const rows = items.length
    ? items.map((i, n) => `<tr>
        <td class="c">${n + 1}</td><td>${esc(i.item_name)}</td>
        <td class="c">${esc(Number(i.quantity).toLocaleString('en-PH'))}</td><td class="c">${esc(i.unit ?? '')}</td>
        <td>${esc(i.condition ?? '')}</td></tr>`).join('')
    : '<tr><td colspan="5" class="c muted">No items listed</td></tr>'
  const rep = d.representative.trim() || '____________________'

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Authorization Letter ${esc(r.pull_out_number ?? '')}</title><style>
    @page{size:A4;margin:18mm 18mm 16mm}
    *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.55;color:#111;margin:0}
    .head{display:flex;align-items:center;gap:14px;padding-bottom:10px;border-bottom:3px solid #E8112D}
    .head img{height:54px;max-width:120px;object-fit:contain}
    .head .n{font-size:17px;font-weight:800;letter-spacing:.2px}.head .s{font-size:10.5px;color:#555}
    h1{text-align:center;font-size:15px;letter-spacing:2px;margin:22px 0 4px}
    .ref{text-align:center;font-size:10.5px;color:#555;margin-bottom:18px}
    .to b{display:block}.subj{margin:14px 0}
    p{margin:0 0 10px;text-align:justify}
    table{width:100%;border-collapse:collapse;margin:8px 0 6px}
    th{background:#E8112D;color:#fff;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;padding:6px 8px;text-align:left}
    td{padding:6px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top}.c{text-align:center}.muted{color:#888}
    tfoot td{font-weight:700;border-bottom:0;border-top:2px solid #111}
    .sig{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:34px}
    .line{border-top:1px solid #111;margin-top:38px;padding-top:4px}.line b{display:block}.line span{font-size:10.5px;color:#555}
    .ack{margin-top:30px;border:1px dashed #999;border-radius:6px;padding:12px 14px;page-break-inside:avoid}
    .ack h2{font-size:11.5px;letter-spacing:1px;margin:0 0 6px}
    .ack .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px}
    .ack .line{margin-top:30px}
    .foot{margin-top:18px;font-size:9.5px;color:#777;text-align:center}
  </style></head><body>
    <div class="head">
      ${co.logo_url ? `<img src="${esc(driveImageSrc(co.logo_url))}" alt=""/>` : ''}
      <div><div class="n">${esc(company)}</div>
        <div class="s">${esc(address)}</div>
        <div class="s">${esc(contacts)}${co.tin ? ` · TIN ${esc(co.tin)}` : ''}</div></div>
    </div>

    <h1>AUTHORIZATION LETTER</h1>
    <div class="ref">Pull Out No. ${esc(r.pull_out_number ?? '—')}${r.reference_no ? ` · Ref. ${esc(r.reference_no)}` : ''}</div>

    <p>${esc(longDate(d.date))}</p>
    <div class="to">
      ${d.recipient.trim() ? `<b>${esc(d.recipient)}</b>` : ''}
      ${d.recipient_title.trim() ? `<div>${esc(d.recipient_title)}</div>` : ''}
      <div>${esc(r.location_name)}</div>
      ${r.pickup_address ? `<div>${esc(r.pickup_address)}</div>` : ''}
    </div>

    <p class="subj"><b>Subject: Authorization to Pull Out Items</b></p>
    <p>Dear ${d.recipient.trim() ? esc(d.recipient) : 'Sir/Madam'},</p>
    <p>This is to formally authorize <b>${esc(rep)}</b>${d.representative_title.trim() ? `, ${esc(d.representative_title)}` : ''} of
      <b>${esc(company)}</b>, to pull out and receive on our behalf the item(s) listed below from <b>${esc(r.location_name)}</b>
      on <b>${esc(longDate(d.pickup_date))}</b> — purpose: <b>${esc(r.reasonLabel)}</b>.</p>

    <table>
      <thead><tr><th class="c" style="width:36px">No.</th><th>Item Description</th><th class="c" style="width:70px">Qty</th><th class="c" style="width:70px">Unit</th><th style="width:150px">Condition / Remarks</th></tr></thead>
      <tbody>${rows}</tbody>
      ${items.length ? `<tfoot><tr><td></td><td>Total: ${items.length} item${items.length === 1 ? '' : 's'}</td><td class="c">${esc(totalQty.toLocaleString('en-PH'))}</td><td></td><td></td></tr></tfoot>` : ''}
    </table>

    <p>Our representative will present a valid identification card${d.id_presented.trim() ? ` (<b>${esc(d.id_presented)}</b>)` : ''}${r.vehicle ? ` and will use vehicle <b>${esc(r.vehicle)}</b>` : ''}.
      Kindly release the items above and sign the acknowledgment below upon release.</p>
    ${d.note.trim() ? `<p>${nl2br(d.note)}</p>` : ''}
    <p>Thank you for your kind assistance.</p>

    <div class="sig">
      <div>Very truly yours,
        <div class="line"><b>${esc(d.signatory)}</b><span>${esc(d.signatory_title)}, ${esc(company)}</span></div></div>
      <div>Specimen signature of representative:
        <div class="line"><b>${esc(d.representative.trim() || ' ')}</b><span>${esc(d.representative_title)}</span></div></div>
    </div>

    <div class="ack">
      <h2>ACKNOWLEDGMENT OF RELEASE</h2>
      <div>The item(s) listed above were released complete and in the condition stated.</div>
      <div class="grid">
        <div class="line"><b>Released by</b><span>Signature over printed name</span></div>
        <div class="line"><b>Received by (CDSC)</b><span>Signature over printed name</span></div>
        <div class="line"><b>Date &amp; Time</b><span>&nbsp;</span></div>
      </div>
    </div>
    <div class="foot">${esc(company)} · Pull Out No. ${esc(r.pull_out_number ?? '—')}</div>
  </body></html>`
}

export function PullOutLetterDialog({ pullOut, onClose }: { pullOut: LetterPullOut; onClose: () => void }) {
  const [d, setD] = useState<Draft>(() => initialDraft(pullOut))
  const [printing, setPrinting] = useState(false)
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setD(p => ({ ...p, [k]: e.target.value }))

  async function print() {
    // Open the window first (inside the click) so pop-up blockers allow it.
    const win = window.open('', '_blank', 'width=900,height=1000')
    if (!win) return
    setPrinting(true)
    const { data } = await createClient()
      .from('system_settings').select('*').single()
    setPrinting(false)
    win.document.write(letterHtml(pullOut, d, (data ?? {}) as Company))
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 600)
  }

  const items = pullOut.items ?? []

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent size="landscape">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-[#E8112D]" />Authorization Letter — {pullOut.pull_out_number ?? 'Pull Out'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Letter Date</Label><Input type="date" value={d.date} onChange={set('date')} /></div>
              <div className="space-y-1.5"><Label>Pick-up Date</Label><Input type="date" value={d.pickup_date} onChange={set('pickup_date')} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Addressed To</Label><Input placeholder="Name of person-in-charge" value={d.recipient} onChange={set('recipient')} /></div>
              <div className="space-y-1.5"><Label>Position / Department</Label><Input placeholder="e.g. Warehouse Supervisor" value={d.recipient_title} onChange={set('recipient_title')} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Authorized Representative</Label><Input placeholder="Driver / staff name" value={d.representative} onChange={set('representative')} /></div>
              <div className="space-y-1.5"><Label>Representative&apos;s Position</Label><Input value={d.representative_title} onChange={set('representative_title')} /></div>
            </div>
            <div className="space-y-1.5"><Label>ID to Present (optional)</Label><Input placeholder="e.g. Driver's License No. N01-23-456789" value={d.id_presented} onChange={set('id_presented')} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Signatory</Label><Input value={d.signatory} onChange={set('signatory')} /></div>
              <div className="space-y-1.5"><Label>Signatory&apos;s Position</Label><Input value={d.signatory_title} onChange={set('signatory_title')} /></div>
            </div>
            <div className="space-y-1.5"><Label>Additional Note (optional)</Label><Textarea rows={2} value={d.note} onChange={set('note')} /></div>
          </div>

          <div className="space-y-2">
            <Label>Items in the Letter</Label>
            <div className="overflow-hidden rounded-xl bg-muted/40">
              <table className="w-full text-sm">
                <thead className="bg-[#E8112D] text-xs text-white">
                  <tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-left">Unit</th><th className="px-3 py-2 text-left">Condition</th></tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No items — edit the pull out to add them.</td></tr>
                  ) : items.map((i, n) => (
                    <tr key={n} className="even:bg-white/60">
                      <td className="px-3 py-1.5 text-muted-foreground">{n + 1}</td>
                      <td className="px-3 py-1.5">{i.item_name}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{Number(i.quantity).toLocaleString('en-PH')}</td>
                      <td className="px-3 py-1.5">{i.unit}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{i.condition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              From <b>{pullOut.location_name}</b>{pullOut.pickup_address ? ` — ${pullOut.pickup_address}` : ''} · {pullOut.reasonLabel}
              {pullOut.vehicle ? ` · Vehicle ${pullOut.vehicle}` : ''}. The letter prints on your letterhead (Settings → Company Profile) with an acknowledgment block for the site to sign.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={print} disabled={printing} className="bg-[#E8112D] hover:bg-[#D10F28]">
            <Printer className="mr-2 h-4 w-4" />Print Letter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
