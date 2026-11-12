'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { PlayCircle, ShoppingCart, FileText, Truck, ArrowRight, Volume2, VolumeX } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DEMO_VIDEO_URL, DEMO_VIDEO_TITLE, toEmbed } from '@/components/live-video-button'
import { Reveal } from '@/components/marketing/profile-motion'

// The CDSC Client Portal demo, hosted with the website so it can play by itself.
// Browsers only allow autoplay when muted — "Tap for sound" turns audio on.
const LOCAL_DEMO = '/videos/cdsc-demo.mp4'

// "See How Ordering Works" — plays automatically when scrolled into view.
// Uses the Demo Video URL from Settings → Website when it's set to something
// other than the default demo (YouTube/Vimeo autoplay muted; a direct video
// file plays like the built-in one).
export function DemoVideoSection() {
  const [url, setUrl] = useState<string | null>(null)
  const [muted, setMuted] = useState(true)
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    createClient().from('system_settings').select('live_video_url').single().then(({ data }) => {
      const v = (data?.live_video_url ?? '').trim()
      if (v && v !== DEMO_VIDEO_URL) setUrl(v)
    })
  }, [])

  const embed = url ? toEmbed(url) : { kind: 'video' as const, src: LOCAL_DEMO }
  const src = embed.kind === 'iframe'
    ? embed.src.replace(/([?&])autoplay=(1|true)/, '$1autoplay=1') + (embed.src.includes('?') ? '&' : '?') + 'mute=1&muted=1&loop=1&playsinline=1'
    : embed.src

  // Play while at least 40% visible; pause when scrolled away.
  useEffect(() => {
    const el = video.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) el.play().catch(() => { /* autoplay blocked: controls still shown */ })
      else el.pause()
    }, { threshold: 0.4 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [src])

  function toggleSound() {
    const el = video.current
    if (!el) return
    el.muted = !el.muted
    setMuted(el.muted)
    if (!el.muted) el.play().catch(() => {})
  }

  return (
    <section id="demo" className="relative scroll-mt-24 overflow-hidden bg-linear-to-b from-cdsc-tint to-white py-24 text-cdsc-ink">
      <div aria-hidden className="pointer-events-none absolute -left-32 top-0 h-[420px] w-[420px] rounded-full bg-cdsc-accent/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-32 bottom-0 h-[420px] w-[420px] rounded-full bg-rose-400/10 blur-3xl" />

      <div className="relative mx-auto grid w-full max-w-screen-2xl items-center gap-14 px-6 lg:grid-cols-[1fr_1.6fr] lg:px-10">
        <Reveal>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-cdsc-accent shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-cdsc-accent motion-safe:animate-pulse-ring" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cdsc-accent" />
            </span>
            Demo Video
          </span>
          <h2 className="mt-5 text-3xl font-black leading-tight sm:text-5xl">
            See How Ordering with <span className="text-cdsc-accent">CDSC</span> Works
          </h2>
          <p className="mt-5 text-cdsc-ink/65">
            A quick walkthrough of the CDSC client portal — from browsing items and sending a request to tracking
            quotations, orders and deliveries.
          </p>
          <ul className="mt-8 space-y-4 text-sm text-cdsc-ink/80">
            {([
              [ShoppingCart, 'Add items to your cart or send a custom requirement'],
              [FileText, 'Receive and approve quotations online'],
              [Truck, 'Track your orders, deliveries and invoices in one place'],
            ] as const).map(([Icon, text]) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-cdsc-accent to-rose-500 text-white shadow-lg shadow-cdsc-accent/30">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
          <Link
            href="/products#shop"
            className="mt-10 inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-cdsc-accent to-rose-500 px-6 py-3 font-bold text-white transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cdsc-accent/30"
          >
            Start Shopping <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>

        <Reveal className="relative">
          <div aria-hidden className="absolute -inset-3 rounded-[2rem] bg-linear-to-br from-cdsc-accent via-red-500 to-rose-400 opacity-40 blur-2xl" />
          <div className="relative overflow-hidden rounded-[1.5rem] bg-white shadow-2xl ring-1 ring-black/5">
            <div className="flex items-center gap-2 bg-cdsc-paper px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              <span className="ml-3 inline-flex items-center gap-1.5 truncate text-xs text-cdsc-ink/55">
                <PlayCircle className="h-3.5 w-3.5 text-cdsc-accent" /> {DEMO_VIDEO_TITLE}
              </span>
            </div>
            <div className="relative w-full bg-black" style={{ paddingTop: '56.25%' }} onContextMenu={e => e.preventDefault()}>
              {embed.kind === 'video' ? (
                <>
                  <video
                    ref={video}
                    src={src}
                    muted
                    loop
                    playsInline
                    autoPlay
                    preload="auto"
                    controls
                    controlsList="nodownload noplaybackrate noremoteplayback"
                    disablePictureInPicture
                    disableRemotePlayback
                    className="absolute inset-0 h-full w-full"
                  />
                  <button
                    type="button"
                    onClick={toggleSound}
                    className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-black/75"
                  >
                    {muted ? <><VolumeX className="h-3.5 w-3.5" /> Tap for sound</> : <><Volume2 className="h-3.5 w-3.5" /> Sound on</>}
                  </button>
                </>
              ) : (
                <iframe
                  src={src}
                  title={DEMO_VIDEO_TITLE}
                  className="absolute inset-0 h-full w-full border-0"
                  allow="autoplay; encrypted-media; fullscreen"
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
