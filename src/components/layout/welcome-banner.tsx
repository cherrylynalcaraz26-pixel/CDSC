'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { FileText, ShoppingCart, Receipt, PackageOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/** Photo welcome banner at the top of the Dashboard. */
export function WelcomeBanner() {
  const [name, setName] = useState('')
  const [now] = useState(() => new Date())
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      setName(((data?.full_name as string | undefined) ?? user.email?.split('@')[0] ?? '').split(' ')[0])
    })
  }, [])
  const hour = now.getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <section className="relative overflow-hidden rounded-3xl text-white shadow-[0_20px_50px_-24px_rgba(232,17,45,0.6)]">
      <Image src="/images/site/hero-warehouse.jpg" alt="" fill priority sizes="(min-width:1024px) 80vw, 100vw" className="object-cover" />
      <div aria-hidden className="absolute inset-0 bg-linear-to-r from-[#E8112D]/95 via-red-600/85 to-rose-500/50" />
      <div aria-hidden className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex flex-col gap-5 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/75">
            {now.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{greet}{name ? `, ${name}` : ''}!</h2>
          <p className="mt-1 max-w-lg text-sm text-white/85">Here&apos;s how CDSC is doing. Charts below cover the last 12 months.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { href: '/quotation', label: 'New Quotation', Icon: FileText },
            { href: '/sales-orders', label: 'Sales Orders', Icon: Receipt },
            { href: '/purchase-orders', label: 'Purchase Orders', Icon: ShoppingCart },
            { href: '/pull-outs', label: 'Pull Outs', Icon: PackageOpen },
          ].map(({ href, label, Icon }) => (
            <Link key={href} href={href} className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/15 px-3.5 py-2 text-xs font-semibold backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/25">
              <Icon className="h-4 w-4" /> {label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
