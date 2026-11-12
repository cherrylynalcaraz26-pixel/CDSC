import type { Metadata } from 'next'
import Image from 'next/image'
import { QuoteRequestForm } from '@/components/marketing/quote-request-form'
import { CompanyContactCards } from '@/components/marketing/company-contact'
import { procurementProcess } from '@/lib/site-content'

export const metadata: Metadata = {
  title: 'Request a Quotation',
  description: 'Send CDSC Industrial Supply your product requirement, quantity, specifications, and target delivery date for a quotation.',
}

export default function QuotePage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <Image src="/images/site/warehouse-shelves.jpg" alt="" fill priority sizes="100vw" className="object-cover" />
        <div aria-hidden className="absolute inset-0 bg-linear-to-r from-cdsc-accent/95 via-red-600/85 to-rose-500/60" />
        <div className="relative mx-auto max-w-screen-2xl px-6 py-24 text-white lg:px-10">
          <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider backdrop-blur">Quotation</span>
          <h1 className="mt-5 text-4xl font-black sm:text-6xl">Request a Quotation</h1>
          <p className="mt-4 max-w-xl text-lg text-white/85">
            List the items you need — specifications, quantity, brand preference or application. Your request goes
            straight to our quotation team.
          </p>
        </div>
      </section>

      <section className="bg-cdsc-paper py-20">
        <div className="mx-auto grid max-w-screen-2xl gap-10 px-6 lg:grid-cols-[1fr_360px] lg:px-10">
          <QuoteRequestForm source="Website - Quotation Request" />
          <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-3xl bg-white p-6 shadow-[0_6px_24px_-12px_rgba(0,0,0,0.18)]">
              <h2 className="text-sm font-black text-cdsc-ink">What happens next</h2>
              <ol className="mt-4 space-y-4">
                {procurementProcess.map(step => (
                  <li key={step.step} className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-cdsc-accent to-rose-500 text-xs font-black text-white">{step.step}</span>
                    <span>
                      <span className="block text-sm font-bold text-cdsc-ink">{step.title}</span>
                      <span className="block text-xs leading-relaxed text-cdsc-ink/55">{step.description}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <CompanyContactCards />
          </aside>
        </div>
      </section>
    </>
  )
}
