'use client'

// "Partner With Us" / Get in Touch form on the public website.
// Collects what the team needs to qualify a client or supplier on first contact:
// company details (industry, business type, TIN, website), the registered
// business address, and the contact person with their position. Every
// submission becomes a CRM lead; a client also gets a Client record, and a
// supplier gets an inactive Supplier record that waits for staff review.

import { useId, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Send, CheckCircle2, Building2, Truck } from 'lucide-react'
import { getErrorMessage } from '@/lib/error-message'
import { joinName, nameColumns, joinAddress, addressColumns } from '@/lib/person-address'

type ContactType = 'client' | 'supplier'

const CONTACT_TYPES: { value: ContactType; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: 'client', label: 'Client / Customer', desc: 'We want to purchase products', icon: <Building2 className="h-6 w-6" /> },
  { value: 'supplier', label: 'Supplier / Vendor', desc: 'We want to supply products', icon: <Truck className="h-6 w-6" /> },
]

const BUSINESS_TYPES = ['Corporation', 'One Person Corporation (OPC)', 'Partnership', 'Sole Proprietorship', 'Cooperative', 'Government / LGU', 'Other']
const INDUSTRIES = ['Manufacturing', 'Construction', 'Electrical / Power', 'Food & Beverage', 'Automotive', 'Logistics / Warehousing', 'Semiconductor / Electronics', 'Pharmaceutical', 'Mining', 'Retail / Distribution', 'Other']

const EMPTY = {
  contact_type: '' as ContactType | '',
  company_name: '',
  industry: '',
  business_type: '',
  tin: '',
  website: '',
  address_no: '',
  street: '',
  barangay: '',
  municipality: '',
  city: '',
  province: '',
  zip_code: '',
  contact_first: '',
  contact_middle: '',
  contact_last: '',
  position: '',
  contact_email: '',
  contact_phone: '',
  product_interest: '',
  notes: '',
}

type Form = typeof EMPTY
const t = (s: string) => s.trim()

function missingFields(f: Form): string[] {
  const out: string[] = []
  if (!f.contact_type) out.push('I am a')
  if (!t(f.company_name)) out.push('Company Name')
  if (!t(f.street) && !t(f.barangay)) out.push('Street or Barangay')
  if (!t(f.municipality) && !t(f.city)) out.push('Municipality / City')
  if (!t(f.province)) out.push('Province')
  if (!t(f.contact_first)) out.push('First Name')
  if (!t(f.contact_last)) out.push('Last Name')
  if (!t(f.position)) out.push('Position / Designation')
  if (!t(f.contact_email)) out.push('Email Address')
  if (!t(f.contact_phone)) out.push('Mobile / Phone')
  return out
}

export function InquiryForm() {
  const supabase = createClient()
  const id = useId()
  const [form, setForm] = useState(EMPTY)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [tried, setTried] = useState(false)

  function set<K extends keyof Form>(field: K, value: Form[K]) {
    setForm(f => ({ ...f, [field]: value }))
  }

  const missing = missingFields(form)
  const bad = (label: string) => tried && missing.includes(label)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    if (missing.length > 0) {
      toast.error(`Please complete: ${missing.join(', ')}`)
      return
    }
    setSending(true)

    const contactName = { first: form.contact_first, middle: form.contact_middle, last: form.contact_last }
    const contactPerson = joinName(contactName)
    const addr = { no: form.address_no, street: form.street, barangay: form.barangay, municipality: form.municipality, city: form.city }
    const fullAddress = [joinAddress(addr), t(form.province), t(form.zip_code)].filter(Boolean).join(', ')
    const typeLabel = form.contact_type === 'client' ? 'Client' : 'Supplier'

    // CRM has no address / position columns, so the lead's notes carry the full profile.
    const profile = [
      `Type: ${typeLabel}`,
      `Position: ${t(form.position)}`,
      form.industry && `Industry: ${form.industry}`,
      form.business_type && `Business Type: ${form.business_type}`,
      t(form.tin) && `TIN: ${t(form.tin)}`,
      t(form.website) && `Website: ${t(form.website)}`,
      `Address: ${fullAddress}`,
      t(form.notes) && `\n${t(form.notes)}`,
    ].filter(Boolean).join('\n')

    const { error: leadError } = await supabase.from('crm_leads').insert({
      company_name: t(form.company_name),
      contact_person: contactPerson || null,
      ...nameColumns(contactName, 'contact_'),
      contact_email: t(form.contact_email) || null,
      contact_phone: t(form.contact_phone) || null,
      product_interest: t(form.product_interest) || null,
      notes: profile,
      stage: 'new_lead',
      priority: 'medium',
      source: 'Online Inquiry Form',
    })
    if (leadError) {
      toast.error(getErrorMessage(leadError, 'Failed to submit inquiry. Please try again.'))
      setSending(false)
      return
    }

    if (form.contact_type === 'client') {
      const { error } = await supabase.from('clients').insert({
        company_name: t(form.company_name),
        contact_person: contactPerson || null,
        ...nameColumns(contactName, 'contact_'),
        position: t(form.position) || null,
        mobile_number: t(form.contact_phone) || null,
        email: t(form.contact_email) || null,
        ...addressColumns(addr),
        address: fullAddress || null,
        province: t(form.province) || null,
        zip_code: t(form.zip_code) || null,
        tin: t(form.tin) || null,
        industry: form.industry || null,
        business_type: form.business_type || null,
        website: t(form.website) || null,
        product_interest: t(form.product_interest) || null,
        notes: t(form.notes) || null,
        status: 'active',
      })
      if (error) toast.error(getErrorMessage(error))
    } else {
      const now = new Date()
      const code = `INQ-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${now.getFullYear()}`
      const { error } = await supabase.from('suppliers').insert({
        supplier_code: code,
        company_name: t(form.company_name),
        contact_person: contactPerson || null,
        ...nameColumns(contactName, 'contact_'),
        mobile_number: t(form.contact_phone) || null,
        email: t(form.contact_email) || null,
        ...addressColumns(addr),
        address: fullAddress || null,
        tin: t(form.tin) || null,
        supplier_category: t(form.product_interest) || null,
        payment_terms: '30 days',
        lead_time_days: 0,
        vat_registered: false,
        // Website applications wait for staff review (Settings → Suppliers) before going live.
        status: 'inactive',
        is_active: false,
      })
      if (error) toast.error(getErrorMessage(error))
    }

    setSending(false)
    setDone(true)
  }

  if (done) {
    return (
      <div className="rounded-lg border border-cdsc-line bg-white p-8 text-center sm:p-10">
        <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-cdsc-accent-dark" />
        <h3 className="text-lg font-semibold text-cdsc-ink">Inquiry Received</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-cdsc-ink/70">
          Thank you, {t(form.contact_first)}. Our team will review the details for {t(form.company_name)} and contact you within one to two business days.
        </p>
        <button
          onClick={() => { setDone(false); setTried(false); setForm(EMPTY) }}
          className="mt-6 inline-flex items-center gap-2 rounded-md border border-cdsc-line px-5 py-2.5 text-sm font-medium text-cdsc-ink transition-colors hover:border-cdsc-navy hover:bg-cdsc-paper"
        >
          Submit Another Inquiry
        </button>
      </div>
    )
  }

  const isSupplier = form.contact_type === 'supplier'

  return (
    <form onSubmit={handleSubmit} noValidate className="rounded-lg border border-cdsc-line bg-white p-6 sm:p-8">
      <Section title="I am a" required invalid={bad('I am a')}>
        <div className="grid grid-cols-2 gap-3">
          {CONTACT_TYPES.map(ct => (
            <button
              key={ct.value}
              type="button"
              aria-pressed={form.contact_type === ct.value}
              onClick={() => set('contact_type', ct.value)}
              className={`flex flex-col items-center gap-2 rounded-lg border px-3 py-5 text-center transition-colors ${
                form.contact_type === ct.value
                  ? 'border-cdsc-accent bg-cdsc-tint text-cdsc-ink'
                  : 'border-cdsc-line bg-white text-cdsc-ink/50 hover:border-cdsc-navy/30'
              }`}
            >
              <span className={form.contact_type === ct.value ? 'text-cdsc-accent-dark' : 'text-cdsc-ink/40'}>{ct.icon}</span>
              <span>
                <span className="block text-xs font-semibold text-cdsc-ink">{ct.label}</span>
                <span className="mt-0.5 block text-[11px] text-cdsc-ink/50">{ct.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Company Information">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id={`${id}-company`} label="Registered Company Name" required invalid={bad('Company Name')} className="sm:col-span-2">
            <input id={`${id}-company`} value={form.company_name} onChange={e => set('company_name', e.target.value)}
              placeholder="e.g. Acme Manufacturing Corporation" autoComplete="organization" className={inputClass} />
          </Field>
          <Field id={`${id}-industry`} label="Industry">
            <select id={`${id}-industry`} value={form.industry} onChange={e => set('industry', e.target.value)} className={inputClass}>
              <option value="">Select industry…</option>
              {INDUSTRIES.map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field id={`${id}-btype`} label="Business Type">
            <select id={`${id}-btype`} value={form.business_type} onChange={e => set('business_type', e.target.value)} className={inputClass}>
              <option value="">Select business type…</option>
              {BUSINESS_TYPES.map(o => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field id={`${id}-tin`} label="TIN">
            <input id={`${id}-tin`} value={form.tin} onChange={e => set('tin', e.target.value)} placeholder="000-000-000-00000" className={inputClass} />
          </Field>
          <Field id={`${id}-web`} label="Website">
            <input id={`${id}-web`} value={form.website} onChange={e => set('website', e.target.value)} placeholder="www.company.com" autoComplete="url" className={inputClass} />
          </Field>
        </div>
      </Section>

      <Section title="Company Address" hint="Office or plant address where we can reach or deliver to you.">
        <div className="grid gap-5 sm:grid-cols-6">
          <Field id={`${id}-no`} label="Bldg / Unit / Lot No." className="sm:col-span-2">
            <input id={`${id}-no`} value={form.address_no} onChange={e => set('address_no', e.target.value)} placeholder="Lot 12, Blk 3" className={inputClass} />
          </Field>
          <Field id={`${id}-street`} label="Street / Industrial Park" required invalid={bad('Street or Barangay')} className="sm:col-span-4">
            <input id={`${id}-street`} value={form.street} onChange={e => set('street', e.target.value)} placeholder="e.g. Main Ave., Light Industry & Science Park" autoComplete="address-line1" className={inputClass} />
          </Field>
          <Field id={`${id}-brgy`} label="Barangay" className="sm:col-span-3">
            <input id={`${id}-brgy`} value={form.barangay} onChange={e => set('barangay', e.target.value)} placeholder="e.g. Diezmo" className={inputClass} />
          </Field>
          <Field id={`${id}-mun`} label="Municipality / City" required invalid={bad('Municipality / City')} className="sm:col-span-3">
            <input id={`${id}-mun`} value={form.municipality} onChange={e => set('municipality', e.target.value)} placeholder="e.g. Cabuyao" autoComplete="address-level2" className={inputClass} />
          </Field>
          <Field id={`${id}-prov`} label="Province" required invalid={bad('Province')} className="sm:col-span-4">
            <input id={`${id}-prov`} value={form.province} onChange={e => set('province', e.target.value)} placeholder="e.g. Laguna" autoComplete="address-level1" className={inputClass} />
          </Field>
          <Field id={`${id}-zip`} label="ZIP Code" className="sm:col-span-2">
            <input id={`${id}-zip`} value={form.zip_code} onChange={e => set('zip_code', e.target.value)} inputMode="numeric" placeholder="4025" autoComplete="postal-code" className={inputClass} />
          </Field>
        </div>
      </Section>

      <Section title="Contact Person">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field id={`${id}-first`} label="First Name" required invalid={bad('First Name')}>
            <input id={`${id}-first`} value={form.contact_first} onChange={e => set('contact_first', e.target.value)} placeholder="Juan" autoComplete="given-name" className={inputClass} />
          </Field>
          <Field id={`${id}-middle`} label="Middle Name">
            <input id={`${id}-middle`} value={form.contact_middle} onChange={e => set('contact_middle', e.target.value)} placeholder="Santos" autoComplete="additional-name" className={inputClass} />
          </Field>
          <Field id={`${id}-last`} label="Last Name" required invalid={bad('Last Name')}>
            <input id={`${id}-last`} value={form.contact_last} onChange={e => set('contact_last', e.target.value)} placeholder="dela Cruz" autoComplete="family-name" className={inputClass} />
          </Field>
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <Field id={`${id}-pos`} label="Position / Designation" required invalid={bad('Position / Designation')}>
            <input id={`${id}-pos`} value={form.position} onChange={e => set('position', e.target.value)} placeholder="e.g. Purchasing Manager" autoComplete="organization-title" className={inputClass} />
          </Field>
          <Field id={`${id}-email`} label="Email Address" required invalid={bad('Email Address')}>
            <input id={`${id}-email`} type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="you@company.com" autoComplete="email" className={inputClass} />
          </Field>
          <Field id={`${id}-phone`} label="Mobile / Phone" required invalid={bad('Mobile / Phone')}>
            <input id={`${id}-phone`} value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="09XX XXX XXXX" autoComplete="tel" className={inputClass} />
          </Field>
        </div>
      </Section>

      <Section title={isSupplier ? 'What You Supply' : 'What You Need'} last>
        <Field id={`${id}-interest`} label={isSupplier ? 'Products / Services You Supply' : 'Products / Services of Interest'}>
          <input id={`${id}-interest`} value={form.product_interest} onChange={e => set('product_interest', e.target.value)}
            placeholder={isSupplier ? 'e.g. Safety equipment, fasteners, power tools' : 'e.g. Industrial fasteners, PPE, electrical supplies'} className={inputClass} />
        </Field>
        <div className="mt-5">
          <Field id={`${id}-notes`} label="Message / Additional Details">
            <textarea id={`${id}-notes`} value={form.notes} onChange={e => set('notes', e.target.value)} rows={4}
              placeholder={isSupplier
                ? 'Brands you carry, coverage area, lead times, and accreditation requirements'
                : 'Expected volume, delivery schedule, target timeline, or specifications'}
              className={`${inputClass} resize-none`} />
          </Field>
        </div>
      </Section>

      <button
        type="submit"
        disabled={sending}
        className="mt-7 flex w-full items-center justify-center gap-2 rounded-md bg-cdsc-navy px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-cdsc-navy-dark disabled:cursor-not-allowed disabled:opacity-40"
      >
        {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending your inquiry…</> : <><Send className="h-4 w-4" /> Send Inquiry</>}
      </button>
      <p className="mt-4 text-center text-xs text-cdsc-ink/40">
        Fields marked <span className="text-cdsc-accent-dark">*</span> are required. Your details are used only to respond to this inquiry and are never shared with third parties.
      </p>
    </form>
  )
}

const inputClass =
  'w-full rounded-md border border-cdsc-line bg-white px-3.5 py-2.5 text-sm text-cdsc-ink placeholder:text-cdsc-ink/35 focus:border-cdsc-navy focus:outline-none focus:ring-2 focus:ring-cdsc-navy/10 transition-colors'

function Section({ title, hint, required, invalid, last, children }: { title: string; hint?: string; required?: boolean; invalid?: boolean; last?: boolean; children: React.ReactNode }) {
  return (
    <fieldset className={last ? '' : 'mb-6 border-b border-cdsc-line pb-6'}>
      <legend className={`mb-1 text-sm font-semibold ${invalid ? 'text-cdsc-accent-dark' : 'text-cdsc-ink'}`}>
        {title}{required && <span className="ml-0.5 text-cdsc-accent-dark">*</span>}
      </legend>
      {hint ? <p className="mb-4 text-xs text-cdsc-ink/50">{hint}</p> : <div className="mb-3" />}
      {children}
    </fieldset>
  )
}

function Field({ id, label, required, invalid, className, children }: { id: string; label: string; required?: boolean; invalid?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={`${className ?? ''} ${invalid ? '[&_input]:border-cdsc-accent [&_select]:border-cdsc-accent' : ''}`}>
      <label htmlFor={id} className={`mb-1.5 block text-xs font-semibold uppercase tracking-wide ${invalid ? 'text-cdsc-accent-dark' : 'text-cdsc-ink/60'}`}>
        {label}{required && <span className="ml-0.5 text-cdsc-accent-dark">*</span>}
      </label>
      {children}
    </div>
  )
}
