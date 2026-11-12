import { NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { requireRole } from '@/lib/supabase/api-auth'
import { SITE_CONTENT_TAG } from '@/lib/site-content-server'

// Called by Settings → Website after saving, so the public site shows the
// new content on the next visit instead of after the cache expires.
export async function POST() {
  const auth = await requireRole('staff')
  if (!auth.ok) return auth.response
  revalidateTag(SITE_CONTENT_TAG, 'max')
  revalidatePath('/', 'layout')
  return NextResponse.json({ ok: true })
}
