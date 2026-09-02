import Link from 'next/link'
import type { Metadata } from 'next'
import {
  ArrowRight, Factory, HardHat, Wrench, Car, Building, Settings, Warehouse, Briefcase, Landmark,
} from 'lucide-react'
import { industries } from '@/lib/site-content'

export const metadata: Metadata = {
  title: 'Industries We Serve',
  description:
    'CDSC Industrial Supply supports purchasing requirements across manufacturing, construction, engineering, automotive, facilities management, and more.',
}

const ICONS = [Factory, HardHat, Wrench, Car, Building, Settings, Warehouse, Briefcase, Landmark]

export default function IndustriesPage() {
  return (
    <>
      <section className="border-b border-cdsc-line bg-cdsc-navy-dark">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">Industries We Serve</h1>
          <p className="mt-5 text-base leading-relaxed text-cdsc-paper/70">
            Purchasing requirements look different across sectors. Here is how CDSC supports each one.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {industries.map((ind, i) => {
            const Icon = ICONS[i]
            return (
              <div key={ind.name} className="rounded-lg border border-cdsc-line p-7">
                <Icon className="h-6 w-6 text-cdsc-accent-dark" />
                <h2 className="mt-4 text-base font-semibold text-cdsc-ink">{ind.name}</h2>
                <p className="mt-2 text-sm leading-relaxed text-cdsc-ink/60">{ind.description}</p>
              </div>
            )
          })}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-6 rounded-lg border border-cdsc-line bg-cdsc-paper px-8 py-10 text-center lg:flex-row lg:text-left">
          <div>
            <h2 className="text-lg font-semibold text-cdsc-ink">Don&apos;t see your industry listed?</h2>
            <p className="mt-2 text-sm text-cdsc-ink/65">We can still help — send us your requirement and we will review how CDSC can support it.</p>
          </div>
          <Link
            href="/quote"
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-cdsc-navy px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-cdsc-navy-dark"
          >
            Send Your Requirement <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  )
}
