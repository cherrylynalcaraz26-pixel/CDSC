// Document header ("letterhead") printed at the top of every PDF / printout —
// Purchase Orders, Quotations, Sales Orders. Set in Settings → Document Header.
//
// Two modes:
//   • standard — the logo plus the company name and detail lines, laid out
//                logo-left, logo-right or centered;
//   • image    — an uploaded header image (e.g. the company's existing
//                letterhead banner) printed full width.
// Empty fields fall back to the Company & Business Profile, so a fresh install
// prints the same header as before.
//
// Stored as JSON in system_settings.pdf_header (migration 043).

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type LetterheadLayout = 'logo-left' | 'logo-right' | 'centered'

export interface Letterhead {
  mode: 'standard' | 'image'
  image_url: string        // header image (image mode)
  show_logo: boolean
  logo_url: string         // '' = company logo
  layout: LetterheadLayout
  company_name: string     // '' = company name from the profile
  lines: string            // one detail per line; '' = address / contact / TIN from the profile
  accent: string           // company-name colour
  footer: string           // optional small line printed under the header rule
}

export const DEFAULT_LETTERHEAD: Letterhead = {
  mode: 'standard',
  image_url: '',
  show_logo: true,
  logo_url: '',
  layout: 'logo-left',
  company_name: '',
  lines: '',
  accent: '#b91c1c',
  footer: '',
}

export interface LetterheadCompany {
  company_name?: string | null
  address?: string | null
  city?: string | null
  province?: string | null
  phone?: string | null
  mobile?: string | null
  email?: string | null
  website?: string | null
  tin?: string | null
  logo_url?: string | null
}

export function normalizeLetterhead(raw: unknown): Letterhead {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Letterhead>
  return {
    ...DEFAULT_LETTERHEAD,
    ...r,
    mode: r.mode === 'image' ? 'image' : 'standard',
    layout: (['logo-left', 'logo-right', 'centered'] as const).includes(r.layout as LetterheadLayout) ? r.layout as LetterheadLayout : 'logo-left',
    show_logo: r.show_logo !== false,
    accent: /^#[0-9a-f]{6}$/i.test(r.accent ?? '') ? r.accent! : DEFAULT_LETTERHEAD.accent,
  }
}

/** The name, detail lines and logo that will actually print. */
export function resolveLetterhead(lh: Letterhead, co: LetterheadCompany | null | undefined, origin = '') {
  const name = lh.company_name.trim() || co?.company_name || 'CDSC Industrial Supply'
  const custom = lh.lines.split('\n').map(s => s.trim()).filter(Boolean)
  const lines = custom.length ? custom : [
    co?.address,
    [co?.phone, co?.mobile, co?.email].filter(Boolean).join(' | '),
    co?.tin ? `TIN: ${co.tin}` : '',
  ].filter((s): s is string => !!s)
  const logo = lh.show_logo ? (lh.logo_url || co?.logo_url || `${origin}/cdsc-logo.jpg`) : ''
  return { name, lines, logo }
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

/** Header block for the HTML print/preview documents (inline styles only). */
export function letterheadHtml(lh: Letterhead, co: LetterheadCompany | null | undefined): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const rule = 'border-bottom:1px solid #e5e7eb;padding-bottom:12px;margin-bottom:14px'
  const footer = lh.footer.trim() ? `<div style="font-size:9px;color:#6b7280;text-align:center;margin:-8px 0 12px">${esc(lh.footer.trim())}</div>` : ''
  if (lh.mode === 'image' && lh.image_url) {
    return `<div style="${rule}"><img src="${esc(lh.image_url)}" alt="" style="display:block;width:100%;max-height:140px;object-fit:contain"/></div>${footer}`
  }
  const { name, lines, logo } = resolveLetterhead(lh, co, origin)
  const img = logo ? `<img src="${esc(logo)}" alt="" style="width:64px;height:64px;object-fit:contain;border-radius:4px;flex-shrink:0"/>` : ''
  const align = lh.layout === 'centered' ? 'center' : lh.layout === 'logo-right' ? 'left' : 'right'
  const text = `<div style="text-align:${align}">
      <div style="font-size:14px;font-weight:bold;color:${lh.accent};margin-bottom:2px">${esc(name)}</div>
      <div style="font-size:9px;color:#6b7280;line-height:1.45">${lines.map(l => `<div>${esc(l)}</div>`).join('')}</div>
    </div>`
  if (lh.layout === 'centered') {
    return `<div style="${rule};display:flex;flex-direction:column;align-items:center;gap:6px">${img}${text}</div>${footer}`
  }
  const left = lh.layout === 'logo-right' ? text : img
  const right = lh.layout === 'logo-right' ? img : text
  return `<div style="${rule};display:flex;justify-content:space-between;align-items:flex-start;gap:16px">${left || '<div></div>'}${right}</div>${footer}`
}

// ── Native (jsPDF) documents ──────────────────────────────────────────────

export interface LetterheadPdf {
  mode: 'standard' | 'image'
  imageDataUrl?: string
  logoDataUrl?: string
  name: string
  lines: string[]
  accent: string
  layout: LetterheadLayout
  footer: string
}

async function toDataUrl(url: string): Promise<string | undefined> {
  if (!url) return undefined
  try {
    const blob = await fetch(url).then(r => { if (!r.ok) throw new Error(); return r.blob() })
    return await new Promise<string>(res => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(blob) })
  } catch { return undefined }
}

/** Loads the images as data URLs so jsPDF can embed them. */
export async function letterheadForPdf(lh: Letterhead, co: LetterheadCompany | null | undefined): Promise<LetterheadPdf> {
  const { name, lines, logo } = resolveLetterhead(lh, co)
  const useImage = lh.mode === 'image' && !!lh.image_url
  return {
    mode: useImage ? 'image' : 'standard',
    imageDataUrl: useImage ? await toDataUrl(lh.image_url) : undefined,
    logoDataUrl: !useImage && logo ? await toDataUrl(logo) : undefined,
    name, lines, accent: lh.accent, layout: lh.layout, footer: lh.footer.trim(),
  }
}

/** Loads the saved letterhead (defaults if the column/row isn't there yet). */
export async function loadLetterhead(): Promise<Letterhead> {
  const { data, error } = await createClient().from('system_settings').select('pdf_header').single()
  if (error) return DEFAULT_LETTERHEAD
  return normalizeLetterhead((data as { pdf_header?: unknown } | null)?.pdf_header)
}

export function useLetterhead(): Letterhead {
  const [lh, setLh] = useState<Letterhead>(DEFAULT_LETTERHEAD)
  useEffect(() => { let on = true; loadLetterhead().then(v => { if (on) setLh(v) }); return () => { on = false } }, [])
  return lh
}
