'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2, Send, ArrowRight, Building2, Truck, Zap, Lock, Package } from 'lucide-react'

type ContactType = 'client' | 'supplier'

const CONTACT_TYPES: { value: ContactType; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: 'client',   label: 'Client / Customer', desc: 'I want to purchase products', icon: <Building2 className="h-6 w-6 text-black" /> },
  { value: 'supplier', label: 'Supplier / Vendor',  desc: 'I want to supply products',  icon: <Truck className="h-6 w-6 text-black" /> },
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

export default function InquiryPage() {
  const supabase = createClient()
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [form, setForm] = useState(EMPTY)

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company_name.trim() || !form.contact_person.trim()) return
    setSending(true)

    const typeLabel = form.contact_type === 'client' ? 'Client' : form.contact_type === 'supplier' ? 'Supplier' : ''

    // Always save to CRM leads
    await supabase.from('crm_leads').insert({
      company_name: form.company_name.trim(),
      contact_person: form.contact_person.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      product_interest: form.product_interest.trim() || null,
      notes: [
        typeLabel ? `Type: ${typeLabel}` : '',
        form.notes.trim(),
      ].filter(Boolean).join('\n') || null,
      stage: 'new_lead',
      priority: 'medium',
      source: 'Online Inquiry Form',
    })

    // Also save into clients or suppliers table
    if (form.contact_type === 'client') {
      await supabase.from('clients').insert({
        company_name: form.company_name.trim(),
        contact_person: form.contact_person.trim() || null,
        mobile_number: form.contact_phone.trim() || null,
        email: form.contact_email.trim() || null,
        product_interest: form.product_interest.trim() || null,
        notes: form.notes.trim() || null,
        status: 'active',
      })
    } else if (form.contact_type === 'supplier') {
      const now = new Date()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      const yyyy = now.getFullYear()
      const code = `INQ-${mm}-${dd}-${yyyy}`
      await supabase.from('suppliers').insert({
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
    }

    setSending(false)
    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/80 border border-slate-100 p-12 max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Inquiry Received!</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            Thank you for reaching out. Our team will review your details and contact you within 24 hours.
          </p>
          <button
            onClick={() => { setDone(false); setForm(EMPTY) }}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            Submit Another <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50">
      {/* Top nav bar */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative h-7 w-16 shrink-0">
              <Image src="/cdsc-logo.jpg" alt="CDSC" fill className="object-contain" />
            </div>
            <span className="font-bold text-slate-800 text-sm">CDSC Industrial Supply</span>
          </div>
          <span className="text-xs text-slate-400 hidden sm:block">Inquiry Form</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-12 lg:py-16">
        <div className="grid lg:grid-cols-5 gap-12 items-start">

          {/* Left — headline */}
          <div className="lg:col-span-2 lg:sticky lg:top-28">
            <div className="inline-flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Now accepting inquiries
            </div>
            <h1 className="text-4xl font-extrabold text-slate-900 leading-tight mb-4">
              Get in<br />
              <span className="text-red-600">Touch</span><br />
              With Us
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed mb-8">
              Whether you&apos;re a client or supplier — we&apos;d love to hear from you. Send us your details and we&apos;ll get back to you promptly.
            </p>

            <div className="space-y-4">
              {([
                { Icon: Zap,     label: 'Quick Response',    sub: 'We reply within 24 hours' },
                { Icon: Lock,    label: 'Confidential',      sub: 'Your data is kept private' },
                { Icon: Package, label: 'Wide Product Range', sub: 'Industrial supplies & more' },
              ] as { Icon: React.ElementType; label: string; sub: string }[]).map(item => (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center shrink-0">
                    <item.Icon className="h-4 w-4 text-black" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-700">{item.label}</div>
                    <div className="text-xs text-slate-400">{item.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — form */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8">
              <form onSubmit={handleSubmit} className="space-y-6">

                {/* Type selection */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    I am a <span className="text-red-500">*</span>
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {CONTACT_TYPES.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => set('contact_type', t.value)}
                        className={`flex flex-col items-center gap-2 py-5 px-3 rounded-2xl border-2 text-center transition-all ${
                          form.contact_type === t.value
                            ? 'border-red-500 bg-red-50 shadow-sm shadow-red-100'
                            : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200 hover:bg-white'
                        }`}
                      >
                        {t.icon}
                        <div>
                          <div className="text-xs font-semibold text-black">{t.label}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{t.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <hr className="border-slate-100" />

                {/* Company */}
                <FormField label="Company / Business Name" required>
                  <input
                    value={form.company_name}
                    onChange={e => set('company_name', e.target.value)}
                    placeholder="e.g. Acme Corporation"
                    required
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition"
                  />
                </FormField>

                {/* Contact row */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Contact Person" required>
                    <input
                      value={form.contact_person}
                      onChange={e => set('contact_person', e.target.value)}
                      placeholder="Full name"
                      required
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition"
                    />
                  </FormField>
                  <FormField label="Phone Number">
                    <input
                      value={form.contact_phone}
                      onChange={e => set('contact_phone', e.target.value)}
                      placeholder="+63 9XX XXX XXXX"
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition"
                    />
                  </FormField>
                </div>

                {/* Email */}
                <FormField label="Email Address">
                  <input
                    type="email"
                    value={form.contact_email}
                    onChange={e => set('contact_email', e.target.value)}
                    placeholder="you@company.com"
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition"
                  />
                </FormField>

                {/* Product interest — shown for both but labelled differently */}
                <FormField label={form.contact_type === 'supplier' ? 'Products / Services You Supply' : 'Product / Service of Interest'}>
                  <input
                    value={form.product_interest}
                    onChange={e => set('product_interest', e.target.value)}
                    placeholder={
                      form.contact_type === 'supplier'
                        ? 'e.g. Safety equipment, fasteners, tools…'
                        : 'e.g. Industrial fasteners, safety equipment…'
                    }
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition"
                  />
                </FormField>

                {/* Message */}
                <FormField label="Message / Additional Details">
                  <textarea
                    value={form.notes}
                    onChange={e => set('notes', e.target.value)}
                    placeholder="Tell us more about your requirements, expected quantity, timeline, or any other details…"
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition resize-none"
                  />
                </FormField>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={sending || !form.company_name.trim() || !form.contact_person.trim()}
                  className="w-full h-12 flex items-center justify-center gap-2.5 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors shadow-lg shadow-red-200"
                >
                  {sending
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending your inquiry…</>
                    : <><Send className="h-4 w-4" /> Send Inquiry</>}
                </button>

                <p className="text-center text-slate-300 text-xs">
                  By submitting this form you agree to our privacy policy. Your data will never be shared with third parties.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-100 mt-16">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative h-5 w-12 shrink-0">
              <Image src="/cdsc-logo.jpg" alt="CDSC" fill className="object-contain" />
            </div>
            <span className="text-xs text-slate-400">CDSC Industrial Supply</span>
          </div>
          <span className="text-xs text-slate-300">© {new Date().getFullYear()} All rights reserved</span>
        </div>
      </footer>
    </div>
  )
}

function FormField({ label, required, children }: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-slate-500">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
