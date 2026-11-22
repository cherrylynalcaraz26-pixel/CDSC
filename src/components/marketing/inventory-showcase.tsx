import Image from 'next/image'
import Link from 'next/link'
import {
  LayoutDashboard, ClipboardList, Truck, Package, Boxes, Receipt, ArrowRight,
} from 'lucide-react'
import { inventorySystem } from '@/lib/site-content'
import { Reveal } from '@/components/marketing/profile-motion'
import { PortalPreview } from '@/components/marketing/portal-preview'

// One icon per portal feature, in the order of inventorySystem.features.
const FEATURE_ICONS = [LayoutDashboard, ClipboardList, Truck, Package, Boxes, Receipt]

/** "Built-In Inventory System" — what clients get in the CDSC Client Portal, with a clickable preview. */
export function InventorySystemShowcase() {
  return (
    <section className="relative overflow-hidden bg-white py-24 print:break-after-page">
      <div aria-hidden className="pointer-events-none absolute -right-40 top-20 h-[480px] w-[480px] rounded-full bg-cdsc-tint" />
      <div className="relative mx-auto grid w-full max-w-screen-2xl items-center gap-14 px-6 lg:grid-cols-[1fr_1.25fr] lg:px-10">
        <Reveal>
          <span className="inline-flex items-center rounded-full bg-cdsc-tint px-3.5 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-cdsc-accent">
            Client Portal
          </span>
          <h2 className="mt-5 text-3xl font-black leading-tight text-cdsc-ink sm:text-5xl">
            Built-In <span className="text-cdsc-accent">Inventory System</span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-cdsc-ink/65">{inventorySystem.description}</p>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {inventorySystem.features.map((f, i) => {
              const Icon = FEATURE_ICONS[i] ?? Boxes
              return (
                <li key={f.title} className="group flex gap-3 rounded-2xl p-3 transition hover:bg-cdsc-tint/70">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-cdsc-accent to-rose-500 text-white shadow-md shadow-cdsc-accent/25 transition group-hover:scale-110">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-cdsc-ink">{f.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-cdsc-ink/60">{f.description}</span>
                  </span>
                </li>
              )
            })}
          </ul>
          <Link href="/inquiry" className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-cdsc-accent to-rose-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-cdsc-accent/25 transition hover:-translate-y-0.5 print:hidden">
            Ask About Client Portal Access <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>

        <Reveal className="relative">
          {/* Photo behind the screen */}
          <div className="absolute -right-4 -top-6 hidden h-[78%] w-[62%] overflow-hidden rounded-[2rem] sm:block">
            <Image src="/images/site/warehouse-shelves.jpg" alt="" fill sizes="40vw" className="object-cover" />
            <div aria-hidden className="absolute inset-0 bg-cdsc-accent/25" />
          </div>

          <PortalPreview />
          <p className="mt-3 text-center text-[11px] text-cdsc-ink/40 sm:mr-14">Preview of the CDSC Client Portal. Click a menu item to see each screen.</p>
        </Reveal>
      </div>
    </section>
  )
}
