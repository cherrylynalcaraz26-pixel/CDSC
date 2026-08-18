import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { to, subject, body, htmlBody, pdfBase64, pdfFilename, attachments: extraAttachments } = await req.json()

    if (!to || !subject) {
      return NextResponse.json({ error: 'Missing required fields: to, subject' }, { status: 400 })
    }

    const gmailUser = process.env.GMAIL_USER
    const gmailPass = process.env.GMAIL_APP_PASSWORD

    if (!gmailUser || !gmailPass) {
      return NextResponse.json({ error: 'Email service not configured on the server.' }, { status: 500 })
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    })

    const attachments: nodemailer.SendMailOptions['attachments'] = []
    if (pdfBase64 && pdfFilename) {
      attachments.push({
        filename: pdfFilename,
        content: pdfBase64,
        encoding: 'base64',
        contentType: 'application/pdf',
      })
    }
    if (Array.isArray(extraAttachments)) {
      for (const a of extraAttachments) {
        if (a?.base64 && a?.filename) {
          attachments.push({
            filename: a.filename,
            content: a.base64,
            encoding: 'base64',
            contentType: a.contentType || 'application/pdf',
          })
        }
      }
    }

    await transporter.sendMail({
      from: `CDSC Industrial Supply <${gmailUser}>`,
      to,
      subject,
      text: body,
      html: htmlBody ?? body.replace(/\n/g, '<br/>'),
      attachments,
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send email'
    console.error('[send-email]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
