import type { Metadata } from 'next'
import { InquiryForm } from '@/components/marketing/inquiry-form'

export const metadata: Metadata = {
  title: 'Get in Touch',
  description: 'Reach out to CDSC Industrial Supply as a client looking to purchase products, or as a supplier or vendor interested in partnering with us.',
}

export default function InquiryPage() {
  return (
    <section className="border-b border-cdsc-line bg-cdsc-tint">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-cdsc-ink sm:text-4xl">Get in Touch</h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-cdsc-ink/65">
            Whether you&apos;re a client looking to purchase products or a supplier interested in partnering with us,
            we&apos;d like to hear from you. Send us your details and our team will get back to you.
          </p>
        </div>
        <div className="mt-12">
          <InquiryForm />
        </div>
      </div>
    </section>
  )
}
