'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar, MobileSidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { SearchProvider } from '@/context/search-context'
import { CompanyProvider } from '@/context/company-context'
import {
  LayoutDashboard, TrendingUp, ShoppingCart, Warehouse, Calculator, MessageSquare,
} from 'lucide-react'
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

  function isActiveHref(href: string) {
    return href === '/dashboard' ? pathname === '/dashboard' : pathname === href || pathname.startsWith(href + '/')
  }

  // Swipe-to-cycle for grouped bottom-nav tabs (e.g. Purchasing: Purchase Orders /
  // Quotation / Sales Orders) — swipe left/right on the tab moves to the next/previous
  // page in the group; a plain tap goes to whichever page in the group is current.
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const justSwiped = useRef(false)

  function handleGroupTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }

  function handleGroupTouchEnd(children: BottomNavChild[], e: React.TouchEvent) {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
      const current = children.findIndex(c => isActiveHref(c.href))
      const idx = current === -1 ? 0 : current
      const next = dx < 0 ? (idx + 1) % children.length : (idx - 1 + children.length) % children.length
      justSwiped.current = true
      router.replace(children[next].href)
      setTimeout(() => { justSwiped.current = false }, 400)
    }
  }

  function handleGroupClick(children: BottomNavChild[]) {
    if (justSwiped.current) return
    const current = children.findIndex(c => isActiveHref(c.href))
    router.replace(children[current === -1 ? 0 : current].href)
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
          const active = link.children
            ? link.children.some(c => isActiveHref(c.href))
            : isActiveHref(link.href)

          if (link.children) {
            const children = link.children
            return (
              <div
                key={link.href}
                role="button"
                tabIndex={0}
                onTouchStart={handleGroupTouchStart}
                onTouchEnd={e => handleGroupTouchEnd(children, e)}
                onClick={() => handleGroupClick(children)}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-medium transition-colors select-none touch-pan-y',
                  active ? 'text-red-400' : 'text-white/40 hover:text-white/70'
                )}
              >
                <link.icon className={cn('h-5 w-5 shrink-0', active ? 'text-red-400' : '')} />
                <span className="leading-tight truncate max-w-full px-1">{link.label}</span>
              </div>
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
