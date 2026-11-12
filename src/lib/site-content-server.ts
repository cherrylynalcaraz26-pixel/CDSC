// Server-side loader for the public website's editable content
// (Settings → Website). Cached for a minute; saving in Settings calls
// /api/revalidate-site so edits show up straight away.

import { unstable_cache } from 'next/cache'
import { createClient as createSupabase } from '@supabase/supabase-js'
import { mergeSiteContent, DEFAULT_SITE_CONTENT, type SiteContent } from '@/lib/site-content'

export const SITE_CONTENT_TAG = 'site-content'

const load = unstable_cache(
  async (): Promise<unknown> => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return {}
    // Public (anon) read with no cookies, so the marketing pages stay cacheable.
    const supabase = createSupabase(url, key, { auth: { persistSession: false } })
    const { data, error } = await supabase.from('system_settings').select('website_content').single()
    if (error) return {}
    return (data as { website_content?: unknown } | null)?.website_content ?? {}
  },
  ['site-content-v1'],
  { revalidate: 60, tags: [SITE_CONTENT_TAG] },
)

export async function getSiteContent(): Promise<SiteContent> {
  try { return mergeSiteContent(await load()) } catch { return DEFAULT_SITE_CONTENT }
}
