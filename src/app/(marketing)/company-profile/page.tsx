import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import {
  Target, Eye, ShieldCheck, MessageCircle, Scale, Wrench, Handshake, BadgeCheck,
  Package, Search, ClipboardList, Boxes, Truck, Puzzle, Phone, Mail, MapPin,
} from 'lucide-react'
import { PrintButton } from '@/components/marketing/print-button'
import {
  company, productCategories, services, industries, procurementProcess, coreValues, whyCds,
  companyOverview, mission, vision, credentials,
} from '@/lib/site-content'

export const metadata: Metadata = {
  title: 'Company Profile',
  description:
    'The CDSC Industrial Supply company profile — overview, mission, vision, values, products, services, industries served, and procurement process.',
}

const VALUE_ICONS = [ShieldCheck, MessageCircle, Scale, Wrench, Handshake]
const SERVICE_ICONS = [Package, Search, ClipboardList, Boxes, Truck, Puzzle]

export default function CompanyProfilePage() {
  return (
    <div className="print:text-[11px]">
      {/* COVER */}
      <section className="border-b border-cdsc-line bg-cdsc-tint print:break-after-page">
        <div className="mx-auto flex max-w-4xl flex-col items-center px-6 py-24 text-center">
          <div className="relative h-20 w-44 rounded border border-cdsc-line bg-white p-2">
            <Image src="/cdsc-logo.jpg" alt="CDSC Industrial Supply logo" fill className="object-contain p-2" />
          </div>
          <h1 className="mt-8 text-3xl font-semibold text-cdsc-ink sm:text-4xl">{company.name}</h1>
          <p className="mt-1 text-sm text-cdsc-ink/50">{company.legalName}</p>
          <p className="mt-3 text-lg italic text-cdsc-ink/65">&ldquo;{company.tagline}&rdquo;</p>
          <p className="mt-6 text-sm uppercase tracking-widest text-cdsc-accent">Industrial Supply &middot; Procurement &middot; Sourcing</p>
          <div className="mt-8">
            <PrintButton />
          </div>
        </div>
      </section>

      {/* COMPANY OVERVIEW */}
      <section className="mx-auto max-w-4xl px-6 py-16 print:break-after-page">
        <h2 className="text-xl font-semibold text-cdsc-ink">Company Overview</h2>
        {companyOverview.map(p => (
          <p key={p.slice(0, 24)} className="mt-4 text-base leading-relaxed text-cdsc-ink/70">{p}</p>
        ))}

        <div className="mt-8 grid grid-cols-2 gap-4 rounded-lg border border-cdsc-line bg-cdsc-paper p-5 sm:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cdsc-ink/50">Business Type</p>
            <p className="mt-1 text-sm text-cdsc-ink">{company.businessType}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cdsc-ink/50">Industry</p>
            <p className="mt-1 text-sm text-cdsc-ink">{company.industry}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cdsc-ink/50">VAT Status</p>
            <p className="mt-1 text-sm text-cdsc-ink">{company.vatRegistered ? 'VAT Registered' : 'Non-VAT'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cdsc-ink/50">Location</p>
            <p className="mt-1 text-sm text-cdsc-ink">Sto. Tomas, Batangas</p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-cdsc-line p-6">
            <Target className="h-6 w-6 text-cdsc-navy" />
            <h3 className="mt-3 text-base font-semibold text-cdsc-ink">Our Mission</h3>
            <p className="mt-2 text-sm leading-relaxed text-cdsc-ink/65">{mission}</p>
          </div>
          <div className="rounded-lg border border-cdsc-line p-6">
            <Eye className="h-6 w-6 text-cdsc-navy" />
            <h3 className="mt-3 text-base font-semibold text-cdsc-ink">Our Vision</h3>
            <p className="mt-2 text-sm leading-relaxed text-cdsc-ink/65">{vision}</p>
          </div>
        </div>

        <h3 className="mt-12 text-base font-semibold text-cdsc-ink">Core Values</h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {coreValues.map((v, i) => {
            const Icon = VALUE_ICONS[i]
            return (
              <div key={v.title} className="rounded-lg border border-cdsc-line p-4 text-center">
                <Icon className="mx-auto h-5 w-5 text-cdsc-accent-dark" />
                <p className="mt-2 text-sm font-semibold text-cdsc-ink">{v.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-cdsc-ink/60">{v.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* PRODUCTS */}
      <section className="border-t border-cdsc-line bg-cdsc-paper px-6 py-16 print:break-after-page">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-xl font-semibold text-cdsc-ink">Products</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {productCategories.map(cat => (
              <div key={cat.name} className="rounded-lg border border-cdsc-line bg-white p-5">
                <h3 className="text-sm font-semibold text-cdsc-ink">{cat.name}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-cdsc-ink/60">{cat.items.join(' · ')}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="mx-auto max-w-4xl px-6 py-16 print:break-after-page">
        <h2 className="text-xl font-semibold text-cdsc-ink">Services</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {services.map((s, i) => {
            const Icon = SERVICE_ICONS[i]
            return (
              <div key={s.title} className="rounded-lg border border-cdsc-line p-5">
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 text-cdsc-accent-dark" />
                  <h3 className="text-sm font-semibold text-cdsc-ink">{s.title}</h3>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-cdsc-ink/60">{s.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* INDUSTRIES SERVED */}
      <section className="border-t border-cdsc-line bg-cdsc-paper px-6 py-16 print:break-after-page">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-xl font-semibold text-cdsc-ink">Industries Served</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {industries.map(ind => (
              <div key={ind.name} className="rounded-lg border border-cdsc-line bg-white px-4 py-3 text-center">
                <p className="text-sm font-medium text-cdsc-ink">{ind.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROCUREMENT PROCESS */}
      <section className="mx-auto max-w-4xl px-6 py-16 print:break-after-page">
        <h2 className="text-xl font-semibold text-cdsc-ink">Procurement Process</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {procurementProcess.map(step => (
            <div key={step.step} className="border-l-2 border-cdsc-accent pl-4">
              <span className="text-xs font-semibold text-cdsc-accent-dark">{step.step}</span>
              <h3 className="mt-1.5 text-sm font-semibold text-cdsc-ink">{step.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-cdsc-ink/60">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WHY CDSC */}
      <section className="border-t border-cdsc-line bg-cdsc-paper px-6 py-16 print:break-after-page">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-xl font-semibold text-cdsc-ink">Why CDSC</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {whyCds.map(card => (
              <div key={card.title} className="rounded-lg border border-cdsc-line bg-white p-5">
                <h3 className="text-sm font-semibold text-cdsc-ink">{card.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-cdsc-ink/60">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CREDENTIALS & ACCREDITATION */}
      <section className="border-t border-cdsc-line bg-cdsc-paper px-6 py-16 print:break-after-page">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-xl font-semibold text-cdsc-ink">Credentials &amp; Accreditation</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {credentials.map(c => (
              <div key={c.label} className="flex items-start gap-3 rounded-lg border border-cdsc-line bg-white p-5">
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-cdsc-accent-dark" />
                <div>
                  <h3 className="text-sm font-semibold text-cdsc-ink">{c.label}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-cdsc-ink/60">{c.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT INFORMATION */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <h2 className="text-xl font-semibold text-cdsc-ink">Contact Information</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="flex items-start gap-3 rounded-lg border border-cdsc-line p-5">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-cdsc-accent-dark" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-cdsc-ink/50">Address</p>
              <p className="mt-1 text-sm text-cdsc-ink">{company.addressLine1}<br />{company.addressLine2}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-cdsc-line p-5">
            <Phone className="mt-0.5 h-5 w-5 shrink-0 text-cdsc-accent-dark" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-cdsc-ink/50">Phone</p>
              <p className="mt-1 text-sm text-cdsc-ink">{company.phone}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-cdsc-line p-5">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-cdsc-accent-dark" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-cdsc-ink/50">Email</p>
              <p className="mt-1 text-sm text-cdsc-ink">{company.email}</p>
            </div>
          </div>
        </div>
        <div className="mt-10 flex justify-center">
          <PrintButton label="Download / Print This Profile" />
        </div>
        <p className="mt-6 text-center text-xs text-cdsc-ink/35 print:hidden">
          <Link href="/login" className="hover:text-cdsc-navy hover:underline">Staff Login</Link>
        </p>
      </section>
    </div>
  )
}
