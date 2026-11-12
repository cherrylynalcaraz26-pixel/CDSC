import Link from 'next/link'
import Image from 'next/image'
import { Phone, Mail, MapPin } from 'lucide-react'
import { nav, company, productCategories } from '@/lib/site-content'

export function SiteFooter() {
  return (
    <footer id="site-footer" className="relative overflow-hidden bg-black text-white/60 print:hidden">
      <div aria-hidden className="h-1 w-full bg-linear-to-r from-cdsc-accent via-red-500 to-orange-500" />
      <div aria-hidden className="pointer-events-none absolute -right-32 -top-10 h-80 w-80 rounded-full bg-cdsc-accent/15 blur-3xl" />
      <div className="relative mx-auto max-w-screen-2xl px-6 py-14 lg:px-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="relative mb-4 h-12 w-28 rounded-xl bg-white p-1">
              <Image src="/cdsc-logo.jpg" alt="CDSC Industrial Supply logo" fill className="object-contain p-1" />
            </div>
            <p className="text-sm font-bold text-white">{company.name}</p>
            <p className="mt-1 text-sm italic text-white/50">{company.tagline}</p>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-orange-300">Navigate</h3>
            <ul className="mt-4 space-y-2.5">
              {nav.map(item => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm transition hover:text-white">{item.label}</Link>
                </li>
              ))}
              <li>
                <Link href="/inquiry" className="text-sm transition hover:text-white">Partner with Us</Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-orange-300">Products</h3>
            <ul className="mt-4 space-y-2.5">
              {productCategories.map(c => (
                <li key={c.name}>
                  <Link href="/products" className="text-sm transition hover:text-white">{c.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-orange-300">Contact</h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
                <span>{company.addressLine1}<br />{company.addressLine2}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-orange-400" />
                <a href={company.phoneHref} className="transition hover:text-white">{company.phone}</a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-orange-400" />
                <a href={company.emailHref} className="transition hover:text-white">{company.email}</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/40 sm:flex-row">
          <span>&copy; {new Date().getFullYear()} {company.name}. All rights reserved.</span>
          <span className="flex items-center gap-3">
            Reliable supply. Practical solutions. Responsive service.
            <Link href="/login" className="text-white/40 underline-offset-2 transition hover:text-white hover:underline">Staff Login</Link>
          </span>
        </div>
      </div>
    </footer>
  )
}
