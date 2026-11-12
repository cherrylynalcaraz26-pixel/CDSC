'use client'

// Website "Request a Quotation" form — same fields as the system:
// Company, First / Middle / Last name, contact, delivery address
// (Address No., Street, Barangay, Municipality, City) and item lines
// (Item, Qty, Unit, Specs/Brand). Submissions create a pending Quotation
// Request (Quotation → Requests) + CRM lead via submit_web_quote_request
// (migration 040). Before that migration exists it falls back to a CRM lead.

import { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { sendEmail } from '@/lib/send-email'
import { company } from '@/lib/site-content'
import { toast } from 'sonner'
import { Loader2, Paperclip, Send, CheckCircle2, Plus, Trash2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/error-message'

const MAX_FILE_BYTES = 5 * 1024 * 1024 // keeps the notification email under the send-email API limit

const EMPTY = {
  company_name: '', first_name: '', middle_name: '', last_name: '',
  email: '', phone: '',
  address_no: '', street: '', barangay: '', municipality: '', city: '',
  subject: '', target_date: '', notes: '',
}
interface Line { item_name: string; quantity: string; unit: string; remarks: string }
const emptyLine = (): Line => ({ item_name: '', quantity: '1', unit: 'pc', remarks: '' })

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function QuoteRequestForm({ source = 'Website - Quotation Request' }: { source?: string }) {
  const formId = useId()
  const [form, setForm] = useState(EMPTY)
  const [lines, setLines] = useState<Line[]>([emptyLine()])
  const [catalog, setCatalog] = useState<{ item_name: string; unit_of_measure: string | null }[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  // Item suggestions from the live catalog (same items as the system).
  useEffect(() => {
    createClient().rpc('public_catalog').then(({ data }) => {
      if (Array.isArray(data)) setCatalog(data as typeof catalog)
    })
  }, [])

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))
  const setLine = (i: number, patch: Partial<Line>) => setLines(p => p.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) { setFile(null); return }
    if (f.size > MAX_FILE_BYTES) {
      toast.error('That file is too large. Please attach a file under 5MB.')
      e.target.value = ''
      setFile(null)
      return
    }
    setFile(f)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const items = lines.filter(l => l.item_name.trim())
    if (!items.length) { toast.error('Add at least one item you need.'); return }
    setSending(true)
    const supabase = createClient()
    const contact = [form.first_name, form.middle_name, form.last_name].map(s => s.trim()).filter(Boolean).join(' ')
    const itemText = items.map((l, i) => `${i + 1}. ${l.item_name.trim()} — ${l.quantity || 1} ${l.unit}${l.remarks.trim() ? ` (${l.remarks.trim()})` : ''}`).join('\n')

    let reference: string | null = null
    const { data, error } = await supabase.rpc('submit_web_quote_request', {
      p_customer: { ...form, source },
      p_items: items.map(l => ({ item_name: l.item_name.trim(), quantity: l.quantity || '1', unit: l.unit, remarks: l.remarks })),
    })
    if (!error) {
      reference = (data as { request_number?: string } | null)?.request_number ?? null
    } else if (/submit_web_quote_request|function|schema cache/i.test(error.message)) {
      // Migration 040 not applied yet → previous behaviour (CRM lead only).
      const { error: leadErr } = await supabase.from('crm_leads').insert({
        company_name: form.company_name.trim(),
        contact_person: contact,
        contact_email: form.email.trim(),
        contact_phone: form.phone.trim(),
        product_interest: items.map(l => l.item_name.trim()).join(', ').slice(0, 200),
        notes: [itemText, form.target_date && `Target delivery: ${form.target_date}`, form.notes.trim()].filter(Boolean).join('\n'),
        stage: 'new_lead',
        priority: 'medium',
        source,
      })
      if (leadErr) { toast.error(getErrorMessage(leadErr, 'Failed to send your request. Please try again.')); setSending(false); return }
    } else {
      toast.error(getErrorMessage(error, 'Failed to send your request. Please try again.'))
      setSending(false)
      return
    }

    // Best-effort email to the CDSC inbox; the database record is the source of truth.
    try {
      const attachments = file ? [{ base64: await fileToBase64(file), filename: file.name, contentType: file.type || 'application/octet-stream' }] : undefined
      await sendEmail({
        to: company.email,
        subject: `New Quotation Request${reference ? ` ${reference}` : ''} — ${form.company_name.trim()}`,
        body: [
          `Company: ${form.company_name.trim()}`,
          `Contact Person: ${contact}`,
          `Email: ${form.email.trim()}`,
          `Contact Number: ${form.phone.trim()}`,
          form.subject.trim() && `Subject: ${form.subject.trim()}`,
          `Items:\n${itemText}`,
          form.target_date && `Target Delivery Date: ${form.target_date}`,
          form.notes.trim() && `Notes: ${form.notes.trim()}`,
          `Source: ${source}`,
        ].filter(Boolean).join('\n'),
        attachments,
      })
    } catch { /* email is a bonus channel */ }

    setSending(false)
    setDone(reference ?? 'received')
  }

  if (done) {
    return (
      <div className="rounded-3xl bg-white p-8 text-center shadow-[0_8px_40px_-12px_rgba(0,0,0,0.15)] sm:p-12">
        <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-cdsc-accent to-rose-500 text-white shadow-lg shadow-cdsc-accent/30">
          <CheckCircle2 className="h-8 w-8" />
        </span>
        <h3 className="text-2xl font-black text-cdsc-ink">Request received — thank you!</h3>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-cdsc-ink/65">
          {done !== 'received' && <>Your reference number is <strong className="text-cdsc-ink">{done}</strong>. </>}
          Our team will review your items and send you a quotation.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => { setDone(null); setForm(EMPTY); setLines([emptyLine()]); setFile(null) }}
            className="rounded-xl bg-cdsc-paper px-5 py-2.5 text-sm font-semibold text-cdsc-ink transition hover:bg-cdsc-tint"
          >
            Send Another Request
          </button>
          <Link href="/products#shop" className="rounded-xl bg-cdsc-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cdsc-accent-dark">
            Browse Products
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7 rounded-3xl bg-white p-6 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.15)] sm:p-9">
      <Section title="Your Details">
        <Field id={`${formId}-company`} label="Company / Business Name" required>
          <input id={`${formId}-company`} required value={form.company_name} onChange={set('company_name')} autoComplete="organization" className={inputClass} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id={`${formId}-fn`} label="First Name" required><input id={`${formId}-fn`} required value={form.first_name} onChange={set('first_name')} autoComplete="given-name" className={inputClass} /></Field>
          <Field id={`${formId}-mn`} label="Middle Name"><input id={`${formId}-mn`} value={form.middle_name} onChange={set('middle_name')} autoComplete="additional-name" className={inputClass} /></Field>
          <Field id={`${formId}-ln`} label="Last Name" required><input id={`${formId}-ln`} required value={form.last_name} onChange={set('last_name')} autoComplete="family-name" className={inputClass} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${formId}-email`} label="Email" required><input id={`${formId}-email`} type="email" required value={form.email} onChange={set('email')} autoComplete="email" placeholder="you@company.com" className={inputClass} /></Field>
          <Field id={`${formId}-phone`} label="Contact Number" required><input id={`${formId}-phone`} required value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="09XX XXX XXXX" className={inputClass} /></Field>
        </div>
      </Section>

      <Section title="Delivery Address" hint="optional">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id={`${formId}-ano`} label="Address No."><input id={`${formId}-ano`} value={form.address_no} onChange={set('address_no')} className={inputClass} /></Field>
          <div className="sm:col-span-2"><Field id={`${formId}-st`} label="Street"><input id={`${formId}-st`} value={form.street} onChange={set('street')} autoComplete="address-line1" className={inputClass} /></Field></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id={`${formId}-brgy`} label="Barangay"><input id={`${formId}-brgy`} value={form.barangay} onChange={set('barangay')} className={inputClass} /></Field>
          <Field id={`${formId}-muni`} label="Municipality"><input id={`${formId}-muni`} value={form.municipality} onChange={set('municipality')} className={inputClass} /></Field>
          <Field id={`${formId}-city`} label="City / Province"><input id={`${formId}-city`} value={form.city} onChange={set('city')} className={inputClass} /></Field>
        </div>
      </Section>

      <Section title="Items Needed">
        <Field id={`${formId}-subj`} label="Subject / Project"><input id={`${formId}-subj`} value={form.subject} onChange={set('subject')} placeholder="e.g. Safety supplies for plant maintenance" className={inputClass} /></Field>
        <div className="overflow-hidden rounded-2xl bg-cdsc-paper">
          <div className="hidden grid-cols-[1fr_90px_100px_1fr_40px] gap-2 px-3 pt-3 text-[11px] font-semibold uppercase tracking-wide text-cdsc-ink/50 sm:grid">
            <span>Item / Description</span><span>Qty</span><span>Unit</span><span>Specs / Brand</span><span />
          </div>
          <div className="space-y-2 p-3">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-xl bg-white p-2 shadow-sm sm:grid-cols-[1fr_90px_100px_1fr_40px] sm:bg-transparent sm:p-0 sm:shadow-none">
                <input
                  aria-label="Item" required={i === 0} list={`${formId}-catalog`} value={l.item_name}
                  onChange={e => { const v = e.target.value; const hit = catalog.find(c => c.item_name === v); setLine(i, { item_name: v, ...(hit?.unit_of_measure ? { unit: hit.unit_of_measure } : {}) }) }}
                  placeholder="Type or pick an item" className={`${inputClass} col-span-2 sm:col-span-1`}
                />
                <input aria-label="Quantity" inputMode="decimal" value={l.quantity} onChange={e => setLine(i, { quantity: e.target.value.replace(/[^\d.]/g, '') })} className={inputClass} />
                <input aria-label="Unit" value={l.unit} onChange={e => setLine(i, { unit: e.target.value })} className={inputClass} />
                <input aria-label="Specifications or brand" value={l.remarks} onChange={e => setLine(i, { remarks: e.target.value })} placeholder="Size, rating, brand…" className={`${inputClass} col-span-2 sm:col-span-1`} />
                <button
                  type="button" aria-label="Remove item" disabled={lines.length === 1}
                  onClick={() => setLines(p => p.filter((_, j) => j !== i))}
                  className="col-span-2 flex h-10 items-center justify-center rounded-lg text-cdsc-ink/40 transition hover:bg-cdsc-tint hover:text-cdsc-accent disabled:opacity-30 sm:col-span-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <datalist id={`${formId}-catalog`}>{catalog.map((c, k) => <option key={k} value={c.item_name} />)}</datalist>
            <button type="button" onClick={() => setLines(p => [...p, emptyLine()])}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-cdsc-accent transition hover:bg-white">
              <Plus className="h-4 w-4" /> Add Item
            </button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${formId}-date`} label="Target Delivery Date"><input id={`${formId}-date`} type="date" value={form.target_date} onChange={set('target_date')} className={inputClass} /></Field>
          <div>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-cdsc-ink/60">
              Attach RFQ / Specs <span className="normal-case text-cdsc-ink/40">(optional, max 5MB)</span>
            </span>
            <label htmlFor={`${formId}-file`} className="flex cursor-pointer items-center gap-2 rounded-xl bg-cdsc-paper px-4 py-2.5 text-sm text-cdsc-ink/60 transition hover:bg-cdsc-tint">
              <Paperclip className="h-4 w-4 shrink-0" /><span className="truncate">{file ? file.name : 'Choose a file'}</span>
            </label>
            <input id={`${formId}-file`} type="file" onChange={onFileChange} className="sr-only" />
          </div>
        </div>
        <Field id={`${formId}-notes`} label="Message / Additional Details">
          <textarea id={`${formId}-notes`} rows={3} value={form.notes} onChange={set('notes')} placeholder="Anything else we should know?" className={`${inputClass} resize-none`} />
        </Field>
      </Section>

      <button
        type="submit" disabled={sending}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-cdsc-accent to-rose-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-cdsc-accent/25 transition hover:-translate-y-0.5 hover:shadow-xl disabled:translate-y-0 disabled:opacity-60"
      >
        {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <><Send className="h-4 w-4" /> Request Quotation</>}
      </button>
      <p className="-mt-3 text-center text-xs text-cdsc-ink/45">Your request goes straight to our quotation team. We&apos;ll reply with pricing and availability.</p>
    </form>
  )
}

const inputClass =
  'w-full rounded-xl border border-cdsc-line bg-white px-3.5 py-2.5 text-sm text-cdsc-ink placeholder:text-cdsc-ink/35 transition focus:border-cdsc-accent focus:outline-none focus:ring-2 focus:ring-cdsc-accent/15'

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-1 flex items-center gap-2 text-sm font-bold text-cdsc-ink">
        <span className="h-4 w-1 rounded-full bg-cdsc-accent" />{title}
        {hint && <span className="text-xs font-normal text-cdsc-ink/40">({hint})</span>}
      </legend>
      {children}
    </fieldset>
  )
}

function Field({ id, label, required, children }: { id: string; label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-cdsc-ink/60">
        {label}{required && <span className="ml-0.5 text-cdsc-accent">*</span>}
      </label>
      {children}
    </div>
  )
}
