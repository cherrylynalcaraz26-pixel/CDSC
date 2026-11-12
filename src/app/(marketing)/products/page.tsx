import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { ArrowRight, PackageSearch, Check } from 'lucide-react'
import { productCategories } from '@/lib/site-content'
import { ProductCatalog } from '@/components/marketing/product-catalog'

export const metadata: Metadata = {
  title: 'Products',
  description:
    'Industrial, electrical, safety, mechanical, and facility supplies for manufacturing, construction, and business operations — plus custom sourcing for hard to find requirements.',
}

const PHOTOS = [
  '/images/site/industrial-tools.jpg',
  '/images/site/electrical-panel.jpg',
  '/images/site/safety-electrician.jpg',
  '/images/site/mechanical-pump.jpg',
  '/images/site/office-team.jpg',
]

export default function ProductsPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <Image src="/images/site/warehouse-aisle.jpg" alt="" fill priority sizes="100vw" className="object-cover" />
        <div aria-hidden className="absolute inset-0 bg-linear-to-r from-cdsc-accent/95 via-red-600/85 to-rose-500/60" />
        <div className="relative mx-auto max-w-screen-2xl px-6 py-24 text-white lg:px-10">
          <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider backdrop-blur">Products</span>
          <h1 className="mt-5 text-4xl font-black sm:text-6xl">Products</h1>
          <p className="mt-4 max-w-xl text-lg text-white/85">
            Browse and filter our catalog, add items to your cart, or tell us what you need and we will help source it.
          </p>
        </div>
      </section>

      <ProductCatalog />

      <section className="mx-auto max-w-screen-2xl px-6 py-20 lg:px-10">
        <div className="mb-10 text-center">
          <span className="inline-flex rounded-full bg-cdsc-tint px-3.5 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-cdsc-accent">Categories</span>
          <h2 className="mt-4 text-3xl font-black text-cdsc-ink sm:text-4xl">What We <span className="text-cdsc-accent">Supply</span></h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {productCategories.map((cat, i) => (
            <div key={cat.name} id={cat.name.toLowerCase().replace(/\W+/g, '-')} className="group grid scroll-mt-28 overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)] sm:grid-cols-[200px_1fr]">
              <div className="relative h-44 sm:h-full">
                <Image src={PHOTOS[i] ?? PHOTOS[0]} alt={cat.name} fill sizes="(min-width:640px) 200px, 100vw" className="object-cover transition duration-700 group-hover:scale-110" />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-black text-cdsc-ink">{cat.name}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-cdsc-ink/60">{cat.description}</p>
                <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {cat.items.map(item => (
                    <li key={item} className="flex items-start gap-1.5 text-sm text-cdsc-ink/70">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cdsc-accent" strokeWidth={3} />{item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-6 rounded-3xl bg-cdsc-tint p-8 sm:flex-row sm:items-center sm:p-10">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-cdsc-accent shadow-sm"><PackageSearch className="h-6 w-6" /></span>
            <div>
              <h2 className="text-xl font-black text-cdsc-ink">Custom Sourcing</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-cdsc-ink/65">
                Can&apos;t find what you need? CDSC can assist in sourcing specific products according to your
                requirements — specifications, quantity, brand preference, or application.
              </p>
            </div>
          </div>
          <Link href="/quote" className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-linear-to-r from-cdsc-accent to-rose-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-cdsc-accent/25 transition hover:-translate-y-0.5">
            Submit Your Requirement <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  )
}
