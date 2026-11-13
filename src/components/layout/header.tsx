'use client'

// Top bar of the staff system.
//   Left   — menu (mobile), breadcrumb (sidebar group) and the page title.
//   Middle — search: filters the current page's list, or jumps to a page (Ctrl+K).
//   Right  — "New" quick-create menu, notifications, and the account menu.

import { useEffect, useRef, useState } from 'react'
import {
  BellRing, BellOff, Bell, Search, Menu, LogOut, Plus, ChevronRight, ChevronDown,
  Settings, UserCog, Globe, Receipt, ShoppingCart, FileText, TrendingUp, CornerDownLeft, CalendarDays, LayoutGrid,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { getPageTitle } from '@/lib/page-titles'
import { getNavGroupLabel, getNavMatch } from '@/components/layout/sidebar'
import { notifyNew, deviceNotifySupported, deviceNotifyEnabled, enableDeviceNotify, disableDeviceNotify } from '@/lib/device-notify'
import { NEW_EVENT } from '@/lib/use-open-on-new'
import { toast } from 'sonner'
import { useSearchContext } from '@/context/search-context'
import { useCompany } from '@/context/company-context'
import { cn } from '@/lib/utils'

interface HeaderProps {
  onMenuClick?: () => void
  sidebarCollapsed?: boolean
}

const SEARCH_ITEMS = [
  { label: 'Dashboard',             href: '/dashboard',               section: 'Main' },
  { label: 'CRM / Inquiry',         href: '/crm',                     section: 'CRM' },
  { label: 'Purchase Orders',       href: '/purchase-orders',         section: 'Purchasing' },
  { label: 'Quotation',             href: '/quotation',               section: 'Purchasing' },
  { label: 'Sales Orders',          href: '/sales-orders',            section: 'Purchasing' },
  { label: 'Receiving',             href: '/receiving',               section: 'Warehouse' },
  { label: 'Inventory',             href: '/inventory',               section: 'Warehouse' },
  { label: 'DR Logs',               href: '/dr-logs',                 section: 'Warehouse' },
  { label: 'CSI Monitoring',        href: '/csi-monitoring',          section: 'Warehouse' },
  { label: 'Pull Outs',             href: '/pull-outs',               section: 'Warehouse' },
  { label: 'Sales Journal (CSI)',   href: '/accounting?tab=bookkeeping&sub=crj', section: 'Accounting' },
  { label: 'Collections (OR)',      href: '/accounting?tab=collections', section: 'Accounting' },
  { label: 'Cash Disbursements',    href: '/accounting?tab=bookkeeping&sub=cdj', section: 'Accounting' },
  { label: 'General Journal',       href: '/accounting?tab=bookkeeping&sub=gj', section: 'Accounting' },
  { label: 'Balance Check',         href: '/accounting?tab=bookkeeping&sub=check', section: 'Accounting' },
  { label: 'General Ledger',        href: '/accounting?tab=bookkeeping&sub=gl', section: 'Accounting' },
  { label: 'Trial Balance',         href: '/accounting?tab=bookkeeping&sub=tb', section: 'Accounting' },
  { label: 'Income Statement',      href: '/accounting?tab=bookkeeping&sub=is', section: 'Accounting' },
  { label: 'Balance Sheet',         href: '/accounting?tab=bookkeeping&sub=bs', section: 'Accounting' },
  { label: 'BIR Compliance',        href: '/accounting?tab=bir',      section: 'Accounting' },
  { label: '201 File · Clients',    href: '/201-file',                section: '201 File' },
  { label: '201 File · Employees',  href: '/201-file?tab=employees',  section: '201 File' },
  { label: 'Reports',               href: '/settings?tab=reports',    section: 'Settings' },
  { label: 'Website Content',       href: '/settings?tab=website',    section: 'Settings' },
  { label: 'PDF Document Header',   href: '/settings?tab=letterhead', section: 'Settings' },
  { label: 'Suppliers',             href: '/settings?tab=suppliers',  section: 'Master Data' },
  { label: 'Item List',             href: '/settings?tab=items',      section: 'Master Data' },
  { label: 'Categories',            href: '/settings?tab=categories', section: 'Master Data' },
  { label: 'Units of Measure',      href: '/settings?tab=uom',        section: 'Master Data' },
  { label: 'Company Profile Deck',  href: '/settings?tab=deck',       section: 'Settings' },
  { label: 'User Management',       href: '/users',                   section: 'Users' },
  { label: 'Settings',              href: '/settings',                section: 'Settings' },
]

// Quick-create: each page opens its create form when visited with ?new=1.
const QUICK_NEW = [
  { label: 'Sales Order',    href: '/sales-orders',    icon: Receipt },
  { label: 'Quotation',      href: '/quotation',       icon: FileText },
  { label: 'Purchase Order', href: '/purchase-orders', icon: ShoppingCart },
  { label: 'CRM Lead',       href: '/crm',             icon: TrendingUp },
]

// Pages whose list the search box filters (elsewhere it searches pages).
const DATA_PAGES = [
  '/crm', '/purchase-orders', '/quotation', '/sales-orders',
  '/receiving', '/inventory', '/dr-logs', '/csi-monitoring',
  '/users', '/clients', '/201-file', '/accounting', '/dashboard', '/messages',
  '/setup', '/assets', '/pull-outs',
]

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin', admin: 'Admin', purchasing_officer: 'Purchasing', warehouse_manager: 'Warehouse Manager',
  warehouse_staff: 'Warehouse', accounting_manager: 'Accounting Manager', accounting_staff: 'Accounting',
  department_head: 'Department Head', employee: 'Staff', auditor: 'Auditor',
}

interface Notif { id: string; type: 'message' | 'order' | 'stock' | 'request' | 'lead'; title: string; message: string; read: boolean; time: string; href: string }

const NOTIF_DOT: Record<Notif['type'], string> = {
  message: 'bg-blue-500', order: 'bg-red-500', request: 'bg-rose-500', lead: 'bg-emerald-500', stock: 'bg-amber-500',
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || 'U'
}

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { query, setQuery } = useSearchContext()
  const { company } = useCompany()
  const [userName, setUserName] = useState('User')
  const [userEmail, setUserEmail] = useState('')
  const [userRole, setUserRole] = useState('')
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [mobileSearch, setMobileSearch] = useState(false)

  // Notifications
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  // Only shown inside the (closed on load) notifications panel, so reading it on first render is safe.
  const [deviceOn, setDeviceOn] = useState(() => typeof window !== 'undefined' && deviceNotifyEnabled())

  async function toggleDevice() {
    if (deviceOn) { disableDeviceNotify(); setDeviceOn(false); toast('Device notifications turned off'); return }
    const p = await enableDeviceNotify()
    if (p === 'granted') { setDeviceOn(true) }
    else if (p === 'denied') toast.error('Notifications are blocked for this site. Allow them in your browser\'s site settings, then try again.')
    else if (p === 'unsupported') toast.error('This browser does not support device notifications.')
  }

  const isDataPage = DATA_PAGES.some(p => pathname.startsWith(p))
  const pageTitle = getPageTitle(pathname, searchParams)
  const group = getNavGroupLabel(pathname, searchParams)
  const navMatch = getNavMatch(pathname, searchParams)

  async function markNotifRead(n: Notif) {
    if (n.type === 'message') {
      await supabase.from('client_messages').update({ status: 'read' }).eq('id', n.id.replace(/^msg-/, ''))
    }
    setNotifs(ns => ns.map(x => x.id === n.id ? { ...x, read: true } : x))
  }

  async function markAllNotifsRead() {
    const messageIds = notifs.filter(n => n.type === 'message' && !n.read).map(n => n.id.replace(/^msg-/, ''))
    if (messageIds.length > 0) {
      await supabase.from('client_messages').update({ status: 'read' }).in('id', messageIds)
    }
    setNotifs(ns => ns.map(n => ({ ...n, read: true })))
  }

  // On a data page the box filters the list; "Go to page" results still show
  // when the text matches a page name, so navigation works from anywhere.
  const q = query.trim().toLowerCase()
  const navResults = q
    ? SEARCH_ITEMS.filter(item => item.label.toLowerCase().includes(q) || (!isDataPage && item.section.toLowerCase().includes(q))).slice(0, 8)
    : []

  useEffect(() => {
    async function loadNotifs() {
      const [{ data: msgs }, { data: orders }, { data: reqs }, { data: leads }] = await Promise.all([
        supabase.from('client_messages').select('id,client_name,supplier_name,message,sent_at').eq('status', 'unread').order('sent_at', { ascending: false }).limit(20),
        supabase.from('sales_orders').select('id,so_number,client_name,created_at,remarks').eq('status', 'draft').order('created_at', { ascending: false }).limit(20),
        supabase.from('quotation_requests').select('id,request_number,client_name,subject,created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(20),
        supabase.from('crm_leads').select('id,company_name,source,product_interest,created_at').eq('stage', 'new_lead').order('created_at', { ascending: false }).limit(20),
      ])
      const built: Notif[] = []
      for (const m of (msgs ?? [])) {
        built.push({ id: `msg-${m.id}`, type: 'message', title: `Message from ${m.client_name || m.supplier_name || 'client'}`, message: `"${(m.message ?? '').slice(0, 60)}${(m.message?.length ?? 0) > 60 ? '…' : ''}"`, read: false, time: m.sent_at, href: '/messages' })
      }
      for (const so of (orders ?? [])) {
        // Portal (SO-P-…) and website-cart orders arrive as drafts for review.
        const web = /^Website order/.test(so.remarks ?? '')
        if (!web && !/^SO-P-/.test(so.so_number ?? '')) continue
        built.push({ id: `so-${so.id}`, type: 'order', title: web ? 'New website order' : 'New portal order', message: `${so.so_number ?? 'Order'} from ${so.client_name || 'client'} needs review`, read: false, time: so.created_at, href: '/sales-orders' })
      }
      for (const r of (reqs ?? [])) {
        built.push({ id: `rfq-${r.id}`, type: 'request', title: 'New quotation request', message: `${r.request_number} · ${r.client_name}: ${r.subject}`, read: false, time: r.created_at, href: '/quotation' })
      }
      for (const l of (leads ?? [])) {
        built.push({ id: `lead-${l.id}`, type: 'lead', title: `New lead · ${l.source || 'CRM'}`, message: `${l.company_name}${l.product_interest ? ` — ${l.product_interest}` : ''}`, read: false, time: l.created_at, href: '/crm' })
      }
      built.sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''))
      setNotifs(built)
      notifyNew(built.map(n => ({ id: n.id, title: n.title, body: n.message, href: n.href })), href => router.push(href))
    }
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserEmail(user.email ?? '')
      const { data: profile } = await supabase.from('profiles').select('full_name, role, avatar_url').eq('id', user.id).single()
      setUserName(profile?.full_name ?? user.email?.split('@')[0] ?? 'User')
      setUserRole((profile as { role?: string } | null)?.role ?? '')
      setUserAvatarUrl((profile as { avatar_url?: string } | null)?.avatar_url ?? null)
      await loadNotifs()
    }
    loadUser()
    const interval = setInterval(loadNotifs, 30000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    // Ctrl/⌘+K or "/" focuses search from anywhere.
    function handleKey(e: KeyboardEvent) {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? '') || (e.target as HTMLElement)?.isContentEditable
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        inputRef.current?.focus()
        setShowResults(true)
      }
    }
    // The header sits above <main>, which is the element that scrolls.
    const main = document.querySelector('main')
    const onScroll = () => setScrolled((main?.scrollTop ?? 0) > 4)
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    main?.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
      main?.removeEventListener('scroll', onScroll)
    }
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function navigateTo(href: string) {
    setQuery('')
    setShowResults(false)
    setMobileSearch(false)
    inputRef.current?.blur()
    router.push(href)
  }

  function quickNew(href: string) {
    if (pathname === href) window.dispatchEvent(new Event(NEW_EVENT))
    else router.push(`${href}?new=1`)
  }

  const unreadCount = notifs.filter(n => !n.read).length
  const companyName = company.company_name || 'CDSC Industrial Supply'
  const roleLabel = ROLE_LABEL[userRole] ?? (userRole ? userRole.replace(/_/g, ' ') : 'Staff')

  const today = new Date().toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  const PageIcon = navMatch?.icon ?? LayoutGrid

  // Floating header: an inset rounded bar that sits over the page background.
  return (
    <header className="sticky top-0 z-30 bg-muted/30 px-3 pt-3 backdrop-blur-sm md:px-6">
      <div className={cn(
        'relative flex h-16 items-center gap-3 rounded-2xl border border-black/5 bg-card px-3 transition-shadow dark:border-white/10 md:px-4',
        scrolled ? 'shadow-[0_12px_32px_-16px_rgba(15,23,42,0.45)]' : 'shadow-[0_4px_16px_-12px_rgba(15,23,42,0.35)]',
      )}>
        {/* ── Left: menu + page identity ── */}
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-xl lg:hidden" onClick={onMenuClick} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex min-w-0 flex-1 items-center gap-3 md:flex-none md:max-w-[40%]">
          <span aria-hidden className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-[#E8112D] to-[#F43F5E] text-white shadow-md shadow-red-500/30 sm:flex">
            <PageIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="hidden truncate text-[10px] font-bold uppercase tracking-[0.12em] text-[#E8112D] sm:block">{group ?? companyName}</p>
            <h1 className="truncate text-base font-extrabold leading-tight tracking-tight" title={pageTitle?.subtitle}>{pageTitle?.title ?? companyName}</h1>
          </div>
        </div>

        {/* ── Middle: search (overlay on phones) ── */}
        <div ref={searchRef} className={cn(
          'flex-1 justify-center',
          mobileSearch ? 'absolute inset-0 z-40 flex items-center gap-2 rounded-2xl bg-card px-3 md:static md:px-0' : 'hidden md:flex',
        )}>
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              placeholder={isDataPage ? 'Search this page or jump to…' : 'Search pages…'}
              className="h-10 w-full rounded-full border border-transparent bg-muted/70 pl-10 pr-16 text-sm outline-none transition placeholder:text-muted-foreground/80 hover:bg-muted focus:border-[#E8112D]/40 focus:bg-background focus:shadow-[0_0_0_4px_rgba(232,17,45,0.08)]"
              autoComplete="off"
              value={query}
              onChange={e => { setQuery(e.target.value); setShowResults(true); setActiveIdx(0) }}
              onFocus={() => setShowResults(true)}
              onKeyDown={e => {
                if (e.key === 'Escape') { setShowResults(false); setQuery(''); setMobileSearch(false); inputRef.current?.blur() }
                if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, navResults.length - 1)) }
                if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
                if (e.key === 'Enter' && navResults[activeIdx]) navigateTo(navResults[activeIdx].href)
              }}
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground lg:block">Ctrl K</kbd>
            {showResults && navResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border bg-popover shadow-xl">
                <p className="px-4 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Go to page</p>
                {navResults.map((item, i) => (
                  <button key={item.href} onMouseDown={() => navigateTo(item.href)} onMouseEnter={() => setActiveIdx(i)}
                    className={cn('flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm', i === activeIdx ? 'bg-muted' : 'hover:bg-muted/60')}>
                    <span className="font-medium">{item.label}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">{item.section}{i === activeIdx && <CornerDownLeft className="h-3 w-3" />}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {mobileSearch && (
            <Button variant="ghost" size="sm" className="shrink-0 md:hidden" onClick={() => { setMobileSearch(false); setShowResults(false) }}>Cancel</Button>
          )}
        </div>

        {/* ── Right ── */}
        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
          <span suppressHydrationWarning className="hidden items-center gap-1.5 rounded-full bg-muted/70 px-3 py-1.5 text-xs font-medium text-muted-foreground 2xl:flex">
            <CalendarDays className="h-3.5 w-3.5" />{today}
          </span>

          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl md:hidden" aria-label="Search"
            onClick={() => { setMobileSearch(true); setTimeout(() => inputRef.current?.focus(), 0) }}>
            <Search className="h-5 w-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger className="hidden h-9 items-center gap-1.5 rounded-full bg-linear-to-r from-[#E8112D] to-[#F43F5E] pl-3 pr-2.5 text-sm font-semibold text-white shadow-md shadow-red-500/25 outline-none transition hover:brightness-110 sm:inline-flex">
              <Plus className="h-4 w-4" />New<ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {QUICK_NEW.map(n => (
                <DropdownMenuItem key={n.href} onClick={() => quickNew(n.href)}><n.icon className="mr-2 h-4 w-4" />New {n.label}</DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/accounting?tab=collections')}><Receipt className="mr-2 h-4 w-4" />Record a Collection</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full bg-muted/70 hover:bg-muted" onClick={() => setNotifOpen(v => !v)} aria-label="Notifications">
              <Bell className="h-4.5 w-4.5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-0.5 text-[10px] font-bold leading-none text-white ring-2 ring-card">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
            {notifOpen && (
              <div className="absolute right-0 top-full z-50 mt-3 flex max-h-112 w-88 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border bg-popover shadow-xl">
                <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
                  <span className="text-sm font-semibold">Notifications{unreadCount > 0 && <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">{unreadCount}</span>}</span>
                  {unreadCount > 0 && <button onClick={() => markAllNotifsRead()} className="text-xs font-medium text-red-600 hover:underline">Mark all read</button>}
                </div>
                <div className="overflow-y-auto">
                  {notifs.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-muted-foreground">You&apos;re all caught up</div>
                  ) : notifs.map(n => (
                    <button key={n.id} onClick={() => { markNotifRead(n); setNotifOpen(false); router.push(n.href) }}
                      className={cn('w-full border-b px-4 py-3 text-left text-xs transition-colors last:border-0 hover:bg-muted/50', !n.read && 'bg-blue-50/50 dark:bg-blue-950/20')}>
                      <div className="flex items-start gap-2.5">
                        <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', n.read ? 'bg-transparent' : NOTIF_DOT[n.type])} />
                        <div className="min-w-0">
                          <p className="font-semibold leading-snug text-foreground">{n.title}</p>
                          <p className="leading-snug text-muted-foreground">{n.message}</p>
                          {n.time && <p className="mt-0.5 text-muted-foreground/80">{new Date(n.time).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {deviceNotifySupported() && (
                  <button type="button" onClick={toggleDevice}
                    className={cn('flex w-full shrink-0 items-center gap-2.5 border-t px-4 py-2.5 text-left text-xs transition-colors', deviceOn ? 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400' : 'text-muted-foreground hover:bg-muted/60')}>
                    {deviceOn ? <BellRing className="h-4 w-4 shrink-0" /> : <BellOff className="h-4 w-4 shrink-0" />}
                    <span className="flex-1">{deviceOn ? 'Device alerts are on — click to turn off' : 'Turn on alerts on this device'}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Account */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-black/5 bg-muted/40 p-0.5 pr-0.5 outline-none transition hover:bg-muted dark:border-white/10 lg:pr-3" aria-label="Account menu">
              <Avatar className="h-8 w-8">
                {userAvatarUrl && <AvatarImage src={userAvatarUrl} alt={userName} />}
                <AvatarFallback className="bg-[#111111] text-xs font-bold text-white">{initials(userName)}</AvatarFallback>
              </Avatar>
              <span className="hidden min-w-0 text-left leading-tight lg:block">
                <span className="block max-w-36 truncate text-[13px] font-semibold">{userName}</span>
                <span className="block max-w-36 truncate text-[11px] capitalize text-muted-foreground">{roleLabel}</span>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="end">
              <div className="flex items-center gap-3 border-b px-3 py-3">
                <Avatar className="h-10 w-10">
                  {userAvatarUrl && <AvatarImage src={userAvatarUrl} alt={userName} />}
                  <AvatarFallback className="bg-[#111111] text-sm font-bold text-white">{initials(userName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{userName}</p>
                  <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                  <p className="mt-0.5 truncate text-[11px] capitalize text-muted-foreground">{roleLabel} · {companyName}</p>
                </div>
              </div>
              <div className="p-1">
                <DropdownMenuItem onClick={() => router.push('/settings')}><Settings className="mr-2 h-4 w-4" />Settings</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/users')}><UserCog className="mr-2 h-4 w-4" />User Management</DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.open('/', '_blank', 'noopener')}><Globe className="mr-2 h-4 w-4" />Visit Website</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" />Sign Out</DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
