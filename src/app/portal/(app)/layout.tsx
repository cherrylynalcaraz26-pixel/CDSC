'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { LayoutDashboard, FileText, Package, User, LogOut, Menu, X, Loader2, Boxes, ClipboardList, Search, Bell } from 'lucide-react'
import { SearchProvider, useSearchContext } from '@/context/search-context'

const NAV = [
  { label: 'Dashboard',      href: '/portal',             icon: LayoutDashboard, exact: true },
  { label: 'Quotations',     href: '/portal/quotations',  icon: ClipboardList,   exact: false },
  { label: 'My Orders',      href: '/portal/requests',    icon: FileText,        exact: false },
  { label: 'Browse Catalog', href: '/portal/inventory',   icon: Package,         exact: false },
  { label: 'My Stock',       href: '/portal/stock',       icon: Boxes,           exact: false },
  { label: 'Account',        href: '/portal/settings',    icon: User,            exact: false },
]

function PortalLayoutInner({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const { query, setQuery } = useSearchContext()
  const [loading, setLoading] = useState(true)
  const [clientName, setClientName] = useState('')
  const [userName, setUserName] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [notifications, setNotifications] = useState<{ id: string; message: string; read: boolean; time: string }[]>([])
  const [notifOpen, setNotifOpen] = useState(false)

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', session.user.id).single()
      if (profile?.role !== 'client') { await supabase.auth.signOut(); router.replace('/login'); return }
      setUserName(profile?.full_name ?? session.user.email?.split('@')[0] ?? 'Client')
      const { data: clientRow } = await supabase.from('clients').select('id, company_name').eq('auth_user_id', session.user.id).single()
      setClientName(clientRow?.company_name ?? '')
      if (clientRow) {
        // Load unread notifications: recent delivered DRs and low stock
        const companyName = (clientRow as any).company_name ?? ''
        const cid = (clientRow as any).id
        if (companyName) {
          const { data: recentDRs } = await supabase.from('dr_logs').select('dr_number,dr_date,status')
            .eq('client_name', companyName).in('status', ['received', 'partial'])
            .order('dr_date', { ascending: false }).limit(5)
          const { data: lowStock } = await supabase.from('client_inventory').select('item_name,quantity_on_hand,low_stock_threshold')
            .eq('client_id', cid)
          const notifs: typeof notifications = []
          for (const dr of (recentDRs ?? [])) {
            notifs.push({ id: `dr-${dr.dr_number}`, message: `Delivery DR ${dr.dr_number} has been ${dr.status === 'received' ? 'delivered' : 'partially delivered'}`, read: false, time: dr.dr_date ?? '' })
          }
          for (const s of (lowStock ?? [])) {
            if (s.quantity_on_hand === 0) notifs.push({ id: `oos-${s.item_name}`, message: `${s.item_name} is out of stock`, read: false, time: '' })
            else if (s.quantity_on_hand <= s.low_stock_threshold) notifs.push({ id: `low-${s.item_name}`, message: `${s.item_name} is low on stock (${s.quantity_on_hand} left)`, read: false, time: '' })
          }
          setNotifications(notifs)
        }
      }
      setLoading(false)
    }
    check()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 h-16 flex items-center">
        <div className="w-full flex items-center h-16 px-4 gap-4">
          {/* Mobile hamburger */}
          <button className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors shrink-0"
            onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>

          {/* Desktop sidebar toggle */}
          <button className="hidden md:flex p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors shrink-0"
            onClick={() => setSidebarOpen(v => !v)}>
            <Menu className="h-5 w-5" />
          </button>

          {/* Logo — always visible, sidebar width on desktop */}
          <Link href="/portal" className="flex items-center gap-2.5 shrink-0 md:w-56">
            <div className="relative h-8 w-8 shrink-0">
              <Image src="/cdsc-logo.jpg" alt="CDSC" fill className="rounded-md object-cover" />
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-bold text-gray-900 leading-tight">CDSC Industrial Supply</div>
              <div className="text-[10px] text-gray-400 leading-tight">Client Portal</div>
            </div>
          </Link>

          {/* Search bar — desktop only, centered */}
          <div className="hidden md:flex flex-1 justify-center">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search orders, quotations, items…"
                className="w-full h-9 pl-9 pr-4 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Right: notifications + user info + sign out */}
          <div className="ml-auto flex items-center gap-3">
            {/* Notification bell */}
            <div className="relative">
              <button onClick={() => setNotifOpen(v => !v)}
                className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
                <Bell className="h-5 w-5" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-600" />
                )}
              </button>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <span className="text-sm font-semibold text-gray-900">Notifications</span>
                    {notifications.some(n => !n.read) && (
                      <button onClick={() => setNotifications(ns => ns.map(n => ({ ...n, read: true })))}
                        className="text-xs text-red-600 hover:underline">Mark all read</button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-gray-400">No notifications</div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {notifications.map(n => (
                        <div key={n.id} className={cn('px-4 py-3 text-xs', n.read ? 'text-gray-400' : 'text-gray-700 bg-blue-50/40')}>
                          <div className="font-medium">{n.message}</div>
                          {n.time && <div className="text-gray-400 mt-0.5">{new Date(n.time).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  </div>
                </>
              )}
            </div>
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
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        {sidebarOpen && (
        <aside className="hidden md:flex flex-col w-56 shrink-0 bg-white border-r border-gray-200 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="flex items-center justify-between px-3 pt-3 pb-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">Menu</span>
            <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <nav className="flex-1 p-3 space-y-0.5">
            {NAV.map(link => {
              const active = isActive(link.href, link.exact)
              return (
                <Link key={link.href} href={link.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    active
                      ? 'bg-red-50 text-red-600'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}>
                  <link.icon className="h-4 w-4 shrink-0" />
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
        </aside>
        )}

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
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <SearchProvider>
      <PortalLayoutInner>{children}</PortalLayoutInner>
    </SearchProvider>
  )
}
