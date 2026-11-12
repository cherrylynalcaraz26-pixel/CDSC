import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import {
  type LucideIcon, ArrowRight, Factory, HardHat, Cog, Car, Building2, Wrench, Warehouse, Briefcase, Landmark,
  GraduationCap, HeartPulse, FlaskConical, Store, House,
} from 'lucide-react'
import { industries, additionalMarkets } from '@/lib/site-content'
import { Reveal } from '@/components/marketing/profile-motion'

export const metadata: Metadata = {
  title: 'Industries We Serve',
  description:
    'CDSC Industrial Supply supports purchasing requirements across manufacturing, construction, engineering, automotive, facilities management, institutions and more.',
}

const ICONS: Record<string, LucideIcon> = {
  Manufacturing: Factory, Construction: HardHat, Engineering: Cog, Automotive: Car,
  'Facilities Management': Building2, 'Maintenance Operations': Wrench, 'Warehousing and Logistics': Warehouse,
  'Commercial Businesses': Briefcase, 'Government and Institutions': Landmark, 'Schools and Universities': GraduationCap,
  'Hospitals and Clinics': HeartPulse, Laboratories: FlaskConical, 'Retail Establishments': Store, 'Property Management': House,
}
const FEATURED: [string, string][] = [
  ['Manufacturing', '/images/site/manufacturing-line.jpg'],
  ['Construction', '/images/site/construction-site.jpg'],
  ['Engineering', '/images/site/lab-engineer.jpg'],
  ['Warehousing & Logistics', '/images/site/logistics-port.jpg'],
]
const WRAP = 'mx-auto w-full max-w-screen-2xl px-6 lg:px-10'

export default function IndustriesPage() {
  const all = [...industries, ...additionalMarkets]
  return (
    <>
      <section className="relative overflow-hidden">
        <Image src="/images/site/construction-site.jpg" alt="" fill priority sizes="100vw" className="object-cover" />
        <div aria-hidden className="absolute inset-0 bg-linear-to-r from-cdsc-accent/95 via-red-600/85 to-rose-500/55" />
        <div className={`relative py-24 text-white ${WRAP}`}>
          <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider backdrop-blur">Industries</span>
          <h1 className="mt-5 text-4xl font-black sm:text-6xl">Industries We Serve</h1>
          <p className="mt-4 max-w-xl text-lg text-white/85">Purchasing requirements look different across sectors. Here is how CDSC supports each one.</p>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className={WRAP}>
          <Reveal className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {FEATURED.map(([label, src]) => (
              <div key={label} className="group relative h-48 overflow-hidden rounded-3xl">
                <Image src={src} alt={label} fill sizes="(min-width:1024px) 25vw, 50vw" className="object-cover transition duration-700 group-hover:scale-110" />
                <div aria-hidden className="absolute inset-0 bg-linear-to-t from-cdsc-accent/85 to-transparent" />
                <p className="absolute bottom-4 left-5 text-lg font-black text-white">{label}</p>
              </div>
            ))}
          </Reveal>

          <Reveal className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {all.map(ind => {
              const Icon = ICONS[ind.name] ?? Building2
              return (
                <div key={ind.name} className="group flex items-start gap-4 rounded-2xl bg-white p-6 shadow-[0_6px_24px_-12px_rgba(0,0,0,0.18)] transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-cdsc-accent/15">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cdsc-tint text-cdsc-accent transition group-hover:bg-linear-to-br group-hover:from-cdsc-accent group-hover:to-rose-500 group-hover:text-white"><Icon className="h-5 w-5" /></span>
                  <div>
                    <h2 className="text-base font-bold text-cdsc-ink">{ind.name}</h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-cdsc-ink/60">{ind.description}</p>
                  </div>
                </div>
              )
            })}
          </Reveal>

          <div className="mt-14 flex flex-col items-center justify-between gap-6 rounded-3xl bg-cdsc-tint px-8 py-10 text-center lg:flex-row lg:text-left">
            <div>
              <h2 className="text-xl font-black text-cdsc-ink">Don&apos;t see your industry listed?</h2>
              <p className="mt-2 text-sm text-cdsc-ink/65">We can still help — send us your requirement and we will review how CDSC can support it.</p>
            </div>
            <Link href="/quote" className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-linear-to-r from-cdsc-accent to-rose-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-cdsc-accent/25 transition hover:-translate-y-0.5">
              Send Your Requirement <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
