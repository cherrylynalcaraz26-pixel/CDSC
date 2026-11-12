import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import {
  Target, Eye, ShieldCheck, MessageCircle, Scale, Wrench, Handshake, BadgeCheck, ArrowRight, Building2, FileText,
} from 'lucide-react'
import {
  company, companyOverview, mission, vision, coreValues, credentials, registration, heroStats, profileHero,
} from '@/lib/site-content'
import { Reveal, CountUp } from '@/components/marketing/profile-motion'

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'About CDSC Industrial Supply — a DTI-registered industrial supply and procurement company in Sto. Tomas, Batangas: our story, mission, vision, values and credentials.',
}

const VALUE_ICONS = [ShieldCheck, MessageCircle, Scale, Wrench, Handshake]
const WRAP = 'mx-auto w-full max-w-screen-2xl px-6 lg:px-10'

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex rounded-full bg-cdsc-tint px-3.5 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-cdsc-accent">{children}</span>
}

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <Image src="/images/site/meeting.jpg" alt="" fill priority sizes="100vw" className="object-cover" />
        <div aria-hidden className="absolute inset-0 bg-linear-to-r from-cdsc-accent/95 via-red-600/85 to-rose-500/55" />
        <div className={`relative py-24 text-white sm:py-28 ${WRAP}`}>
          <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider backdrop-blur">About Us</span>
          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight sm:text-6xl">
            {profileHero.headline[0]} <span className="text-red-100">{profileHero.headline[1]}</span> {profileHero.headline[2]}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/85">{profileHero.description}</p>
        </div>
      </section>

      {/* Our story + registration */}
      <section className="bg-white py-24">
        <Reveal className={`grid items-center gap-14 lg:grid-cols-2 ${WRAP}`}>
          <div>
            <Badge>Our Story</Badge>
            <h2 className="mt-5 text-3xl font-black leading-tight text-cdsc-ink sm:text-5xl">
              Your Trusted <span className="text-cdsc-accent">Industrial Partner</span>
            </h2>
            {companyOverview.map(p => (
              <p key={p.slice(0, 24)} className="mt-5 text-[0.95rem] leading-relaxed text-cdsc-ink/70">{p}</p>
            ))}
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {heroStats.map(s => (
                <div key={s.label} className="rounded-2xl bg-cdsc-tint p-4 text-center">
                  <div className="text-2xl font-black text-cdsc-accent">{s.animate ? <CountUp to={s.value} suffix={s.suffix} /> : `${s.value}${s.suffix}`}</div>
                  <div className="mt-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-cdsc-ink/55">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div aria-hidden className="absolute -inset-3 rotate-2 overflow-hidden rounded-3xl">
              <Image src="/images/site/warehouse-shelves.jpg" alt="" fill sizes="50vw" className="object-cover" />
              <div className="absolute inset-0 bg-cdsc-accent/30" />
            </div>
            <div className="relative rounded-3xl bg-white p-8 shadow-2xl">
              <div className="mb-6 flex items-center gap-4 border-b border-cdsc-line pb-6">
                <div className="relative h-14 w-28 shrink-0">
                  <Image src="/cdsc-logo.png" alt="CDSC Industrial Supply logo" fill sizes="112px" className="object-contain" />
                </div>
                <div>
                  <p className="text-sm font-black text-cdsc-ink">{company.name}</p>
                  <p className="text-xs italic text-cdsc-ink/50">&ldquo;{company.tagline}&rdquo;</p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                {[
                  ['Proprietor', registration.proprietor],
                  ['Business Type', company.businessType],
                  ['Industry', company.industry],
                  ['Established', String(registration.established)],
                  ['DTI Reg. No.', registration.dtiNo],
                  ['TIN', registration.tin],
                  ['VAT Status', company.vatRegistered ? 'VAT Registered' : 'Non-VAT'],
                  ['Clients', registration.clientTypes],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[0.65rem] font-bold uppercase tracking-wider text-cdsc-ink/45">{k}</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-cdsc-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-6 flex items-start gap-2 rounded-xl bg-cdsc-paper p-3 text-xs text-cdsc-ink/65">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-cdsc-accent" /> {company.addressFull}
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Mission, vision, values */}
      <section className="bg-cdsc-tint py-24">
        <div className={WRAP}>
          <Reveal className="mx-auto mb-14 max-w-2xl text-center">
            <Badge>What Drives Us</Badge>
            <h2 className="mt-5 text-3xl font-black text-cdsc-ink sm:text-5xl">Mission, Vision &amp; Values</h2>
          </Reveal>
          <Reveal className="grid gap-6 md:grid-cols-2">
            {[
              { Icon: Target, title: 'Our Mission', text: mission },
              { Icon: Eye, title: 'Our Vision', text: vision },
            ].map(({ Icon, title, text }) => (
              <div key={title} className="relative overflow-hidden rounded-3xl bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-cdsc-accent to-rose-500 text-white shadow-lg shadow-cdsc-accent/30"><Icon className="h-6 w-6" /></span>
                <h3 className="mt-6 text-2xl font-black text-cdsc-ink">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-cdsc-ink/65">{text}</p>
                <div aria-hidden className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-cdsc-tint" />
              </div>
            ))}
          </Reveal>
          <Reveal className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {coreValues.map((v, i) => {
              const Icon = VALUE_ICONS[i] ?? ShieldCheck
              return (
                <div key={v.title} className="group rounded-2xl bg-white p-5 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                  <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-cdsc-tint text-cdsc-accent transition group-hover:bg-cdsc-accent group-hover:text-white"><Icon className="h-5 w-5" /></span>
                  <p className="mt-3 text-sm font-bold text-cdsc-ink">{v.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-cdsc-ink/60">{v.description}</p>
                </div>
              )
            })}
          </Reveal>
        </div>
      </section>

      {/* Credentials */}
      <section className="bg-white py-24">
        <Reveal className={WRAP}>
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Badge>Credentials</Badge>
            <h2 className="mt-5 text-3xl font-black text-cdsc-ink sm:text-4xl">Registered &amp; Compliant</h2>
            <p className="mt-3 text-cdsc-ink/60">Buy with confidence — CDSC issues official receipts and invoices and complies with BIR requirements.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[...credentials, { label: 'BIR Registered · VAT', description: `TIN ${registration.tin}. Official receipts, invoices and BIR Form 2307 issued for creditable withholding.` }].map(c => (
              <div key={c.label} className="flex items-start gap-4 rounded-2xl bg-cdsc-paper p-6">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-cdsc-accent shadow-sm"><BadgeCheck className="h-5 w-5" /></span>
                <div>
                  <h3 className="text-sm font-bold text-cdsc-ink">{c.label}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-cdsc-ink/60">{c.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Next steps */}
      <section className="bg-white pb-24">
        <Reveal className={`grid gap-5 md:grid-cols-3 ${WRAP}`}>
          {[
            { href: '/products', title: 'Browse Products', text: 'Industrial, electrical, safety, mechanical, office and more.', photo: '/images/site/industrial-tools.jpg' },
            { href: '/industries', title: 'Industries We Serve', text: 'Manufacturing, construction, facilities, institutions and more.', photo: '/images/site/construction-site.jpg' },
            { href: '/services', title: 'Our Services', text: 'Procurement support, sourcing, bulk orders and delivery.', photo: '/images/site/logistics-port.jpg' },
          ].map(c => (
            <Link key={c.href} href={c.href} className="group relative h-56 overflow-hidden rounded-3xl">
              <Image src={c.photo} alt="" fill sizes="(min-width:768px) 33vw, 100vw" className="object-cover transition duration-700 group-hover:scale-110" />
              <div aria-hidden className="absolute inset-0 bg-linear-to-t from-cdsc-accent/90 via-cdsc-accent/30 to-transparent" />
              <div className="absolute bottom-5 left-6 right-6 text-white">
                <h3 className="flex items-center gap-2 text-xl font-black">{c.title} <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" /></h3>
                <p className="mt-1 text-sm text-white/85">{c.text}</p>
              </div>
            </Link>
          ))}
        </Reveal>
        <div className="mt-10 flex justify-center">
          <Link href="/quote" className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-cdsc-accent to-rose-500 px-7 py-3.5 font-bold text-white shadow-lg shadow-cdsc-accent/25 transition hover:-translate-y-0.5">
            <FileText className="h-4 w-4" /> Request a Quotation
          </Link>
        </div>
      </section>
    </>
  )
}
