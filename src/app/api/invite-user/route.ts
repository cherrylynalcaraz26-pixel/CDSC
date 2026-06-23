import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    // Generate a temporary password — user should reset on first login
    const tempPassword = Math.random().toString(36).slice(-12) + 'A1!'

    const { data, error } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name, role },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (data.user) {
      await admin.from('profiles').upsert({
        id: data.user.id,
        email: email.trim().toLowerCase(),
        full_name: full_name || null,
        role: role || 'employee',
        department: department || null,
        company: company || null,
        status: 'active',
      })
    }

    return NextResponse.json({ success: true, userId: data.user?.id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to invite user'
    console.error('[invite-user]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
