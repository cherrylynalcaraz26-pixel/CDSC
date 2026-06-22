'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { LayoutDashboard, FileText, Package, User, LogOut, Menu, X, Loader2 } from 'lucide-react'

const NAV = [
  { label: 'Dashboard',      href: '/portal',            icon: LayoutDashboard, exact: true },
  { label: 'My Orders',      href: '/portal/requests',   icon: FileText,        exact: false },
  { label: 'Browse Catalog', href: '/portal/inventory',  icon: Package,         exact: false },
  { label: 'Account',        href: '/portal/settings',   icon: User,            exact: false },
]

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [clientName, setClientName] = useState('')
  const [userName, setUserName] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/portal/login'); return }
      const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', session.user.id).single()
      if (profile?.role !== 'client') { await supabase.auth.signOut(); router.replace('/portal/login'); return }
      setUserName(profile?.full_name ?? session.user.email?.split('@')[0] ?? 'Client')
      const { data: clientRow } = await supabase.from('clients').select('company_name').eq('auth_user_id', session.user.id).single()
      setClientName(clientRow?.company_name ?? '')
      setLoading(false)
    }
    check()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/portal/login')
  }

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-7 w-7 text-red-600 animate-spin" />
        <p className="text-sm text-gray-400">Loading portal…</p>
      </div>
    </div>
  )

  const initials = (clientName || userName).split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'C'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            {/* Logo */}
            <Link href="/portal" className="flex items-center gap-2.5 shrink-0">
              <div className="relative h-8 w-8 shrink-0">
                <Image src="/cdsc-logo.jpg" alt="CDSC" fill className="rounded-md object-cover" />
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-bold text-gray-900 leading-tight">CDSC Industrial Supply</div>
                <div className="text-[10px] text-gray-400 leading-tight">Client Portal</div>
              </div>
            </Link>

            {/* Desktop nav (centered) */}
            <nav className="hidden md:flex items-center gap-1 mx-auto">
              {NAV.map(link => {
                const active = isActive(link.href, link.exact)
                return (
                  <Link key={link.href} href={link.href}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      active
                        ? 'bg-red-50 text-red-600'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    )}>
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                )
              })}
            </nav>

            {/* Right: user info + sign out */}
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <div className="text-xs font-semibold text-gray-900 leading-tight">{clientName || userName}</div>
                {clientName && <div className="text-[10px] text-gray-400 leading-tight">{userName}</div>}
              </div>
              <div className="h-8 w-8 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                {initials}
              </div>
              <button onClick={signOut}
                className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors">
                <LogOut className="h-4 w-4" />
                <span className="hidden lg:inline">Sign Out</span>
              </button>
              {/* Mobile hamburger */}
              <button className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                onClick={() => setMobileOpen(true)}>
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl md:hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <div className="relative h-7 w-7 shrink-0">
                  <Image src="/cdsc-logo.jpg" alt="CDSC" fill className="rounded object-cover" />
                </div>
                <span className="font-bold text-sm text-gray-900">CDSC Client Portal</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 border-b bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-red-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                  {initials}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">{clientName || userName}</div>
                  {clientName && <div className="text-xs text-gray-400">{userName}</div>}
                </div>
              </div>
            </div>
            <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
              {NAV.map(link => {
                const active = isActive(link.href, link.exact)
                return (
                  <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      active ? 'bg-red-50 text-red-600' : 'text-gray-700 hover:bg-gray-100'
                    )}>
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                )
              })}
            </nav>
            <div className="p-3 border-t">
              <button onClick={signOut}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          </div>
        </>
      )}

      {/* Page content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
