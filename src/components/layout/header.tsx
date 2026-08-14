'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, Search, Menu, LogOut, Package, MessageSquare, ShoppingCart, MapPin, Phone, Mail, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { useSearchContext } from '@/context/search-context'
import { useCompany } from '@/context/company-context'
import { cn } from '@/lib/utils'

interface HeaderProps {
  onMenuClick?: () => void
  sidebarCollapsed?: boolean
}

const SEARCH_ITEMS = [
  { label: 'Dashboard',             href: '/dashboard',               section: 'Main' },
  { label: 'CRM / Inquiry',        href: '/crm',                     section: 'CRM' },
  { label: 'Purchase Orders',       href: '/purchase-orders',         section: 'Purchasing' },
  { label: 'Quotation',             href: '/quotation',               section: 'Purchasing' },
  { label: 'Sales Orders',          href: '/sales-orders',            section: 'Purchasing' },
  { label: 'Receiving',             href: '/receiving',               section: 'Warehouse' },
  { label: 'Inventory',             href: '/inventory',               section: 'Warehouse' },
  { label: 'DR Logs',               href: '/dr-logs',                 section: 'Warehouse' },
  { label: 'CSI Monitoring',        href: '/csi-monitoring',          section: 'Warehouse' },
  { label: 'Accounting',            href: '/accounting',              section: 'Accounting' },
  { label: 'Reports',               href: '/reports',                 section: 'Setup' },
  { label: 'Configuration',         href: '/setup',                   section: 'Setup' },
  { label: 'Clients',               href: '/clients',                 section: 'Setup' },
  { label: 'Users',                 href: '/users',                   section: 'Setup' },
  { label: 'Settings',              href: '/settings',                section: 'Settings' },
]

const DATA_PAGES = [
  '/crm', '/purchase-orders', '/quotation', '/sales-orders',
  '/receiving', '/inventory', '/dr-logs', '/csi-monitoring',
  '/users', '/clients', '/accounting', '/dashboard', '/messages',
  '/setup', '/assets',
]

interface Notif { id: string; type: 'message' | 'order' | 'stock'; message: string; read: boolean; time: string; href: string }

export function Header({ onMenuClick, sidebarCollapsed }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const { query, setQuery } = useSearchContext()
  const { company } = useCompany()
  const [userName, setUserName] = useState('User')
  const [userEmail, setUserEmail] = useState('')
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null)
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Notifications
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const isDataPage = DATA_PAGES.some(p => pathname.startsWith(p))

  const navResults = (!isDataPage && query.trim().length > 0)
    ? SEARCH_ITEMS.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.section.toLowerCase().includes(query.toLowerCase())
      )
    : []

  useEffect(() => {
    async function loadNotifs() {
      const [{ data: msgs }, { data: orders }] = await Promise.all([
        supabase.from('client_messages').select('id,client_name,message,sent_at').eq('status', 'unread').order('sent_at', { ascending: false }).limit(20),
        supabase.from('sales_orders').select('id,so_number,client_name,created_at').eq('status', 'draft').like('so_number', 'SO-P-%').order('created_at', { ascending: false }).limit(20),
      ])
      const built: Notif[] = []
      for (const m of (msgs ?? [])) {
        built.push({ id: `msg-${m.id}`, type: 'message', message: `New message from ${m.client_name || 'client'}: "${(m.message ?? '').slice(0, 60)}${(m.message?.length ?? 0) > 60 ? '…' : ''}"`, read: false, time: m.sent_at, href: '/messages' })
      }
      for (const so of (orders ?? [])) {
        built.push({ id: `so-${so.id}`, type: 'order', message: `Portal order ${so.so_number} from ${so.client_name || 'client'} needs review`, read: false, time: so.created_at, href: '/sales-orders' })
      }
      setNotifs(built)
    }
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserEmail(user.email ?? '')
      const { data: profile } = await supabase.from('profiles').select('full_name, role, avatar_url').eq('id', user.id).single()
      const name = profile?.full_name ?? user.email?.split('@')[0] ?? 'User'
      setUserName(name)
      setUserAvatarUrl((profile as any)?.avatar_url ?? null)
      await loadNotifs()
    }
    loadUser()
    const interval = setInterval(loadNotifs, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function navigateTo(href: string) {
    setQuery('')
    setShowResults(false)
    router.push(href)
  }

  const unreadCount = notifs.filter(n => !n.read).length
  const companyName = company.company_name || 'CDSC Industrial Supply'
  const logoSrc = company.logo_url || '/cdsc-logo.jpg'

  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b px-4 md:px-6 py-3">
      <div className="flex items-center justify-between gap-3">
        {/* Left: hamburger + logo when collapsed */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9" onClick={onMenuClick}>
            <Menu className="h-5 w-5" />
          </Button>
          {sidebarCollapsed && (
            <div className="hidden lg:flex items-center gap-2">
              <div className="h-7 w-7 shrink-0 rounded-md overflow-hidden bg-white flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoSrc} alt={companyName} className="h-full w-full object-contain p-0.5" />
              </div>
              <span className="text-sm font-semibold leading-tight">{companyName}</span>
            </div>
          )}
        </div>

        {/* Center: search */}
        <div className="flex-1 max-w-sm" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={isDataPage ? 'Search this page…' : 'Search pages…'}
              className="pl-9 h-9"
              autoComplete="off"
              value={query}
              onChange={e => { setQuery(e.target.value); setShowResults(true) }}
              onFocus={() => setShowResults(true)}
              onKeyDown={e => {
                if (e.key === 'Escape') { setShowResults(false); setQuery('') }
                if (e.key === 'Enter' && navResults.length > 0) navigateTo(navResults[0].href)
              }}
            />
            {showResults && navResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden">
                {navResults.map(item => (
                  <button key={item.href} onMouseDown={() => navigateTo(item.href)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted text-left">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.section}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5">
          {/* Notification bell */}
          <div className="relative" ref={notifRef}>
            <Button
              variant="ghost" size="icon"
              className="h-9 w-9 relative"
              onClick={() => setNotifOpen(v => !v)}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-4 min-w-[16px] px-0.5 rounded-full bg-red-600 text-[10px] font-bold text-white flex items-center justify-center leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>

            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-popover border rounded-xl shadow-lg z-50 max-h-96 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
                  <span className="text-sm font-semibold">Notifications</span>
                  {unreadCount > 0 && (
                    <button onClick={() => setNotifs(ns => ns.map(n => ({ ...n, read: true })))}
                      className="text-xs text-red-600 hover:underline">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto">
                  {notifs.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">No new notifications</div>
                  ) : notifs.map(n => (
                    <button
                      key={n.id}
                      onClick={() => {
                        setNotifs(ns => ns.map(x => x.id === n.id ? { ...x, read: true } : x))
                        setNotifOpen(false)
                        router.push(n.href)
                      }}
                      className={cn(
                        'w-full text-left px-4 py-3 text-xs border-b last:border-0 hover:bg-muted/50 transition-colors',
                        !n.read && 'bg-blue-50/50 dark:bg-blue-950/20',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span className={cn('mt-0.5 shrink-0 h-1.5 w-1.5 rounded-full mt-1.5', n.read ? 'bg-transparent' : n.type === 'message' ? 'bg-blue-500' : n.type === 'order' ? 'bg-red-500' : 'bg-amber-500')} />
                        <div>
                          <p className="font-medium text-foreground leading-snug">{n.message}</p>
                          {n.time && (
                            <p className="text-muted-foreground mt-0.5">
                              {new Date(n.time).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Avatar dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="h-9 w-9 rounded-full flex items-center justify-center hover:ring-2 hover:ring-red-500/30 outline-none transition-all">
              <Avatar className="h-8 w-8">
                {userAvatarUrl && <AvatarImage src={userAvatarUrl} alt={userName} />}
                <AvatarFallback className="bg-white p-0.5">
                  <img src={logoSrc} alt={companyName} className="h-full w-full object-contain" />
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-72" align="end">
              {/* Company logo + name */}
              <div className="px-4 py-4 flex flex-col items-center gap-3 border-b text-center">
                <div className="h-14 w-14 rounded-xl overflow-hidden shrink-0 border bg-white flex items-center justify-center">
                  <img src={logoSrc} alt={companyName} className="h-full w-full object-contain p-1" />
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight">{companyName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{userEmail}</p>
                </div>
              </div>
              <div className="p-2">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
