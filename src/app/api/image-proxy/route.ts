import { NextRequest, NextResponse } from 'next/server'

// Item/logo images live on Google Drive (drive.google.com/thumbnail?id=...). Those
// responses can't be read cross-origin from the browser (no CORS headers), so they
// can't be turned into the base64 the jsPDF quotation attachment needs. This route
// fetches the bytes server-side (same-origin to the browser) so they can be embedded.

export const maxDuration = 30

// SSRF guard: only proxy images from the hosts we actually store URLs from.
const ALLOWED_HOSTS = new Set([
  'drive.google.com',
  'lh3.googleusercontent.com',
  'lh4.googleusercontent.com',
  'lh5.googleusercontent.com',
  'lh6.googleusercontent.com',
  'googleusercontent.com',
])

function isAllowed(url: URL) {
  const host = url.hostname.toLowerCase()
  if (ALLOWED_HOSTS.has(host)) return true
  // Allow any *.googleusercontent.com subdomain (Drive redirects thumbnails there).
  return host.endsWith('.googleusercontent.com')
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url')
  if (!raw) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
  }

  if (target.protocol !== 'https:' || !isAllowed(target)) {
    return NextResponse.json({ error: 'URL not allowed' }, { status: 403 })
  }

  try {
    const resp = await fetch(target.toString(), {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CDSC-image-proxy)' },
    })
    if (!resp.ok) {
      return NextResponse.json({ error: `Upstream returned ${resp.status}` }, { status: 502 })
    }
    const contentType = resp.headers.get('content-type') ?? 'image/jpeg'
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Upstream is not an image' }, { status: 415 })
    }
    const buffer = Buffer.from(await resp.arrayBuffer())
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch image'
    console.error('[image-proxy]', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
