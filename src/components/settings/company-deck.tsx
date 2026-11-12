'use client'

/* eslint-disable @next/next/no-img-element */
// Company Profile Deck (Settings → Company Profile Deck)
// A 16:9 slide presentation to show clients, built from Settings
// (system_settings) and the website content/photos. Present full screen with
// the arrow keys, or "Download PDF" — one slide per page (print → Save as PDF).

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  ChevronLeft, ChevronRight, Maximize2, Download, Loader2, Phone, Mail, MapPin, Clock,
  ShieldCheck, MessageCircle, Scale, Wrench, Handshake, Target, Eye, Package, Search,
  ClipboardList, Boxes, Truck, Puzzle, LayoutDashboard, ArrowDownToLine, ArrowUpFromLine, RefreshCw, CalendarCheck,
} from 'lucide-react'
import {
  company as SITE, mission as SITE_MISSION, vision as SITE_VISION, companyOverview, coreValues, productCategories,
  industries, additionalMarkets, services, procurementProcess, whyCds, registration, inventorySystem, heroStats,
} from '@/lib/site-content'

const W = 1280
const H = 720
const RED = '#E8112D'
const ROSE = '#F43F5E'

interface Co {
  name: string; tagline: string; logo: string; phone: string; email: string; address: string
  mission: string; vision: string; about: string; tin: string; website: string
}

function useCompanyInfo(): Co | null {
  const [co, setCo] = useState<Co | null>(null)
  useEffect(() => {
    createClient().from('system_settings').select('*').single().then(({ data }) => {
      const v = (k: string) => (data && typeof data[k] === 'string' ? (data[k] as string).trim() : '')
      setCo({
        name: v('company_name') || SITE.name,
        tagline: v('tagline') || SITE.tagline,
        logo: v('logo_url') || '/cdsc-logo.png',
        phone: v('phone') || v('mobile') || SITE.phone,
        email: v('email') || SITE.email,
        address: [v('address'), v('city'), v('province')].filter(Boolean).join(', ') || SITE.addressFull,
        mission: v('mission_statement') || SITE_MISSION,
        vision: SITE_VISION,
        about: v('about_company') || companyOverview[0],
        tin: v('tin') || registration.tin,
        website: v('website') || 'cdsc-eight.vercel.app',
      })
    })
  }, [])
  return co
}

/* ── Slide primitives (designed at 1280×720) ── */
function Frame({ children, bg = '#ffffff' }: { children: React.ReactNode; bg?: string }) {
  return <div style={{ width: W, height: H, background: bg, position: 'relative', overflow: 'hidden', fontFamily: 'inherit' }}>{children}</div>
}
function Photo({ src, overlay = 0.88 }: { src: string; overlay?: number }) {
  return (
    <>
      <img src={src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(110deg, rgba(232,17,45,${overlay}) 0%, rgba(220,38,38,${overlay - 0.1}) 45%, rgba(244,63,94,${overlay - 0.45}) 100%)` }} />
    </>
  )
}
function Kicker({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <span style={{
      display: 'inline-block', padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 800, letterSpacing: 2,
      textTransform: 'uppercase', background: light ? 'rgba(255,255,255,.15)' : '#FDECEE', color: light ? '#fff' : RED,
    }}>{children}</span>
  )
}
function Title({ children, light = false, size = 52 }: { children: React.ReactNode; light?: boolean; size?: number }) {
  return <h2 style={{ fontSize: size, lineHeight: 1.05, fontWeight: 900, margin: '18px 0 0', color: light ? '#fff' : '#1c1f26', letterSpacing: -1 }}>{children}</h2>
}
function Footer({ co, n, total, light = false }: { co: Co; n: number; total: number; light?: boolean }) {
  return (
    <div style={{ position: 'absolute', left: 64, right: 64, bottom: 28, display: 'flex', justifyContent: 'space-between', fontSize: 13, color: light ? 'rgba(255,255,255,.75)' : '#8a8f98' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 28, height: 4, borderRadius: 4, background: light ? '#fff' : `linear-gradient(90deg, ${RED}, ${ROSE})` }} />
        {co.name}
      </span>
      <span>{n} / {total}</span>
    </div>
  )
}
const iconBox = (size = 52): React.CSSProperties => ({
  width: size, height: size, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: `linear-gradient(135deg, ${RED}, ${ROSE})`, color: '#fff', flexShrink: 0, boxShadow: '0 10px 24px -10px rgba(232,17,45,.6)',
})

const CAT_PHOTOS = ['industrial-tools', 'electrical-panel', 'safety-electrician', 'mechanical-pump', 'office-team']
const VALUE_ICONS = [ShieldCheck, MessageCircle, Scale, Wrench, Handshake]
const SERVICE_ICONS = [Package, Search, ClipboardList, Boxes, Truck, Puzzle]
const SYS_ICONS = [LayoutDashboard, Search, ArrowDownToLine, ArrowUpFromLine, RefreshCw, CalendarCheck]

function buildSlides(co: Co): ((n: number, total: number) => React.ReactNode)[] {
  return [
    // 1 — Cover
    (n, t) => (
      <Frame>
        <Photo src="/images/site/hero-warehouse.jpg" overlay={0.92} />
        <div style={{ position: 'absolute', left: 80, top: 90, right: 80, color: '#fff' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 18, background: '#fff', borderRadius: 20, padding: '12px 22px' }}>
            <img src={co.logo} alt="" style={{ height: 64, width: 150, objectFit: 'contain' }} />
          </div>
          <div style={{ marginTop: 40 }}><Kicker light>Company Profile</Kicker></div>
          <h1 style={{ fontSize: 84, fontWeight: 900, lineHeight: 1, margin: '22px 0 0', letterSpacing: -2 }}>{co.name}</h1>
          <p style={{ fontSize: 28, marginTop: 18, fontStyle: 'italic', color: 'rgba(255,255,255,.9)' }}>&ldquo;{co.tagline}&rdquo;</p>
          <p style={{ fontSize: 18, marginTop: 34, maxWidth: 720, color: 'rgba(255,255,255,.85)', lineHeight: 1.5 }}>
            Industrial supply, sourcing and procurement partner for businesses across Batangas, CALABARZON and the Philippines.
          </p>
        </div>
        <Footer co={co} n={n} total={t} light />
      </Frame>
    ),
    // 2 — About
    (n, t) => (
      <Frame>
        <div style={{ position: 'absolute', left: 64, top: 64, width: 640 }}>
          <Kicker>About Us</Kicker>
          <Title>Your Trusted <span style={{ color: RED }}>Industrial Partner</span></Title>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: '#4b5160', marginTop: 24 }}>{co.about}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 30 }}>
            {[
              ['Business Type', SITE.businessType], ['Established', String(registration.established)],
              ['DTI Reg. No.', registration.dtiNo], ['TIN', co.tin],
              ['VAT Status', SITE.vatRegistered ? 'VAT Registered' : 'Non-VAT'], ['Clients', registration.clientTypes],
            ].map(([k, v]) => (
              <div key={k} style={{ background: '#F7F7F8', borderRadius: 14, padding: '12px 16px' }}>
                <div style={{ fontSize: 12, color: '#8a8f98', textTransform: 'uppercase', letterSpacing: 1 }}>{k}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#1c1f26', marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 500 }}>
          <img src="/images/site/meeting.jpg" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #fff 0%, rgba(255,255,255,0) 30%)' }} />
          <div style={{ position: 'absolute', left: 60, right: 40, bottom: 70, display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
            {heroStats.map(s => (
              <div key={s.label} style={{ background: 'rgba(232,17,45,.92)', color: '#fff', borderRadius: 16, padding: '14px 18px' }}>
                <div style={{ fontSize: 32, fontWeight: 900 }}>{s.value}{s.suffix}</div>
                <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, opacity: .85 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        <Footer co={co} n={n} total={t} />
      </Frame>
    ),
    // 3 — Mission, Vision, Values
    (n, t) => (
      <Frame bg="#FDF2F3">
        <div style={{ position: 'absolute', left: 64, right: 64, top: 56 }}>
          <Kicker>Who We Are</Kicker>
          <Title>Mission, Vision &amp; Values</Title>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, marginTop: 30 }}>
            {[[Target, 'Our Mission', co.mission], [Eye, 'Our Vision', co.vision]].map(([I, h, txt]) => {
              const Ico = I as typeof Target
              return (
                <div key={h as string} style={{ background: '#fff', borderRadius: 24, padding: 28, boxShadow: '0 10px 30px -18px rgba(0,0,0,.25)' }}>
                  <div style={iconBox()}><Ico size={24} /></div>
                  <div style={{ fontSize: 24, fontWeight: 900, marginTop: 16, color: '#1c1f26' }}>{h as string}</div>
                  <p style={{ fontSize: 16, lineHeight: 1.55, color: '#4b5160', marginTop: 8 }}>{txt as string}</p>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginTop: 22 }}>
            {coreValues.map((v, i) => {
              const Ico = VALUE_ICONS[i] ?? ShieldCheck
              return (
                <div key={v.title} style={{ background: '#fff', borderRadius: 18, padding: '16px 14px', textAlign: 'center' }}>
                  <div style={{ ...iconBox(40), margin: '0 auto', borderRadius: 12 }}><Ico size={18} /></div>
                  <div style={{ fontSize: 15, fontWeight: 800, marginTop: 10, color: '#1c1f26' }}>{v.title}</div>
                  <div style={{ fontSize: 12, lineHeight: 1.4, color: '#6b7180', marginTop: 4 }}>{v.description}</div>
                </div>
              )
            })}
          </div>
        </div>
        <Footer co={co} n={n} total={t} />
      </Frame>
    ),
    // 4 — What we supply
    (n, t) => (
      <Frame>
        <div style={{ position: 'absolute', left: 64, right: 64, top: 56 }}>
          <Kicker>Product Catalog</Kicker>
          <Title>What We <span style={{ color: RED }}>Supply</span></Title>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16, marginTop: 30 }}>
            {productCategories.map((c, i) => (
              <div key={c.name} style={{ borderRadius: 20, overflow: 'hidden', background: '#fff', boxShadow: '0 10px 30px -16px rgba(0,0,0,.3)' }}>
                <div style={{ height: 170, position: 'relative' }}>
                  <img src={`/images/site/${CAT_PHOTOS[i] ?? CAT_PHOTOS[0]}.jpg`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ padding: '14px 16px 18px' }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#1c1f26' }}>{c.name}</div>
                  <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none' }}>
                    {c.items.slice(0, 4).map(it => (
                      <li key={it} style={{ fontSize: 12.5, color: '#4b5160', padding: '2px 0', display: 'flex', gap: 6 }}>
                        <span style={{ color: RED, fontWeight: 900 }}>•</span>{it}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 22, fontSize: 15, color: '#6b7180' }}>
            Plus custom sourcing for hard-to-find items — tell us the specification, quantity and brand preference.
          </p>
        </div>
        <Footer co={co} n={n} total={t} />
      </Frame>
    ),
    // 5 — Industries
    (n, t) => (
      <Frame>
        <div style={{ position: 'absolute', left: 64, top: 56, width: 520 }}>
          <Kicker>Who We Serve</Kicker>
          <Title>Industries &amp; Markets</Title>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 26 }}>
            {[...industries, ...additionalMarkets].map(m => (
              <span key={m.name} style={{ fontSize: 13.5, fontWeight: 600, padding: '7px 13px', borderRadius: 999, background: '#FDECEE', color: '#B3122A' }}>{m.name}</span>
            ))}
          </div>
        </div>
        <div style={{ position: 'absolute', right: 64, top: 56, bottom: 80, width: 590, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 14 }}>
          {[['Manufacturing', 'manufacturing-line'], ['Construction', 'construction-site'], ['Engineering', 'engineering-plans'], ['Logistics', 'logistics-port']].map(([l, p]) => (
            <div key={l} style={{ position: 'relative', borderRadius: 22, overflow: 'hidden' }}>
              <img src={`/images/site/${p}.jpg`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(232,17,45,.85), rgba(232,17,45,0) 60%)' }} />
              <div style={{ position: 'absolute', left: 18, bottom: 14, color: '#fff', fontSize: 20, fontWeight: 900 }}>{l}</div>
            </div>
          ))}
        </div>
        <Footer co={co} n={n} total={t} />
      </Frame>
    ),
    // 6 — Services
    (n, t) => (
      <Frame bg="#F7F7F8">
        <div style={{ position: 'absolute', left: 64, right: 64, top: 56 }}>
          <Kicker>What We Do</Kicker>
          <Title>Our Services</Title>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18, marginTop: 30 }}>
            {services.slice(0, 6).map((s, i) => {
              const Ico = SERVICE_ICONS[i] ?? Package
              return (
                <div key={s.title} style={{ background: '#fff', borderRadius: 22, padding: 24, display: 'flex', gap: 16 }}>
                  <div style={iconBox(48)}><Ico size={22} /></div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#1c1f26' }}>{s.title}</div>
                    <div style={{ fontSize: 14, lineHeight: 1.5, color: '#6b7180', marginTop: 4 }}>{s.description}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <Footer co={co} n={n} total={t} />
      </Frame>
    ),
    // 7 — Process
    (n, t) => (
      <Frame>
        <div style={{ position: 'absolute', left: 64, right: 64, top: 56 }}>
          <Kicker>How We Work</Kicker>
          <Title>From Requirement to <span style={{ color: RED }}>Delivery</span></Title>
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 22, marginTop: 70 }}>
            <div style={{ position: 'absolute', left: 40, right: 40, top: 38, height: 4, borderRadius: 4, background: `linear-gradient(90deg, ${RED}, ${ROSE}, #fecdd3)` }} />
            {procurementProcess.map(p => (
              <div key={p.step} style={{ position: 'relative', textAlign: 'center' }}>
                <div style={{ ...iconBox(80), margin: '0 auto', borderRadius: 24, fontSize: 28, fontWeight: 900, border: '8px solid #fff' }}>{p.step}</div>
                <div style={{ fontSize: 21, fontWeight: 900, marginTop: 18, color: '#1c1f26' }}>{p.title}</div>
                <div style={{ fontSize: 15, lineHeight: 1.5, color: '#6b7180', marginTop: 8 }}>{p.description}</div>
              </div>
            ))}
          </div>
        </div>
        <Footer co={co} n={n} total={t} />
      </Frame>
    ),
    // 8 — Inventory system
    (n, t) => (
      <Frame>
        <Photo src="/images/site/warehouse-shelves.jpg" overlay={0.93} />
        <div style={{ position: 'absolute', left: 64, right: 64, top: 56, color: '#fff' }}>
          <Kicker light>Smart Operations</Kicker>
          <Title light>Built-In Inventory System</Title>
          <p style={{ fontSize: 17, lineHeight: 1.55, maxWidth: 820, marginTop: 14, color: 'rgba(255,255,255,.88)' }}>{inventorySystem.description}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginTop: 28 }}>
            {inventorySystem.features.map((f, i) => {
              const Ico = SYS_ICONS[i] ?? Boxes
              return (
                <div key={f.title} style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 20, padding: 20 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: '#fff', color: RED, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico size={20} /></div>
                  <div style={{ fontSize: 17, fontWeight: 800, marginTop: 12 }}>{f.title}</div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.45, marginTop: 4, color: 'rgba(255,255,255,.82)' }}>{f.description}</div>
                </div>
              )
            })}
          </div>
        </div>
        <Footer co={co} n={n} total={t} light />
      </Frame>
    ),
    // 9 — Why CDSC
    (n, t) => (
      <Frame>
        <div style={{ position: 'absolute', left: 64, right: 64, top: 56 }}>
          <Kicker>Our Edge</Kicker>
          <Title>Why Businesses Choose <span style={{ color: RED }}>{co.name.split(' ')[0]}</span></Title>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginTop: 30 }}>
            {whyCds.slice(0, 8).map((w, i) => (
              <div key={w.title} style={{ background: i % 3 === 0 ? `linear-gradient(135deg, ${RED}, ${ROSE})` : '#F7F7F8', color: i % 3 === 0 ? '#fff' : '#1c1f26', borderRadius: 22, padding: 22, minHeight: 170 }}>
                <div style={{ fontSize: 34, fontWeight: 900, opacity: i % 3 === 0 ? .5 : .15, color: i % 3 === 0 ? '#fff' : RED }}>{String(i + 1).padStart(2, '0')}</div>
                <div style={{ fontSize: 17, fontWeight: 800, marginTop: 6 }}>{w.title}</div>
                <div style={{ fontSize: 13, lineHeight: 1.45, marginTop: 6, opacity: .85 }}>{w.description}</div>
              </div>
            ))}
          </div>
        </div>
        <Footer co={co} n={n} total={t} />
      </Frame>
    ),
    // 10 — Contact
    (n, t) => (
      <Frame>
        <Photo src="/images/site/welding.jpg" overlay={0.93} />
        <div style={{ position: 'absolute', left: 80, top: 90, width: 600, color: '#fff' }}>
          <Kicker light>Let&apos;s Work Together</Kicker>
          <h2 style={{ fontSize: 72, fontWeight: 900, lineHeight: 1, margin: '22px 0 0', letterSpacing: -2 }}>Have a requirement?</h2>
          <p style={{ fontSize: 20, lineHeight: 1.5, marginTop: 20, color: 'rgba(255,255,255,.88)' }}>
            Send us your list — specifications, quantity and target date — and we&apos;ll come back with a quotation.
          </p>
        </div>
        <div style={{ position: 'absolute', right: 80, top: 110, width: 430, background: '#fff', borderRadius: 28, padding: 30, boxShadow: '0 30px 60px -20px rgba(0,0,0,.4)' }}>
          <img src={co.logo} alt="" style={{ height: 60, width: 150, objectFit: 'contain' }} />
          {[[Phone, co.phone], [Mail, co.email], [MapPin, co.address], [Clock, registration.businessHours.join(' · ')]].map(([I, v]) => {
            const Ico = I as typeof Phone
            return (
              <div key={v as string} style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 18 }}>
                <div style={iconBox(40)}><Ico size={18} /></div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#1c1f26', lineHeight: 1.35 }}>{v as string}</div>
              </div>
            )
          })}
          <div style={{ marginTop: 20, fontSize: 14, color: RED, fontWeight: 700 }}>{co.website}</div>
        </div>
        <Footer co={co} n={n} total={t} light />
      </Frame>
    ),
  ]
}

/** Renders a 1280×720 slide scaled to its container's width. */
function Scaled({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setScale(Math.min(e.contentRect.width / W, e.contentRect.height / H)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className={className} style={{ position: 'relative', aspectRatio: '16 / 9', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: W, height: H, transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}>
        {children}
      </div>
    </div>
  )
}

export function CompanyDeck() {
  const co = useCompanyInfo()
  const [i, setI] = useState(0)
  const [presenting, setPresenting] = useState(false)
  const [printing, setPrinting] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const slides = co ? buildSlides(co) : []
  const total = slides.length

  const go = useCallback((d: number) => setI(x => Math.max(0, Math.min(total - 1, x + d))), [total])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!presenting) return
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(1) }
      if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go(-1) }
    }
    function onFs() { if (!document.fullscreenElement) setPresenting(false) }
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFs)
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('fullscreenchange', onFs) }
  }, [presenting, go])

  async function present() {
    setPresenting(true)
    try { await stage.current?.requestFullscreen() } catch { /* fullscreen blocked → in-page presentation */ }
  }

  function downloadPdf() {
    // One slide per 16:9 page; the browser's print dialog saves it as PDF.
    setPrinting(true)
    const style = document.createElement('style')
    style.id = 'deck-print-page'
    style.textContent = `@page { size: 13.333in 7.5in; margin: 0 } @media print {
      body * { visibility: hidden !important }
      #deck-print, #deck-print * { visibility: visible !important }
      #deck-print { position: absolute; left: 0; top: 0; display: block !important }
      .deck-page { width: 13.333in; height: 7.5in; overflow: hidden; break-after: page; page-break-after: always }
      .deck-page > div { transform: scale(${(13.333 * 96) / W}); transform-origin: top left }
    }`
    document.head.appendChild(style)
    setTimeout(() => {
      window.print()
      style.remove()
      setPrinting(false)
    }, 300)
  }

  if (!co) return <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-4">
      <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
        <div>
          <p className="text-sm font-semibold">Present CDSC to clients</p>
          <p className="text-xs text-muted-foreground">
            {total} slides built from your Company &amp; Business Profile. Edit the profile and the slides update. Use ← → keys while presenting.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadPdf} disabled={printing} className="gap-1.5">
            {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download PDF
          </Button>
          <Button onClick={present} className="gap-1.5 bg-[#E8112D] text-white hover:bg-[#D10F28]">
            <Maximize2 className="h-4 w-4" /> Present
          </Button>
        </div>
      </CardContent></Card>

      {/* Stage */}
      <div
        ref={stage}
        className={presenting ? 'fixed inset-0 z-[90] flex flex-col items-center justify-center bg-neutral-950' : 'relative'}
        onClick={presenting ? () => go(1) : undefined}
      >
        <Scaled className={presenting ? 'w-full max-h-screen' : 'w-full rounded-2xl shadow-[0_24px_60px_-24px_rgba(15,23,42,0.45)] ring-1 ring-black/5'}>
          {slides[i](i + 1, total)}
        </Scaled>
        <div className={`flex items-center gap-3 ${presenting ? 'absolute bottom-4 rounded-full bg-black/50 px-3 py-1.5 text-white' : 'mt-3 justify-center'}`} onClick={e => e.stopPropagation()}>
          <Button size="icon" variant={presenting ? 'ghost' : 'outline'} className="h-8 w-8 rounded-full" onClick={() => go(-1)} disabled={i === 0}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm tabular-nums">{i + 1} / {total}</span>
          <Button size="icon" variant={presenting ? 'ghost' : 'outline'} className="h-8 w-8 rounded-full" onClick={() => go(1)} disabled={i === total - 1}><ChevronRight className="h-4 w-4" /></Button>
          {presenting && <Button size="sm" variant="ghost" className="h-8 text-white" onClick={() => document.exitFullscreen?.().catch(() => setPresenting(false))}>Exit</Button>}
        </div>
      </div>

      {/* Thumbnails */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {slides.map((s, k) => (
          <button key={k} type="button" onClick={() => setI(k)} className={`overflow-hidden rounded-xl text-left transition ${k === i ? 'ring-2 ring-[#E8112D] ring-offset-2' : 'opacity-80 ring-1 ring-black/5 hover:opacity-100'}`}>
            <Scaled className="pointer-events-none w-full">{s(k + 1, total)}</Scaled>
          </button>
        ))}
      </div>

      {/* Print-only: every slide, one per page */}
      <div id="deck-print" className="hidden" aria-hidden>
        {printing && slides.map((s, k) => (
          <div key={k} className="deck-page"><div style={{ width: W, height: H }}>{s(k + 1, total)}</div></div>
        ))}
      </div>
    </div>
  )
}
