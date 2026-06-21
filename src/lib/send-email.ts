import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface EmailAttachmentOptions {
  /** Raw HTML string to render as PDF attachment */
  htmlContent?: string
  /** Structured data for table-based PDF (used if htmlContent is not set) */
  tableData?: {
    title: string
    headers: string[]
    rows: (string | number)[][]
    footerRows?: (string | number)[][]
  }
  pdfFilename?: string
}

export interface SendEmailPayload {
  to: string
  subject: string
  body: string
  attachment?: EmailAttachmentOptions
}

/** Generates a simple PDF from table data and returns base64 string. */
function generateTablePdf(opts: NonNullable<EmailAttachmentOptions['tableData']>): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()

  doc.setFontSize(16)
  doc.setTextColor(185, 28, 28)
  doc.text('CDSC INDUSTRIAL', pageW / 2, 50, { align: 'center' })

  doc.setFontSize(13)
  doc.setTextColor(40, 40, 40)
  doc.text(opts.title, pageW / 2, 70, { align: 'center' })

  autoTable(doc, {
    startY: 90,
    head: [opts.headers],
    body: opts.rows.map(r => r.map(String)),
    foot: opts.footerRows ? opts.footerRows.map(r => r.map(String)) : undefined,
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [185, 28, 28], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [245, 245, 245], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [252, 252, 252] },
  })

  return doc.output('datauristring').split(',')[1]
}

/**
 * Sends an email via the /api/send-email route using CDSC's Gmail account.
 * Optionally attaches a generated PDF.
 */
export async function sendEmail(payload: SendEmailPayload): Promise<void> {
  let pdfBase64: string | undefined
  const pdfFilename = payload.attachment?.pdfFilename ?? 'attachment.pdf'

  if (payload.attachment?.tableData) {
    pdfBase64 = generateTablePdf(payload.attachment.tableData)
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
