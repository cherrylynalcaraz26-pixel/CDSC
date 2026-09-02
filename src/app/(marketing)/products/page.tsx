import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight, Wrench, Zap, ShieldCheck, Cog, Building2, PackageSearch } from 'lucide-react'
import { productCategories } from '@/lib/site-content'

export const metadata: Metadata = {
  title: 'Products',
  description:
    'Industrial, electrical, safety, mechanical, and facility supplies for manufacturing, construction, and business operations — plus custom sourcing for hard to find requirements.',
}

const ICONS = [Wrench, Zap, ShieldCheck, Cog, Building2]

export default function ProductsPage() {
  return (
    <>
      <section className="border-b border-cdsc-line bg-cdsc-navy-dark">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">Products</h1>
          <p className="mt-5 text-base leading-relaxed text-cdsc-paper/70">
            Tell us what you need and we will help source it. Below are the categories we regularly supply.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-6 sm:grid-cols-2">
          {productCategories.map((cat, i) => {
            const Icon = ICONS[i]
            return (
              <div key={cat.name} className="rounded-lg border border-cdsc-line p-7">
                <Icon className="h-7 w-7 text-cdsc-accent-dark" />
                <h2 className="mt-4 text-lg font-semibold text-cdsc-ink">{cat.name}</h2>
                <p className="mt-2 text-sm leading-relaxed text-cdsc-ink/60">{cat.description}</p>
                <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {cat.items.map(item => (
                    <li key={item} className="text-sm text-cdsc-ink/70 before:mr-2 before:content-['—']">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        <div className="mt-6 rounded-lg border border-dashed border-cdsc-navy/30 bg-cdsc-paper p-8 sm:p-10">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div className="flex items-start gap-4">
              <PackageSearch className="mt-1 h-7 w-7 shrink-0 text-cdsc-navy" />
              <div>
                <h2 className="text-lg font-semibold text-cdsc-ink">Custom Sourcing</h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-cdsc-ink/65">
                  Can&apos;t find what you need? CDSC can assist in sourcing specific products according to your
                  requirements — specifications, quantity, brand preference, or application.
                </p>
              </div>
            </div>
            <Link
              href="/quote"
              className="inline-flex shrink-0 items-center gap-2 rounded-md bg-cdsc-navy px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-cdsc-navy-dark"
            >
              Submit Your Requirement <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
