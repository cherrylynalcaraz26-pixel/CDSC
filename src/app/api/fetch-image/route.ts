import { NextRequest, NextResponse } from 'next/server'

// Google Drive's thumbnail/uc endpoints serve images fine to <img> tags but don't send
// CORS headers, so a browser-side fetch() to read the bytes (e.g. to embed in a jsPDF
// document) gets blocked. This route fetches the image server-side — no CORS applies
// between servers — and hands it back as a data URL. Restricted to Drive's own hosts so
// this can't be used as an open proxy to fetch arbitrary URLs (SSRF).
const ALLOWED_HOSTS = ['drive.google.com', 'lh3.googleusercontent.com']

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })

  let parsed: URL
  try { parsed = new URL(url) } catch { return NextResponse.json({ error: 'Invalid url' }, { status: 400 }) }
  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return NextResponse.json({ error: 'Host not allowed' }, { status: 400 })
  }

  try {
    const resp = await fetch(parsed.toString())
    if (!resp.ok) return NextResponse.json({ error: `Upstream fetch failed (${resp.status})` }, { status: 502 })
    const contentType = resp.headers.get('content-type') || 'image/jpeg'
    const buf = Buffer.from(await resp.arrayBuffer())
    return NextResponse.json({ dataUrl: `data:${contentType};base64,${buf.toString('base64')}` })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch image' }, { status: 500 })
  }
}
