'use client'

// HTML → A4 PDF that matches what the user previewed.
//
// The document is laid out at a fixed A4 width (794 CSS px = 595 pt), the same
// width the on-screen preview uses, so text wraps identically. Pages are then
// cut from one rasterized image, choosing cut points that respect:
//   • forced breaks  — any element with class "brk" starts a new page;
//   • keep-together  — p, tr, li, headings and elements with class
//                      "keep" / "sig" / "conf" / "to" are never split
//                      (a block taller than a page is split as a last resort);
//   • headings       — an h2 left at the very bottom of a page moves to the next.

import jsPDF from 'jspdf'

export const SHEET_W = 794             // CSS px, A4 width at 96 dpi
const PT_PER_PX = 595.28 / SHEET_W
const PAGE_H_PT = 841.89
const MARGIN_Y_PT = 34
const PAGE_BODY_PX = (PAGE_H_PT - MARGIN_Y_PT * 2) / PT_PER_PX

const KEEP = 'p, tr, li, h1, h2, h3, .keep, .sig, .conf, .to, .sub'

/** Full HTML document at A4 width. Use the same string for preview and PDF. */
export function sheetDoc(inner: string, css: string, extraCss = '') {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${css}
    html,body{margin:0;padding:0;background:#fff}
    body{width:${SHEET_W}px}
    .sheet{padding:0 52px;box-sizing:border-box;width:${SHEET_W}px}
    ${extraCss}</style></head><body><div class="sheet">${inner}</div></body></html>`
}

/**
 * Replace off-site images (e.g. the Google Drive logo) with same-origin data
 * URLs. Drive sends no CORS headers, so html2canvas would otherwise leave the
 * image out of the PDF even though the browser displays it.
 */
async function inlineImages(d: Document) {
  await Promise.all(Array.from(d.images).map(async img => {
    const src = img.getAttribute('src') ?? ''
    if (!/^https?:/i.test(src)) return
    let url: URL
    try { url = new URL(src, window.location.href) } catch { return }
    const fetchUrl = url.origin === window.location.origin ? url.href : `/api/image-proxy?url=${encodeURIComponent(url.href)}`
    try {
      const blob = await fetch(fetchUrl).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.blob() })
      const dataUrl = await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.onerror = rej; fr.readAsDataURL(blob) })
      await new Promise<void>(res => { img.onload = () => res(); img.onerror = () => res(); img.src = dataUrl })
    } catch (e) {
      console.warn('PDF: could not embed image', src, e)
    }
  }))
}

export async function pagedPdfBase64(doc: string): Promise<string> {
  const { default: html2canvas } = await import('html2canvas')
  const iframe = document.createElement('iframe')
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${SHEET_W}px;height:10px;border:0;visibility:hidden`
  document.body.appendChild(iframe)
  try {
    await new Promise<void>(res => { iframe.onload = () => res(); iframe.srcdoc = doc })
    const d = iframe.contentDocument!
    await inlineImages(d)
    const imgs = Array.from(d.images)
    await Promise.race([
      Promise.all([
        ...imgs.map(i => i.complete ? null : new Promise<void>(r => { i.onload = () => r(); i.onerror = () => r() })),
        d.fonts?.ready,
      ]),
      new Promise(r => setTimeout(r, 4000)),
    ])
    const body = d.body
    iframe.style.height = body.scrollHeight + 'px'
    await new Promise(r => setTimeout(r, 60))

    // Measure in html2canvas's own cloned document: that clone is what gets
    // drawn, and its layout can differ slightly from the source iframe.
    let end = 0, breaks: number[] = [], blocks: { top: number; bottom: number }[] = [], heads: { top: number; bottom: number }[] = []
    const scale = 2
    const canvas = await html2canvas(body, {
      scale, useCORS: true, backgroundColor: '#ffffff', windowWidth: SHEET_W, windowHeight: body.scrollHeight, logging: false,
      onclone: (cd: Document) => {
        const top0 = cd.body.getBoundingClientRect().top
        const rect = (el: Element) => { const r = el.getBoundingClientRect(); return { top: r.top - top0, bottom: r.bottom - top0 } }
        breaks = Array.from(cd.querySelectorAll('.brk')).map(el => rect(el).top).sort((a, b) => a - b)
        blocks = Array.from(cd.querySelectorAll(KEEP)).map(rect).filter(r => r.bottom > r.top)
        heads = Array.from(cd.querySelectorAll('h1, h2, h3, .sub')).map(rect)
        end = Math.max(0, ...Array.from(cd.body.querySelectorAll('*')).map(el => rect(el).bottom))
      },
    })
    // Stop at the last drawn element so trailing whitespace never makes a blank page.
    const total = Math.min(canvas.height / scale, Math.ceil(end) + 2 || canvas.height / scale)

    // Choose page cut points in CSS px.
    const cuts: number[] = []
    let y = 0
    while (y < total - 1) {
      const limit = y + PAGE_BODY_PX
      const forced = breaks.find(b => b > y + 4 && b <= limit)
      let cut: number
      if (forced !== undefined) cut = forced
      else if (limit >= total) cut = total
      else {
        cut = limit
        for (let guard = 0; guard < 200; guard++) {
          const hit = blocks.find(b => b.top < cut - 0.5 && b.bottom > cut + 0.5 && b.top > y + 1)
          if (!hit) break
          cut = hit.top
        }
        // Don't strand a heading (or the line under it) at the foot of a page.
        for (let guard = 0; guard < 5; guard++) {
          const h = heads.find(h => h.top > y + 1 && h.top < cut && cut - h.bottom < 60)
          if (!h) break
          cut = h.top
        }
        if (cut < y + PAGE_BODY_PX * 0.25) cut = limit // a block taller than a page
      }
      cuts.push(cut)
      y = cut
    }

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    let from = 0
    cuts.forEach((cut, i) => {
      const sy = Math.round(from * scale)
      const sh = Math.max(1, Math.round((cut - from) * scale))
      const c = document.createElement('canvas')
      c.width = canvas.width; c.height = sh
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, sh)
      ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh)
      if (i > 0) pdf.addPage()
      pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, MARGIN_Y_PT, pageW, sh / scale * PT_PER_PX)
      pdf.setFontSize(8); pdf.setTextColor(150)
      pdf.text(`Page ${i + 1} of ${cuts.length}`, pageW / 2, PAGE_H_PT - 16, { align: 'center' })
      from = cut
    })
    return pdf.output('datauristring').split(',')[1]
  } finally {
    document.body.removeChild(iframe)
  }
}
