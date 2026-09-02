'use client'

import { useId, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Send, CheckCircle2, Building2, Truck } from 'lucide-react'

type ContactType = 'client' | 'supplier'

const CONTACT_TYPES: { value: ContactType; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: 'client', label: 'Client / Customer', desc: 'I want to purchase products', icon: <Building2 className="h-6 w-6" /> },
  { value: 'supplier', label: 'Supplier / Vendor', desc: 'I want to supply products', icon: <Truck className="h-6 w-6" /> },
]

const EMPTY = {
  contact_type: '' as ContactType | '',
  company_name: '',
  contact_person: '',
  contact_email: '',
  contact_phone: '',
  product_interest: '',
  notes: '',
}

export function InquiryForm() {
  const supabase = createClient()
  const formId = useId()
  const [form, setForm] = useState(EMPTY)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  function set<K extends keyof typeof EMPTY>(field: K, value: (typeof EMPTY)[K]) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company_name.trim() || !form.contact_person.trim()) return
    setSending(true)

    const typeLabel = form.contact_type === 'client' ? 'Client' : form.contact_type === 'supplier' ? 'Supplier' : ''

    const { error: leadError } = await supabase.from('crm_leads').insert({
      company_name: form.company_name.trim(),
      contact_person: form.contact_person.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      product_interest: form.product_interest.trim() || null,
      notes: [typeLabel ? `Type: ${typeLabel}` : '', form.notes.trim()].filter(Boolean).join('\n') || null,
      stage: 'new_lead',
      priority: 'medium',
      source: 'Online Inquiry Form',
    })
    if (leadError) {
      toast.error(leadError.message || 'Failed to submit inquiry. Please try again.')
      setSending(false)
      return
    }

    if (form.contact_type === 'client') {
      const { error } = await supabase.from('clients').insert({
        company_name: form.company_name.trim(),
        contact_person: form.contact_person.trim() || null,
        mobile_number: form.contact_phone.trim() || null,
        email: form.contact_email.trim() || null,
        product_interest: form.product_interest.trim() || null,
        notes: form.notes.trim() || null,
        status: 'active',
      })
      if (error) toast.error(error.message)
    } else if (form.contact_type === 'supplier') {
      const now = new Date()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      const yyyy = now.getFullYear()
      const code = `INQ-${mm}-${dd}-${yyyy}`
      const { error } = await supabase.from('suppliers').insert({
        supplier_code: code,
        company_name: form.company_name.trim(),
        contact_person: form.contact_person.trim() || null,
        mobile_number: form.contact_phone.trim() || null,
        email: form.contact_email.trim() || null,
        payment_terms: '30 days',
        lead_time_days: 0,
        vat_registered: false,
        status: 'active',
        is_active: true,
      })
      if (error) toast.error(error.message)
    }

    setSending(false)
    setDone(true)
  }

  if (done) {
    return (
      <div className="rounded-lg border border-cdsc-line bg-white p-8 text-center sm:p-10">
        <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-cdsc-accent-dark" />
        <h3 className="text-lg font-semibold text-cdsc-ink">Inquiry Received!</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-cdsc-ink/70">
          Thank you for reaching out. Our team will review your details and contact you regarding the next steps.
        </p>
        <button
          onClick={() => { setDone(false); setForm(EMPTY) }}
          className="mt-6 inline-flex items-center gap-2 rounded-md border border-cdsc-line px-5 py-2.5 text-sm font-medium text-cdsc-ink transition-colors hover:border-cdsc-navy hover:bg-cdsc-paper"
        >
          Submit Another Inquiry
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-cdsc-line bg-white p-6 sm:p-8">
      <div>
        <label className="mb-2.5 block text-xs font-semibold uppercase tracking-wide text-cdsc-ink/60">
          I am a <span className="text-cdsc-accent-dark">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {CONTACT_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => set('contact_type', t.value)}
              className={`flex flex-col items-center gap-2 rounded-lg border py-5 px-3 text-center transition-colors ${
                form.contact_type === t.value
                  ? 'border-cdsc-accent bg-cdsc-tint text-cdsc-ink'
                  : 'border-cdsc-line bg-white text-cdsc-ink/50 hover:border-cdsc-navy/30'
              }`}
            >
              <span className={form.contact_type === t.value ? 'text-cdsc-accent-dark' : 'text-cdsc-ink/40'}>{t.icon}</span>
              <span>
                <span className="block text-xs font-semibold text-cdsc-ink">{t.label}</span>
                <span className="mt-0.5 block text-[11px] text-cdsc-ink/50">{t.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <hr className="my-6 border-cdsc-line" />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={`${formId}-company`} label="Company / Business Name" required>
          <input
            id={`${formId}-company`}
            value={form.company_name}
            onChange={e => set('company_name', e.target.value)}
            required
            placeholder="e.g. Acme Corporation"
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
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field id={`${formId}-phone`} label="Phone Number">
          <input
            id={`${formId}-phone`}
            value={form.contact_phone}
            onChange={e => set('contact_phone', e.target.value)}
            placeholder="09XX XXX XXXX"
            className={inputClass}
          />
        </Field>
        <Field id={`${formId}-email`} label="Email Address">
          <input
            id={`${formId}-email`}
            type="email"
            value={form.contact_email}
            onChange={e => set('contact_email', e.target.value)}
            placeholder="you@company.com"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-5">
        <Field id={`${formId}-interest`} label={form.contact_type === 'supplier' ? 'Products / Services You Supply' : 'Product / Service of Interest'}>
          <input
            id={`${formId}-interest`}
            value={form.product_interest}
            onChange={e => set('product_interest', e.target.value)}
            placeholder={form.contact_type === 'supplier' ? 'e.g. Safety equipment, fasteners, tools…' : 'e.g. Industrial fasteners, safety equipment…'}
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
            rows={4}
            placeholder="Tell us more about your requirements, expected quantity, timeline, or any other details…"
            className={`${inputClass} resize-none`}
          />
        </Field>
      </div>

      <button
        type="submit"
        disabled={sending || !form.company_name.trim() || !form.contact_person.trim()}
        className="mt-7 flex w-full items-center justify-center gap-2 rounded-md bg-cdsc-navy px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-cdsc-navy-dark disabled:cursor-not-allowed disabled:opacity-40"
      >
        {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending your inquiry…</> : <><Send className="h-4 w-4" /> Send Inquiry</>}
      </button>
      <p className="mt-4 text-center text-xs text-cdsc-ink/40">
        By submitting this form you agree to our privacy policy. Your data will never be shared with third parties.
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
