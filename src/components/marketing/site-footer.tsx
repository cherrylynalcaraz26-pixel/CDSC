import Link from 'next/link'
import Image from 'next/image'
import { Phone, Mail, MapPin } from 'lucide-react'
import { nav, company, productCategories } from '@/lib/site-content'

export function SiteFooter() {
  return (
    <footer id="site-footer" className="bg-cdsc-navy-dark text-cdsc-paper/70 print:hidden">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="relative mb-4 h-10 w-24 rounded bg-white p-1">
              <Image src="/cdsc-logo.jpg" alt="CDSC Industrial Supply logo" fill className="object-contain p-1" />
            </div>
            <p className="text-sm font-medium text-white">{company.name}</p>
            <p className="mt-1 text-sm italic text-cdsc-paper/60">{company.tagline}</p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-white/80">Navigate</h3>
            <ul className="mt-4 space-y-2.5">
              {nav.map(item => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm hover:text-white">{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-white/80">Products</h3>
            <ul className="mt-4 space-y-2.5">
              {productCategories.map(c => (
                <li key={c.name}>
                  <Link href="/products" className="text-sm hover:text-white">{c.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-white/80">Contact</h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cdsc-accent" />
                <span>{company.addressLine1}<br />{company.addressLine2}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-cdsc-accent" />
                <a href={company.phoneHref} className="hover:text-white">{company.phone}</a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-cdsc-accent" />
                <a href={company.emailHref} className="hover:text-white">{company.email}</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-cdsc-paper/50 sm:flex-row">
          <span>&copy; {new Date().getFullYear()} {company.name}. All rights reserved.</span>
          <span>Reliable supply. Practical solutions. Responsive service.</span>
        </div>
      </div>
    </footer>
  )
}
