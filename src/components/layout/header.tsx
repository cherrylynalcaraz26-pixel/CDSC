'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, Search, Menu, LogOut, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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
  { label: 'Accounting',            href: '/accounting',              section: 'Accounting' },
  { label: 'Reports',               href: '/reports',                 section: 'Setup' },
  { label: 'Configuration',         href: '/setup',                   section: 'Setup' },
  { label: 'Users',                 href: '/users',                   section: 'Setup' },
  { label: 'Settings',              href: '/settings',                section: 'Settings' },
]

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()
  const [userName, setUserName] = useState('User')
  const [userEmail, setUserEmail] = useState('')
  const [initials, setInitials] = useState('U')
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const results = query.trim().length > 0
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
      setInitials(name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2))
    }
    loadUser()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
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
    router.push(href)
  }

  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b px-4 md:px-6 py-3">
      <div className="flex items-center justify-between gap-3">
        {/* Left: hamburger */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-9 w-9"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Center: search */}
        <div className="flex-1 max-w-sm hidden md:block" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search pages…"
              className="pl-9 h-9"
              value={query}
              onChange={e => { setQuery(e.target.value); setShowResults(true) }}
              onFocus={() => setShowResults(true)}
              onKeyDown={e => {
                if (e.key === 'Escape') { setShowResults(false); setQuery('') }
                if (e.key === 'Enter' && results.length > 0) navigateTo(results[0].href)
              }}
            />
            {showResults && results.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden">
                {results.map(item => (
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
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" className="h-9 w-9 relative">
            <Bell className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:flex items-center gap-1.5 text-muted-foreground hover:text-destructive"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">Sign Out</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-accent outline-none">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-red-600 text-white text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{userName}</p>
                  <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <Settings className="mr-2 h-4 w-4" />Settings
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
