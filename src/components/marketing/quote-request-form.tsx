'use client'

import { useId, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sendEmail } from '@/lib/send-email'
import { company } from '@/lib/site-content'
import { toast } from 'sonner'
import { Loader2, Paperclip, Send, CheckCircle2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/error-message'

const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5MB — keeps the notification email well under the send-email API's size limit

const EMPTY = {
  company_name: '',
  contact_person: '',
  email: '',
  mobile: '',
  product: '',
  quantity: '',
  specifications: '',
  brand: '',
  target_date: '',
  notes: '',
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function QuoteRequestForm({ source = 'Website - Quotation Request' }: { source?: string }) {
  const supabase = createClient()
  const formId = useId()
  const [form, setForm] = useState(EMPTY)
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  function set<K extends keyof typeof EMPTY>(field: K, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

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
    if (!form.company_name.trim() || !form.contact_person.trim() || !form.email.trim() || !form.mobile.trim() || !form.product.trim()) {
      return
    }
    setSending(true)

    const detailLines = [
      `Quantity: ${form.quantity.trim() || '-'}`,
      `Specifications: ${form.specifications.trim() || '-'}`,
      `Preferred Brand: ${form.brand.trim() || '-'}`,
      `Target Delivery Date: ${form.target_date.trim() || '-'}`,
      form.notes.trim() ? `Notes: ${form.notes.trim()}` : '',
    ].filter(Boolean).join('\n')

    const { error } = await supabase.from('crm_leads').insert({
      company_name: form.company_name.trim(),
      contact_person: form.contact_person.trim(),
      contact_email: form.email.trim(),
      contact_phone: form.mobile.trim(),
      product_interest: form.product.trim(),
      notes: detailLines,
      stage: 'new_lead',
      priority: 'medium',
      source,
    })

    if (error) {
      toast.error(getErrorMessage(error, 'Failed to send your request. Please try again.'))
      setSending(false)
      return
    }

    // Best-effort email notification to the CDSC inbox — the CRM record above
    // is the record of truth, so a failure here (e.g. email not configured)
    // should never block the visitor's confirmation.
    try {
      const attachments = file ? [{ base64: await fileToBase64(file), filename: file.name, contentType: file.type || 'application/octet-stream' }] : undefined
      await sendEmail({
        to: company.email,
        subject: `New Quotation Request — ${form.company_name.trim()}`,
        body: [
          `Company: ${form.company_name.trim()}`,
          `Contact Person: ${form.contact_person.trim()}`,
          `Email: ${form.email.trim()}`,
          `Mobile: ${form.mobile.trim()}`,
          `Product / Requirement: ${form.product.trim()}`,
          detailLines,
          `Source: ${source}`,
        ].join('\n'),
        attachments,
      })
    } catch {
      /* notification email is a bonus channel; the CRM insert already succeeded */
    }

    setSending(false)
    setDone(true)
  }

  if (done) {
    return (
      <div className="rounded-lg border border-cdsc-line bg-white p-8 text-center sm:p-10">
        <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-cdsc-accent-dark" />
        <h3 className="text-lg font-semibold text-cdsc-ink">Thank you.</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-cdsc-ink/70">
          Your requirement has been received. Our team will review the details and contact you regarding the next steps.
        </p>
        <button
          onClick={() => { setDone(false); setForm(EMPTY); setFile(null) }}
          className="mt-6 inline-flex items-center gap-2 rounded-md border border-cdsc-line px-5 py-2.5 text-sm font-medium text-cdsc-ink transition-colors hover:border-cdsc-navy hover:bg-cdsc-paper"
        >
          Submit Another Requirement
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-cdsc-line bg-white p-6 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={`${formId}-company`} label="Company Name" required>
          <input
            id={`${formId}-company`}
            value={form.company_name}
            onChange={e => set('company_name', e.target.value)}
            required
            placeholder="Your company"
            className={inputClass}
          />
        </Field>
        <Field id={`${formId}-contact`} label="Contact Person" required>
          <input
            id={`${formId}-contact`}
            value={form.contact_person}
            onChange={e => set('contact_person', e.target.value)}
            required
            placeholder="Full name"
            className={inputClass}
          />
        </Field>
        <Field id={`${formId}-email`} label="Email" required>
          <input
            id={`${formId}-email`}
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            required
            placeholder="you@company.com"
            className={inputClass}
          />
        </Field>
        <Field id={`${formId}-mobile`} label="Mobile Number" required>
          <input
            id={`${formId}-mobile`}
            value={form.mobile}
            onChange={e => set('mobile', e.target.value)}
            required
            placeholder="09XX XXX XXXX"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-5">
        <Field id={`${formId}-product`} label="Product / Requirement" required>
          <textarea
            id={`${formId}-product`}
            value={form.product}
            onChange={e => set('product', e.target.value)}
            required
            rows={3}
            placeholder="Describe what you need — e.g. safety gloves, cutting discs, control relays…"
            className={`${inputClass} resize-none`}
          />
        </Field>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field id={`${formId}-qty`} label="Quantity">
          <input
            id={`${formId}-qty`}
            value={form.quantity}
            onChange={e => set('quantity', e.target.value)}
            placeholder="e.g. 50 pcs"
            className={inputClass}
          />
        </Field>
        <Field id={`${formId}-brand`} label="Preferred Brand">
          <input
            id={`${formId}-brand`}
            value={form.brand}
            onChange={e => set('brand', e.target.value)}
            placeholder="If applicable"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field id={`${formId}-specs`} label="Specifications">
          <input
            id={`${formId}-specs`}
            value={form.specifications}
            onChange={e => set('specifications', e.target.value)}
            placeholder="Size, grade, rating, application…"
            className={inputClass}
          />
        </Field>
        <Field id={`${formId}-date`} label="Target Delivery Date">
          <input
            id={`${formId}-date`}
            type="date"
            value={form.target_date}
            onChange={e => set('target_date', e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-5">
        <Field id={`${formId}-notes`} label="Message / Additional Details">
          <textarea
            id={`${formId}-notes`}
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
            placeholder="Anything else we should know?"
            className={`${inputClass} resize-none`}
          />
        </Field>
      </div>

      <div className="mt-5">
        <label htmlFor={`${formId}-file`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-cdsc-ink/60">
          Upload Requirement / RFQ <span className="normal-case text-cdsc-ink/40">(optional, max 5MB)</span>
        </label>
        <label
          htmlFor={`${formId}-file`}
          className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-cdsc-line bg-cdsc-paper px-4 py-3 text-sm text-cdsc-ink/60 transition-colors hover:border-cdsc-navy"
        >
          <Paperclip className="h-4 w-4 shrink-0" />
          {file ? file.name : 'Choose a file (PDF, image, or document)'}
        </label>
        <input id={`${formId}-file`} type="file" onChange={onFileChange} className="sr-only" />
      </div>

      <button
        type="submit"
        disabled={sending}
        className="mt-7 flex w-full items-center justify-center gap-2 rounded-md bg-cdsc-navy px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-cdsc-navy-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : <><Send className="h-4 w-4" /> Request Quotation</>}
      </button>
      <p className="mt-4 text-center text-xs text-cdsc-ink/40">
        We will review your requirement and contact you regarding the next steps.
      </p>
    </form>
  )
}

const inputClass =
  'w-full rounded-md border border-cdsc-line bg-white px-3.5 py-2.5 text-sm text-cdsc-ink placeholder:text-cdsc-ink/35 focus:border-cdsc-navy focus:outline-none focus:ring-2 focus:ring-cdsc-navy/10 transition-colors'

function Field({ id, label, required, children }: { id: string; label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-cdsc-ink/60">
        {label}{required && <span className="ml-0.5 text-cdsc-accent-dark">*</span>}
      </label>
      {children}
    </div>
  )
}
