'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Menu, X, Phone, Mail, ArrowRight } from 'lucide-react'
import { nav, company } from '@/lib/site-content'
import { cn } from '@/lib/utils'

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header id="site-header" className="sticky top-0 z-40 w-full print:hidden">
      {/* Top utility bar */}
      <div className="hidden border-b border-cdsc-line bg-cdsc-paper text-cdsc-ink/70 sm:block">
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-6 px-6 py-2 text-xs">
          <a href={company.phoneHref} className="flex items-center gap-1.5 hover:text-cdsc-navy">
            <Phone className="h-3.5 w-3.5 text-cdsc-accent" /> {company.phone}
          </a>
          <a href={company.emailHref} className="flex items-center gap-1.5 hover:text-cdsc-navy">
            <Mail className="h-3.5 w-3.5 text-cdsc-accent" /> {company.email}
          </a>
        </div>
      </div>

      {/* Main nav */}
      <div className="border-b border-cdsc-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" onClick={() => setOpen(false)}>
            <div className="relative h-9 w-20 shrink-0">
              <Image src="/cdsc-logo.jpg" alt="CDSC Industrial Supply logo" fill className="object-contain" priority />
            </div>
            <span className="hidden text-sm font-semibold leading-tight text-cdsc-ink md:block">
              CDSC<br className="hidden lg:block" /> Industrial Supply
            </span>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            {nav.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'text-sm font-medium text-cdsc-ink/70 transition-colors hover:text-cdsc-navy',
                  pathname === item.href && 'text-cdsc-navy font-semibold'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/quote"
              className="hidden items-center gap-1.5 rounded-md bg-cdsc-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cdsc-navy-dark sm:inline-flex"
            >
              Request a Quotation <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => setOpen(v => !v)}
              className="inline-flex items-center justify-center rounded-md border border-cdsc-line p-2 text-cdsc-ink lg:hidden"
              aria-label={open ? 'Close menu' : 'Open menu'}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open && (
          <nav className="border-t border-cdsc-line bg-white px-6 py-4 lg:hidden">
            <ul className="flex flex-col gap-1">
              {nav.map(item => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'block rounded-md px-3 py-2.5 text-sm font-medium text-cdsc-ink/80 hover:bg-cdsc-paper',
                      pathname === item.href && 'bg-cdsc-paper text-cdsc-navy font-semibold'
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-col gap-2 border-t border-cdsc-line pt-3">
              <a href={company.phoneHref} className="flex items-center gap-2 px-3 py-1.5 text-sm text-cdsc-ink/70">
                <Phone className="h-4 w-4" /> {company.phone}
              </a>
              <a href={company.emailHref} className="flex items-center gap-2 px-3 py-1.5 text-sm text-cdsc-ink/70">
                <Mail className="h-4 w-4" /> {company.email}
              </a>
              <Link
                href="/quote"
                onClick={() => setOpen(false)}
                className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-cdsc-navy px-4 py-2.5 text-sm font-semibold text-white"
              >
                Request a Quotation <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}
