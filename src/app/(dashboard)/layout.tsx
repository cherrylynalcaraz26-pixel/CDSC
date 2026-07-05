'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar, MobileSidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { SearchProvider } from '@/context/search-context'
import { CompanyProvider } from '@/context/company-context'
import {
  LayoutDashboard, TrendingUp, ShoppingCart, Warehouse, Calculator, MessageSquare,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface BottomNavChild { label: string; href: string }

const BOTTOM_NAV: { label: string; href: string; icon: React.ComponentType<{ className?: string }>; children?: BottomNavChild[] }[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'CRM', href: '/crm', icon: TrendingUp },
  {
    label: 'Purchasing', href: '/sales-orders', icon: ShoppingCart,
    children: [
      { label: 'Purchase Orders', href: '/purchase-orders' },
      { label: 'Quotation', href: '/quotation' },
      { label: 'Sales Orders', href: '/sales-orders' },
    ],
  },
  {
    label: 'Warehouse', href: '/inventory', icon: Warehouse,
    children: [
      { label: 'Receiving', href: '/receiving' },
      { label: 'Inventory', href: '/inventory' },
      { label: 'DR Logs', href: '/dr-logs' },
      { label: 'CSI Monitoring', href: '/csi-monitoring' },
      { label: 'Pull Out & Billing', href: '/pull-out-billing' },
    ],
  },
  { label: 'Accounting', href: '/accounting', icon: Calculator },
  { label: 'Messages', href: '/messages', icon: MessageSquare },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
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
          const isActiveHref = (href: string) => href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname === href || pathname.startsWith(href + '/')
          const active = link.children
            ? link.children.some(c => isActiveHref(c.href))
            : isActiveHref(link.href)

          if (link.children) {
            return (
              <DropdownMenu key={link.href}>
                <DropdownMenuTrigger
                  className={cn(
                    'flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-medium transition-colors outline-none',
                    active ? 'text-red-400' : 'text-white/40 hover:text-white/70'
                  )}
                >
                  {/* Dot indicator sits as a badge on the icon itself (not an extra row) —
                      signals this tab holds multiple pages without changing the tab's height */}
                  <span className="relative">
                    <link.icon className={cn('h-5 w-5 shrink-0', active ? 'text-red-400' : '')} />
                    <span className="absolute -top-1 -right-1.5 flex items-center gap-[1px]">
                      {link.children.map((_, i) => (
                        <span key={i} className={cn('h-[3px] w-[3px] rounded-full', active ? 'bg-red-400' : 'bg-white/50')} />
                      ))}
                    </span>
                  </span>
                  <span className="leading-tight truncate max-w-full px-1">{link.label}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" side="top" className="mb-1 w-48">
                  {link.children.map(child => (
                    <DropdownMenuItem key={child.href} onClick={() => router.replace(child.href)} className={cn(isActiveHref(child.href) && 'font-semibold text-red-600')}>
                      {child.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )
          }

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
