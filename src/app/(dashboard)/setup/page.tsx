import { redirect } from 'next/navigation'

// Setup / Configuration now lives inside Settings → Master Data.
export default async function SetupPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  redirect(`/settings?tab=${encodeURIComponent(tab || 'suppliers')}`)
}
