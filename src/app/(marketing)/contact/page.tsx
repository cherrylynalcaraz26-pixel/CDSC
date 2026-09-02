import type { Metadata } from 'next'
import { Phone, Mail, MapPin } from 'lucide-react'
import { QuoteRequestForm } from '@/components/marketing/quote-request-form'
import { company } from '@/lib/site-content'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contact CDSC Industrial Supply in Sto. Tomas, Batangas, or submit your product requirement directly.',
}

export default function ContactPage() {
  return (
    <>
      <section className="border-b border-cdsc-line bg-cdsc-tint">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h1 className="text-3xl font-semibold text-cdsc-ink sm:text-4xl">Contact CDSC</h1>
          <p className="mt-5 text-base leading-relaxed text-cdsc-ink/65">
            Reach out directly, or send us your requirement and we&apos;ll take it from there.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-cdsc-ink">{company.name}</h2>
            <ul className="mt-6 space-y-5">
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-cdsc-accent-dark" />
                <span className="text-sm text-cdsc-ink/75">{company.addressLine1}<br />{company.addressLine2}</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="h-5 w-5 shrink-0 text-cdsc-accent-dark" />
                <a href={company.phoneHref} className="text-sm text-cdsc-ink/75 hover:text-cdsc-navy">{company.phone}</a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="h-5 w-5 shrink-0 text-cdsc-accent-dark" />
                <a href={company.emailHref} className="text-sm text-cdsc-ink/75 hover:text-cdsc-navy">{company.email}</a>
              </li>
            </ul>
          </div>
          <div className="lg:col-span-3">
            <QuoteRequestForm source="Website - Contact Page" />
          </div>
        </div>
      </section>
    </>
  )
}
