import type { Metadata } from 'next'
import { InquiryForm } from '@/components/marketing/inquiry-form'
import { CompanyContactCards } from '@/components/marketing/company-contact'

export const metadata: Metadata = {
  title: 'Partner With Us',
  description: 'Open an account with CDSC Industrial Supply as a client, or apply as an accredited supplier or vendor.',
}

const STEPS = [
  { n: '1', title: 'Submit your details', body: 'Company, address and the contact person handling purchasing or sales.' },
  { n: '2', title: 'We review within 1 to 2 business days', body: 'Our team verifies the business and reaches out to the contact you named.' },
  { n: '3', title: 'Account set-up', body: 'Clients get pricing and portal access. Suppliers go through accreditation.' },
]

export default function InquiryPage() {
  return (
    <section className="border-b border-cdsc-line bg-cdsc-tint">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-cdsc-accent">Partner With Us</p>
          <h1 className="mt-2 text-3xl font-semibold text-cdsc-ink sm:text-4xl">Work with CDSC Industrial Supply</h1>
          <p className="mt-4 text-base leading-relaxed text-cdsc-ink/65">
            For companies that want to source industrial, electrical and safety supplies from us, and for suppliers
            and vendors who want to be accredited. Complete the form and the right person on our team will contact you.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_340px]">
          <InquiryForm />

          <aside className="space-y-6">
            <div className="rounded-2xl bg-white p-6 shadow-[0_6px_24px_-12px_rgba(0,0,0,0.18)]">
              <p className="text-sm font-semibold text-cdsc-ink">What happens next</p>
              <ol className="mt-4 space-y-4">
                {STEPS.map(s => (
                  <li key={s.n} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cdsc-tint text-xs font-bold text-cdsc-accent">{s.n}</span>
                    <div>
                      <p className="text-sm font-semibold text-cdsc-ink">{s.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-cdsc-ink/60">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold text-cdsc-ink">Our office</p>
              <CompanyContactCards />
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
