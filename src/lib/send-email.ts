import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export interface SendEmailPayload {
  to: string
  subject: string
  body: string
  /** Rendered HTML string of the document (e.g. from buildPOHtml or printRef.innerHTML) */
  printHtml?: string
  pdfFilename?: string
}

// Minimal safe CSS that replaces Tailwind utility classes with hex values,
// avoiding lab()/oklch() colors that html2canvas cannot parse.
const SAFE_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111827; background: #fff; margin: 0; padding: 24px; }
  .font-sans { font-family: Arial, sans-serif; }
  .font-mono { font-family: monospace; }
  .font-bold { font-weight: 700; }
  .font-semibold { font-weight: 600; }
  .font-medium { font-weight: 500; }
  .font-extrabold { font-weight: 800; }
  .font-normal { font-weight: 400; }
  .italic { font-style: italic; }
  .text-red-700 { color: #b91c1c; }
  .text-blue-600 { color: #2563eb; }
  .text-gray-800 { color: #1f2937; }
  .text-gray-700 { color: #374151; }
  .text-gray-500 { color: #6b7280; }
  .text-gray-400 { color: #9ca3af; }
  .text-gray-300 { color: #d1d5db; }
  .text-white { color: #ffffff; }
  .text-yellow-600 { color: #ca8a04; }
  .text-orange-600 { color: #ea580c; }
  .bg-white { background-color: #ffffff; }
  .bg-gray-50 { background-color: #f9fafb; }
  .bg-red-700 { background-color: #b91c1c; }
  .bg-red-100 { background-color: #fee2e2; }
  .bg-blue-100 { background-color: #dbeafe; }
  .bg-green-100 { background-color: #dcfce7; }
  .bg-yellow-100 { background-color: #fef9c3; }
  .border { border: 1px solid #e5e7eb; }
  .border-b { border-bottom: 1px solid #e5e7eb; }
  .border-t { border-top: 1px solid #e5e7eb; }
  .rounded { border-radius: 4px; }
  .rounded-lg { border-radius: 8px; }
  .shadow-sm { box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
  .p-5 { padding: 20px; }
  .p-6 { padding: 24px; }
  .px-1\\.5 { padding-left: 6px; padding-right: 6px; }
  .py-1 { padding-top: 4px; padding-bottom: 4px; }
  .pt-2 { padding-top: 8px; }
  .pt-0\\.5 { padding-top: 2px; }
  .pb-3 { padding-bottom: 12px; }
  .mt-1 { margin-top: 4px; }
  .mt-1\\.5 { margin-top: 6px; }
  .mb-1 { margin-bottom: 4px; }
  .space-y-3 > * + * { margin-top: 12px; }
  .space-y-0\\.5 > * + * { margin-top: 2px; }
  .space-y-1 > * + * { margin-top: 4px; }
  .flex { display: flex; }
  .grid { display: grid; }
  .items-center { align-items: center; }
  .items-start { align-items: flex-start; }
  .justify-between { justify-content: space-between; }
  .justify-end { justify-content: flex-end; }
  .justify-center { justify-content: center; }
  .text-left { text-align: left; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .w-full { width: 100%; }
  .w-52 { width: 208px; }
  .w-6 { width: 24px; }
  .w-14 { width: 56px; }
  .w-16 { width: 64px; }
  .w-20 { width: 80px; }
  .w-24 { width: 96px; }
  .gap-2 { gap: 8px; }
  .gap-2\\.5 { gap: 10px; }
  .gap-3 { gap: 12px; }
  .shrink-0 { flex-shrink: 0; }
  .leading-tight { line-height: 1.25; }
  .uppercase { text-transform: uppercase; }
  .tracking-widest { letter-spacing: 0.1em; }
  .whitespace-pre-wrap { white-space: pre-wrap; }
  .grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
  .border-collapse { border-collapse: collapse; }
  table { width: 100%; border-collapse: collapse; }
  th, td { font-size: 10px; }
  .\\[\\&_th\\]\\:text-white th { color: #fff; }
  .text-\\[13px\\] { font-size: 13px; }
  .text-\\[11px\\] { font-size: 11px; }
  .text-\\[10px\\] { font-size: 10px; }
  .text-\\[9px\\] { font-size: 9px; }
  .text-xs { font-size: 12px; }
  .text-sm { font-size: 14px; }
  .h-12 { height: 48px; }
  .w-12 { width: 48px; }
  .object-cover { object-fit: cover; }
`

/** Renders an HTML string to a PDF and returns base64. */
async function htmlToPdfBase64(html: string): Promise<string> {
  // Strip external scripts (Tailwind CDN etc) — html2canvas can't handle lab()/oklch() from Tailwind v4
  const stripped = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:white;z-index:-1;overflow:hidden;'

  // Inject safe hex-based CSS instead of letting Tailwind CDN apply oklch/lab colors
  const style = document.createElement('style')
  style.textContent = SAFE_CSS
  container.appendChild(style)

  const inner = document.createElement('div')
  inner.innerHTML = stripped
  container.appendChild(inner)

  document.body.appendChild(container)
  await new Promise(r => setTimeout(r, 200))

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      windowWidth: 794,
      logging: false,
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const imgH = (canvas.height / canvas.width) * pageW

    if (imgH <= pageH) {
      pdf.addImage(imgData, 'PNG', 0, 0, pageW, imgH)
    } else {
      // Multi-page: slice the canvas image across pages
      const totalPages = Math.ceil(imgH / pageH)
      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, -(page * pageH), pageW, imgH)
      }
    }

    return pdf.output('datauristring').split(',')[1]
  } finally {
    document.body.removeChild(container)
  }
}

/**
 * Sends an email via /api/send-email using CDSC's Gmail account.
 * If printHtml is provided it is rendered to PDF and attached.
 */
export async function sendEmail(payload: SendEmailPayload): Promise<void> {
  let pdfBase64: string | undefined
  const pdfFilename = payload.pdfFilename ?? 'attachment.pdf'

  if (payload.printHtml) {
    pdfBase64 = await htmlToPdfBase64(payload.printHtml)
  }

  const res = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: payload.to,
      subject: payload.subject,
      body: payload.body,
      pdfBase64,
      pdfFilename,
    }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? `Email API error ${res.status}`)
  }
}
