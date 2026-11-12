import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { ArrowRight, Package, Search, ClipboardList, Boxes, Truck, Puzzle } from 'lucide-react'
import { services, howWeWork } from '@/lib/site-content'
import { Reveal } from '@/components/marketing/profile-motion'

export const metadata: Metadata = {
  title: 'Services',
  description:
    'Procurement support, product sourcing, bulk and business orders, and delivery coordination from CDSC Industrial Supply.',
}

const ICONS = [Package, Search, ClipboardList, Boxes, Truck, Puzzle]
const WRAP = 'mx-auto w-full max-w-screen-2xl px-6 lg:px-10'

export default function ServicesPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <Image src="/images/site/logistics-port.jpg" alt="" fill priority sizes="100vw" className="object-cover" />
        <div aria-hidden className="absolute inset-0 bg-linear-to-r from-cdsc-accent/95 via-red-600/85 to-rose-500/55" />
        <div className={`relative py-24 text-white ${WRAP}`}>
          <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider backdrop-blur">Services</span>
          <h1 className="mt-5 text-4xl font-black sm:text-6xl">Our Services</h1>
          <p className="mt-4 max-w-xl text-lg text-white/85">
            Procurement, sourcing, quotation support and delivery coordination — built around recurring business requirements.
          </p>
        </div>
      </section>

      <section className="bg-white py-20">
        <Reveal className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 ${WRAP}`}>
          {services.map((s, i) => {
            const Icon = ICONS[i] ?? Package
            return (
              <div key={s.title} className="group rounded-3xl bg-white p-7 shadow-[0_6px_24px_-12px_rgba(0,0,0,0.18)] transition duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-cdsc-accent/15">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-cdsc-accent to-rose-500 text-white shadow-lg shadow-cdsc-accent/25 transition group-hover:rotate-6"><Icon className="h-5 w-5" /></span>
                <h2 className="mt-5 text-lg font-bold text-cdsc-ink">{s.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-cdsc-ink/60">{s.description}</p>
              </div>
            )
          })}
        </Reveal>
      </section>

      <section className="bg-cdsc-tint py-20">
        <div className={WRAP}>
          <h2 className="text-center text-3xl font-black text-cdsc-ink sm:text-4xl">How We Work</h2>
          <Reveal className="mt-12 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {howWeWork.map((step, i) => (
              <div key={step} className="relative rounded-2xl bg-white px-4 py-6 text-center shadow-sm">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-cdsc-accent to-rose-500 text-sm font-black text-white">{i + 1}</span>
                <span className="mt-3 block text-sm font-bold text-cdsc-ink">{step}</span>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="bg-white py-20 text-center">
        <h2 className="text-2xl font-black text-cdsc-ink">Have a recurring or one-time requirement?</h2>
        <p className="mt-2 text-sm text-cdsc-ink/65">Send us the details and we&apos;ll take it from there.</p>
        <Link href="/quote" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-cdsc-accent to-rose-500 px-7 py-3.5 font-bold text-white shadow-lg shadow-cdsc-accent/25 transition hover:-translate-y-0.5">
          Request a Quotation <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </>
  )
}
