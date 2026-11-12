import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { ArrowRight, Phone, PlayCircle, ShoppingCart, PackageSearch, Handshake } from 'lucide-react'
import { additionalMarkets, companyWithContact } from '@/lib/site-content'
import { getSiteContent } from '@/lib/site-content-server'
import { DemoVideoSection } from '@/components/marketing/demo-video-section'
import { InventorySystemShowcase } from '@/components/marketing/inventory-showcase'
import { Reveal, CountUp } from '@/components/marketing/profile-motion'

export const metadata: Metadata = {
  title: 'Industrial Supply & Procurement Partner in the Philippines',
  description:
    'Reliable industrial, electrical, safety, and mechanical supplies with sourcing and procurement support for manufacturing, construction, and facility operations across the Philippines.',
}

// Real photos (public/images/site) for the five main supply categories.
const CATEGORY_PHOTOS = [
  '/images/site/industrial-tools.jpg',
  '/images/site/electrical-panel.jpg',
  '/images/site/safety-electrician.jpg',
  '/images/site/mechanical-pump.jpg',
  '/images/site/office-team.jpg',
]
const INDUSTRY_PHOTOS: [string, string][] = [
  ['Manufacturing', '/images/site/manufacturing-line.jpg'],
  ['Construction', '/images/site/construction-site.jpg'],
  ['Engineering', '/images/site/engineering-plans.jpg'],
  ['Warehousing & Logistics', '/images/site/logistics-port.jpg'],
]

function Badge({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <span
      className={
        light
          ? 'inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-white backdrop-blur'
          : 'inline-flex items-center rounded-full bg-cdsc-tint px-3.5 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-cdsc-accent'
      }
    >
      {children}
    </span>
  )
}

function Heading({ badge, title, intro }: { badge: string; title: React.ReactNode; intro?: string }) {
  return (
    <div className="mx-auto mb-14 max-w-3xl text-center">
      <Badge>{badge}</Badge>
      <h2 className="mt-5 text-3xl font-black leading-tight text-cdsc-ink sm:text-5xl">{title}</h2>
      {intro && <p className="mt-4 text-base leading-relaxed text-cdsc-ink/60">{intro}</p>}
    </div>
  )
}

const WRAP = 'mx-auto w-full max-w-screen-2xl px-6 lg:px-10'

// Content is editable in Settings → Website; refreshed at most every minute.
export const revalidate = 60

export default async function HomePage() {
  const content = await getSiteContent()
  const { productCategories, whyCds, industries, procurementProcess, heroStats, homeHero } = content
  const company = companyWithContact(content.contact)
  const MARKETS = [...industries, ...additionalMarkets].map(m => m.name)
  // The built-in system gets its own showcase section below.
  const WHY = whyCds.filter(w => !/inventory system/i.test(w.title))
  const [h1 = '', h2 = '', ...h3] = homeHero.headline
  return (
    <>
      {/* ═══════════ HERO — real photo, fills the window ═══════════ */}
      <section className="relative flex min-h-[calc(100svh-3.75rem)] items-center overflow-hidden sm:min-h-[calc(100svh-5.75rem)]">
        <Image src="/images/site/hero-warehouse.jpg" alt="" fill priority sizes="100vw" className="object-cover motion-safe:animate-ken-burns" />
        <div aria-hidden className="absolute inset-0 bg-linear-to-r from-cdsc-accent/95 via-red-600/80 to-rose-500/40" />
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] bg-[size:60px_60px]"
        />

        <div className={`relative z-10 pb-32 pt-16 ${WRAP}`}>
          <div className="max-w-3xl motion-safe:animate-rise">
            <Badge light>{homeHero.badge}</Badge>
            <h1 className="mt-7 text-5xl font-black leading-[1.04] tracking-tight text-white sm:text-6xl xl:text-7xl">
              {h1}
              {h2 && <><br /><span className="text-red-100">{h2}</span></>}
              {h3.length > 0 && <><br />{h3.join(' ')}</>}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/85">{homeHero.description}</p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link href="/quote" className="inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-3.5 font-bold text-cdsc-accent shadow-lg transition hover:-translate-y-0.5 hover:shadow-2xl">
                Request a Quotation <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/products#shop" className="inline-flex items-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-7 py-3.5 font-bold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20">
                <ShoppingCart className="h-4 w-4" /> Shop Products
              </Link>
              <a href="#demo" className="inline-flex items-center gap-2 rounded-2xl px-5 py-3.5 font-bold text-white transition hover:bg-white/10">
                <PlayCircle className="h-5 w-5" /> Watch Demo
              </a>
            </div>
            <div className="mt-14 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
              {heroStats.map(s => (
                <div key={s.label} className="rounded-2xl border border-white/20 bg-white/10 p-4 text-center backdrop-blur-md transition hover:-translate-y-1 hover:bg-white/15">
                  <div className="text-3xl font-black text-white">
                    {s.animate ? <CountUp to={s.value} suffix={s.suffix} /> : `${s.value}${s.suffix}`}
                  </div>
                  <div className="mt-1 text-[0.65rem] font-semibold uppercase tracking-wider text-white/70">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <svg aria-hidden className="absolute inset-x-0 bottom-0 block h-20 w-full" viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="white" />
        </svg>
      </section>

      {/* ═══════════ MARKETS MARQUEE ═══════════ */}
      <section aria-label="Industries we serve" className="overflow-hidden bg-white py-8">
        <div className="flex w-max motion-safe:animate-marquee hover:[animation-play-state:paused]">
          {[...MARKETS, ...MARKETS].map((name, i) => (
            <Link
              key={`${name}-${i}`}
              href="/industries"
              aria-hidden={i >= MARKETS.length}
              tabIndex={i >= MARKETS.length ? -1 : undefined}
              className="mr-3 flex shrink-0 items-center gap-2.5 rounded-full bg-cdsc-paper px-5 py-2.5 text-sm font-semibold text-cdsc-ink/70 transition hover:bg-cdsc-accent hover:text-white"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-cdsc-accent" /> {name}
            </Link>
          ))}
        </div>
      </section>

      {/* ═══════════ WHAT WE SUPPLY — photo cards ═══════════ */}
      <section className="bg-white pb-24 pt-12">
        <div className={WRAP}>
          <Reveal>
            <Heading
              badge="Product Catalog"
              title={<>What We <span className="text-cdsc-accent">Supply</span></>}
              intro="Tell us what you need and we will help source it — from stock categories to hard-to-find requirements."
            />
          </Reveal>
          <Reveal className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {productCategories.map((cat, i) => (
              <Link
                key={cat.name}
                href={`/products?category=${encodeURIComponent(cat.name)}#shop`}
                className="group overflow-hidden rounded-3xl bg-white shadow-[0_8px_30px_-12px_rgba(0,0,0,0.18)] transition duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-cdsc-accent/20"
              >
                <div className="relative h-52 overflow-hidden">
                  <Image src={CATEGORY_PHOTOS[i] ?? CATEGORY_PHOTOS[0]} alt={cat.name} fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover transition duration-700 group-hover:scale-110" />
                  <div aria-hidden className="absolute inset-0 bg-linear-to-t from-cdsc-ink/60 via-transparent to-transparent" />
                  <h3 className="absolute bottom-4 left-5 right-5 text-xl font-black text-white">{cat.name}</h3>
                </div>
                <div className="p-6">
                  <p className="text-sm leading-relaxed text-cdsc-ink/60">{cat.description}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-cdsc-accent transition-all group-hover:gap-2.5">
                    View products <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            ))}
            <div className="relative flex flex-col justify-end overflow-hidden rounded-3xl p-7 text-white shadow-lg shadow-cdsc-accent/25 transition duration-300 hover:-translate-y-1.5">
              <Image src="/images/site/warehouse-aisle.jpg" alt="" fill sizes="(min-width:1024px) 33vw, 100vw" className="object-cover" />
              <div aria-hidden className="absolute inset-0 bg-linear-to-t from-cdsc-accent via-cdsc-accent/85 to-rose-500/50" />
              <div className="relative">
                <PackageSearch className="h-8 w-8" />
                <h3 className="mt-4 text-xl font-black">Custom Sourcing</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/90">
                  Can&apos;t find what you need? CDSC can source specific products according to your requirements.
                </p>
                <Link href="/quote" className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-cdsc-accent transition hover:gap-2.5">
                  Submit Your Requirement <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ DEMO VIDEO ═══════════ */}
      <DemoVideoSection />

      {/* ═══════════ INDUSTRIES — photo mosaic ═══════════ */}
      <section className="bg-white py-24">
        <div className={WRAP}>
          <Reveal>
            <Heading badge="Who We Serve" title="Industries We Supply" intro="Purchasing support built around the way each sector actually operates." />
          </Reveal>
          <Reveal className="grid auto-rows-[220px] gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {INDUSTRY_PHOTOS.map(([name, src], i) => (
              <Link
                key={name}
                href="/industries"
                className={`group relative overflow-hidden rounded-3xl ${i === 0 ? 'lg:col-span-2 lg:row-span-2' : ''} ${i === 3 ? 'lg:col-span-2' : ''}`}
              >
                <Image src={src} alt={name} fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover transition duration-700 group-hover:scale-110" />
                <div aria-hidden className="absolute inset-0 bg-linear-to-t from-cdsc-accent/90 via-cdsc-accent/20 to-transparent opacity-80 transition group-hover:opacity-100" />
                <div className="absolute bottom-5 left-6 right-6 flex items-end justify-between gap-3 text-white">
                  <h3 className="text-xl font-black sm:text-2xl">{name}</h3>
                  <ArrowRight className="h-5 w-5 shrink-0 transition group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ═══════════ WHY CDSC ═══════════ */}
      <section className="bg-cdsc-tint py-24">
        <div className={WRAP}>
          <Reveal>
            <Heading badge="Why CDSC" title="Why Businesses Choose CDSC" intro="Your requirement. Our responsibility." />
          </Reveal>
          <Reveal className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {WHY.map((card, i) => (
              <div key={card.title} className="group relative overflow-hidden rounded-3xl bg-white p-7 shadow-sm transition duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-cdsc-accent/15">
                <span className="text-5xl font-black leading-none text-cdsc-accent/15 transition group-hover:text-cdsc-accent/30">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-3 text-lg font-bold text-cdsc-ink">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-cdsc-ink/60">{card.description}</p>
                <div aria-hidden className="absolute inset-x-7 bottom-0 h-1 origin-left scale-x-0 rounded-t-full bg-linear-to-r from-cdsc-accent to-rose-500 transition duration-500 group-hover:scale-x-100" />
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ═══════════ BUILT-IN INVENTORY SYSTEM ═══════════ */}
      <InventorySystemShowcase />

      {/* ═══════════ PROCUREMENT PROCESS ═══════════ */}
      <section className="bg-cdsc-paper py-24">
        <div className={WRAP}>
          <Reveal>
            <Heading
              badge="How We Work"
              title={<>More Than a Supplier.<br /><span className="text-cdsc-accent">Your Procurement Partner.</span></>}
              intro="We assist with product sourcing, supplier coordination, quotation preparation, and fulfillment — so purchasing stays straightforward."
            />
          </Reveal>
          <Reveal className="relative grid gap-6 pt-6 sm:grid-cols-2 lg:grid-cols-4">
            <div aria-hidden className="absolute left-0 right-0 top-16 hidden h-0.5 bg-linear-to-r from-cdsc-accent via-rose-400 to-rose-200 lg:block" />
            {procurementProcess.map(step => (
              <div key={step.step} className="relative rounded-3xl bg-white p-7 text-center shadow-sm transition duration-300 hover:-translate-y-1.5 hover:shadow-xl">
                <span className="relative mx-auto -mt-14 mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-cdsc-accent to-rose-500 text-lg font-black text-white shadow-lg shadow-cdsc-accent/30 ring-8 ring-cdsc-paper">
                  {step.step}
                </span>
                <h3 className="text-base font-bold text-cdsc-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-cdsc-ink/60">{step.description}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ═══════════ CTA + PARTNER ═══════════ */}
      <section className="bg-white py-24">
        <Reveal className={`grid gap-6 lg:grid-cols-2 ${WRAP}`}>
          <div className="relative overflow-hidden rounded-3xl p-10 text-white">
            <Image src="/images/site/welding.jpg" alt="" fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
            <div aria-hidden className="absolute inset-0 bg-linear-to-br from-cdsc-accent/95 via-red-600/85 to-rose-500/70" />
            <div className="relative">
              <h2 className="text-3xl font-black leading-tight sm:text-4xl">Have a Requirement?<br />Let&apos;s Work on It.</h2>
              <p className="mt-4 max-w-md text-white/90">Send us your product requirements and our team will identify the right sourcing and supply options.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/quote" className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 font-bold text-cdsc-accent transition hover:-translate-y-0.5 hover:shadow-xl">
                  Request a Quotation <ArrowRight className="h-4 w-4" />
                </Link>
                <a href={company.phoneHref} className="inline-flex items-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-6 py-3 font-bold backdrop-blur transition hover:bg-white/20">
                  <Phone className="h-4 w-4" /> {company.phone}
                </a>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-3xl bg-cdsc-tint p-10">
            <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-cdsc-accent/10" />
            <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-cdsc-accent shadow-sm"><Handshake className="h-7 w-7" /></span>
            <h2 className="relative mt-5 text-3xl font-black leading-tight text-cdsc-ink sm:text-4xl">Interested in Partnering with CDSC?</h2>
            <p className="relative mt-4 max-w-md text-cdsc-ink/65">
              We work with reliable suppliers, vendors, and business partners. If you supply industrial, electrical,
              safety, or related products, we&apos;d like to hear from you.
            </p>
            <Link href="/inquiry" className="relative mt-8 inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-cdsc-accent to-rose-500 px-6 py-3 font-bold text-white transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cdsc-accent/30">
              Partner with Us <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
        <p className="mt-10 text-center text-xs text-cdsc-ink/40">{company.name} &middot; {company.addressFull}</p>
      </section>
    </>
  )
}
