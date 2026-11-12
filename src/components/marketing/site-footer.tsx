import Link from 'next/link'
import Image from 'next/image'
import { Phone, Mail, MapPin } from 'lucide-react'
import { nav, company, productCategories } from '@/lib/site-content'

export function SiteFooter() {
  return (
    <footer id="site-footer" className="relative overflow-hidden bg-cdsc-paper text-cdsc-ink/65 print:hidden">
      <div aria-hidden className="h-1 w-full bg-linear-to-r from-cdsc-accent via-red-500 to-rose-400" />
      <div aria-hidden className="pointer-events-none absolute -right-32 -top-10 h-80 w-80 rounded-full bg-cdsc-accent/5 blur-3xl" />
      <div className="relative mx-auto max-w-screen-2xl px-6 py-14 lg:px-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="relative mb-4 h-12 w-28">
              <Image src="/cdsc-logo.png" alt="CDSC Industrial Supply logo" fill sizes="112px" className="object-contain" />
            </div>
            <p className="text-sm font-bold text-cdsc-ink">{company.name}</p>
            <p className="mt-1 text-sm italic text-cdsc-ink/50">{company.tagline}</p>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-cdsc-accent">Navigate</h3>
            <ul className="mt-4 space-y-2.5">
              {nav.map(item => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm transition hover:text-cdsc-accent">{item.label}</Link>
                </li>
              ))}
              <li>
                <Link href="/inquiry" className="text-sm transition hover:text-cdsc-accent">Partner with Us</Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-cdsc-accent">Products</h3>
            <ul className="mt-4 space-y-2.5">
              {productCategories.map(c => (
                <li key={c.name}>
                  <Link href="/products" className="text-sm transition hover:text-cdsc-accent">{c.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-cdsc-accent">Contact</h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cdsc-accent" />
                <span>{company.addressLine1}<br />{company.addressLine2}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-cdsc-accent" />
                <a href={company.phoneHref} className="transition hover:text-cdsc-accent">{company.phone}</a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-cdsc-accent" />
                <a href={company.emailHref} className="transition hover:text-cdsc-accent">{company.email}</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-cdsc-line pt-6 text-xs text-cdsc-ink/45 sm:flex-row">
          <span>&copy; {new Date().getFullYear()} {company.name}. All rights reserved.</span>
          <span>Reliable supply. Practical solutions. Responsive service.</span>
        </div>
      </div>
    </footer>
  )
}
