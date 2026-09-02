import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight, Target, Eye, ShieldCheck, MessageCircle, Scale, Wrench, Handshake } from 'lucide-react'
import { coreValues } from '@/lib/site-content'

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'CDSC Industrial Supply is a Philippine based B2B industrial supply and procurement company providing products and sourcing support to businesses, industrial facilities, contractors, and organizations.',
}

const VALUE_ICONS = [ShieldCheck, MessageCircle, Scale, Wrench, Handshake]

export default function AboutPage() {
  return (
    <>
      <section className="border-b border-cdsc-line bg-cdsc-navy-dark">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">About CDSC Industrial Supply</h1>
          <p className="mt-5 text-base leading-relaxed text-cdsc-paper/70">
            A reliable industrial supply and procurement partner for businesses across the Philippines.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-20">
        <h2 className="text-xl font-semibold text-cdsc-ink">Company Overview</h2>
        <p className="mt-4 text-base leading-relaxed text-cdsc-ink/70">
          CDSC Industrial Supply is a Philippine based B2B industrial supply and procurement company providing
          products and sourcing support to businesses, industrial facilities, contractors, and organizations.
        </p>
        <p className="mt-4 text-base leading-relaxed text-cdsc-ink/70">
          We help customers simplify purchasing by providing practical sourcing solutions, responsive communication,
          and dependable fulfillment support — for everyday industrial supplies as well as requirements that need a
          more specific sourcing effort.
        </p>
      </section>

      <section className="border-y border-cdsc-line bg-cdsc-paper">
        <div className="mx-auto grid max-w-5xl gap-8 px-6 py-16 sm:grid-cols-2">
          <div className="rounded-lg bg-white p-8 ring-1 ring-cdsc-line">
            <Target className="h-6 w-6 text-cdsc-navy" />
            <h2 className="mt-4 text-lg font-semibold text-cdsc-ink">Our Mission</h2>
            <p className="mt-3 text-sm leading-relaxed text-cdsc-ink/65">
              To provide businesses with dependable supply and procurement support through responsive service,
              practical sourcing, and long term partnerships.
            </p>
          </div>
          <div className="rounded-lg bg-white p-8 ring-1 ring-cdsc-line">
            <Eye className="h-6 w-6 text-cdsc-navy" />
            <h2 className="mt-4 text-lg font-semibold text-cdsc-ink">Our Vision</h2>
            <p className="mt-3 text-sm leading-relaxed text-cdsc-ink/65">
              To become a trusted industrial supply and procurement partner for businesses across the Philippines.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold text-cdsc-ink sm:text-3xl">Core Values</h2>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {coreValues.map((v, i) => {
            const Icon = VALUE_ICONS[i]
            return (
              <div key={v.title} className="rounded-lg border border-cdsc-line p-6 text-center">
                <Icon className="mx-auto h-6 w-6 text-cdsc-accent-dark" />
                <h3 className="mt-4 text-sm font-semibold text-cdsc-ink">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-cdsc-ink/60">{v.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="border-t border-cdsc-line bg-cdsc-paper">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 px-6 py-14 text-center lg:flex-row lg:text-left">
          <div>
            <h2 className="text-xl font-semibold text-cdsc-ink">Read the full Company Profile</h2>
            <p className="mt-2 text-sm text-cdsc-ink/65">A structured overview suitable for procurement and purchasing teams.</p>
          </div>
          <Link
            href="/company-profile"
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-cdsc-navy px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-cdsc-navy-dark"
          >
            View Company Profile <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  )
}
