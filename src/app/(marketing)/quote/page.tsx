import type { Metadata } from 'next'
import { QuoteRequestForm } from '@/components/marketing/quote-request-form'

export const metadata: Metadata = {
  title: 'Request a Quotation',
  description: 'Send CDSC Industrial Supply your product requirement, quantity, specifications, and target delivery date for a quotation.',
}

export default function QuotePage() {
  return (
    <section className="border-b border-cdsc-line bg-cdsc-paper">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-cdsc-ink sm:text-4xl">Request a Quotation</h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-cdsc-ink/65">
            Tell us what you need, including specifications, quantity, brand preference, or application. Our team
            will review the requirement and identify suitable supply options.
          </p>
        </div>
        <div className="mt-12">
          <QuoteRequestForm source="Website - Quotation Request" />
        </div>
      </div>
    </section>
  )
}
