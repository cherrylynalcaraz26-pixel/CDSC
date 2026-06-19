'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2, Send, Building2, User, Phone, Mail, Package, MessageSquare, ChevronRight } from 'lucide-react'

type ContactType = 'client' | 'buyer' | 'supplier'

const CONTACT_TYPES: { value: ContactType; label: string; desc: string }[] = [
  { value: 'client', label: 'Client / Customer', desc: 'I want to purchase products or services' },
  { value: 'buyer', label: 'Buyer', desc: 'I am looking to source industrial supplies' },
  { value: 'supplier', label: 'Supplier / Vendor', desc: 'I want to supply products to CDSC' },
]

const EMPTY = { contact_type: '' as ContactType | '', company_name: '', contact_person: '', contact_email: '', contact_phone: '', product_interest: '', notes: '' }

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
    await supabase.from('crm_leads').insert({
      company_name: form.company_name.trim(),
      contact_person: form.contact_person.trim() || null,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      product_interest: form.product_interest.trim() || null,
      notes: [
        form.contact_type ? `Type: ${form.contact_type.charAt(0).toUpperCase() + form.contact_type.slice(1)}` : '',
        form.notes.trim(),
      ].filter(Boolean).join('\n') || null,
      stage: 'new_lead',
      priority: 'medium',
      source: 'Online Inquiry Form',
    })
    setSending(false)
    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 50%, #111 100%)' }}>
        <div className="text-center max-w-sm mx-auto space-y-6">
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" />
            <div className="relative w-24 h-24 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-green-400" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Inquiry Sent!</h2>
            <p className="text-white/50 text-sm leading-relaxed">
              Thank you for reaching out. Our team will review your inquiry and get back to you as soon as possible.
            </p>
          </div>
          <button
            onClick={() => { setDone(false); setForm(EMPTY) }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/15 text-white/60 hover:text-white hover:border-white/30 text-sm transition-colors"
          >
            Submit Another Inquiry <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 50%, #111 100%)' }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-80 shrink-0 p-10 border-r border-white/8">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="relative h-9 w-9 shrink-0">
              <Image src="/cdsc-logo.jpg" alt="CDSC" fill className="rounded-lg object-cover" />
            </div>
            <div>
              <div className="text-white font-bold text-sm">CDSC Industrial</div>
              <div className="text-white/35 text-xs">Supply Corporation</div>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white leading-tight mb-3">
            Let&apos;s work<br />together.
          </h1>
          <p className="text-white/40 text-sm leading-relaxed">
            Fill out the form and our team will get back to you within 24 hours.
          </p>

          <div className="mt-10 space-y-5">
            {[
              { icon: '📦', title: 'Industrial Supplies', desc: 'Wide range of industrial products' },
              { icon: '🚚', title: 'Fast Delivery', desc: 'Reliable logistics and warehouse' },
              { icon: '🤝', title: 'Trusted Partners', desc: 'Serving clients across industries' },
            ].map(item => (
              <div key={item.title} className="flex items-start gap-3">
                <div className="text-lg mt-0.5">{item.icon}</div>
                <div>
                  <div className="text-white/80 text-sm font-medium">{item.title}</div>
                  <div className="text-white/35 text-xs">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-white/20 text-xs">© {new Date().getFullYear()} CDSC Industrial Supply</div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-lg">
          {/* Mobile header */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="relative h-8 w-8 shrink-0">
              <Image src="/cdsc-logo.jpg" alt="CDSC" fill className="rounded-md object-cover" />
            </div>
            <div>
              <div className="text-white font-bold text-sm">CDSC Industrial Supply</div>
              <div className="text-white/35 text-xs">Send us your inquiry</div>
            </div>
          </div>

          <div className="mb-8 hidden lg:block">
            <h2 className="text-xl font-semibold text-white">Send an Inquiry</h2>
            <p className="text-white/40 text-sm mt-1">All fields marked * are required</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Type selector */}
            <div>
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">I am a <span className="text-red-400">*</span></label>
              <div className="grid grid-cols-3 gap-2">
                {CONTACT_TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => set('contact_type', t.value)}
                    className={`relative p-3 rounded-xl border text-left transition-all ${
                      form.contact_type === t.value
                        ? 'border-red-500 bg-red-500/10 text-white'
                        : 'border-white/10 bg-white/5 text-white/40 hover:border-white/20 hover:text-white/70'
                    }`}
                  >
                    <div className="text-xs font-semibold leading-tight">{t.label}</div>
                    <div className="text-[10px] mt-1 leading-tight opacity-60 hidden xl:block">{t.desc}</div>
                    {form.contact_type === t.value && (
                      <div className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-red-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Fields */}
            <div className="space-y-4">
              <Field icon={<Building2 className="h-4 w-4" />} label="Company / Business Name" required>
                <input
                  value={form.company_name}
                  onChange={e => set('company_name', e.target.value)}
                  placeholder="Your company name"
                  required
                  className="w-full bg-transparent text-white placeholder-white/25 text-sm outline-none"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field icon={<User className="h-4 w-4" />} label="Contact Person" required>
                  <input
                    value={form.contact_person}
                    onChange={e => set('contact_person', e.target.value)}
                    placeholder="Full name"
                    required
                    className="w-full bg-transparent text-white placeholder-white/25 text-sm outline-none"
                  />
                </Field>
                <Field icon={<Phone className="h-4 w-4" />} label="Phone Number">
                  <input
                    value={form.contact_phone}
                    onChange={e => set('contact_phone', e.target.value)}
                    placeholder="+63 9XX XXX XXXX"
                    className="w-full bg-transparent text-white placeholder-white/25 text-sm outline-none"
                  />
                </Field>
              </div>

              <Field icon={<Mail className="h-4 w-4" />} label="Email Address">
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={e => set('contact_email', e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-transparent text-white placeholder-white/25 text-sm outline-none"
                />
              </Field>

              <Field icon={<Package className="h-4 w-4" />} label="Product / Service of Interest">
                <input
                  value={form.product_interest}
                  onChange={e => set('product_interest', e.target.value)}
                  placeholder="What are you looking for?"
                  className="w-full bg-transparent text-white placeholder-white/25 text-sm outline-none"
                />
              </Field>

              <Field icon={<MessageSquare className="h-4 w-4" />} label="Message / Details" multiline>
                <textarea
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  placeholder="Tell us more about your needs…"
                  rows={4}
                  className="w-full bg-transparent text-white placeholder-white/25 text-sm outline-none resize-none"
                />
              </Field>
            </div>

            <button
              type="submit"
              disabled={sending || !form.company_name.trim() || !form.contact_person.trim()}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
            >
              {sending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                : <><Send className="h-4 w-4" /> Send Inquiry</>}
            </button>

            <p className="text-center text-white/25 text-xs">
              Your information is kept confidential and used only for business correspondence.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

function Field({ icon, label, required, multiline, children }: {
  icon: React.ReactNode
  label: string
  required?: boolean
  multiline?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={`flex gap-3 rounded-xl border border-white/10 bg-white/5 px-4 ${multiline ? 'pt-3.5 pb-2' : 'items-center py-3'} focus-within:border-white/25 transition-colors`}>
      <div className="text-white/25 shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <label className="block text-[10px] font-medium text-white/35 uppercase tracking-wider mb-0.5">
          {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        {children}
      </div>
    </div>
  )
}
