'use client'

// Contact details shown on the website, read from the system
// (Settings → Company Profile / system_settings) so the site always matches
// what staff maintain in the ERP. Falls back to the built-in details when a
// field is empty or the settings can't be read.

import { useEffect, useState } from 'react'
import { Phone, Mail, MapPin, Clock, Smartphone, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { company, registration } from '@/lib/site-content'

export interface CompanyContact {
  name: string
  phone: string
  phoneHref: string
  mobile: string | null
  email: string
  emailHref: string
  address: string
}

const FALLBACK: CompanyContact = {
  name: company.name,
  phone: company.phone,
  phoneHref: company.phoneHref,
  mobile: null,
  email: company.email,
  emailHref: company.emailHref,
  address: company.addressFull,
}

const tel = (n: string) => {
  const d = n.replace(/[^\d+]/g, '')
  return `tel:${d.startsWith('0') ? '+63' + d.slice(1) : d}`
}

export function useCompanyContact(): CompanyContact {
  const [c, setC] = useState<CompanyContact>(FALLBACK)
  useEffect(() => {
    createClient().from('system_settings').select('*').single().then(({ data }) => {
      if (!data) return
      const v = (k: string) => (typeof data[k] === 'string' ? (data[k] as string).trim() : '')
      const phone = v('phone') || v('mobile')
      const address = [v('address'), v('city'), v('province'), v('zip_code')].filter(Boolean).join(', ')
      setC({
        name: v('company_name') || FALLBACK.name,
        phone: phone || FALLBACK.phone,
        phoneHref: phone ? tel(phone) : FALLBACK.phoneHref,
        mobile: v('mobile') && v('mobile') !== phone ? v('mobile') : null,
        email: v('email') || FALLBACK.email,
        emailHref: v('email') ? `mailto:${v('email')}` : FALLBACK.emailHref,
        address: address || FALLBACK.address,
      })
    })
  }, [])
  return c
}

/** Contact cards (call, email, location, hours) — used on Contact and Quotation pages. */
export function CompanyContactCards({ layout = 'stack' }: { layout?: 'stack' | 'grid' }) {
  const c = useCompanyContact()
  const cards = [
    { Icon: Phone, label: 'Call / SMS', value: c.phone, href: c.phoneHref, cta: 'Call now' },
    ...(c.mobile ? [{ Icon: Smartphone, label: 'Mobile', value: c.mobile, href: tel(c.mobile), cta: 'Call mobile' }] : []),
    { Icon: Mail, label: 'Email', value: c.email, href: c.emailHref, cta: 'Send email' },
    { Icon: MapPin, label: 'Office / Warehouse', value: c.address, href: `https://maps.google.com/?q=${encodeURIComponent(c.address)}`, cta: 'Open map' },
    { Icon: Clock, label: 'Business Hours', value: registration.businessHours.join(' · ') },
  ]
  return (
    <ul className={layout === 'grid' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4' : 'space-y-3'}>
      {cards.map(({ Icon, label, value, href, cta }) => (
        <li key={label} className="group flex items-start gap-4 rounded-2xl bg-white p-5 shadow-[0_6px_24px_-12px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 hover:shadow-lg">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-cdsc-accent to-rose-500 text-white shadow-md shadow-cdsc-accent/25">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-cdsc-ink/45">{label}</p>
            <p className="mt-0.5 break-words text-sm font-semibold leading-snug text-cdsc-ink">{value}</p>
            {href && cta && (
              <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-cdsc-accent">
                {cta} <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
