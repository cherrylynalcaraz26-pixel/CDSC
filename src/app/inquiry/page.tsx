'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

type ContactType = 'client' | 'buyer' | 'supplier'

export default function InquiryPage() {
  const supabase = createClient()
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [form, setForm] = useState({
    contact_type: '' as ContactType | '',
    company_name: '',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    product_interest: '',
    notes: '',
  })

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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center space-y-4">
          <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-800">Inquiry Received!</h2>
          <p className="text-gray-500 text-sm">
            Thank you for reaching out. Our team will review your inquiry and get back to you shortly.
          </p>
          <Button
            variant="outline"
            className="mt-2"
            onClick={() => { setDone(false); setForm({ contact_type: '', company_name: '', contact_person: '', contact_email: '', contact_phone: '', product_interest: '', notes: '' }) }}
          >
            Submit Another Inquiry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-[#111111] px-8 py-6 flex items-center gap-4">
          <div className="relative h-10 w-10 shrink-0">
            <Image src="/cdsc-logo.jpg" alt="CDSC" fill className="rounded-md object-cover" />
          </div>
          <div>
            <div className="text-white font-bold text-lg leading-tight">CDSC Industrial Supply</div>
            <div className="text-white/50 text-xs">Send us your inquiry or business details</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
          <div className="space-y-1">
            <Label>I am a <span className="text-red-500">*</span></Label>
            <Select value={form.contact_type ?? ''} onValueChange={(v: string) => setForm(f => ({ ...f, contact_type: v as ContactType }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select type…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Client / Customer</SelectItem>
                <SelectItem value="buyer">Buyer</SelectItem>
                <SelectItem value="supplier">Supplier / Vendor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Company / Business Name <span className="text-red-500">*</span></Label>
              <Input
                value={form.company_name}
                onChange={e => set('company_name', e.target.value)}
                placeholder="Your company name"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Contact Person <span className="text-red-500">*</span></Label>
              <Input
                value={form.contact_person}
                onChange={e => set('contact_person', e.target.value)}
                placeholder="Full name"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Phone Number</Label>
              <Input
                value={form.contact_phone}
                onChange={e => set('contact_phone', e.target.value)}
                placeholder="+63 9XX XXX XXXX"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Email Address</Label>
              <Input
                type="email"
                value={form.contact_email}
                onChange={e => set('contact_email', e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Product / Service of Interest</Label>
              <Input
                value={form.product_interest}
                onChange={e => set('product_interest', e.target.value)}
                placeholder="What product or service are you inquiring about?"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Message / Additional Details</Label>
              <Textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Tell us more about your needs…"
                rows={4}
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={sending || !form.company_name.trim() || !form.contact_person.trim()}
            className="w-full bg-red-600 hover:bg-red-700 text-white gap-2"
          >
            {sending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
              : <><Send className="h-4 w-4" /> Send Inquiry</>}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Your information will be kept confidential and used only for business correspondence.
          </p>
        </form>
      </div>
    </div>
  )
}
