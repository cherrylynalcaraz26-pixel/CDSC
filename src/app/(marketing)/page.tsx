import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import {
  ArrowRight, ShieldCheck, MessageCircle, SlidersHorizontal, Scale, Building2, Handshake, Boxes,
  Wrench, Zap, Cog, PackageSearch, Phone, Check, PlayCircle, ShoppingCart, Sparkles,
} from 'lucide-react'
import {
  productCategories, whyCds, industries, additionalMarkets, procurementProcess, company, heroStats,
} from '@/lib/site-content'
import { DemoVideoSection } from '@/components/marketing/demo-video-section'
import { Reveal, CountUp } from '@/components/marketing/profile-motion'

export const metadata: Metadata = {
  title: 'Industrial Supply & Procurement Partner in the Philippines',
  description:
    'Reliable industrial, electrical, safety, and mechanical supplies with sourcing and procurement support for manufacturing, construction, and facility operations across the Philippines.',
}

const WHY_ICONS = [ShieldCheck, MessageCircle, SlidersHorizontal, Scale, Building2, Handshake, Boxes]
const CATEGORY_ICONS = [Wrench, Zap, ShieldCheck, Cog, Building2]
const MARKETS = [...industries, ...additionalMarkets].map(m => m.name)

// Same visual language as /company-profile: animated red→orange gradient hero,
// black feature bands, white/paper content bands, rounded cards that lift on hover.
function Badge({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <span
      className={
        dark
          ? 'inline-flex items-center gap-1.5 rounded-full border border-orange-400/25 bg-orange-500/10 px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-orange-300'
          : 'inline-flex items-center gap-1.5 rounded-full bg-cdsc-tint px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-cdsc-accent'
      }
    >
      {children}
    </span>
  )
}

function Heading({ badge, title, intro, dark = false }: { badge: string; title: React.ReactNode; intro?: string; dark?: boolean }) {
  return (
    <div className="mx-auto mb-14 max-w-3xl text-center">
      <Badge dark={dark}>{badge}</Badge>
      <h2 className={`mt-5 text-3xl font-black leading-tight sm:text-5xl ${dark ? 'text-white' : 'text-cdsc-ink'}`}>{title}</h2>
      {intro && <p className={`mt-4 text-base leading-relaxed ${dark ? 'text-white/60' : 'text-cdsc-ink/60'}`}>{intro}</p>}
    </div>
  )
}

const WRAP = 'mx-auto w-full max-w-screen-2xl px-6 lg:px-10'

export default function HomePage() {
  return (
    <>
      {/* ═══════════ HERO — fills the window ═══════════ */}
      <section className="relative flex min-h-[calc(100svh-3.75rem)] items-center overflow-hidden bg-linear-to-br from-cdsc-accent via-red-500 to-orange-500 bg-[length:300%_300%] motion-safe:animate-gradient-shift sm:min-h-[calc(100svh-5.75rem)]">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] bg-[size:60px_60px]"
        />
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-[520px] w-[520px] rounded-full bg-white/[.08] motion-safe:animate-float" />
        <div aria-hidden className="pointer-events-none absolute -left-20 bottom-24 h-72 w-72 rounded-full bg-white/[.06] motion-safe:animate-float-slow" />

        <div className={`relative z-10 grid items-center gap-14 pb-32 pt-16 lg:grid-cols-[1.15fr_1fr] ${WRAP}`}>
          <div className="motion-safe:animate-rise">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white/90 backdrop-blur">
              <Check className="h-3.5 w-3.5 text-orange-200" /> Industrial Supply · Procurement · Sourcing
            </div>
            <h1 className="text-5xl font-black leading-[1.04] tracking-tight text-white sm:text-6xl xl:text-7xl">
              Industrial Supply
              <br />
              <span className="text-orange-200">Solutions Built</span>
              <br />
              Around Your Business
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/80">
              Reliable products, sourcing support, and procurement solutions for businesses, industrial facilities,
              contractors, and organizations across the Philippines.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/quote"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-3.5 font-bold text-cdsc-accent shadow-lg transition hover:-translate-y-0.5 hover:shadow-2xl"
              >
                Request a Quotation <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/products#shop"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-7 py-3.5 font-bold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20"
              >
                <ShoppingCart className="h-4 w-4" /> Shop Products
              </Link>
              <a
                href="#demo"
                className="inline-flex items-center gap-2 rounded-2xl px-5 py-3.5 font-bold text-white transition hover:bg-white/10"
              >
                <PlayCircle className="h-5 w-5" /> Watch Demo
              </a>
            </div>

            <div className="mt-14 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
              {heroStats.map(s => (
                <div key={s.label} className="rounded-2xl border border-white/15 bg-white/[.08] p-4 text-center backdrop-blur-md transition hover:-translate-y-1 hover:bg-white/[.14]">
                  <div className="text-3xl font-black text-white">
                    {s.animate ? <CountUp to={s.value} suffix={s.suffix} /> : `${s.value}${s.suffix}`}
                  </div>
                  <div className="mt-1 text-[0.65rem] font-semibold uppercase tracking-wider text-white/60">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Floating brand card */}
          <div className="relative hidden lg:block motion-safe:animate-rise-late">
            <div aria-hidden className="absolute inset-0 rotate-3 rounded-[2rem] bg-white/15" />
            <div className="relative rounded-[2rem] bg-white p-8 shadow-2xl shadow-black/20 motion-safe:animate-float-slow">
              <div className="flex items-center gap-4 border-b border-cdsc-line pb-6">
                <div className="relative h-14 w-32 shrink-0">
                  <Image src="/cdsc-logo.jpg" alt="CDSC Industrial Supply logo" fill className="object-contain" priority />
                </div>
                <div>
                  <p className="text-sm font-black text-cdsc-ink">{company.name}</p>
                  <p className="text-xs italic text-cdsc-ink/50">&ldquo;{company.tagline}&rdquo;</p>
                </div>
              </div>
              <ul className="mt-6 space-y-4">
                {procurementProcess.map(step => (
                  <li key={step.step} className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-cdsc-accent to-orange-500 text-xs font-black text-white">
                      {step.step}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-cdsc-ink">{step.title}</p>
                      <p className="text-xs leading-relaxed text-cdsc-ink/55">{step.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
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
              className="mr-4 flex shrink-0 items-center gap-2 rounded-full bg-cdsc-paper px-5 py-2.5 text-sm font-semibold text-cdsc-ink/70 transition hover:bg-cdsc-accent hover:text-white"
            >
              <Sparkles className="h-3.5 w-3.5 text-orange-500" /> {name}
            </Link>
          ))}
        </div>
      </section>

      {/* ═══════════ DEMO VIDEO ═══════════ */}
      <DemoVideoSection />

      {/* ═══════════ WHAT WE SUPPLY ═══════════ */}
      <section className="bg-white py-24">
        <div className={WRAP}>
          <Reveal>
            <Heading
              badge="Product Catalog"
              title={<>What We <span className="text-cdsc-accent">Supply</span></>}
              intro="Tell us what you need and we will help source it — from stock categories to hard-to-find requirements."
            />
          </Reveal>
          <Reveal className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {productCategories.map((cat, i) => {
              const Icon = CATEGORY_ICONS[i] ?? Boxes
              return (
                <div
                  key={cat.name}
                  className="group rounded-2xl bg-white p-7 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.12)] transition duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-cdsc-accent/20"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cdsc-tint text-cdsc-accent transition group-hover:rotate-6 group-hover:bg-linear-to-br group-hover:from-cdsc-accent group-hover:to-orange-500 group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-cdsc-ink">{cat.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-cdsc-ink/60">{cat.description}</p>
                </div>
              )
            })}
            <div className="flex flex-col justify-between rounded-2xl bg-linear-to-br from-cdsc-accent to-orange-500 p-7 text-white shadow-lg shadow-cdsc-accent/25 transition duration-300 hover:-translate-y-1.5">
              <div>
                <PackageSearch className="h-7 w-7" />
                <h3 className="mt-5 text-lg font-bold">Custom Sourcing</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/85">
                  Can&apos;t find what you need? CDSC can source specific products according to your requirements.
                </p>
              </div>
              <Link href="/quote" className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold hover:gap-2.5 transition-all">
                Submit Your Requirement <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ WHY CDSC (black band, like the profile) ═══════════ */}
      <section className="relative overflow-hidden bg-black py-24">
        <div aria-hidden className="pointer-events-none absolute -right-40 top-10 h-96 w-96 rounded-full bg-cdsc-accent/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -left-40 bottom-0 h-96 w-96 rounded-full bg-orange-500/10 blur-3xl" />
        <div className={`relative ${WRAP}`}>
          <Reveal>
            <Heading dark badge="Why CDSC" title="Why Businesses Choose CDSC" intro="Your requirement. Our responsibility." />
          </Reveal>
          <Reveal className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {whyCds.map((card, i) => {
              const Icon = WHY_ICONS[i] ?? ShieldCheck
              return (
                <div
                  key={card.title}
                  className="group relative overflow-hidden rounded-3xl bg-white/[.05] p-7 transition duration-300 hover:-translate-y-1.5 hover:bg-white/[.07] hover:shadow-2xl hover:shadow-cdsc-accent/20"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cdsc-accent/15 text-orange-300 transition group-hover:bg-linear-to-br group-hover:from-cdsc-accent group-hover:to-orange-500 group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-base font-bold text-white">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">{card.description}</p>
                  <div aria-hidden className="absolute right-0 top-0 h-28 w-28 rounded-bl-full bg-cdsc-accent/[.08] transition group-hover:bg-cdsc-accent/[.16]" />
                </div>
              )
            })}
          </Reveal>
        </div>
      </section>

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
          <Reveal className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div aria-hidden className="absolute left-0 right-0 top-10 hidden h-0.5 bg-linear-to-r from-cdsc-accent via-orange-400 to-orange-200 lg:block" />
            {procurementProcess.map(step => (
              <div key={step.step} className="relative rounded-2xl bg-white p-7 text-center shadow-sm transition duration-300 hover:-translate-y-1.5 hover:shadow-xl">
                <span className="relative mx-auto -mt-14 mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-cdsc-accent to-orange-500 text-lg font-black text-white shadow-lg shadow-cdsc-accent/30 ring-8 ring-cdsc-paper">
                  {step.step}
                </span>
                <h3 className="text-base font-bold text-cdsc-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-cdsc-ink/60">{step.description}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ═══════════ PARTNER + FINAL CTA ═══════════ */}
      <section className="bg-white py-24">
        <Reveal className={`grid gap-6 lg:grid-cols-2 ${WRAP}`}>
          <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-cdsc-accent via-red-500 to-orange-500 bg-[length:300%_300%] p-10 text-white motion-safe:animate-gradient-shift">
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 motion-safe:animate-float" />
            <h2 className="relative text-3xl font-black leading-tight sm:text-4xl">Have a Requirement?<br />Let&apos;s Work on It.</h2>
            <p className="relative mt-4 max-w-md text-white/85">
              Send us your product requirements and our team will identify the right sourcing and supply options.
            </p>
            <div className="relative mt-8 flex flex-wrap gap-3">
              <Link href="/quote" className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 font-bold text-cdsc-accent transition hover:-translate-y-0.5 hover:shadow-xl">
                Request a Quotation <ArrowRight className="h-4 w-4" />
              </Link>
              <a href={company.phoneHref} className="inline-flex items-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-6 py-3 font-bold transition hover:bg-white/20">
                <Phone className="h-4 w-4" /> {company.phone}
              </a>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-3xl bg-black p-10 text-white">
            <div aria-hidden className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-cdsc-accent/25 blur-3xl" />
            <Handshake className="relative h-9 w-9 text-orange-300" />
            <h2 className="relative mt-5 text-3xl font-black leading-tight sm:text-4xl">Interested in Partnering with CDSC?</h2>
            <p className="relative mt-4 max-w-md text-white/60">
              We work with reliable suppliers, vendors, and business partners. If you supply industrial, electrical,
              safety, or related products, we&apos;d like to hear from you.
            </p>
            <Link href="/inquiry" className="relative mt-8 inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-cdsc-accent to-orange-500 px-6 py-3 font-bold transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cdsc-accent/30">
              Partner with Us <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
        <p className="mt-10 text-center text-xs text-cdsc-ink/40">
          {company.name} &middot; {company.addressFull}
        </p>
      </section>
    </>
  )
}
