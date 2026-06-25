import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    return NextResponse.redirect(new URL(`/confirm?status=error&msg=Server+not+configured`, req.url))
  }

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  // Fetch the SO
  const { data: so, error: soErr } = await supabase
    .from('sales_orders')
    .select('id, so_number, client_name, client_po_number, status')
    .eq('id', id)
    .single()

  if (soErr || !so) {
    return NextResponse.redirect(new URL(`/confirm?status=error&msg=Order+not+found`, req.url))
  }

  if (so.status === 'confirmed') {
    return NextResponse.redirect(new URL(`/confirm?status=already&type=so&ref=${so.so_number ?? id}`, req.url))
  }

  // Update status to confirmed
  const { error: updErr } = await supabase
    .from('sales_orders')
    .update({ status: 'confirmed' })
    .eq('id', id)

  if (updErr) {
    return NextResponse.redirect(new URL(`/confirm?status=error&msg=Failed+to+confirm`, req.url))
  }

  // Send thank-you email to client
  try {
    const { data: clientRow } = await supabase
      .from('clients')
      .select('email')
      .eq('company_name', so.client_name ?? '')
      .single()

    const { data: settings } = await supabase
      .from('system_settings')
      .select('company_name, email, phone')
      .single()

    const gmailUser = process.env.GMAIL_USER
    const gmailPass = process.env.GMAIL_APP_PASSWORD

    if (gmailUser && gmailPass && clientRow?.email) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPass },
      })
      const companyName = settings?.company_name ?? 'CDSC Industrial Supply'
      const subject = `Order Confirmed — ${so.so_number ?? 'Your Order'}`
      const html = `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <h2 style="color:#1f2937;margin-bottom:4px">Thank you for confirming your order!</h2>
          <p style="color:#6b7280;margin-bottom:24px">We have received your confirmation for the following order:</p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:24px">
            <div style="margin-bottom:8px"><span style="color:#9ca3af;font-size:13px">SO Number</span><br/><strong style="font-family:monospace;color:#dc2626">${so.so_number ?? '—'}</strong></div>
            ${so.client_po_number ? `<div style="margin-bottom:8px"><span style="color:#9ca3af;font-size:13px">Your PO Reference</span><br/><strong>${so.client_po_number}</strong></div>` : ''}
            <div><span style="color:#9ca3af;font-size:13px">Status</span><br/><strong style="color:#16a34a">✓ Confirmed</strong></div>
          </div>
          <p style="color:#374151">Our team will process your order promptly. We'll keep you updated on the delivery status.</p>
          <p style="color:#374151;margin-top:16px">If you have any questions, please contact us at <a href="mailto:${settings?.email ?? gmailUser}" style="color:#dc2626">${settings?.email ?? gmailUser}</a>${settings?.phone ? ` or call ${settings.phone}` : ''}.</p>
          <p style="color:#6b7280;margin-top:24px;font-size:13px">— ${companyName}</p>
        </div>
      `
      await transporter.sendMail({
        from: `${companyName} <${gmailUser}>`,
        to: clientRow.email,
        subject,
        html,
      })
    }
  } catch {
    // Non-fatal — confirmation already succeeded
  }

  return NextResponse.redirect(new URL(`/confirm?status=ok&type=so&ref=${so.so_number ?? id}`, req.url))
}
