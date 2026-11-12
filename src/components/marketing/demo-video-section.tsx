'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PlayCircle, ShoppingCart, FileText, Truck, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DEMO_VIDEO_URL, DEMO_VIDEO_TITLE, toEmbed } from '@/components/live-video-button'
import { Reveal } from '@/components/marketing/profile-motion'

// "See How Ordering Works" — the CDSC demo video, shown right on the website.
// Uses the Demo Video URL from Settings → Website when set, otherwise the default
// CDSC Client Portal demo. The player is visible immediately (no autoplay).
export function DemoVideoSection() {
  const [url, setUrl] = useState(DEMO_VIDEO_URL)

  useEffect(() => {
    createClient().from('system_settings').select('live_video_url').single().then(({ data }) => {
      const v = (data?.live_video_url ?? '').trim()
      if (v) setUrl(v)
    })
  }, [])

  const embed = toEmbed(url)
  // toEmbed asks for autoplay (it's built for the click-to-open modal); here the
  // player sits on the page, so let the visitor press play.
  const src = embed.src.replace(/([?&])autoplay=(1|true)/, '$1autoplay=0')

  return (
    <section id="demo" className="relative scroll-mt-24 overflow-hidden bg-black py-24 text-white">
      <div aria-hidden className="pointer-events-none absolute -left-32 top-0 h-[420px] w-[420px] rounded-full bg-cdsc-accent/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-32 bottom-0 h-[420px] w-[420px] rounded-full bg-orange-500/15 blur-3xl" />

      <div className="relative mx-auto grid w-full max-w-screen-2xl items-center gap-14 px-6 lg:grid-cols-[1fr_1.6fr] lg:px-10">
        <Reveal>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/25 bg-orange-500/10 px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-orange-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-orange-400 motion-safe:animate-pulse-ring" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-400" />
            </span>
            Demo Video
          </span>
          <h2 className="mt-5 text-3xl font-black leading-tight sm:text-5xl">
            See How Ordering with <span className="bg-linear-to-r from-red-400 to-orange-300 bg-clip-text text-transparent">CDSC</span> Works
          </h2>
          <p className="mt-5 text-white/65">
            A quick walkthrough of the CDSC client portal — from browsing items and sending a request to tracking
            quotations, orders and deliveries.
          </p>
          <ul className="mt-8 space-y-4 text-sm text-white/85">
            {([
              [ShoppingCart, 'Add items to your cart or send a custom requirement'],
              [FileText, 'Receive and approve quotations online'],
              [Truck, 'Track your orders, deliveries and invoices in one place'],
            ] as const).map(([Icon, text]) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-cdsc-accent to-orange-500 text-white shadow-lg shadow-cdsc-accent/30">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
          <Link
            href="/products#shop"
            className="mt-10 inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-cdsc-accent to-orange-500 px-6 py-3 font-bold transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cdsc-accent/30"
          >
            Start Shopping <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>

        <Reveal className="relative">
          <div aria-hidden className="absolute -inset-3 rounded-[2rem] bg-linear-to-br from-cdsc-accent via-red-500 to-orange-500 opacity-70 blur-xl" />
          <div className="relative overflow-hidden rounded-[1.5rem] bg-neutral-900 shadow-2xl ring-1 ring-white/10">
            <div className="flex items-center gap-2 bg-neutral-800 px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-neutral-500" />
              <span className="ml-3 inline-flex items-center gap-1.5 truncate text-xs text-white/60">
                <PlayCircle className="h-3.5 w-3.5 text-orange-300" /> {DEMO_VIDEO_TITLE}
              </span>
            </div>
            <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
              {embed.kind === 'video' ? (
                <video src={src} controls preload="metadata" playsInline className="absolute inset-0 h-full w-full bg-black" />
              ) : (
                <iframe
                  src={src}
                  title={DEMO_VIDEO_TITLE}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full border-0 bg-black"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
