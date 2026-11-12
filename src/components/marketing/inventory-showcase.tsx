import Image from 'next/image'
import Link from 'next/link'
import {
  LayoutDashboard, Search, ArrowDownToLine, ArrowUpFromLine, RefreshCw, CalendarCheck,
  Boxes, AlertTriangle, Truck, FileText, ArrowRight, Package,
} from 'lucide-react'
import { inventorySystem } from '@/lib/site-content'
import { Reveal } from '@/components/marketing/profile-motion'

const FEATURE_ICONS = [LayoutDashboard, Search, ArrowDownToLine, ArrowUpFromLine, RefreshCw, CalendarCheck]

// Illustrative figures for the mock screen (not live data).
const MONTHS = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov']
const IN = [62, 70, 58, 80, 74, 88]
const OUT = [48, 55, 60, 66, 59, 71]
const MOVES = [
  { item: 'Safety Helmet, Yellow', type: 'IN', qty: '+120 pcs', who: 'Receiving · RR-1042', tone: 'in' },
  { item: 'Circuit Breaker 2P 30A', type: 'OUT', qty: '−24 pcs', who: 'DR-0871 · Client A', tone: 'out' },
  { item: 'Nitrile Gloves (box)', type: 'LOW', qty: '18 left', who: 'Reorder point 25', tone: 'low' },
  { item: 'Cutting Disc 4"', type: 'OUT', qty: '−60 pcs', who: 'DR-0872 · Client B', tone: 'out' },
] as const

/** "Built-In Inventory System" — feature list + a mock of the CDSC system screen. */
export function InventorySystemShowcase() {
  return (
    <section className="relative overflow-hidden bg-white py-24 print:break-after-page">
      <div aria-hidden className="pointer-events-none absolute -right-40 top-20 h-[480px] w-[480px] rounded-full bg-cdsc-tint" />
      <div className="relative mx-auto grid w-full max-w-screen-2xl items-center gap-14 px-6 lg:grid-cols-[1fr_1.25fr] lg:px-10">
        <Reveal>
          <span className="inline-flex items-center rounded-full bg-cdsc-tint px-3.5 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-cdsc-accent">
            Smart Operations
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

          {/* Mock app window */}
          <div className="relative mr-0 mt-10 overflow-hidden rounded-[1.5rem] bg-white shadow-[0_40px_90px_-30px_rgba(15,23,42,0.45)] ring-1 ring-black/5 sm:mr-14">
            <div className="flex items-center gap-2 border-b border-cdsc-line bg-cdsc-paper px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              <span className="ml-3 truncate rounded-md bg-white px-3 py-0.5 text-[11px] text-cdsc-ink/45">portal.cdsc · Inventory</span>
            </div>
            <div className="grid grid-cols-[52px_1fr] sm:grid-cols-[150px_1fr]">
              {/* sidebar */}
              <nav aria-hidden className="space-y-1 bg-linear-to-b from-cdsc-accent to-rose-600 p-2 text-white sm:p-3">
                {[[LayoutDashboard, 'Dashboard'], [Boxes, 'Inventory'], [ArrowDownToLine, 'Stock In'], [ArrowUpFromLine, 'Stock Out'], [Truck, 'Deliveries'], [FileText, 'Reports']].map(([I, label], k) => {
                  const Ico = I as typeof Boxes
                  return (
                    <div key={label as string} className={`flex items-center gap-2 rounded-lg px-2 py-2 text-[11px] font-semibold ${k === 1 ? 'bg-white text-cdsc-accent shadow' : 'text-white/85'}`}>
                      <Ico className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">{label as string}</span>
                    </div>
                  )
                })}
              </nav>

              <div className="space-y-4 p-4 sm:p-5">
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { label: 'Items in stock', value: '1,284', Icon: Package, cls: 'text-cdsc-accent bg-cdsc-tint' },
                    { label: 'Low stock', value: '7', Icon: AlertTriangle, cls: 'text-amber-600 bg-amber-50' },
                    { label: 'Deliveries', value: '23', Icon: Truck, cls: 'text-emerald-600 bg-emerald-50' },
                  ].map(k => (
                    <div key={k.label} className="rounded-xl bg-cdsc-paper p-2.5 sm:p-3">
                      <span className={`mb-2 flex h-7 w-7 items-center justify-center rounded-lg ${k.cls}`}><k.Icon className="h-3.5 w-3.5" /></span>
                      <p className="text-base font-black text-cdsc-ink sm:text-lg">{k.value}</p>
                      <p className="text-[10px] text-cdsc-ink/50">{k.label}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl bg-cdsc-paper p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] font-bold text-cdsc-ink">Stock movement</p>
                    <div className="flex gap-3 text-[10px] text-cdsc-ink/55">
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-cdsc-accent" />In</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-slate-400" />Out</span>
                    </div>
                  </div>
                  <div className="flex h-28 items-end gap-2 sm:gap-3">
                    {MONTHS.map((m, k) => (
                      <div key={m} className="flex flex-1 flex-col items-center gap-1">
                        <div className="flex h-24 w-full items-end justify-center gap-[3px]">
                          <span className="w-1/2 max-w-3 origin-bottom rounded-t bg-cdsc-accent motion-safe:animate-grow-y" style={{ height: `${IN[k]}%`, animationDelay: `${k * 80}ms` }} />
                          <span className="w-1/2 max-w-3 origin-bottom rounded-t bg-slate-400 motion-safe:animate-grow-y" style={{ height: `${OUT[k]}%`, animationDelay: `${k * 80 + 40}ms` }} />
                        </div>
                        <span className="text-[9px] text-cdsc-ink/45">{m}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl bg-cdsc-paper p-3">
                  <p className="mb-2 text-[11px] font-bold text-cdsc-ink">Recent movements</p>
                  <ul className="space-y-1.5">
                    {MOVES.map(mv => (
                      <li key={mv.item} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[11px]">
                        <span className={`w-10 shrink-0 rounded-full py-0.5 text-center text-[9px] font-bold ${mv.tone === 'in' ? 'bg-emerald-50 text-emerald-700' : mv.tone === 'out' ? 'bg-cdsc-tint text-cdsc-accent' : 'bg-amber-50 text-amber-700'}`}>{mv.type}</span>
                        <span className="min-w-0 flex-1 truncate font-semibold text-cdsc-ink">{mv.item}</span>
                        <span className="hidden truncate text-cdsc-ink/45 sm:inline">{mv.who}</span>
                        <span className="shrink-0 font-bold tabular-nums text-cdsc-ink">{mv.qty}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] text-cdsc-ink/40 sm:mr-14">Sample screen of the CDSC client portal</p>
        </Reveal>
      </div>
    </section>
  )
}
