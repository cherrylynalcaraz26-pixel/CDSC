'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sidebar, MobileSidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { SearchProvider } from '@/context/search-context'
import { CompanyProvider } from '@/context/company-context'
import {
  LayoutDashboard, TrendingUp, ShoppingCart, Warehouse, Calculator, MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const BOTTOM_NAV = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'CRM', href: '/crm', icon: TrendingUp },
  { label: 'Purchasing', href: '/sales-orders', icon: ShoppingCart },
  { label: 'Warehouse', href: '/inventory', icon: Warehouse },
  { label: 'Accounting', href: '/accounting', icon: Calculator },
  { label: 'Messages', href: '/messages', icon: MessageSquare },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })

  function toggleSidebar() {
    setSidebarCollapsed(c => {
      localStorage.setItem('sidebar-collapsed', String(!c))
      return !c
    })
  }

  return (
    <CompanyProvider><SearchProvider>
      <div className="flex h-screen overflow-hidden bg-muted/30">
        {/* Desktop sidebar */}
        <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} />

        {/* Mobile drawer */}
        <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Header onMenuClick={() => setMobileOpen(true)} sidebarCollapsed={sidebarCollapsed} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 lg:pb-6">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#111111] border-t border-white/10 flex items-stretch">
        {BOTTOM_NAV.map(link => {
          const active = link.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname === link.href || pathname.startsWith(link.href + '/')
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
    </SearchProvider></CompanyProvider>
  )
}
