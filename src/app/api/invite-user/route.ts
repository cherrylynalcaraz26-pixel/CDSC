import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  try {
    const { email, full_name, role, department, company } = await req.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'Server not configured for user creation.' }, { status: 500 })
    }

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const normalizedEmail = email.trim().toLowerCase()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin

    // Generate an invite link instead of setting a random password no one
    // will ever see — that left invited users with no way to log in.
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'invite',
      email: normalizedEmail,
      options: {
        data: { full_name, role },
        redirectTo: `${appUrl}/set-password`,
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (data.user) {
      await admin.from('profiles').upsert({
        id: data.user.id,
        email: normalizedEmail,
        full_name: full_name || null,
        role: role || 'employee',
        department: department || null,
        company: company || null,
        status: 'active',
      })
    }

    const actionLink = data.properties?.action_link
    const gmailUser = process.env.GMAIL_USER
    const gmailPass = process.env.GMAIL_APP_PASSWORD
    let emailSent = false

    if (actionLink && gmailUser && gmailPass) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: gmailUser, pass: gmailPass },
        })
        const roleLabel = typeof role === 'string' ? role.replace(/_/g, ' ') : ''
        const html = `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
            <h2 style="color:#1f2937;margin-bottom:4px">You've been invited to CDSC Industrial Supply</h2>
            <p style="color:#6b7280">${full_name ? `Hi ${full_name},` : 'Hello,'} an account has been created for you${roleLabel ? ` as <strong>${roleLabel}</strong>` : ''}. Click below to set your password and get started.</p>
            <div style="text-align:center;margin:28px 0">
              <a href="${actionLink}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 32px;border-radius:8px">Set Your Password</a>
            </div>
            <p style="color:#9ca3af;font-size:12px">This link is single-use and will expire. If you weren't expecting this, you can ignore this email.</p>
          </div>`
        await transporter.sendMail({
          from: `CDSC Industrial Supply <${gmailUser}>`,
          to: normalizedEmail,
          subject: "You're invited to CDSC Industrial Supply",
          html,
        })
        emailSent = true
      } catch (mailErr) {
        console.error('[invite-user] failed to send invite email', mailErr)
      }
    }

    return NextResponse.json({
      success: true,
      userId: data.user?.id,
      emailSent,
      // Surfaced so the admin can relay it manually if the invite email
      // couldn't be sent (e.g. email service not configured).
      actionLink: emailSent ? undefined : actionLink,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to invite user'
    console.error('[invite-user]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
