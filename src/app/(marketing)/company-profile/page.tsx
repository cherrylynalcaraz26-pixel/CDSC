import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  type LucideIcon,
  Target, Eye, ShieldCheck, MessageCircle, Scale, Wrench, Handshake, BadgeCheck,
  Package, Search, ClipboardList, Boxes, Truck, Puzzle, Phone, Mail, MapPin, Clock,
  ArrowRight, Check, Star, Users, Award, Zap, TrendingUp, ArrowDownToLine, ArrowUpFromLine,
  Factory, HardHat, Cog, Car, Building2, Warehouse, Briefcase, Landmark, GraduationCap,
  HeartPulse, FlaskConical, Store, House, Stethoscope, Lock, Monitor, Fan, Paintbrush,
  Armchair, Archive, LayoutDashboard, RefreshCw, CalendarCheck, ExternalLink,
} from 'lucide-react'
import { PrintButton } from '@/components/marketing/print-button'
import { Reveal, CountUp, ProgressBar } from '@/components/marketing/profile-motion'
import {
  company, productCategories, services, industries, procurementProcess, coreValues, whyCds,
  companyOverview, mission, vision, credentials, profileHero, heroStats, registration,
  additionalMarkets, extendedCatalog, furniture, inventorySystem,
} from '@/lib/site-content'

export const metadata: Metadata = {
  title: 'Company Profile',
  description:
    'The CDSC Industrial Supply company profile — overview, mission, vision, values, products, services, markets served, inventory system, and procurement process.',
}

const VALUE_ICONS = [ShieldCheck, MessageCircle, Scale, Wrench, Handshake]
const SERVICE_ICONS = [Package, Search, ClipboardList, Boxes, Truck, Puzzle]
const FURNITURE_ICONS = [Armchair, House, Archive, Briefcase]
const SYSTEM_ICONS = [LayoutDashboard, Search, ArrowDownToLine, ArrowUpFromLine, RefreshCw, CalendarCheck]

const MARKET_ICONS: Record<string, LucideIcon> = {
  Manufacturing: Factory,
  Construction: HardHat,
  Engineering: Cog,
  Automotive: Car,
  'Facilities Management': Building2,
  'Maintenance Operations': Wrench,
  'Warehousing and Logistics': Warehouse,
  'Commercial Businesses': Briefcase,
  'Government and Institutions': Landmark,
  'Schools and Universities': GraduationCap,
  'Hospitals and Clinics': HeartPulse,
  Laboratories: FlaskConical,
  'Retail Establishments': Store,
  'Property Management': House,
}

const PRODUCT_ICONS: Record<string, LucideIcon> = {
  'Industrial Supplies': Wrench,
  'Electrical Supplies': Zap,
  'Safety Supplies': HardHat,
  'Mechanical Supplies': Cog,
  'Office and Facility Supplies': Briefcase,
  'Medical Supplies': Stethoscope,
  'Security and Access': Lock,
  'IT and Electronics': Monitor,
  'Packaging and Logistics': Package,
  'Industrial Equipment': Fan,
  'Painting and Finishing': Paintbrush,
}

const allMarkets = [...industries, ...additionalMarkets]
const allProducts = [...productCategories, ...extendedCatalog]

function Badge({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <span
      className={
        dark
          ? 'inline-flex items-center gap-1.5 rounded-full border border-cdsc-accent/25 bg-cdsc-accent/10 px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-red-400'
          : 'inline-flex items-center gap-1.5 rounded-full bg-cdsc-tint px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-cdsc-accent'
      }
    >
      {children}
    </span>
  )
}

function SectionHeading({
  badge, title, intro, dark = false,
}: { badge: string; title: string; intro?: string; dark?: boolean }) {
  return (
    <div className="mx-auto mb-14 max-w-2xl text-center">
      <Badge dark={dark}>{badge}</Badge>
      <h2 className={`mt-5 text-3xl font-black leading-tight sm:text-5xl ${dark ? 'text-white' : 'text-cdsc-ink'}`}>
        {title}
      </h2>
      {intro && (
        <p className={`mt-4 text-sm leading-relaxed ${dark ? 'text-white/55' : 'text-cdsc-ink/55'}`}>{intro}</p>
      )}
    </div>
  )
}

export default function CompanyProfilePage() {
  return (
    <div className="[print-color-adjust:exact] print:text-[11px]">
      {/* ═══════════ HERO ═══════════ */}
      <section className="relative flex min-h-[calc(100vh-4rem)] items-center overflow-hidden bg-linear-to-br from-[#7a1000] via-cdsc-accent-dark to-cdsc-accent bg-[length:300%_300%] motion-safe:animate-gradient-shift print:min-h-0 print:break-after-page">
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] bg-[size:60px_60px]"
        />
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-[500px] w-[500px] rounded-full bg-white/[.08] motion-safe:animate-float" />
        <div aria-hidden className="pointer-events-none absolute -left-20 bottom-20 h-72 w-72 rounded-full bg-white/[.06] motion-safe:animate-float-slow" />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-28 pt-20">
          <div className="max-w-3xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white/90 backdrop-blur">
              <Check className="h-3.5 w-3.5 text-orange-200" /> {profileHero.badge}
            </div>

            <div className="mb-6 flex items-center gap-4">
              <div className="relative h-14 w-32 rounded-lg bg-white p-1.5">
                <Image src="/cdsc-logo.jpg" alt="CDSC Industrial Supply logo" fill className="object-contain p-1.5" priority />
              </div>
              <div className="text-white">
                <p className="text-sm font-bold">{company.name}</p>
                <p className="text-xs italic text-white/65">&ldquo;{company.tagline}&rdquo;</p>
              </div>
            </div>

            <h1 className="text-5xl font-black leading-[1.05] tracking-tight text-white sm:text-7xl">
              {profileHero.headline[0]}
              <br />
              <span className="text-orange-200">{profileHero.headline[1]}</span>
              <br />
              {profileHero.headline[2]}
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">{profileHero.description}</p>

            <div className="mt-10 flex flex-wrap gap-4 print:hidden">
              <Link
                href="/inquiry"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-3.5 font-bold text-cdsc-accent shadow-lg transition hover:-translate-y-0.5 hover:bg-cdsc-tint"
              >
                Request a Quote <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href={company.phoneHref}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-8 py-3.5 font-bold text-white backdrop-blur transition hover:bg-white/20"
              >
                <Phone className="h-4 w-4" /> Talk to Us
              </a>
              <PrintButton className="rounded-2xl border border-white/25 bg-transparent px-8 hover:bg-white/10" />
            </div>

            <div className="mt-16 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {heroStats.map(s => (
                <div key={s.label} className="rounded-2xl border border-white/15 bg-white/[.08] p-4 text-center backdrop-blur-md">
                  <div className="text-3xl font-black text-white">
                    {s.animate ? <CountUp to={s.value} suffix={s.suffix} /> : `${s.value}${s.suffix}`}
                  </div>
                  <div className="mt-1 text-[0.65rem] font-semibold uppercase tracking-wider text-white/55">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <svg aria-hidden className="absolute inset-x-0 bottom-0 block h-20 w-full" viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="white" />
        </svg>
      </section>

      {/* ═══════════ ABOUT / OVERVIEW ═══════════ */}
      <section className="bg-white py-24 print:break-after-page">
        <Reveal className="mx-auto grid max-w-7xl items-center gap-16 px-6 lg:grid-cols-2">
          <div>
            <Badge><Star className="h-3 w-3 fill-current" /> About CDSC</Badge>
            <h2 className="mt-5 text-3xl font-black leading-tight text-cdsc-ink sm:text-5xl">
              Your Trusted
              <br />
              <span className="text-cdsc-accent">Industrial Partner</span>
            </h2>
            {companyOverview.map(p => (
              <p key={p.slice(0, 24)} className="mt-5 text-[0.95rem] leading-relaxed text-cdsc-ink/70">{p}</p>
            ))}
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { Icon: ShieldCheck, text: `DTI Reg. No. ${registration.dtiNo}` },
                { Icon: BadgeCheck, text: `TIN: ${registration.tin}` },
                { Icon: Users, text: registration.clientTypes },
                { Icon: Award, text: 'Sto. Tomas, Batangas' },
              ].map(({ Icon, text }) => (
                <div key={text} className="flex items-center gap-2.5 rounded-xl bg-cdsc-paper p-3">
                  <Icon className="h-4 w-4 shrink-0 text-cdsc-accent" />
                  <span className="text-xs font-semibold text-cdsc-ink/75">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div aria-hidden className="absolute inset-0 rotate-2 rounded-3xl bg-linear-to-br from-cdsc-tint to-red-100" />
            <div className="relative rounded-3xl border border-cdsc-line bg-white p-8 shadow-xl">
              <div className="mb-6 flex items-center gap-3 border-b border-cdsc-line pb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cdsc-accent">
                  <Briefcase className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-cdsc-ink">{registration.proprietor}</p>
                  <p className="text-xs text-cdsc-ink/50">{registration.proprietorTitle}</p>
                </div>
              </div>
              <dl>
                {[
                  ['Business Type', company.businessType],
                  ['Industry', company.industry],
                  ['VAT Status', company.vatRegistered ? 'VAT Registered' : 'Non-VAT'],
                  ['Address', company.addressFull],
                  ['Email', company.email],
                  ['Phone', company.phone],
                ].map(([k, v], i, arr) => (
                  <div key={k} className={`flex justify-between gap-4 py-3 ${i < arr.length - 1 ? 'border-b border-cdsc-paper' : ''}`}>
                    <dt className="text-xs text-cdsc-ink/50">{k}</dt>
                    <dd className="text-right text-xs font-semibold text-cdsc-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══════════ MISSION / VISION / VALUES ═══════════ */}
      <section className="bg-black py-24 print:break-after-page">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <SectionHeading dark badge="Why CDSC" title="Mission & Vision" />
          </Reveal>
          <Reveal className="grid gap-6 md:grid-cols-2">
            {[
              { Icon: Target, title: 'Our Mission', text: mission, iconBg: 'bg-linear-to-br from-cdsc-accent to-cdsc-accent-dark shadow-lg shadow-cdsc-accent/30' },
              { Icon: Eye, title: 'Our Vision', text: vision, iconBg: 'bg-linear-to-br from-neutral-600 to-neutral-900' },
            ].map(({ Icon, title, text, iconBg }) => (
              <div
                key={title}
                className="relative overflow-hidden rounded-3xl border border-white/[.07] bg-white/[.04] p-8 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-cdsc-accent/20"
              >
                <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl ${iconBg}`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="mb-4 text-2xl font-black text-white">{title}</h3>
                <p className="text-sm leading-relaxed text-white/60">{text}</p>
                <div aria-hidden className="absolute right-0 top-0 h-36 w-36 rounded-bl-full bg-cdsc-accent/[.08]" />
              </div>
            ))}
          </Reveal>

          <Reveal className="mt-14">
            <h3 className="mb-6 text-center text-sm font-bold uppercase tracking-widest text-white/50">Core Values</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {coreValues.map((v, i) => {
                const Icon = VALUE_ICONS[i]
                return (
                  <div key={v.title} className="group rounded-2xl border border-white/[.07] bg-white/[.03] p-5 text-center transition hover:-translate-y-1">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-cdsc-accent/15 text-red-400 transition group-hover:bg-cdsc-accent group-hover:text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mt-3 text-sm font-bold text-white">{v.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/55">{v.description}</p>
                  </div>
                )
              })}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ MARKETS / INDUSTRIES ═══════════ */}
      <section className="bg-white py-24 print:break-after-page">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <SectionHeading
              badge="Who We Serve"
              title="Industries & Markets We Serve"
              intro="From startup offices to large industrial operations, we have the supplies to support your business."
            />
          </Reveal>
          <Reveal className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {allMarkets.map(m => {
              const Icon = MARKET_ICONS[m.name] ?? Building2
              return (
                <div
                  key={m.name}
                  className="group flex items-start gap-4 rounded-2xl border border-cdsc-line bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-cdsc-accent hover:shadow-xl hover:shadow-cdsc-accent/15"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cdsc-tint text-cdsc-accent transition group-hover:bg-cdsc-accent group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-cdsc-ink">{m.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-cdsc-ink/55">{m.description}</p>
                  </div>
                </div>
              )
            })}
          </Reveal>
        </div>
      </section>

      {/* ═══════════ PRODUCTS ═══════════ */}
      <section className="bg-cdsc-paper py-24 print:break-after-page">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <SectionHeading
              badge="Product Catalog"
              title="What We Carry"
              intro="A comprehensive catalog spanning industrial, office, and operational needs — all from one supplier."
            />
          </Reveal>
          <Reveal className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {allProducts.map(p => {
              const Icon = PRODUCT_ICONS[p.name] ?? Package
              return (
                <div
                  key={p.name}
                  className="group rounded-2xl border border-cdsc-line bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-cdsc-accent hover:shadow-xl"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-cdsc-tint text-cdsc-accent transition group-hover:bg-cdsc-accent group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-2.5 text-sm font-bold text-cdsc-ink">{p.name}</h3>
                  <ul className="space-y-1.5">
                    {p.items.map(item => (
                      <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-cdsc-ink/65">
                        <Check className="mt-0.5 h-3 w-3 shrink-0 text-cdsc-accent" strokeWidth={3} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </Reveal>
        </div>
      </section>

      {/* ═══════════ FURNITURE ═══════════ */}
      <section className="bg-white py-24 print:break-after-page">
        <Reveal className="mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-2">
          <div className="relative">
            <div aria-hidden className="absolute inset-0 -rotate-2 rounded-3xl bg-linear-to-br from-cdsc-tint to-red-100" />
            <div className="relative grid grid-cols-2 gap-4 p-6">
              {furniture.tiles.map((t, i) => {
                const Icon = FURNITURE_ICONS[i]
                return (
                  <div key={t} className="rounded-2xl border border-cdsc-tint bg-white p-5 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-cdsc-accent/20">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-cdsc-accent">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-xs font-semibold text-cdsc-ink/75">{t}</p>
                  </div>
                )
              })}
            </div>
          </div>
          <div>
            <Badge>Furniture &amp; Fixtures</Badge>
            <h2 className="mt-5 text-3xl font-black leading-tight text-cdsc-ink sm:text-5xl">
              Office Furniture &amp; Workspace Solutions
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-cdsc-ink/70">{furniture.description}</p>
            <ul className="mt-7 space-y-3">
              {furniture.items.map(item => (
                <li key={item} className="flex items-center gap-3 text-sm text-cdsc-ink/75">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-cdsc-tint">
                    <Check className="h-3.5 w-3.5 text-cdsc-accent" strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/inquiry"
              className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-cdsc-accent px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-cdsc-accent/30 transition hover:-translate-y-0.5 hover:bg-cdsc-accent-dark print:hidden"
            >
              Inquire About Furniture <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ═══════════ SERVICES ═══════════ */}
      <section className="bg-cdsc-paper py-24 print:break-after-page">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <SectionHeading badge="What We Do" title="Our Services" />
          </Reveal>
          <Reveal className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s, i) => {
              const Icon = SERVICE_ICONS[i]
              return (
                <div key={s.title} className="group rounded-2xl border border-cdsc-line bg-white p-6 transition hover:-translate-y-1 hover:border-cdsc-accent hover:shadow-xl">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-cdsc-tint text-cdsc-accent transition group-hover:bg-cdsc-accent group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-bold text-cdsc-ink">{s.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-cdsc-ink/60">{s.description}</p>
                </div>
              )
            })}
          </Reveal>
        </div>
      </section>

      {/* ═══════════ PROCUREMENT PROCESS ═══════════ */}
      <section className="bg-white py-24 print:break-after-page">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <SectionHeading badge="How It Works" title="Procurement Process" />
          </Reveal>
          <Reveal className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {procurementProcess.map(step => (
              <div key={step.step} className="relative rounded-2xl border border-cdsc-line p-6">
                <span className="text-4xl font-black text-cdsc-accent/20">{step.step}</span>
                <h3 className="mt-2 text-sm font-bold text-cdsc-ink">{step.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-cdsc-ink/60">{step.description}</p>
                <div aria-hidden className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-cdsc-accent" />
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ═══════════ INVENTORY SYSTEM ═══════════ */}
      <section className="bg-black py-24 print:break-after-page">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <SectionHeading dark badge="Smart Operations" title="Built-In Inventory System" intro={inventorySystem.description} />
          </Reveal>

          <Reveal className="mb-9 grid gap-6 md:grid-cols-2">
            {([
              { tone: 'in', label: 'Stock IN', Icon: ArrowDownToLine, bars: inventorySystem.stockIn },
              { tone: 'out', label: 'Stock OUT', Icon: ArrowUpFromLine, bars: inventorySystem.stockOut },
            ] as const).map(({ tone, label, Icon, bars }) => (
              <div key={label} className="rounded-3xl border border-white/[.07] bg-white/[.04] p-7">
                <div className="mb-6 flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone === 'in' ? 'bg-linear-to-br from-green-600 to-green-500' : 'bg-linear-to-br from-cdsc-accent-dark to-cdsc-accent'}`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${tone === 'in' ? 'border-green-500/20 bg-green-500/10 text-green-400' : 'border-cdsc-accent/20 bg-cdsc-accent/10 text-red-400'}`}>
                    {label}
                  </span>
                </div>
                <div className="space-y-4">
                  {bars.map(b => (
                    <div key={b.label}>
                      <div className="mb-1.5 flex justify-between text-xs">
                        <span className="text-white/55">{b.label}</span>
                        <span className="font-bold text-white">{b.percent}%</span>
                      </div>
                      <ProgressBar percent={b.percent} tone={tone} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Reveal>

          <Reveal className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {inventorySystem.features.map((f, i) => {
              const Icon = SYSTEM_ICONS[i]
              return (
                <div key={f.title} className="group rounded-2xl border border-white/[.07] bg-white/[.03] p-6 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-cdsc-accent/15">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-cdsc-accent/10 text-red-400 transition group-hover:bg-cdsc-accent group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mb-2 text-sm font-bold text-white">{f.title}</h3>
                  <p className="text-xs leading-relaxed text-white/55">{f.description}</p>
                </div>
              )
            })}
          </Reveal>
        </div>
      </section>

      {/* ═══════════ WHY CDSC + CREDENTIALS ═══════════ */}
      <section className="bg-cdsc-paper py-24 print:break-after-page">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <SectionHeading badge="Our Edge" title="Why Choose CDSC" />
          </Reveal>
          <Reveal className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {whyCds.map(card => (
              <div key={card.title} className="rounded-2xl border border-cdsc-line bg-white p-6 transition hover:-translate-y-1 hover:border-cdsc-accent hover:shadow-xl">
                <TrendingUp className="h-5 w-5 text-cdsc-accent" />
                <h3 className="mt-3 text-sm font-bold text-cdsc-ink">{card.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-cdsc-ink/60">{card.description}</p>
              </div>
            ))}
          </Reveal>

          <Reveal className="mt-16">
            <h3 className="mb-6 text-center text-xl font-black text-cdsc-ink">Credentials &amp; Accreditation</h3>
            <div className="grid gap-5 sm:grid-cols-2">
              {credentials.map(c => (
                <div key={c.label} className="flex items-start gap-3 rounded-2xl border border-cdsc-line bg-white p-6">
                  <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-cdsc-accent" />
                  <div>
                    <h4 className="text-sm font-bold text-cdsc-ink">{c.label}</h4>
                    <p className="mt-1.5 text-xs leading-relaxed text-cdsc-ink/60">{c.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 text-center text-xs text-cdsc-ink/55">
              DTI Reg. No. {registration.dtiNo} &middot; TIN {registration.tin}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ CONTACT ═══════════ */}
      <section className="bg-white py-24">
        <Reveal className="mx-auto max-w-7xl px-6">
          <div className="relative mb-12 overflow-hidden rounded-[28px] bg-linear-to-br from-[#7a1000] via-cdsc-accent to-cdsc-accent bg-[length:200%_200%] shadow-2xl motion-safe:animate-gradient-shift">
            <div className="relative bg-[linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] bg-[size:40px_40px] px-6 py-10 sm:p-16">
              <div className="relative z-10 max-w-xl">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-white/90">
                  <Zap className="h-3 w-3" /> Ready to Order?
                </span>
                <h2 className="mt-6 text-4xl font-black leading-tight text-white sm:text-5xl">Let&apos;s Talk Supply.</h2>
                <p className="mt-4 max-w-md leading-relaxed text-white/80">
                  Tell us what your business needs and we&apos;ll put together a quote that fits your volume, budget, and timeline.
                </p>
                <div className="mt-9 flex flex-wrap gap-4 print:hidden">
                  <Link
                    href="/inquiry"
                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-3.5 font-bold text-cdsc-accent shadow-lg transition hover:-translate-y-0.5 hover:bg-cdsc-tint"
                  >
                    Submit an Inquiry <ExternalLink className="h-4 w-4" />
                  </Link>
                  <a
                    href={company.phoneHref}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-8 py-3.5 font-bold text-white backdrop-blur transition hover:bg-white/20"
                  >
                    <Phone className="h-4 w-4" /> Talk to Us Now
                  </a>
                </div>
              </div>
              <div aria-hidden className="absolute right-6 top-6 h-44 w-44 rounded-full bg-white/[.06] motion-safe:animate-float" />
              <div aria-hidden className="absolute bottom-4 right-32 h-24 w-24 rounded-full bg-white/[.05] motion-safe:animate-float-slow" />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { Icon: Phone, label: 'Call / SMS', value: company.phone, href: company.phoneHref, cta: 'Call Now' },
              { Icon: Mail, label: 'Email Us', value: company.email, href: company.emailHref, cta: 'Send Email' },
              { Icon: MapPin, label: 'Location', value: company.addressFull },
              { Icon: Clock, label: 'Business Hours', value: registration.businessHours.join(' · ') },
            ].map(({ Icon, label, value, href, cta }) => (
              <div key={label} className="rounded-2xl border border-cdsc-line bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-cdsc-accent hover:shadow-xl">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-cdsc-tint">
                  <Icon className="h-4 w-4 text-cdsc-accent" />
                </div>
                <p className="mb-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-cdsc-ink/45">{label}</p>
                <p className="break-words text-sm font-semibold leading-snug text-cdsc-ink">{value}</p>
                {href && cta && (
                  <a href={href} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-cdsc-accent print:hidden">
                    {cta} <ArrowRight className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>

          <div className="mt-12 flex justify-center">
            <PrintButton label="Download / Print This Profile" className="rounded-2xl px-8 font-bold shadow-lg shadow-cdsc-accent/30" />
          </div>
        </Reveal>
      </section>
    </div>
  )
}
