'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Menu, X, Phone, Mail, ArrowRight, ShoppingCart } from 'lucide-react'
import { useCart, cartCount, useCartHydrated } from '@/lib/cart-store'
import { nav, company } from '@/lib/site-content'
import { cn } from '@/lib/utils'

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const cartReady = useCartHydrated()
  const cartItems = useCart(s => s.items)
  const count = cartReady ? cartCount(cartItems) : 0

  return (
    <header id="site-header" className="sticky top-0 z-40 w-full print:hidden">
      {/* Top utility bar */}
      <div className="hidden bg-linear-to-r from-cdsc-accent to-rose-500 text-white/90 sm:block">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-end gap-6 px-6 py-2 text-xs">
          <a href={company.phoneHref} className="flex items-center gap-1.5 transition hover:text-white">
            <Phone className="h-3.5 w-3.5" /> {company.phone}
          </a>
          <a href={company.emailHref} className="flex items-center gap-1.5 transition hover:text-white">
            <Mail className="h-3.5 w-3.5" /> {company.email}
          </a>
        </div>
      </div>

      {/* Main nav */}
      <div className="bg-white/90 shadow-sm shadow-black/5 backdrop-blur-md">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" onClick={() => setOpen(false)}>
            <div className="relative h-9 w-20 shrink-0">
              <Image src="/cdsc-logo.png" alt="CDSC Industrial Supply logo" fill sizes="80px" className="object-contain" priority />
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
                  'group relative py-1 text-sm font-medium text-cdsc-ink/70 transition-colors hover:text-cdsc-accent',
                  pathname === item.href && 'text-cdsc-accent font-semibold'
                )}
              >
                {item.label}
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-x-0 -bottom-0.5 h-0.5 origin-left rounded-full bg-linear-to-r from-cdsc-accent to-rose-500 transition-transform duration-300',
                    pathname === item.href ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                  )}
                />
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/cart"
              aria-label={count ? `Cart, ${count} items` : 'Cart'}
              className="relative inline-flex items-center justify-center rounded-md p-2 text-cdsc-ink/70 transition-colors hover:bg-cdsc-paper hover:text-cdsc-accent"
            >
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-cdsc-accent px-1 text-[10px] font-bold text-white">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </Link>
            <Link
              href="/quote"
              className="hidden items-center gap-1.5 rounded-xl bg-linear-to-r from-cdsc-accent to-rose-500 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-cdsc-accent/25 transition hover:-translate-y-0.5 hover:shadow-lg sm:inline-flex"
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
          <nav className="bg-white px-6 py-4 shadow-lg motion-safe:animate-rise lg:hidden">
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
                className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-linear-to-r from-cdsc-accent to-rose-500 px-4 py-2.5 text-sm font-bold text-white"
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
