'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { cacheBustImageUrl } from '@/lib/upload-image'
import { toast } from 'sonner'
import {
  LayoutDashboard, FileText, Package, User, LogOut, Menu, X, Boxes,
  ClipboardList, Search, Bell, PanelLeftClose, PanelLeftOpen, MessageSquare, Send, ChevronRight, Globe,
  Store, Lightbulb,
} from 'lucide-react'
import { SearchProvider, useSearchContext } from '@/context/search-context'

const CLIENT_NAV = [
  { label: 'Dashboard',      href: '/portal',             icon: LayoutDashboard, exact: true },
  { label: 'Quotations',     href: '/portal/quotations',  icon: ClipboardList,   exact: false },
  { label: 'My Orders',      href: '/portal/requests',    icon: FileText,        exact: false },
  { label: 'Browse Catalog', href: '/portal/inventory',   icon: Package,         exact: false },
  { label: 'My Stock',       href: '/portal/stock',       icon: Boxes,           exact: false },
  { label: 'Account',        href: '/portal/settings',    icon: User,            exact: false },
]

const VENDOR_NAV = [
  { label: 'Dashboard',       href: '/portal',                   icon: LayoutDashboard, exact: true },
  { label: 'Purchase Orders', href: '/portal/purchase-orders',   icon: ClipboardList,   exact: false },
  { label: 'My Catalog',      href: '/portal/catalog',           icon: Store,           exact: false },
  { label: 'Recommendations', href: '/portal/recommendations',   icon: Lightbulb,       exact: false },
  { label: 'Account',         href: '/portal/settings',          icon: User,            exact: false },
]

function PortalLayoutInner({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const { query, setQuery } = useSearchContext()
  const [loading, setLoading] = useState(true)
  const [portalRole, setPortalRole] = useState<'client' | 'vendor'>('client')
  const [clientName, setClientName] = useState('')
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null)
  const [clientLogoUrl, setClientLogoUrl] = useState<string | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const [companyWebsite, setCompanyWebsite] = useState<string | null>(null)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const avatarRef = useRef<HTMLDivElement>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('portal-sidebar-collapsed') === 'true'
  })
  const [notifications, setNotifications] = useState<{ id: string; message: string; read: boolean; time: string }[]>([])
  const [notifOpen, setNotifOpen] = useState(false)

  // Messages / Chat
  const [msgOpen, setMsgOpen] = useState(false)
  const [msgText, setMsgText] = useState('')
  const [msgSending, setMsgSending] = useState(false)
  const [chatHistory, setChatHistory] = useState<{ id: string; message: string; sent_at: string; reply: string | null; replied_at: string | null }[]>([])
  const [seenReplyIds, setSeenReplyIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try { return new Set(JSON.parse(localStorage.getItem('portal-seen-replies') ?? '[]')) } catch { return new Set() }
  })

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Re-fetch logo when tab becomes visible (e.g. after uploading in settings)
  useEffect(() => {
    async function refreshLogo() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const table = portalRole === 'vendor' ? 'suppliers' : 'clients'
      const { data: clientRow } = await supabase.from(table).select('logo_url, avatar_url').eq('auth_user_id', session.user.id).single()
      const rawLogo = (clientRow as any)?.logo_url ?? (clientRow as any)?.avatar_url ?? null
      setClientLogoUrl(rawLogo ? cacheBustImageUrl(rawLogo) : null)
    }
    function onVisible() { if (document.visibilityState === 'visible') refreshLogo() }
    function onLogoUpdated(e: Event) {
      const url = (e as CustomEvent).detail?.url
      if (url) setClientLogoUrl(url)
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('portal-logo-updated', onLogoUpdated)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('portal-logo-updated', onLogoUpdated)
    }
  }, [portalRole])

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
      const { data: profile } = await supabase.from('profiles').select('full_name, role, avatar_url, company').eq('id', session.user.id).single()
      if (profile?.role !== 'client' && profile?.role !== 'vendor') { await supabase.auth.signOut(); router.replace('/login'); return }
      const isVendor = profile.role === 'vendor'
      setPortalRole(isVendor ? 'vendor' : 'client')
      setUserName(profile?.full_name ?? session.user.email?.split('@')[0] ?? (isVendor ? 'Vendor' : 'Client'))
      setUserEmail(session.user.email ?? '')
      setUserAvatarUrl((profile as any)?.avatar_url ?? null)

      const table = isVendor ? 'suppliers' : 'clients'
      let { data: clientRow } = await supabase.from(table).select('id, company_name, logo_url, avatar_url').eq('auth_user_id', session.user.id).single()
      // Some portal accounts were created before the client/supplier row got linked to
      // their auth user — fall back to matching by company name and repair the link for
      // next time, so messages/notifications/inventory don't silently fail for those accounts.
      if (!clientRow && profile?.company) {
        const { data: byName } = await supabase.from(table).select('id, company_name, logo_url, avatar_url').eq('company_name', profile.company).single()
        if (byName) {
          clientRow = byName
          await supabase.from(table).update({ auth_user_id: session.user.id, portal_access: true }).eq('id', byName.id)
        }
      }
      setClientName(clientRow?.company_name ?? '')
      const rawLogo = (clientRow as any)?.logo_url ?? (clientRow as any)?.avatar_url ?? null
      setClientLogoUrl(rawLogo ? cacheBustImageUrl(rawLogo) : null)
      const { data: sysSettings } = await supabase.from('system_settings').select('website').single()
      setCompanyWebsite(sysSettings?.website ?? null)
      if (clientRow) {
        setClientId((clientRow as any).id)
        const companyName = (clientRow as any).company_name ?? ''
        const cid = (clientRow as any).id
        if (companyName && isVendor) {
          const { data: poRes } = await supabase.from('purchase_orders')
            .select('po_number,po_date,status')
            .eq('supplier_id', cid)
            .order('po_date', { ascending: false })
            .limit(5)
          const notifs: typeof notifications = []
          for (const po of (poRes ?? [])) {
            if (po.status === 'completed') notifs.push({ id: `po-${po.po_number}`, message: `PO ${po.po_number} has been marked Completed`, read: false, time: po.po_date ?? '' })
            else if (po.status === 'partially_delivered') notifs.push({ id: `po-${po.po_number}`, message: `PO ${po.po_number} is partially delivered`, read: false, time: po.po_date ?? '' })
          }
          setNotifications(notifs)
        } else if (companyName) {
          const [drRes, stockRes, msgRes] = await Promise.all([
            supabase.from('dr_logs').select('dr_number,dr_date,status')
              .eq('supplier_name', companyName).in('status', ['received', 'partial'])
              .order('dr_date', { ascending: false }).limit(5),
            supabase.from('client_inventory').select('item_name,quantity_on_hand,low_stock_threshold')
              .eq('client_id', cid),
            supabase.from('client_messages').select('id,message,sent_at,reply,replied_at')
              .eq('client_id', cid).order('sent_at', { ascending: true }),
          ])
          const notifs: typeof notifications = []
          for (const dr of (drRes.data ?? [])) {
            notifs.push({ id: `dr-${dr.dr_number}`, message: `Delivery DR ${dr.dr_number} has been ${dr.status === 'received' ? 'delivered' : 'partially delivered'}`, read: false, time: dr.dr_date ?? '' })
          }
          for (const s of (stockRes.data ?? [])) {
            if (s.quantity_on_hand === 0) notifs.push({ id: `oos-${s.item_name}`, message: `${s.item_name} is out of stock`, read: false, time: '' })
            else if (s.quantity_on_hand <= s.low_stock_threshold) notifs.push({ id: `low-${s.item_name}`, message: `${s.item_name} is low on stock (${s.quantity_on_hand} left)`, read: false, time: '' })
          }
          for (const m of (msgRes.data ?? [])) {
            if (m.reply) notifs.push({ id: `reply-${m.id}`, message: `CDSC replied: "${m.reply.slice(0, 60)}${m.reply.length > 60 ? '…' : ''}"`, read: false, time: m.replied_at ?? '' })
          }
          setNotifications(notifs)
          setChatHistory(msgRes.data ?? [])
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

  const NAV = portalRole === 'vendor' ? VENDOR_NAV : CLIENT_NAV
  const websiteHref = companyWebsite ? (companyWebsite.startsWith('http') ? companyWebsite : `https://${companyWebsite}`) : null

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  async function sendMessage() {
    if (!msgText.trim()) return
    setMsgSending(true)
    const { data, error } = await supabase.from('client_messages').insert({
      client_id: clientId || null,
      client_name: clientName || userName,
      message: msgText.trim(),
      sent_at: new Date().toISOString(),
      status: 'unread',
    }).select('id,message,sent_at,reply,replied_at').single()
    if (error) {
      toast.error('Failed to send message. Please try again.')
    } else if (data) {
      setChatHistory(h => [...h, data])
      setMsgText('')
    }
    setMsgSending(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-48 h-20">
          <Image src="/cdsc-logo.png" alt="CDSC" fill className="object-contain" priority />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-bounce [animation-delay:0ms]" />
          <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-bounce [animation-delay:150ms]" />
          <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )

  const initials = (clientName || userName).split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'C'

  // Shared nav content for sidebar
  function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <>
        {NAV.map(link => {
          const active = isActive(link.href, link.exact)
          if (collapsed) {
            return (
              <div key={link.href} className="relative group">
                <Link href={link.href} onClick={onNavigate} title={link.label}
                  className={cn(
                    'flex items-center justify-center h-9 rounded-md transition-colors',
                    active ? 'bg-red-600/20 text-red-400' : 'text-white/40 hover:text-white/80 hover:bg-white/5'
                  )}>
                  <link.icon className="h-[16px] w-[16px] shrink-0" />
                </Link>
                <div className="absolute left-full top-0 ml-1 hidden group-hover:block z-50 min-w-[160px] bg-[#1a1a1a] border border-white/10 rounded-lg py-1 shadow-xl pointer-events-none">
                  <span className={cn('block px-3 py-1.5 text-[13px]', active ? 'text-red-400' : 'text-white/70')}>{link.label}</span>
                </div>
              </div>
            )
          }
          return (
            <Link key={link.href} href={link.href} onClick={onNavigate}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors',
                active ? 'bg-red-600/20 text-red-400 border-l-2 border-red-500' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              )}>
              <link.icon className={cn('h-[15px] w-[15px] shrink-0', active ? 'text-red-400' : '')} />
              {link.label}
            </Link>
          )
        })}
      </>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Desktop sidebar — full height, matches admin exactly */}
      <aside className={cn(
        'hidden lg:flex flex-col bg-[#111111] sticky top-0 h-screen shrink-0 transition-all duration-200',
        collapsed ? 'w-14' : 'w-56'
      )}>
        {/* Logo + collapse toggle */}
        <div className={cn('py-4 flex items-center gap-3 transition-all', collapsed ? 'px-3 justify-center' : 'px-4')}>
          {collapsed ? (
            <button onClick={toggleCollapsed} title="Expand sidebar"
              className="h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-white flex items-center justify-center">
              <img
                src="/cdsc-logo.jpg"
                alt="CDSC Industrial Supply"
                className="h-full w-full object-contain p-1"
              />
            </button>
          ) : (
            <>
              <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-white flex items-center justify-center">
                <img
                  src="/cdsc-logo.jpg"
                  alt="CDSC Industrial Supply"
                  className="h-full w-full object-contain p-1"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-white font-semibold text-sm leading-tight truncate">CDSC Industrial Supply</div>
                <div className="text-white/35 text-[11px] leading-tight">{portalRole === 'vendor' ? 'Vendor Portal' : 'Client Portal'}</div>
              </div>
              <button onClick={toggleCollapsed} title="Collapse sidebar"
                className="text-white/40 hover:text-white/80 transition-colors shrink-0">
                <X className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        <div className="h-px bg-white/8 mx-3 mb-2" />

        <nav className={cn('flex-1 overflow-y-auto pb-2 space-y-0.5 scrollbar-thin', collapsed ? 'px-1.5' : 'px-2')}>
          <SidebarNav />
        </nav>

        <div className={cn('p-3 border-t border-white/8 space-y-1', collapsed && 'flex flex-col items-center')}>
          {websiteHref && (
            collapsed ? (
              <div className="relative group">
                <a href={websiteHref} target="_blank" rel="noopener noreferrer" title="View our website"
                  className="flex items-center justify-center h-9 w-9 rounded-md transition-colors text-white/40 hover:text-white/80 hover:bg-white/5">
                  <Globe className="h-[15px] w-[15px] shrink-0" />
                </a>
                <div className="absolute left-full bottom-0 ml-1 hidden group-hover:block z-50 min-w-[180px] bg-[#1a1a1a] border border-white/10 rounded-lg py-1 shadow-xl pointer-events-none">
                  <span className="block px-3 py-1.5 text-[13px] text-white/70">View our website</span>
                </div>
              </div>
            ) : (
              <a href={websiteHref} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-[13px] font-medium text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors">
                <Globe className="h-[15px] w-[15px] shrink-0" />
                View our website
              </a>
            )
          )}
          <button onClick={signOut} title="Sign Out"
            className={cn(
              'flex items-center gap-2.5 rounded-md text-[13px] font-medium text-white/40 hover:text-red-400 hover:bg-white/5 transition-colors',
              collapsed ? 'h-9 w-9 justify-center' : 'w-full px-3 py-2'
            )}>
            <LogOut className="h-[15px] w-[15px] shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-60 bg-[#111111] transition-transform duration-300 ease-in-out lg:hidden flex flex-col',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="py-4 px-4 flex items-center gap-3 border-b border-white/8">
          <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-white flex items-center justify-center">
            <img
              src="/cdsc-logo.jpg"
              alt="CDSC Industrial Supply"
              className="h-full w-full object-contain p-1"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-white font-semibold text-sm leading-tight truncate">CDSC Industrial Supply</div>
            <div className="text-white/35 text-[11px] leading-tight">{portalRole === 'vendor' ? 'Vendor Portal' : 'Client Portal'}</div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="text-white/40 hover:text-white/80 transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {NAV.map(link => {
            const active = isActive(link.href, link.exact)
            return (
              <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors',
                  active ? 'bg-red-600/20 text-red-400 border-l-2 border-red-500' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                )}>
                <link.icon className={cn('h-[15px] w-[15px] shrink-0', active ? 'text-red-400' : '')} />
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-white/8 space-y-1">
          {websiteHref && (
            <a href={websiteHref} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-[13px] font-medium transition-colors text-white/40 hover:text-white/80 hover:bg-white/5">
              <Globe className="h-[15px] w-[15px] shrink-0" />
              View our website
            </a>
          )}
          <button onClick={signOut}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-[13px] font-medium text-white/40 hover:text-red-400 hover:bg-white/5 rounded-md transition-colors">
            <LogOut className="h-[15px] w-[15px] shrink-0" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main area: header + content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top header */}
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b px-4 md:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Left: hamburger (mobile) + logo when sidebar collapsed (desktop) */}
            <div className="flex items-center gap-3">
              <button className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                onClick={() => setMobileOpen(true)}>
                <Menu className="h-5 w-5" />
              </button>
              {collapsed && (
                <div className="hidden lg:flex items-center gap-2">
                  <div className="h-7 w-7 shrink-0 rounded-md overflow-hidden bg-white flex items-center justify-center">
                    <img src="/cdsc-logo.jpg" alt="CDSC Industrial Supply" className="max-h-full max-w-full object-contain p-0.5" />
                  </div>
                  <span className="text-sm font-semibold leading-tight">CDSC Industrial Supply</span>
                </div>
              )}
            </div>

            {/* Center: search */}
            <div className="flex-1 max-w-sm">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="search"
                  name="portal-search"
                  autoComplete="off"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search orders, items…"
                  className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Right: notifications + user */}
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <button onClick={() => setNotifOpen(v => !v)}
                  className="relative h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent transition-colors">
                  <Bell className="h-5 w-5" />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-600" />
                  )}
                </button>
                {notifOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-80 bg-popover border rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto">
                      <div className="flex items-center justify-between px-4 py-3 border-b">
                        <span className="text-sm font-semibold">Notifications</span>
                        {notifications.some(n => !n.read) && (
                          <button onClick={() => setNotifications(ns => ns.map(n => ({ ...n, read: true })))}
                            className="text-xs text-red-600 hover:underline">Mark all read</button>
                        )}
                      </div>
                      {notifications.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications</div>
                      ) : (
                        <div className="divide-y">
                          {notifications.map(n => (
                            <div key={n.id} className={cn('px-4 py-3 text-xs', n.read ? 'text-muted-foreground' : 'bg-blue-50/40 dark:bg-blue-950/20')}>
                              <div className="font-medium">{n.message}</div>
                              {n.time && <div className="text-muted-foreground mt-0.5">{new Date(n.time).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Avatar dropdown */}
              <div className="relative" ref={avatarRef}>
                <button
                  onClick={() => setAvatarOpen(v => !v)}
                  className="h-9 w-9 rounded-full overflow-hidden flex items-center justify-center bg-red-600 text-white text-xs font-bold shrink-0 hover:ring-2 hover:ring-red-500/40 transition-all"
                >
                  {clientLogoUrl
                    ? <img src={clientLogoUrl} alt={clientName} className="h-full w-full object-contain p-1 bg-white" />
                    : userAvatarUrl
                      ? <img src={userAvatarUrl} alt={userName} className="h-full w-full object-cover" />
                      : initials}
                </button>

                {avatarOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                    {/* User info */}
                    <div className="px-4 py-3 border-b flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full overflow-hidden shrink-0 bg-white border border-gray-200 flex items-center justify-center text-red-600 text-sm font-bold">
                        {clientLogoUrl
                          ? <img src={clientLogoUrl} alt={clientName} className="h-full w-full object-contain p-1" />
                          : userAvatarUrl
                            ? <img src={userAvatarUrl} alt={userName} className="h-full w-full object-cover" />
                            : <span className="bg-red-600 text-white h-full w-full flex items-center justify-center text-sm font-bold">{initials}</span>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 leading-tight truncate">{clientName || userName}</p>
                        <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="p-1.5">
                      <button
                        onClick={() => { setAvatarOpen(false); signOut() }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-8 pb-24 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#111111] border-t border-white/10 flex items-stretch">
        {NAV.map(link => {
          const active = isActive(link.href, link.exact)
          return (
            <Link
              key={link.href}
              href={link.href}
              replace
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-medium transition-colors',
                active ? 'text-red-400' : 'text-white/40 hover:text-white/70'
              )}
            >
              <link.icon className={cn('h-5 w-5 shrink-0', active ? 'text-red-400' : '')} />
              <span className="leading-tight truncate max-w-full px-1">{link.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Messages FAB + chat window (client portal only — vendor messages aren't wired up yet) */}
      {portalRole === 'client' && <div className="fixed bottom-20 lg:bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {msgOpen && (
          <div className="w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col" style={{ maxHeight: '520px' }}>
            <div className="bg-[#111111] px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-white/70" />
                <span className="text-sm font-semibold text-white">Messages</span>
                {chatHistory.length > 0 && (
                  <span className="text-[10px] bg-white/10 text-white/60 px-1.5 py-0.5 rounded-full">{chatHistory.length}</span>
                )}
              </div>
              <button onClick={() => { setMsgOpen(false); setMsgText('') }} className="text-white/40 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
              {chatHistory.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-xs text-gray-400">No messages yet. Send your first message below.</p>
                </div>
              ) : chatHistory.map(m => (
                <div key={m.id} className="space-y-2">
                  <div className="flex justify-end">
                    <div className="max-w-[80%] bg-red-600 text-white rounded-2xl rounded-tr-sm px-3 py-2">
                      <p className="text-xs whitespace-pre-wrap">{m.message}</p>
                      <p className="text-[10px] text-red-200 mt-1 text-right">
                        {m.sent_at ? new Date(m.sent_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                  </div>
                  {m.reply && (
                    <div className="flex justify-start">
                      <div className="max-w-[80%] bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm">
                        <p className="text-[10px] font-semibold text-gray-400 mb-1">CDSC Industrial Supply</p>
                        <p className="text-xs text-gray-800 whitespace-pre-wrap">{m.reply}</p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {m.replied_at ? new Date(m.replied_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="p-3 border-t bg-white shrink-0">
              <div className="flex gap-2 items-end">
                <textarea
                  rows={2}
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder="Type a message… (Enter to send)"
                  className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
                />
                <button
                  onClick={sendMessage}
                  disabled={!msgText.trim() || msgSending}
                  className="h-9 w-9 flex items-center justify-center rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-gray-200 text-white transition-colors shrink-0"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
        {(() => {
          const unreadCount = chatHistory.filter(m => m.reply && !seenReplyIds.has(m.id)).length
          return (
            <button
              onClick={() => {
                setMsgOpen(v => {
                  const opening = !v
                  if (opening) {
                    const allReplyIds = chatHistory.filter(m => m.reply).map(m => m.id)
                    const updated = new Set([...seenReplyIds, ...allReplyIds])
                    setSeenReplyIds(updated)
                    localStorage.setItem('portal-seen-replies', JSON.stringify([...updated]))
                  }
                  return opening
                })
              }}
              className="relative flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
            >
              <MessageSquare className="h-5 w-5" />
              <span className="text-sm font-medium">Messages</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-5 min-w-[20px] px-1 rounded-full bg-white text-red-600 text-[11px] font-bold flex items-center justify-center shadow">
                  {unreadCount}
                </span>
              )}
            </button>
          )
        })()}
      </div>}
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
