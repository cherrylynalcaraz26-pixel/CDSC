import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { ArrowRight, PackageSearch, Check, Stethoscope, Lock, Monitor, Package, Fan, Paintbrush, Armchair } from 'lucide-react'
import { productCategories, extendedCatalog, furniture } from '@/lib/site-content'

const EXT_ICONS = [Stethoscope, Lock, Monitor, Package, Fan, Paintbrush]
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

        <h3 className="mb-5 mt-16 text-center text-2xl font-black text-cdsc-ink">More Categories</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {extendedCatalog.map((c, i) => {
            const Icon = EXT_ICONS[i] ?? Package
            return (
              <div key={c.name} className="group flex gap-4 rounded-2xl bg-white p-5 shadow-[0_6px_24px_-12px_rgba(0,0,0,0.18)] transition hover:-translate-y-1 hover:shadow-xl">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cdsc-tint text-cdsc-accent transition group-hover:bg-cdsc-accent group-hover:text-white"><Icon className="h-5 w-5" /></span>
                <div>
                  <h4 className="text-sm font-bold text-cdsc-ink">{c.name}</h4>
                  <p className="mt-1 text-xs leading-relaxed text-cdsc-ink/60">{c.items.join(' · ')}</p>
                </div>
              </div>
            )
          })}
        </div>

        <div id="furniture" className="mt-16 grid scroll-mt-28 items-center gap-10 overflow-hidden rounded-3xl bg-cdsc-paper lg:grid-cols-2">
          <div className="relative h-72 lg:h-full lg:min-h-[380px]">
            <Image src="/images/site/office-team.jpg" alt="Office furniture and workspace" fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
          </div>
          <div className="p-8 lg:pr-12">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-cdsc-accent"><Armchair className="h-3.5 w-3.5" /> Furniture &amp; Fixtures</span>
            <h3 className="mt-4 text-3xl font-black text-cdsc-ink">Office Furniture &amp; Workspace Solutions</h3>
            <p className="mt-3 text-sm leading-relaxed text-cdsc-ink/65">{furniture.description}</p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {furniture.items.map(item => (
                <li key={item} className="flex items-start gap-2 text-sm text-cdsc-ink/75"><Check className="mt-0.5 h-4 w-4 shrink-0 text-cdsc-accent" strokeWidth={3} />{item}</li>
              ))}
            </ul>
          </div>
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
