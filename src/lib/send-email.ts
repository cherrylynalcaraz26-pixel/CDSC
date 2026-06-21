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

/** Renders an HTML string to a PDF and returns base64. */
async function htmlToPdfBase64(html: string): Promise<string> {
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:white;padding:0;z-index:-1;'
  container.innerHTML = html
  document.body.appendChild(container)

  // Wait for any images/fonts to settle
  await new Promise(r => setTimeout(r, 300))

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      windowWidth: 794,
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const ratio = canvas.width / canvas.height
    const imgH = pageW / ratio
    let posY = 0

    // If content is taller than one page, split across pages
    if (imgH <= pageH) {
      pdf.addImage(imgData, 'PNG', 0, 0, pageW, imgH)
    } else {
      const totalPages = Math.ceil(imgH / pageH)
      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, posY, pageW, imgH)
        posY -= pageH
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
