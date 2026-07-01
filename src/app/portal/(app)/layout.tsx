'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, FileText, Package, User, LogOut, Menu, X, Boxes,
  ClipboardList, Search, Bell, PanelLeftClose, PanelLeftOpen, MessageSquare, Send,
} from 'lucide-react'
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
  const [clientId, setClientId] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('portal-sidebar-collapsed') === 'true'
  })
  const [notifications, setNotifications] = useState<{ id: string; message: string; read: boolean; time: string }[]>([])
  const [notifOpen, setNotifOpen] = useState(false)

  // Leave us a Message
  const [msgOpen, setMsgOpen] = useState(false)
  const [msgText, setMsgText] = useState('')
  const [msgSending, setMsgSending] = useState(false)
  const [msgSent, setMsgSent] = useState(false)

  function toggleCollapsed() {
    setCollapsed(c => {
      localStorage.setItem('portal-sidebar-collapsed', String(!c))
      return !c
    })
  }

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
        setClientId((clientRow as any).id)
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

  async function sendMessage() {
    if (!msgText.trim()) return
    setMsgSending(true)
    await supabase.from('client_messages').insert({
      client_id: clientId,
      client_name: clientName || userName,
      message: msgText.trim(),
      sent_at: new Date().toISOString(),
      status: 'unread',
    })
    setMsgSending(false)
    setMsgSent(true)
    setMsgText('')
    setTimeout(() => { setMsgSent(false); setMsgOpen(false) }, 2000)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#111111]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-16 w-16 rounded-xl overflow-hidden bg-white animate-pulse">
          <Image src="/cdsc-logo.jpg" alt="CDSC" fill className="object-cover" priority />
        </div>
        <p className="text-sm text-white/40">Loading portal…</p>
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

          {/* Logo area — full name when expanded, logo+name when collapsed */}
          <Link href="/portal" className={cn('hidden md:flex items-center gap-2.5 shrink-0 transition-all duration-200', collapsed ? 'w-14 justify-center' : 'w-56')}>
            <div className="relative h-8 w-8 shrink-0 rounded-md overflow-hidden bg-[#111111]">
              <Image src="/cdsc-logo.jpg" alt="CDSC Industrial Supply" fill className="object-cover" />
            </div>
            {!collapsed && (
              <div>
                <div className="text-sm font-bold text-gray-900 leading-tight">CDSC Industrial Supply</div>
                <div className="text-[10px] text-gray-400 leading-tight">Client Portal</div>
              </div>
            )}
          </Link>

          {/* Mobile logo */}
          <Link href="/portal" className="md:hidden flex items-center gap-2">
            <div className="relative h-8 w-8 shrink-0 rounded-md overflow-hidden bg-[#111111]">
              <Image src="/cdsc-logo.jpg" alt="CDSC Industrial Supply" fill className="object-cover" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900 leading-tight">CDSC Industrial Supply</div>
              <div className="text-[10px] text-gray-400 leading-tight">Client Portal</div>
            </div>
          </Link>

          {/* Search bar */}
          <div className="flex flex-1 justify-center">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search orders, items…"
                className="w-full h-9 pl-9 pr-4 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Right: notifications + user + sign out */}
          <div className="ml-auto flex items-center gap-3">
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
        {/* Desktop sidebar — collapsible like admin */}
        <aside className={cn(
          'hidden md:flex flex-col bg-[#111111] sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto shrink-0 transition-all duration-200',
          collapsed ? 'w-14' : 'w-56'
        )}>
          {/* Sidebar header with toggle */}
          <div className={cn('py-3 flex items-center transition-all', collapsed ? 'px-2 justify-center' : 'px-3 justify-end')}>
            <button
              onClick={toggleCollapsed}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="text-white/40 hover:text-white/80 transition-colors p-1"
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>

          <div className="h-px bg-white/8 mx-3 mb-2" />

          <nav className={cn('flex-1 space-y-0.5', collapsed ? 'px-1.5' : 'px-2')}>
            {NAV.map(link => {
              const active = isActive(link.href, link.exact)
              if (collapsed) {
                return (
                  <div key={link.href} className="relative group">
                    <Link href={link.href}
                      title={link.label}
                      className={cn(
                        'flex items-center justify-center h-9 rounded-md transition-colors',
                        active
                          ? 'bg-red-600/20 text-red-400'
                          : 'text-white/40 hover:text-white/80 hover:bg-white/5'
                      )}>
                      <link.icon className="h-[16px] w-[16px] shrink-0" />
                    </Link>
                    {/* Flyout label */}
                    <div className="absolute left-full top-0 ml-1 hidden group-hover:block z-50 min-w-[140px] bg-[#1a1a1a] border border-white/10 rounded-lg py-1 shadow-xl pointer-events-none">
                      <span className={cn('block px-3 py-1.5 text-[13px]', active ? 'text-red-400' : 'text-white/70')}>{link.label}</span>
                    </div>
                  </div>
                )
              }
              return (
                <Link key={link.href} href={link.href}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors',
                    active
                      ? 'bg-red-600/20 text-red-400 border-l-2 border-red-500'
                      : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                  )}>
                  <link.icon className={cn('h-[15px] w-[15px] shrink-0', active ? 'text-red-400' : '')} />
                  {link.label}
                </Link>
              )
            })}
          </nav>

          <div className={cn('p-3 border-t border-white/8', collapsed && 'flex justify-center')}>
            <button onClick={signOut}
              title="Sign Out"
              className={cn(
                'flex items-center gap-2.5 text-[13px] font-medium text-white/40 hover:text-red-400 hover:bg-white/5 rounded-md transition-colors',
                collapsed ? 'h-9 w-9 justify-center' : 'w-full px-3 py-2'
              )}>
              <LogOut className="h-[15px] w-[15px] shrink-0" />
              {!collapsed && <span>Sign Out</span>}
            </button>
          </div>
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <>
            <div className="fixed inset-0 z-50 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
            <div className="fixed inset-y-0 left-0 z-50 w-72 bg-[#111111] shadow-2xl md:hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-white/8">
                <div className="flex items-center gap-2">
                  <div className="relative h-7 w-7 shrink-0 rounded-md overflow-hidden bg-white">
                    <Image src="/cdsc-logo.jpg" alt="CDSC" fill className="object-cover" />
                  </div>
                  <span className="font-bold text-sm text-white">CDSC Industrial Supply</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg text-white/40 hover:bg-white/5">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-4 border-b border-white/8">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-red-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                    {initials}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{clientName || userName}</div>
                    {clientName && <div className="text-xs text-white/40">{userName}</div>}
                  </div>
                </div>
              </div>
              <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
                {NAV.map(link => {
                  const active = isActive(link.href, link.exact)
                  return (
                    <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors',
                        active ? 'bg-red-600/20 text-red-400 border-l-2 border-red-500' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                      )}>
                      <link.icon className={cn('h-[15px] w-[15px]', active ? 'text-red-400' : '')} />
                      {link.label}
                    </Link>
                  )
                })}
              </nav>
              <div className="p-3 border-t border-white/8">
                <button onClick={signOut}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] font-medium text-white/40 hover:text-red-400 hover:bg-white/5 rounded-md transition-colors">
                  <LogOut className="h-[15px] w-[15px]" /> Sign Out
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

      {/* Floating Leave us a Message button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* Message dialog */}
        {msgOpen && (
          <div className="w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="bg-[#111111] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-white/70" />
                <span className="text-sm font-semibold text-white">Leave us a Message</span>
              </div>
              <button onClick={() => { setMsgOpen(false); setMsgText(''); setMsgSent(false) }}
                className="text-white/40 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">
              {msgSent ? (
                <div className="text-center py-4">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                    <Send className="h-5 w-5 text-green-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-900">Message sent!</p>
                  <p className="text-xs text-gray-400 mt-0.5">We'll get back to you soon.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-400 mb-3">Send a message to CDSC Industrial Supply. We'll respond within 1 business day.</p>
                  <textarea
                    rows={4}
                    value={msgText}
                    onChange={e => setMsgText(e.target.value)}
                    placeholder="Type your message here…"
                    className="w-full text-sm border border-gray-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!msgText.trim() || msgSending}
                    className="mt-3 w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                  >
                    <Send className="h-4 w-4" />
                    {msgSending ? 'Sending…' : 'Send Message'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* FAB button */}
        <button
          onClick={() => setMsgOpen(v => !v)}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
        >
          <MessageSquare className="h-5 w-5" />
          <span className="text-sm font-medium">Leave us a Message</span>
        </button>
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
