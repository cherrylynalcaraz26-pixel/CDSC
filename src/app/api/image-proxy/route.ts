// Same-origin copy of a letterhead / logo image for client-side PDF rendering.
//
// The company logo lives on Google Drive. Browsers display it in an <img>, but
// Drive sends no CORS headers, so html2canvas cannot read its pixels and the
// logo is silently dropped from generated PDFs. Fetching it here and serving it
// from our own origin fixes that.
//
// Staff only, image content only, and only from known image hosts, so this
// cannot be used to reach arbitrary URLs.

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/supabase/api-auth'

export const maxDuration = 20

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = [/^drive\.google\.com$/, /^docs\.google\.com$/, /^lh\d*\.googleusercontent\.com$/, /^[a-z0-9-]+\.supabase\.co$/]
const allowedHost = (u: URL) => u.protocol === 'https:' && ALLOWED.some(re => re.test(u.hostname))

export async function GET(req: NextRequest) {
  const auth = await requireRole('staff')
  if (!auth.ok) return auth.response

  let target: URL
  try { target = new URL(req.nextUrl.searchParams.get('url') ?? '') } catch {
    return NextResponse.json({ error: 'Invalid image URL.' }, { status: 400 })
  }
  if (!allowedHost(target)) return NextResponse.json({ error: 'Image host not allowed.' }, { status: 400 })

  try {
    // Follow redirects one hop at a time so each hop is checked (Drive → googleusercontent).
    let url = target
    let res: Response | null = null
    for (let hop = 0; hop < 5; hop++) {
      res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) })
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        url = new URL(res.headers.get('location')!, url)
        if (!allowedHost(url)) return NextResponse.json({ error: 'Image host not allowed.' }, { status: 400 })
        continue
      }
      break
    }
    if (!res || !res.ok) return NextResponse.json({ error: 'Image not found.' }, { status: 502 })
    const type = res.headers.get('content-type') ?? ''
    if (!type.startsWith('image/')) return NextResponse.json({ error: 'Not an image.' }, { status: 415 })
    const buf = await res.arrayBuffer()
    if (buf.byteLength > MAX_BYTES) return NextResponse.json({ error: 'Image too large.' }, { status: 413 })
    return new NextResponse(buf, {
      headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600' },
    })
  } catch {
    return NextResponse.json({ error: 'Could not load the image.' }, { status: 502 })
  }
}
