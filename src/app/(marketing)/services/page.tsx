import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight, Package, Search, ClipboardList, Boxes, Truck, Puzzle } from 'lucide-react'
import { services, howWeWork } from '@/lib/site-content'

export const metadata: Metadata = {
  title: 'Services',
  description:
    'Procurement support, product sourcing, bulk and business orders, and delivery coordination from CDSC Industrial Supply.',
}

const ICONS = [Package, Search, ClipboardList, Boxes, Truck, Puzzle]

export default function ServicesPage() {
  return (
    <>
      <section className="border-b border-cdsc-line bg-cdsc-navy-dark">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">Services</h1>
          <p className="mt-5 text-base leading-relaxed text-cdsc-paper/70">
            Procurement, sourcing, quotation support, and delivery coordination — built around recurring business requirements.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s, i) => {
            const Icon = ICONS[i]
            return (
              <div key={s.title} className="rounded-lg border border-cdsc-line p-7">
                <Icon className="h-6 w-6 text-cdsc-accent-dark" />
                <h2 className="mt-4 text-base font-semibold text-cdsc-ink">{s.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-cdsc-ink/60">{s.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="border-y border-cdsc-line bg-cdsc-paper">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-center text-2xl font-semibold text-cdsc-ink sm:text-3xl">How We Work</h2>
          <div className="mt-12 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            {howWeWork.map((step, i) => (
              <div key={step} className="flex flex-1 items-center gap-3">
                <div className="flex flex-1 flex-col items-center rounded-lg border border-cdsc-line bg-white px-4 py-5 text-center">
                  <span className="text-xs font-semibold text-cdsc-accent-dark">STEP {i + 1}</span>
                  <span className="mt-1.5 text-sm font-semibold text-cdsc-ink">{step}</span>
                </div>
                {i < howWeWork.length - 1 && <ArrowRight className="hidden h-4 w-4 shrink-0 text-cdsc-ink/30 sm:block" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <h2 className="text-xl font-semibold text-cdsc-ink">Have a recurring or one-time requirement?</h2>
        <p className="mt-2 text-sm text-cdsc-ink/65">Send us the details and we&apos;ll take it from there.</p>
        <Link
          href="/quote"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-cdsc-navy px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-cdsc-navy-dark"
        >
          Request a Quotation <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </>
  )
}
