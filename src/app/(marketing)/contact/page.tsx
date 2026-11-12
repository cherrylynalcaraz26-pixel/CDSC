import type { Metadata } from 'next'
import Image from 'next/image'
import { QuoteRequestForm } from '@/components/marketing/quote-request-form'
import { CompanyContactCards } from '@/components/marketing/company-contact'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contact CDSC Industrial Supply in Sto. Tomas, Batangas, or submit your product requirement directly.',
}

export default function ContactPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <Image src="/images/site/office-team.jpg" alt="" fill priority sizes="100vw" className="object-cover" />
        <div aria-hidden className="absolute inset-0 bg-linear-to-r from-cdsc-accent/95 via-red-600/85 to-rose-500/60" />
        <div className="relative mx-auto max-w-screen-2xl px-6 py-24 text-white lg:px-10">
          <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider backdrop-blur">Contact</span>
          <h1 className="mt-5 text-4xl font-black sm:text-6xl">Contact CDSC</h1>
          <p className="mt-4 max-w-xl text-lg text-white/85">
            Reach out directly, or send us your requirement and our quotation team will take it from there.
          </p>
        </div>
      </section>

      <section className="bg-cdsc-paper py-20">
        <div className="mx-auto grid max-w-screen-2xl gap-10 px-6 lg:grid-cols-[380px_1fr] lg:px-10">
          <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
            <h2 className="text-lg font-black text-cdsc-ink">Get in touch</h2>
            <CompanyContactCards />
          </aside>
          <div>
            <h2 className="mb-4 text-lg font-black text-cdsc-ink">Send your requirement</h2>
            <QuoteRequestForm source="Website - Contact Page" />
          </div>
        </div>
      </section>
    </>
  )
}
