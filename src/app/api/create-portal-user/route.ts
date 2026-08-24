import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { email, password, full_name, company, role } = await req.json()
    const portalRole = role === 'vendor' ? 'vendor' : 'client'

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'Server not configured for admin user creation.' }, { status: 500 })
    }

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

    // Create user with email already confirmed so they can log in immediately
    const { data, error } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name, role: portalRole },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (data.user) {
      // Upsert profile row with role = 'client' or 'vendor'
      await admin.from('profiles').upsert({
        id: data.user.id,
        email: email.trim().toLowerCase(),
        full_name: full_name || null,
        role: portalRole,
        company: company || null,
        status: 'active',
      })
    }

    return NextResponse.json({ success: true, userId: data.user?.id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create user'
    console.error('[create-portal-user]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
