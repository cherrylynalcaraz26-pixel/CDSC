// Authorization for API routes. The middleware only checks that *someone* is
// signed in; routes that use the service-role key must also check WHO it is.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const STAFF_ROLES = [
  'super_admin', 'admin', 'purchasing_officer', 'warehouse_manager', 'warehouse_staff',
  'accounting_manager', 'accounting_staff', 'department_head', 'employee', 'auditor',
] as const
export const PORTAL_ROLES = ['client', 'vendor'] as const
export const ADMIN_ROLES = ['super_admin', 'admin'] as const
export const ALL_ROLES: readonly string[] = [...STAFF_ROLES, ...PORTAL_ROLES]

export type AuthResult =
  | { ok: true; userId: string; email: string | null; role: string }
  | { ok: false; response: NextResponse }

/**
 * @param allow  'any' = any signed-in account, 'staff' = not a client/vendor
 *               portal account, or an explicit list of roles.
 */
export async function requireRole(allow: 'any' | 'staff' | readonly string[]): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, response: NextResponse.json({ error: 'Please sign in.' }, { status: 401 }) }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = (profile?.role as string | undefined) ?? ''
  const allowed =
    allow === 'any' ? true
    : allow === 'staff' ? (STAFF_ROLES as readonly string[]).includes(role)
    : allow.includes(role)
  if (!allowed) {
    return { ok: false, response: NextResponse.json({ error: 'You do not have permission to do this.' }, { status: 403 }) }
  }
  return { ok: true, userId: user.id, email: user.email ?? null, role }
}

/** Best-effort in-memory rate limit (per server instance) for public endpoints. */
const hits = new Map<string, number[]>()
export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const list = (hits.get(key) ?? []).filter(t => now - t < windowMs)
  list.push(now)
  hits.set(key, list)
  if (hits.size > 5000) hits.clear()
  return list.length > max
}

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
}
