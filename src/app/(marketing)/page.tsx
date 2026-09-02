import Link from 'next/link'
import type { Metadata } from 'next'
import {
  ArrowRight, ShieldCheck, MessageCircle, SlidersHorizontal, Scale, Building2, Handshake,
  Wrench, Zap, Cog, PackageSearch, ClipboardCheck,
} from 'lucide-react'
import { productCategories, whyCds, industries, procurementProcess, company } from '@/lib/site-content'

export const metadata: Metadata = {
  title: 'Industrial Supply & Procurement Partner in the Philippines',
  description:
    'Reliable industrial, electrical, safety, and mechanical supplies with sourcing and procurement support for manufacturing, construction, and facility operations across the Philippines.',
}

const WHY_ICONS = [ShieldCheck, MessageCircle, SlidersHorizontal, Scale, Building2, Handshake]
const CATEGORY_ICONS = [Wrench, Zap, ShieldCheck, Cog, Building2]

export default function HomePage() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-cdsc-navy-dark">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 1px,transparent 26px)' }}
        />
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--cdsc-accent), transparent 70%)' }}
        />
        <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-28 lg:py-32">
          <div className="max-w-3xl">
            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wide text-cdsc-paper/70">
              Industrial Supply &middot; Procurement &middot; Sourcing
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
              Industrial Supply Solutions<br className="hidden sm:block" /> Built Around Your Business
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-cdsc-paper/70 sm:text-lg">
              CDSC Industrial Supply provides reliable products, sourcing support, and procurement solutions for
              businesses, industrial facilities, contractors, and organizations across the Philippines.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/quote"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-cdsc-accent px-6 py-3.5 text-sm font-semibold text-cdsc-navy-dark transition-colors hover:bg-white"
              >
                Request a Quotation <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/products"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Explore Our Products
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STATEMENT */}
      <section className="border-b border-cdsc-line bg-cdsc-paper">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold text-cdsc-ink sm:text-3xl">Your Requirement. Our Responsibility.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-cdsc-ink/65">
            From everyday industrial supplies to specific sourcing requirements, CDSC helps businesses find practical
            solutions while keeping procurement straightforward and dependable.
          </p>
        </div>
      </section>

      {/* PRODUCTS OVERVIEW */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold text-cdsc-ink sm:text-3xl">What We Supply</h2>
          <p className="mt-3 text-cdsc-ink/65">
            Tell us what you need and we will help source it — from stock categories to hard to find requirements.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {productCategories.map((cat, i) => {
            const Icon = CATEGORY_ICONS[i]
            return (
              <div key={cat.name} className="rounded-lg border border-cdsc-line p-6 transition-colors hover:border-cdsc-navy/30">
                <Icon className="h-6 w-6 text-cdsc-accent-dark" />
                <h3 className="mt-4 text-base font-semibold text-cdsc-ink">{cat.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-cdsc-ink/60">{cat.description}</p>
              </div>
            )
          })}
          <div className="flex flex-col justify-between rounded-lg border border-dashed border-cdsc-navy/30 bg-cdsc-paper p-6">
            <div>
              <PackageSearch className="h-6 w-6 text-cdsc-navy" />
              <h3 className="mt-4 text-base font-semibold text-cdsc-ink">Custom Sourcing</h3>
              <p className="mt-2 text-sm leading-relaxed text-cdsc-ink/60">
                Can&apos;t find what you need? CDSC can assist in sourcing specific products according to your requirements.
              </p>
            </div>
            <Link href="/quote" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-cdsc-navy hover:text-cdsc-navy-dark">
              Submit Your Requirement <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* WHY CDSC */}
      <section className="border-y border-cdsc-line bg-cdsc-paper">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold text-cdsc-ink sm:text-3xl">Why Businesses Choose CDSC</h2>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {whyCds.map((card, i) => {
              const Icon = WHY_ICONS[i]
              return (
                <div key={card.title} className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-cdsc-line">
                  <Icon className="h-6 w-6 text-cdsc-navy" />
                  <h3 className="mt-4 text-base font-semibold text-cdsc-ink">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-cdsc-ink/60">{card.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* INDUSTRIES PREVIEW */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-semibold text-cdsc-ink sm:text-3xl">Industries We Serve</h2>
            <p className="mt-3 max-w-xl text-cdsc-ink/65">Purchasing support built around the way each sector actually operates.</p>
          </div>
          <Link href="/industries" className="inline-flex items-center gap-1.5 text-sm font-semibold text-cdsc-navy hover:text-cdsc-navy-dark">
            View All Industries <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {industries.slice(0, 5).map(ind => (
            <div key={ind.name} className="rounded-lg border border-cdsc-line px-4 py-6 text-center">
              <p className="text-sm font-semibold text-cdsc-ink">{ind.name}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PROCUREMENT / SOURCING */}
      <section className="bg-cdsc-navy-dark">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">More Than a Supplier. Your Procurement Partner.</h2>
            <p className="mt-4 text-cdsc-paper/70">
              Every business has purchasing requirements that do not always fit neatly into a catalog. CDSC helps
              simplify those requirements by assisting with product sourcing, supplier coordination, quotation
              preparation, and fulfillment.
            </p>
          </div>
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {procurementProcess.map(step => (
              <div key={step.step} className="border-l-2 border-cdsc-accent pl-5">
                <span className="text-sm font-semibold text-cdsc-accent">{step.step}</span>
                <h3 className="mt-2 text-base font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-cdsc-paper/60">{step.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link
              href="/quote"
              className="inline-flex items-center gap-2 rounded-md bg-cdsc-accent px-6 py-3.5 text-sm font-semibold text-cdsc-navy-dark transition-colors hover:bg-white"
            >
              Send Your Requirement <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="flex flex-col items-center justify-between gap-8 rounded-lg border border-cdsc-line bg-cdsc-paper px-8 py-14 text-center lg:flex-row lg:text-left">
          <div>
            <h2 className="text-2xl font-semibold text-cdsc-ink sm:text-3xl">Have a Requirement? Let&apos;s Work on It.</h2>
            <p className="mt-3 max-w-xl text-cdsc-ink/65">
              Send us your product requirements and our team will help you identify the appropriate sourcing and supply options.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <Link
              href="/quote"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-cdsc-navy px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-cdsc-navy-dark"
            >
              Request a Quotation <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-cdsc-navy/20 px-6 py-3.5 text-sm font-semibold text-cdsc-ink transition-colors hover:bg-white"
            >
              <ClipboardCheck className="h-4 w-4" /> Contact CDSC
            </Link>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-cdsc-ink/40">
          {company.name} &middot; {company.addressFull}
        </p>
      </section>
    </>
  )
}
