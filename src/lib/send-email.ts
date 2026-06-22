import jsPDF from 'jspdf'

export interface QuotationPdfData {
  companyName: string
  companyAddress?: string
  companyPhone?: string
  companyEmail?: string
  companyTin?: string
  logoDataUrl?: string
  quoteNumber: string
  quoteDate: string
  validUntil?: string
  clientName?: string
  subject?: string
  items: { item_name: string; quantity: number; unit?: string | null; unit_price: number; selling_price?: number | null; total_amount: number }[]
  subtotal: number
  vatAmount: number
  ewtAmount: number
  totalAmount: number
  notes?: string | null
}

export interface SendEmailPayload {
  to: string
  subject: string
  body: string
  pdfData?: QuotationPdfData
  /** @deprecated pass pdfData instead for faster generation */
  printHtml?: string
  pdfFilename?: string
}

function fmtAmt(n: number) {
  return (n ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })
}

async function buildQuotePdf(data: QuotationPdfData): Promise<string> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const W = pdf.internal.pageSize.getWidth()
  const margin = 36
  const contentW = W - margin * 2
  let y = margin

  // Load Questrial font
  try {
    const fontResp = await fetch('/fonts/Questrial-Regular.ttf')
    const fontBuf = await fontResp.arrayBuffer()
    const fontBase64 = btoa(String.fromCharCode(...new Uint8Array(fontBuf)))
    pdf.addFileToVFS('Questrial-Regular.ttf', fontBase64)
    pdf.addFont('Questrial-Regular.ttf', 'Questrial', 'normal')
  } catch { /* fall back to helvetica */ }

  const setFont = (weight: 'normal' | 'bold' = 'normal') => {
    try { pdf.setFont('Questrial', 'normal') } catch { pdf.setFont('helvetica', weight) }
  }

  // ── Header ──────────────────────────────────────────────────────────────
  const logoSize = 80
  let textStartX = margin

  if (data.logoDataUrl) {
    try {
      pdf.addImage(data.logoDataUrl, 'JPEG', margin, y, logoSize, logoSize)
      textStartX = margin + logoSize + 10
    } catch { /* skip logo on error */ }
  }

  // Company name vertically centered with logo
  setFont()
  pdf.setFontSize(14)
  pdf.setTextColor(185, 28, 28)
  pdf.text(data.companyName, textStartX, y + logoSize / 2 + 5)

  // Right: address/phone/tin
  setFont()
  pdf.setFontSize(8)
  pdf.setTextColor(107, 114, 128)
  const rightLines = [
    data.companyAddress,
    data.companyPhone,
    data.companyEmail,
    data.companyTin ? `TIN: ${data.companyTin}` : undefined,
  ].filter(Boolean) as string[]
  rightLines.forEach((line, i) => {
    pdf.text(line, W - margin, y + 8 + i * 10, { align: 'right' })
  })

  y += Math.max(logoSize, rightLines.length * 10) + 6
  pdf.setDrawColor(229, 231, 235)
  pdf.line(margin, y, W - margin, y)
  y += 12

  // ── Bill To / Quote# ─────────────────────────────────────────────────────
  pdf.setFontSize(8)
  setFont()
  pdf.setTextColor(156, 163, 175)
  pdf.text('BILL TO', margin, y)
  pdf.setFontSize(10)
  pdf.setTextColor(31, 41, 55)
  pdf.text(data.clientName ?? '-', margin, y + 11)
  if (data.subject) {
    setFont()
    pdf.setFontSize(8)
    pdf.setTextColor(156, 163, 175)
    pdf.text('SUBJECT', margin, y + 23)
    pdf.setTextColor(55, 65, 81)
    pdf.text(data.subject, margin, y + 32)
  }

  // Right: Quote#, Date, Valid Until
  const rx = W - margin
  pdf.setFontSize(8)
  setFont()
  pdf.setTextColor(156, 163, 175)
  pdf.text('QUOTE NUMBER', rx, y, { align: 'right' })
  pdf.setFontSize(10)
  pdf.setTextColor(31, 41, 55)
  pdf.text(data.quoteNumber, rx, y + 11, { align: 'right' })
  pdf.setFontSize(8)
  pdf.setTextColor(156, 163, 175)
  pdf.text('DATE', rx, y + 23, { align: 'right' })
  setFont()
  pdf.setFontSize(9)
  pdf.setTextColor(31, 41, 55)
  pdf.text(data.quoteDate, rx, y + 32, { align: 'right' })
  if (data.validUntil) {
    setFont()
    pdf.setFontSize(8)
    pdf.setTextColor(156, 163, 175)
    pdf.text('VALID UNTIL', rx, y + 44, { align: 'right' })
    setFont()
    pdf.setFontSize(9)
    pdf.setTextColor(31, 41, 55)
    pdf.text(data.validUntil, rx, y + 53, { align: 'right' })
  }

  y += 60
  pdf.setDrawColor(229, 231, 235)
  pdf.line(margin, y, W - margin, y)
  y += 14

  // ── QUOTATION title ───────────────────────────────────────────────────────
  setFont()
  pdf.setFontSize(16)
  pdf.setTextColor(185, 28, 28)
  pdf.text('QUOTATION', W / 2, y, { align: 'center' })
  y += 14

  // ── Items Table ───────────────────────────────────────────────────────────
  if (data.items.length > 0) {
    const cols = { num: 20, desc: contentW - 20 - 50 - 60 - 80 - 70, qty: 50, unit: 60, price: 80, total: 70 }
    const rowH = 16
    const headerY = y

    pdf.setFillColor(185, 28, 28)
    pdf.rect(margin, headerY, contentW, rowH, 'F')

    setFont()
    pdf.setFontSize(8)
    pdf.setTextColor(255, 255, 255)

    let cx = margin + 4
    pdf.text('#', cx + cols.num / 2, headerY + 11, { align: 'center' }); cx += cols.num
    pdf.text('Item Description', cx + 4, headerY + 11); cx += cols.desc
    pdf.text('QTY', cx + cols.qty / 2, headerY + 11, { align: 'center' }); cx += cols.qty
    pdf.text('Unit', cx + cols.unit / 2, headerY + 11, { align: 'center' }); cx += cols.unit
    pdf.text('Unit Price', cx + cols.price / 2, headerY + 11, { align: 'center' }); cx += cols.price
    pdf.text('Total', cx + cols.total / 2, headerY + 11, { align: 'center' })

    y += rowH

    data.items.forEach((item, i) => {
      const rowBg = i % 2 === 0 ? [255, 255, 255] : [249, 250, 251]
      pdf.setFillColor(rowBg[0], rowBg[1], rowBg[2])
      pdf.rect(margin, y, contentW, rowH, 'F')

      setFont()
      pdf.setFontSize(8)
      pdf.setTextColor(156, 163, 175)

      let rx2 = margin + 4
      pdf.text(String(i + 1), rx2 + cols.num / 2, y + 11, { align: 'center' }); rx2 += cols.num

      pdf.setTextColor(31, 41, 55)
      const maxDescW = cols.desc - 8
      const descText = pdf.splitTextToSize(item.item_name ?? '-', maxDescW)[0]
      pdf.text(descText, rx2 + 4, y + 11); rx2 += cols.desc

      pdf.text(String(item.quantity), rx2 + cols.qty / 2, y + 11, { align: 'center' }); rx2 += cols.qty

      pdf.setTextColor(107, 114, 128)
      pdf.text(item.unit ?? '-', rx2 + cols.unit / 2, y + 11, { align: 'center' }); rx2 += cols.unit

      pdf.setTextColor(31, 41, 55)
      const price = item.selling_price ?? item.unit_price ?? 0
      pdf.text(fmtAmt(price), rx2 + cols.price - 2, y + 11, { align: 'right' }); rx2 += cols.price
      pdf.text(fmtAmt(item.total_amount), rx2 + cols.total - 2, y + 11, { align: 'right' })

      y += rowH
    })

    y += 8
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const totW = 180
  const totX = W - margin - totW
  const hasVat = (data.vatAmount ?? 0) > 0
  const hasEwt = (data.ewtAmount ?? 0) > 0

  y += 26 // 2 row space before subtotal

  setFont()
  pdf.setFontSize(9)
  pdf.setTextColor(107, 114, 128)
  pdf.text('Subtotal', totX, y)
  pdf.setTextColor(31, 41, 55)
  pdf.text(fmtAmt(data.subtotal), W - margin, y, { align: 'right' })
  y += 13

  if (hasVat) {
    pdf.setDrawColor(229, 231, 235)
    pdf.line(totX, y - 3, W - margin, y - 3)
    pdf.setTextColor(107, 114, 128)
    pdf.text('VAT (12%)', totX, y)
    pdf.setTextColor(37, 99, 235)
    pdf.text(fmtAmt(data.vatAmount), W - margin, y, { align: 'right' })
    y += 13
  }

  if (hasEwt) {
    pdf.setDrawColor(229, 231, 235)
    pdf.line(totX, y - 3, W - margin, y - 3)
    pdf.setTextColor(107, 114, 128)
    pdf.text('EWT', totX, y)
    pdf.setTextColor(185, 28, 28)
    pdf.text(`-${fmtAmt(data.ewtAmount)}`, W - margin, y, { align: 'right' })
    y += 13
  }

  pdf.setDrawColor(229, 231, 235)
  pdf.line(totX, y - 3, W - margin, y - 3)
  setFont()
  pdf.setFontSize(10)
  pdf.setTextColor(31, 41, 55)
  pdf.text('Total', totX, y)
  pdf.setTextColor(185, 28, 28)
  pdf.text(fmtAmt(data.totalAmount), W - margin, y, { align: 'right' })
  y += 16

  // ── Notes ─────────────────────────────────────────────────────────────────
  if (data.notes) {
    y += 4
    pdf.setDrawColor(229, 231, 235)
    pdf.line(margin, y, W - margin, y)
    y += 10
    setFont()
    pdf.setFontSize(8)
    pdf.setTextColor(156, 163, 175)
    pdf.text('NOTES / TERMS', margin, y)
    y += 10
    setFont()
    pdf.setFontSize(9)
    pdf.setTextColor(55, 65, 81)
    const noteLines = pdf.splitTextToSize(data.notes, contentW)
    pdf.text(noteLines, margin, y)
    y += noteLines.length * 11
  }

  // ── Signatures ────────────────────────────────────────────────────────────
  y += 40
  const sigW = (contentW - 40) / 2
  pdf.setDrawColor(55, 65, 81)
  pdf.line(margin, y, margin + sigW, y)
  setFont()
  pdf.setFontSize(9)
  pdf.setTextColor(55, 65, 81)
  pdf.text('PREPARED BY', margin + sigW / 2, y + 10, { align: 'center' })
  setFont()
  pdf.setFontSize(8)
  pdf.setTextColor(156, 163, 175)
  pdf.text('Signature over Printed Name', margin + sigW / 2, y + 19, { align: 'center' })

  const sig2X = W - margin - sigW
  pdf.setDrawColor(55, 65, 81)
  pdf.line(sig2X, y, W - margin, y)
  setFont()
  pdf.setFontSize(9)
  pdf.setTextColor(55, 65, 81)
  pdf.text('ACCEPTED BY', sig2X + sigW / 2, y + 10, { align: 'center' })
  setFont()
  pdf.setFontSize(8)
  pdf.setTextColor(156, 163, 175)
  pdf.text('Signature over Printed Name / Date', sig2X + sigW / 2, y + 19, { align: 'center' })

  return pdf.output('datauristring').split(',')[1]
}

async function htmlToPdfBase64(html: string): Promise<string> {
  const { default: html2canvas } = await import('html2canvas')
  const stripped = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;height:1px;border:none;visibility:hidden;'
  document.body.appendChild(iframe)
  await new Promise<void>(resolve => { iframe.onload = () => resolve(); iframe.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;margin:0;padding:24px;font-size:11px;}</style></head><body>${stripped}</body></html>` })
  await new Promise(r => setTimeout(r, 200))
  const iBody = iframe.contentDocument?.body
  if (!iBody) { document.body.removeChild(iframe); throw new Error('iframe body not found') }
  const contentH = iBody.scrollHeight || 1000
  iframe.style.height = contentH + 'px'
  await new Promise(r => setTimeout(r, 50))
  try {
    const canvas = await html2canvas(iBody, { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: 794, windowHeight: contentH, logging: false })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const imgH = (canvas.height / canvas.width) * pageW
    if (imgH <= pageH) { pdf.addImage(imgData, 'PNG', 0, 0, pageW, imgH) }
    else { const n = Math.ceil(imgH / pageH); for (let p = 0; p < n; p++) { if (p > 0) pdf.addPage(); pdf.addImage(imgData, 'PNG', 0, -(p * pageH), pageW, imgH) } }
    return pdf.output('datauristring').split(',')[1]
  } finally { document.body.removeChild(iframe) }
}

export async function sendEmail(payload: SendEmailPayload): Promise<void> {
  const pdfFilename = payload.pdfFilename ?? 'attachment.pdf'
  let pdfBase64: string | undefined
  if (payload.pdfData) {
    pdfBase64 = await buildQuotePdf(payload.pdfData)
  } else if (payload.printHtml) {
    pdfBase64 = await htmlToPdfBase64(payload.printHtml)
  }

  const res = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: payload.to, subject: payload.subject, body: payload.body, pdfBase64, pdfFilename }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? `Email API error ${res.status}`)
  }
}
