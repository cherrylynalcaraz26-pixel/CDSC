'use client'

// Email a client's records confirmation letter (Pull Outs → Client Records).
// Everything is editable before sending: recipients, subject and message; the
// letter details (date, ref. series, signatory, reply period, how untagged CSIs
// count); and the letter's wording (addressee, subject line, salutation, body,
// closing). Wording follows the figures automatically until it is edited.
// The right side shows a live preview; "Preview PDF" renders the exact file
// that will be attached, so what the user approves is what the client receives.

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { sendEmail } from '@/lib/send-email'
import { createClient } from '@/lib/supabase/client'
import { pagedPdfBase64, sheetDoc, SHEET_W } from '@/lib/paged-pdf'
import { getErrorMessage } from '@/lib/error-message'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Eye, FileText, Loader2, Mail, Paperclip, RotateCcw, Send } from 'lucide-react'
import {
  letterHtml, loadDocHeader, summarize, php, longDate, defaultLetterContent, STYLE,
  type ClientRecord, type LetterOptions, type LetterContent,
} from '@/components/pull-outs/client-records'

function defaultSubject(r: ClientRecord, ref: string) {
  return `Records Confirmation: Delivery Receipts and Charge Sales Invoices | ${r.name} | Ref. No. ${ref}`
}

function defaultBody(r: ClientRecord, ref: string, o: LetterOptions, company: string) {
  const s = summarize(r)
  const period = r.from ? ` from ${longDate(r.from)} to ${longDate(r.to)}` : ''
  const status = s.open
    ? `Our records show ${s.open} invoice${s.open === 1 ? '' : 's'} still open for collection, totaling ${php(s.openAmt)}. ${s.open === 1 ? 'It is' : 'These are'} itemized in Section 2 of the letter. We would appreciate settlement, or an update on ${s.open === 1 ? 'its' : 'their'} processing status, at your earliest convenience.`
    : s.active
      ? 'Our records show all active invoices as collected. Thank you for your consistent and timely settlement.'
      : ''
  return [
    `Dear ${r.contact || 'Sir/Madam'},`,
    'Good day.',
    `Attached is our records confirmation letter (Ref. No. ${ref}) covering the Delivery Receipts and Charge Sales Invoices issued by ${company} to ${r.name}${period}.`,
    status,
    `Kindly review the attached list against your receiving and payables records, then sign and return the conforme within ${o.days} days. If anything does not match, please reply with the document number and the difference so we can reconcile it on our side.`,
    'Thank you for your continued partnership.',
    ['Respectfully,', o.signatory, o.title, company].filter(Boolean).join('\n'),
  ].filter(Boolean).join('\n\n')
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        {action}
      </div>
      {children}
    </div>
  )
}

const fileSafe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim()

export function ClientRecordsEmailDialog({ record, refNo, opts, onOptsChange, untagged, onUntaggedChange, onClose, onLogged }: {
  record: ClientRecord
  refNo: string
  opts: LetterOptions
  onOptsChange: (o: LetterOptions) => void
  untagged: 'open' | 'collected'
  onUntaggedChange: (v: 'open' | 'collected') => void
  onClose: () => void
  /** Called after the send (or failure) is written to the email history. */
  onLogged?: () => void
}) {
  const [doc, setDoc] = useState<{ header: string; company: string } | null>(null)
  const [to, setTo] = useState(record.email)
  // null = follow the figures and settings automatically; a string = edited by the user.
  const [subjectEdit, setSubject] = useState<string | null>(null)
  const [bodyEdit, setBody] = useState<string | null>(null)
  const [letterEdit, setLetterEdit] = useState<Partial<LetterContent>>({})
  const [contact, setContact] = useState(record.contact)
  const [position, setPosition] = useState(record.position)
  const [address, setAddress] = useState(record.address)
  const setOpt = <K extends keyof LetterOptions>(k: K, v: LetterOptions[K]) => onOptsChange({ ...opts, [k]: v })
  const [tab, setTab] = useState<'letter' | 'pdf'>('letter')
  const [pdf, setPdf] = useState<{ html: string; base64: string; url: string } | null>(null)
  const [busy, setBusy] = useState<'pdf' | 'send' | null>(null)
  const urlRef = useRef<string | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const [zoom, setZoom] = useState(0.6)

  // Scale the A4-width preview to the panel so it wraps exactly like the PDF.
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setZoom(Math.min(1, (el.clientWidth - 2) / SHEET_W)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    let on = true
    loadDocHeader().then(d => { if (on) setDoc(d) })
    return () => { on = false }
  }, [])

  const company = doc?.company ?? ''
  const subject = subjectEdit ?? defaultSubject(record, refNo)
  const body = bodyEdit ?? (doc ? defaultBody({ ...record, contact: contact.trim() }, refNo, opts, company) : '')
  const letterDefaults = useMemo(() => defaultLetterContent({ ...record, contact: contact.trim() }, opts, company), [record, contact, opts, company])
  const letter: LetterContent = { ...letterDefaults, ...letterEdit }
  const setLetter = (k: keyof LetterContent) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setLetterEdit(p => ({ ...p, [k]: e.target.value }))
  const edited = subjectEdit !== null || bodyEdit !== null || Object.keys(letterEdit).length > 0
  const resetWording = () => { setSubject(null); setBody(null); setLetterEdit({}) }

  // Free the PDF blob URL when the dialog closes.
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current) }, [])

  const html = useMemo(() => {
    if (!doc) return ''
    const r = { ...record, contact: contact.trim(), position: position.trim(), address: address.trim() }
    return letterHtml(r, refNo, opts, doc.header, doc.company, '', letter)
  }, [doc, record, contact, position, address, refNo, opts, letter.subject, letter.salutation, letter.body, letter.closing]) // eslint-disable-line react-hooks/exhaustive-deps

  const pdfStale = !!pdf && pdf.html !== html
  const filename = `Client Records ${refNo} - ${fileSafe(record.name)}.pdf`

  async function makePdf() {
    if (pdf && pdf.html === html) return pdf
    // Same document, same A4 width as the on-screen preview, paginated onto A4.
    const base64 = await pagedPdfBase64(sheetDoc(html, STYLE, 'body{padding-top:0}'))
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
    urlRef.current = url
    const out = { html, base64, url }
    setPdf(out)
    return out
  }

  async function previewPdf() {
    setBusy('pdf')
    try { await makePdf(); setTab('pdf') }
    catch (e) { toast.error(getErrorMessage(e, 'Could not build the PDF')) }
    finally { setBusy(null) }
  }

  async function send() {
    const recipients = to.split(/[,;]/).map(x => x.trim()).filter(Boolean)
    if (!recipients.length) { toast.error('Enter the client’s email address'); return }
    if (recipients.some(x => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x))) { toast.error('Check the email address format'); return }
    if (!subject.trim()) { toast.error('Enter a subject'); return }
    setBusy('send')
    const sentHtml = html
    let error: string | null = null
    try {
      const p = await makePdf()
      await sendEmail({ to: recipients.join(', '), subject: subject.trim(), body, attachments: [{ base64: p.base64, filename }] })
    } catch (e) {
      error = getErrorMessage(e, 'Failed to send email')
    }
    const logged = await logEmail(recipients.join(', '), sentHtml, error)
    setBusy(null)
    if (error) { toast.error(error); return }
    toast.success(`Letter ${refNo} emailed to ${recipients.join(', ')}`)
    if (!logged) toast.warning('Email sent, but it could not be saved to the email history. Has migration 045 been applied?')
    onClose()
  }

  // Writes the send (or failure) to the client's email history. Never throws.
  async function logEmail(recipients: string, sentHtml: string, error: string | null) {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = user ? await supabase.from('profiles').select('full_name, email').eq('id', user.id).single() : { data: null }
      const s = summarize(record)
      const { error: dbErr } = await supabase.from('client_record_emails').insert({
        client_key: record.key,
        client_name: record.name,
        ref_no: refNo,
        letter_date: opts.date || null,
        period_from: record.from || null,
        period_to: record.to || null,
        recipients,
        subject: subject.trim(),
        body,
        attachment_name: filename,
        letter_html: sentHtml,
        csi_count: s.active,
        invoiced_amount: Math.round(s.activeAmt * 100) / 100,
        open_count: s.open,
        open_amount: Math.round(s.openAmt * 100) / 100,
        dr_count: s.drs,
        status: error ? 'failed' : 'sent',
        error,
        sent_by_name: prof?.full_name || prof?.email || user?.email || null,
      })
      if (dbErr) { console.warn('email history write failed', dbErr); return false }
      onLogged?.()
      return true
    } catch (e) {
      console.warn('email history write failed', e)
      return false
    }
  }

  return (
    <Dialog open onOpenChange={o => { if (!o && !busy) onClose() }}>
      <DialogContent size="landscape">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-[#E8112D]" />Email Records Letter · {record.name}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* LEFT: email, letter details, letter wording */}
          <div className="max-h-[72vh] space-y-3 overflow-y-auto pr-1">
            <Section title="Email">
              <div className="space-y-1.5">
                <Label>To</Label>
                <Input value={to} onChange={e => setTo(e.target.value)} placeholder="client@company.com, accounting@company.com" />
                {!record.email && <p className="text-xs text-amber-700">No email on file for this client. Add it in Clients to prefill next time.</p>}
              </div>
              <div className="space-y-1.5"><Label>Subject</Label><Input value={subject} onChange={e => setSubject(e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>Message</Label>
                <Textarea rows={9} value={body} onChange={e => setBody(e.target.value)} placeholder={doc ? '' : 'Loading…'} />
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <Paperclip className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{filename}</span>
              </div>
            </Section>

            <Section title="Letter details">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Letter Date (as of)</Label><Input type="date" value={opts.date} onChange={e => setOpt('date', e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Ref. No. Series</Label><Input value={opts.refBase} onChange={e => setOpt('refBase', e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Signatory</Label><Input value={opts.signatory} onChange={e => setOpt('signatory', e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Position</Label><Input value={opts.title} onChange={e => setOpt('title', e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Reply Within (days)</Label><Input type="number" min={1} value={opts.days} onChange={e => setOpt('days', Math.max(1, Number(e.target.value) || 15))} /></div>
                <div className="space-y-1.5">
                  <Label>Untagged CSIs count as</Label>
                  <Select value={untagged} onValueChange={v => onUntaggedChange((v ?? 'open') as 'open' | 'collected')}>
                    <SelectTrigger className="w-full"><span className="text-sm">{untagged === 'open' ? 'Open for collection' : 'Collected'}</span></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open for collection</SelectItem>
                      <SelectItem value="collected">Collected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Ref. No. for this client: <span className="font-mono">{refNo}</span>. These settings are remembered for printing too.</p>
            </Section>

            <Section title="Letter content" action={edited ? (
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={resetWording}><RotateCcw className="mr-1 h-3 w-3" />Reset wording</Button>
            ) : null}>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Addressed To</Label><Input value={contact} onChange={e => setContact(e.target.value)} placeholder="Blank = Attention: Purchasing / AP" /></div>
                <div className="space-y-1.5"><Label>Position</Label><Input value={position} onChange={e => setPosition(e.target.value)} /></div>
              </div>
              <div className="space-y-1.5"><Label>Address</Label><Input value={address} onChange={e => setAddress(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Subject Line</Label><Input value={letter.subject} onChange={setLetter('subject')} /></div>
              <div className="space-y-1.5"><Label>Salutation</Label><Input value={letter.salutation} onChange={setLetter('salutation')} /></div>
              <div className="space-y-1.5">
                <Label>Body</Label>
                <Textarea rows={12} value={letter.body} onChange={setLetter('body')} />
                <p className="text-xs text-muted-foreground">Leave a blank line between paragraphs. Wrap words in **double asterisks** to print them in bold.</p>
              </div>
              <div className="space-y-1.5"><Label>Closing Line</Label><Input value={letter.closing} onChange={setLetter('closing')} /></div>
              <p className="text-xs text-muted-foreground">The tables (Account Summary, Items for Collection, Annexes) and the conforme always follow the records.</p>
            </Section>
          </div>

          {/* RIGHT: preview */}
          <div className="flex min-h-0 flex-col space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex rounded-lg bg-muted p-0.5">
                <button type="button" onClick={() => setTab('letter')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium ${tab === 'letter' ? 'bg-white text-[#E8112D] shadow-sm' : 'text-muted-foreground'}`}>
                  <FileText className="h-3.5 w-3.5" />Letter
                </button>
                <button type="button" disabled={!pdf} onClick={() => setTab('pdf')}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium disabled:opacity-40 ${tab === 'pdf' ? 'bg-white text-[#E8112D] shadow-sm' : 'text-muted-foreground'}`}>
                  <Paperclip className="h-3.5 w-3.5" />PDF Attachment
                </button>
              </div>
              <Button variant="outline" size="sm" disabled={!doc || !!busy} onClick={previewPdf}>
                {busy === 'pdf' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
                {pdf && !pdfStale ? 'PDF Up to Date' : 'Preview PDF'}
              </Button>
            </div>
            {pdfStale && tab === 'pdf' && (
              <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">The letter changed since this PDF was built. Click Preview PDF to refresh it. Sending always attaches the latest version.</p>
            )}
            <div ref={boxRef} className="h-[62vh] overflow-hidden rounded-xl border bg-white">
              {!doc ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading letterhead…</div>
              ) : tab === 'pdf' && pdf ? (
                <iframe title="PDF attachment preview" src={pdf.url} className="h-full w-full" />
              ) : (
                <iframe title="Letter preview" className="h-full w-full"
                  srcDoc={sheetDoc(html, STYLE, `html{zoom:${zoom}}body{padding:44px 0}.brk{border-top:2px dashed #cbd5e1;margin:28px -52px}`)} />
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={!!busy} onClick={onClose}>Cancel</Button>
          <Button disabled={!doc || !!busy} onClick={send} className="bg-[#E8112D] hover:bg-[#D10F28]">
            {busy === 'send' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
