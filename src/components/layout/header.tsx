'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, Search, Menu, LogOut, Settings, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { useSearchContext } from '@/context/search-context'
import { cn } from '@/lib/utils'

interface HeaderProps {
  onMenuClick?: () => void
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
  { label: 'Pull Out & Billing',   href: '/pull-out-billing',        section: 'Warehouse' },
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
  '/pull-out-billing', '/users', '/clients',
]

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const { query, setQuery } = useSearchContext()
  const [userName, setUserName] = useState('User')
  const [userEmail, setUserEmail] = useState('')
  const [userRole, setUserRole] = useState('')
  const [initials, setInitials] = useState('U')
  const [showResults, setShowResults] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<{ id: string; title: string; desc: string; read: boolean }[]>([])
  const searchRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  const isDataPage = DATA_PAGES.some(p => pathname.startsWith(p))

  const navResults = (!isDataPage && query.trim().length > 0)
    ? SEARCH_ITEMS.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.section.toLowerCase().includes(query.toLowerCase())
      )
    : []

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserEmail(user.email ?? '')
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single()
      const name = profile?.full_name ?? user.email?.split('@')[0] ?? 'User'
      setUserName(name)
      setUserRole(profile?.role ?? '')
      setInitials(name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2))

      // Load notifications: pending purchase requests and low stock alerts
      const notifs: typeof notifications = []
      const { data: pendingPR } = await supabase
        .from('purchase_requests')
        .select('pr_number')
        .eq('status', 'pending')
        .limit(5)
      for (const pr of (pendingPR ?? [])) {
        notifs.push({ id: `pr-${pr.pr_number}`, title: 'Pending Purchase Request', desc: `PR ${pr.pr_number} awaiting approval`, read: false })
      }
      setNotifications(notifs)
    }
    loadUser()
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
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
    setShowSearch(false)
    router.push(href)
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b px-4 md:px-6 py-3">
      <div className="flex items-center justify-between gap-3">
        {/* Left: hamburger (mobile drawer trigger) */}
        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-9 w-9"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Center: search (hidden on mobile, shown via toggle) */}
        <div
          ref={searchRef}
          className={cn(
            'flex-1 max-w-sm',
            showSearch ? 'flex' : 'hidden sm:flex',
          )}
        >
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={isDataPage ? 'Search this page…' : 'Search pages…'}
              className="pl-9 pr-9 h-9 w-full"
              value={query}
              onChange={e => { setQuery(e.target.value); setShowResults(true) }}
              onFocus={() => setShowResults(true)}
              onKeyDown={e => {
                if (e.key === 'Escape') { setShowResults(false); setQuery(''); setShowSearch(false) }
                if (e.key === 'Enter' && navResults.length > 0) navigateTo(navResults[0].href)
              }}
              autoFocus={showSearch}
            />
            {showSearch && (
              <button
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => { setShowSearch(false); setQuery(''); setShowResults(false) }}
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {showResults && navResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden">
                {navResults.map(item => (
                  <button
                    key={item.href}
                    onMouseDown={() => navigateTo(item.href)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted text-left"
                  >
                    <span className="font-medium">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.section}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Mobile search toggle */}
          {!showSearch && (
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden h-9 w-9"
              onClick={() => setShowSearch(true)}
            >
              <Search className="h-5 w-5" />
            </Button>
          )}

          {/* Notification bell */}
          <div ref={notifRef} className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 relative"
              onClick={() => setNotifOpen(v => !v)}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-600" />
              )}
            </Button>
            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-popover border rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <span className="text-sm font-semibold">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => setNotifications(ns => ns.map(n => ({ ...n, read: true })))}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications</div>
                ) : (
                  <div className="divide-y">
                    {notifications.map(n => (
                      <div
                        key={n.id}
                        className={cn('px-4 py-3 text-xs cursor-pointer hover:bg-muted/50', !n.read && 'bg-blue-50/40 dark:bg-blue-950/20')}
                        onClick={() => setNotifications(ns => ns.map(x => x.id === n.id ? { ...x, read: true } : x))}
                      >
                        <div className="font-medium text-foreground">{n.title}</div>
                        <div className="text-muted-foreground mt-0.5">{n.desc}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-accent outline-none">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-red-600 text-white text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64" align="end">
              <DropdownMenuLabel className="font-normal">
                <div className="flex items-center gap-3 py-1">
                  <div className="h-10 w-10 rounded-full bg-red-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight truncate">{userName}</p>
                    <p className="text-xs leading-tight text-muted-foreground truncate">{userEmail}</p>
                    {userRole && (
                      <span className="inline-block mt-1 text-[10px] bg-muted px-1.5 py-0.5 rounded capitalize font-medium">
                        {userRole}
                      </span>
                    )}
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <Settings className="mr-2 h-4 w-4" />Company Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
