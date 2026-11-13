import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Website pages, files and endpoints anyone may open without signing in.
const PUBLIC_PATHS = [
  '/inquiry', '/about', '/products', '/cart', '/industries', '/services', '/company-profile', '/contact', '/quote',
  '/robots.txt', '/sitemap.xml', '/manifest.webmanifest', '/videos', '/images', '/api/public',
]

// The staff system. Client / vendor portal accounts are sent to /portal instead.
const STAFF_PREFIXES = [
  '/dashboard', '/201-file', '/accounting', '/assets', '/bir', '/client-requests', '/clients', '/crm', '/csi-monitoring',
  '/dr-logs', '/employee-requests', '/inventory', '/items', '/messages', '/pull-outs', '/purchase-orders',
  '/purchase-requests', '/quotation', '/receiving', '/reports', '/returns', '/sales-deliveries', '/sales-orders',
  '/settings', '/setup', '/users', '/warehouse',
]
const PORTAL_ROLES = ['client', 'vendor']

const startsWithAny = (path: string, list: string[]) => list.some(p => path === p || path.startsWith(`${p}/`))

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  const isAuthPage = path.startsWith('/login') || path.startsWith('/portal/login')
  const isPublicPath = path === '/' || startsWithAny(path, PUBLIC_PATHS)

  if (!user && !isAuthPage && !isPublicPath) {
    // API calls get a 401 instead of an HTML redirect.
    if (path.startsWith('/api/')) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })
    const url = request.nextUrl.clone()
    url.pathname = path.startsWith('/portal') ? '/portal/login' : '/login'
    return NextResponse.redirect(url)
  }

  if (user && (isAuthPage || startsWithAny(path, STAFF_PREFIXES))) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const isPortalAccount = PORTAL_ROLES.includes((profile?.role as string | undefined) ?? '')

    // Portal accounts never see the staff system (their data is also blocked by RLS).
    if (isPortalAccount && !isAuthPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/portal'
      url.search = ''
      return NextResponse.redirect(url)
    }
    if (isAuthPage) {
      const url = request.nextUrl.clone()
      url.pathname = isPortalAccount ? '/portal' : '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|woff2?)$).*)'],
}
