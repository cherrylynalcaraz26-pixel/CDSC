import Link from 'next/link'
import Image from 'next/image'
import { Phone, Mail, MapPin } from 'lucide-react'
import { nav, company, productCategories } from '@/lib/site-content'

export function SiteFooter() {
  return (
    <footer id="site-footer" className="border-t-2 border-cdsc-accent bg-cdsc-paper text-cdsc-ink/70 print:hidden">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="relative mb-4 h-10 w-24 rounded border border-cdsc-line bg-white p-1">
              <Image src="/cdsc-logo.jpg" alt="CDSC Industrial Supply logo" fill className="object-contain p-1" />
            </div>
            <p className="text-sm font-medium text-cdsc-ink">{company.name}</p>
            <p className="mt-1 text-sm italic text-cdsc-ink/55">{company.tagline}</p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-cdsc-ink/80">Navigate</h3>
            <ul className="mt-4 space-y-2.5">
              {nav.map(item => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm hover:text-cdsc-navy">{item.label}</Link>
                </li>
              ))}
              <li>
                <Link href="/inquiry" className="text-sm hover:text-cdsc-navy">Partner with Us</Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-cdsc-ink/80">Products</h3>
            <ul className="mt-4 space-y-2.5">
              {productCategories.map(c => (
                <li key={c.name}>
                  <Link href="/products" className="text-sm hover:text-cdsc-navy">{c.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-cdsc-ink/80">Contact</h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cdsc-accent" />
                <span>{company.addressLine1}<br />{company.addressLine2}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-cdsc-accent" />
                <a href={company.phoneHref} className="hover:text-cdsc-navy">{company.phone}</a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-cdsc-accent" />
                <a href={company.emailHref} className="hover:text-cdsc-navy">{company.email}</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-cdsc-line pt-6 text-xs text-cdsc-ink/45 sm:flex-row">
          <span>&copy; {new Date().getFullYear()} {company.name}. All rights reserved.</span>
          <span className="flex items-center gap-3">
            Reliable supply. Practical solutions. Responsive service.
            <Link href="/login" className="text-cdsc-ink/40 underline-offset-2 hover:text-cdsc-navy hover:underline">Staff Login</Link>
          </span>
        </div>
      </div>
    </footer>
  )
}
