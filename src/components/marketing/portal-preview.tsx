'use client'

// Website → Built-In Inventory System. A clickable preview of the real CDSC
// Client Portal: the sidebar matches the portal's own menu (Dashboard,
// Quotations, My Orders, Browse Catalog, My Stock, Account) and each item shows
// a sample of that screen. Figures are illustrative, not live data.

import { useEffect, useState } from 'react'
import {
  LayoutDashboard, ClipboardList, FileText, Package, Boxes, User, Truck, AlertTriangle,
  CheckCircle2, Clock, Search, ShoppingCart, Receipt, MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const MENU = [
  { key: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { key: 'quotations', label: 'Quotations', Icon: ClipboardList },
  { key: 'orders', label: 'My Orders', Icon: FileText },
  { key: 'catalog', label: 'Browse Catalog', Icon: Package },
  { key: 'stock', label: 'My Stock', Icon: Boxes },
  { key: 'account', label: 'Account', Icon: User },
] as const
type Key = typeof MENU[number]['key']

const pill = (tone: 'green' | 'amber' | 'red' | 'blue' | 'gray') => ({
  green: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-cdsc-tint text-cdsc-accent',
  blue: 'bg-sky-50 text-sky-700', gray: 'bg-slate-100 text-slate-600',
})[tone]

function Row({ a, b, c, tone, tag }: { a: string; b?: string; c: string; tone: Parameters<typeof pill>[0]; tag: string }) {
  return (
    <li className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[11px]">
      <span className={cn('w-16 shrink-0 rounded-full py-0.5 text-center text-[9px] font-bold', pill(tone))}>{tag}</span>
      <span className="min-w-0 flex-1 truncate font-semibold text-cdsc-ink">{a}</span>
      {b && <span className="hidden truncate text-cdsc-ink/45 sm:inline">{b}</span>}
      <span className="shrink-0 font-bold tabular-nums text-cdsc-ink">{c}</span>
    </li>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-cdsc-paper p-3">
      <p className="mb-2 text-[11px] font-bold text-cdsc-ink">{title}</p>
      {children}
    </div>
  )
}

function Kpis({ items }: { items: { label: string; value: string; Icon: typeof Boxes; cls: string }[] }) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {items.map(k => (
        <div key={k.label} className="rounded-xl bg-cdsc-paper p-2.5 sm:p-3">
          <span className={cn('mb-2 flex h-7 w-7 items-center justify-center rounded-lg', k.cls)}><k.Icon className="h-3.5 w-3.5" /></span>
          <p className="text-base font-black text-cdsc-ink sm:text-lg">{k.value}</p>
          <p className="text-[10px] text-cdsc-ink/50">{k.label}</p>
        </div>
      ))}
    </div>
  )
}

const SCREENS: Record<Key, () => React.ReactNode> = {
  dashboard: () => (
    <>
      <Kpis items={[
        { label: 'Open orders', value: '4', Icon: FileText, cls: 'text-cdsc-accent bg-cdsc-tint' },
        { label: 'Deliveries this month', value: '11', Icon: Truck, cls: 'text-emerald-600 bg-emerald-50' },
        { label: 'Low stock items', value: '3', Icon: AlertTriangle, cls: 'text-amber-600 bg-amber-50' },
      ]} />
      <Panel title="Recent orders">
        <ul className="space-y-1.5">
          <Row tag="DELIVERED" tone="green" a="SO-2026-0418 · PPE replenishment" b="DR-0871" c="₱48,600" />
          <Row tag="PARTIAL" tone="amber" a="SO-2026-0421 · Electrical parts" b="DR-0874" c="₱126,300" />
          <Row tag="PROCESSING" tone="blue" a="SO-2026-0430 · Fasteners" c="₱18,950" />
        </ul>
      </Panel>
    </>
  ),
  quotations: () => (
    <>
      <div className="flex items-center justify-between rounded-xl bg-cdsc-paper p-3">
        <div>
          <p className="text-[11px] font-bold text-cdsc-ink">Request a quotation</p>
          <p className="text-[10px] text-cdsc-ink/50">List the items and quantities. We reply with prices and lead times.</p>
        </div>
        <span className="rounded-lg bg-cdsc-accent px-2.5 py-1 text-[10px] font-bold text-white">+ New</span>
      </div>
      <Panel title="Quotations">
        <ul className="space-y-1.5">
          <Row tag="FOR REVIEW" tone="amber" a="QT-2026-0112 · Safety shoes, 80 pairs" c="₱92,000" />
          <Row tag="ACCEPTED" tone="green" a="QT-2026-0108 · Circuit breakers" c="₱34,750" />
          <Row tag="REQUESTED" tone="gray" a="RFQ-0057 · Cutting discs and grinders" c="Pending" />
        </ul>
      </Panel>
    </>
  ),
  orders: () => (
    <>
      <Panel title="SO-2026-0421 · Electrical parts">
        <div className="mb-2 flex items-center gap-1.5 text-[10px]">
          {['Ordered', 'Prepared', 'Delivered', 'Received'].map((s, i) => (
            <span key={s} className="flex flex-1 items-center gap-1">
              <span className={cn('flex h-4 w-4 items-center justify-center rounded-full', i < 3 ? 'bg-cdsc-accent text-white' : 'bg-slate-200 text-slate-500')}>
                {i < 3 ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-2.5 w-2.5" />}
              </span>
              <span className="truncate text-cdsc-ink/60">{s}</span>
            </span>
          ))}
        </div>
        <ul className="space-y-1.5">
          <Row tag="RECEIVED" tone="green" a="DR-0874 · 3 of 5 items" b="Accepted by M. Reyes" c="Nov 18" />
          <Row tag="IN TRANSIT" tone="blue" a="DR-0879 · remaining 2 items" c="Nov 24" />
        </ul>
      </Panel>
      <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-[11px] ring-1 ring-cdsc-line">
        <span className="font-semibold text-cdsc-ink">DR-0879 arrived?</span>
        <span className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white">Confirm Receipt</span>
      </div>
    </>
  ),
  catalog: () => (
    <>
      <div className="flex items-center gap-2 rounded-xl bg-cdsc-paper px-3 py-2 text-[11px] text-cdsc-ink/45">
        <Search className="h-3.5 w-3.5" /> Search 1,200+ items…
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {[
          ['Safety Helmet, Yellow', 'PPE', 'pc'], ['Nitrile Gloves', 'PPE', 'box'],
          ['Circuit Breaker 2P 30A', 'Electrical', 'pc'], ['Cutting Disc 4"', 'Tools', 'pc'],
        ].map(([n, c, u]) => (
          <div key={n} className="rounded-xl bg-cdsc-paper p-2.5">
            <span className="mb-2 flex h-10 items-center justify-center rounded-lg bg-white text-cdsc-ink/25"><Package className="h-5 w-5" /></span>
            <p className="truncate text-[11px] font-semibold text-cdsc-ink">{n}</p>
            <div className="mt-1 flex items-center justify-between text-[10px] text-cdsc-ink/50">
              <span>{c} · per {u}</span>
              <ShoppingCart className="h-3 w-3 text-cdsc-accent" />
            </div>
          </div>
        ))}
      </div>
    </>
  ),
  stock: () => (
    <>
      <Kpis items={[
        { label: 'Items on hand', value: '86', Icon: Boxes, cls: 'text-cdsc-accent bg-cdsc-tint' },
        { label: 'Issued this month', value: '412', Icon: FileText, cls: 'text-sky-600 bg-sky-50' },
        { label: 'Below alert level', value: '3', Icon: AlertTriangle, cls: 'text-amber-600 bg-amber-50' },
      ]} />
      <Panel title="Stock movement">
        <ul className="space-y-1.5">
          <Row tag="RECEIVED" tone="green" a="Safety Helmet, Yellow" b="From DR-0871" c="+120 pcs" />
          <Row tag="ISSUED" tone="red" a="Nitrile Gloves (box)" b="Production, Line 2" c="−12 box" />
          <Row tag="LOW" tone="amber" a="Ear Plugs (pair)" b="Alert at 50" c="18 left" />
        </ul>
      </Panel>
    </>
  ),
  account: () => (
    <>
      <Panel title="Sales invoices">
        <ul className="space-y-1.5">
          <Row tag="UNPAID" tone="amber" a="SI 004512 · SO-2026-0421" c="₱126,300" />
          <Row tag="PAID" tone="green" a="SI 004498 · SO-2026-0418" c="₱48,600" />
        </ul>
      </Panel>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-cdsc-paper p-3">
          <Receipt className="mb-1.5 h-4 w-4 text-cdsc-accent" />
          <p className="text-[11px] font-bold text-cdsc-ink">Company profile</p>
          <p className="text-[10px] text-cdsc-ink/50">Address, TIN, contacts and portal users</p>
        </div>
        <div className="rounded-xl bg-cdsc-paper p-3">
          <MessageSquare className="mb-1.5 h-4 w-4 text-cdsc-accent" />
          <p className="text-[11px] font-bold text-cdsc-ink">Messages</p>
          <p className="text-[10px] text-cdsc-ink/50">Chat with the CDSC team, with attachments</p>
        </div>
      </div>
    </>
  ),
}

export function PortalPreview() {
  const [active, setActive] = useState<Key>('dashboard')
  const [auto, setAuto] = useState(true)

  // Cycles through the screens until the visitor clicks one.
  useEffect(() => {
    if (!auto) return
    const t = setInterval(() => setActive(a => MENU[(MENU.findIndex(m => m.key === a) + 1) % MENU.length].key), 3500)
    return () => clearInterval(t)
  }, [auto])

  const current = MENU.find(m => m.key === active)!

  return (
    <div className="relative mr-0 mt-10 overflow-hidden rounded-[1.5rem] bg-white shadow-[0_40px_90px_-30px_rgba(15,23,42,0.45)] ring-1 ring-black/5 sm:mr-14">
      <div className="flex items-center gap-2 border-b border-cdsc-line bg-cdsc-paper px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="ml-3 truncate rounded-md bg-white px-3 py-0.5 text-[11px] text-cdsc-ink/45">CDSC Client Portal · {current.label}</span>
      </div>
      <div className="grid grid-cols-[52px_1fr] sm:grid-cols-[150px_1fr]">
        <nav aria-label="Client portal preview" className="space-y-1 bg-linear-to-b from-cdsc-accent to-rose-600 p-2 text-white sm:p-3">
          {MENU.map(m => (
            <button key={m.key} type="button" title={m.label} aria-pressed={active === m.key}
              onClick={() => { setAuto(false); setActive(m.key) }}
              className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[11px] font-semibold transition',
                active === m.key ? 'bg-white text-cdsc-accent shadow' : 'text-white/85 hover:bg-white/15')}>
              <m.Icon className="h-3.5 w-3.5 shrink-0" /><span className="hidden sm:inline">{m.label}</span>
            </button>
          ))}
        </nav>
        <div key={active} className="min-h-[300px] space-y-4 p-4 animate-in fade-in-0 duration-300 sm:p-5">
          <p className="text-sm font-black text-cdsc-ink">{current.label}</p>
          {SCREENS[active]()}
        </div>
      </div>
    </div>
  )
}
