import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { rateLimited, clientIp } from '@/lib/supabase/api-auth'

export const maxDuration = 30

// Public endpoint for the website's quotation / contact form. Unlike
// /api/send-email it can ONLY email the CDSC inbox (never an address the
// visitor chooses), is rate-limited per visitor, and caps attachment size —
// so it can't be used to send spam from the company account.
export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  if (rateLimited(`quote-notify:${ip}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests — please try again in a few minutes.' }, { status: 429 })
  }
  try {
    const { subject, body, website, attachment } = await req.json()
    if (website) return NextResponse.json({ success: true }) // honeypot field filled → bot
    if (typeof subject !== 'string' || typeof body !== 'string' || !subject.trim() || !body.trim()) {
      return NextResponse.json({ error: 'Missing details.' }, { status: 400 })
    }
    if (subject.length > 200 || body.length > 8000) {
      return NextResponse.json({ error: 'Message is too long.' }, { status: 413 })
    }
    if (attachment && (typeof attachment.base64 !== 'string' || attachment.base64.length > 7_000_000)) {
      return NextResponse.json({ error: 'Attachment is too large (max 5 MB).' }, { status: 413 })
    }

    const gmailUser = process.env.GMAIL_USER
    const gmailPass = process.env.GMAIL_APP_PASSWORD
    const inbox = process.env.COMPANY_INBOX_EMAIL || gmailUser
    if (!gmailUser || !gmailPass || !inbox) {
      return NextResponse.json({ error: 'Email is not configured.' }, { status: 500 })
    }

    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailPass } })
    await transporter.sendMail({
      from: `CDSC Website <${gmailUser}>`,
      to: inbox,
      subject: `[Website] ${subject.replace(/[\r\n]+/g, ' ').trim()}`,
      text: body,
      attachments: attachment?.base64 && attachment?.filename ? [{
        filename: String(attachment.filename).slice(0, 120),
        content: attachment.base64,
        encoding: 'base64',
        contentType: typeof attachment.contentType === 'string' ? attachment.contentType : 'application/octet-stream',
      }] : undefined,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[quote-notify]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Could not send notification.' }, { status: 500 })
  }
}
