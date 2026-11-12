import { createBrowserClient } from '@supabase/ssr'
import { trackedFetch } from '@/lib/activity'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
    // Every database write shows the global Saving / Adding / Deleting indicator.
    { global: { fetch: trackedFetch } },
  )
}
