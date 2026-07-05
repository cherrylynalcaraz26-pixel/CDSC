'use client'

import { useEffect, useRef, useState } from 'react'
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
  //
  // Attached as native (non-passive) listeners rather than React's onTouch* props:
  // React binds touch handlers as passive by default, so calling preventDefault() from
  // them doesn't actually stop the browser's own gesture handling (edge-swipe-back,
  // rubber-band scroll) from hijacking the touch sequence before our JS finishes — which
  // is what made swipes not register at all. A manual { passive: false } listener lets us
  // seize the gesture the moment we detect it's horizontal.
  const navRef = useRef<HTMLElement | null>(null)
  const pathnameRef = useRef(pathname)
  useEffect(() => { pathnameRef.current = pathname }, [pathname])

  useEffect(() => {
    const el = navRef.current
    if (!el) return

    let startX = 0
    let startY = 0
    let dragging = false
    let activeChildren: BottomNavChild[] | null = null

    function isActive(href: string) {
      return href === '/dashboard' ? pathnameRef.current === '/dashboard' : pathnameRef.current === href || pathnameRef.current.startsWith(href + '/')
    }

    function findGroupChildren(target: EventTarget | null): BottomNavChild[] | null {
      let node = target as HTMLElement | null
      while (node && node !== el) {
        const key = node.getAttribute?.('data-group')
        if (key) {
          const group = BOTTOM_NAV.find(l => l.href === key)
          return group?.children ?? null
        }
        node = node.parentElement
      }
      return null
    }

    function navigateWithin(children: BottomNavChild[], offset: number) {
      const current = children.findIndex(c => isActive(c.href))
      const idx = current === -1 ? 0 : current
      const target = offset === 0 ? idx : (idx + offset + children.length) % children.length
      router.replace(children[target].href)
    }

    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0]
      startX = t.clientX
      startY = t.clientY
      dragging = false
      activeChildren = findGroupChildren(e.target)
    }

    function onTouchMove(e: TouchEvent) {
      if (!activeChildren) return
      const t = e.touches[0]
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      if (!dragging && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        dragging = true
      }
      if (dragging) e.preventDefault()
    }

    function onTouchEnd(e: TouchEvent) {
      if (!activeChildren) return
      const t = e.changedTouches[0]
      const dx = t.clientX - startX
      if (dragging && Math.abs(dx) > 30) {
        navigateWithin(activeChildren, dx < 0 ? 1 : -1)
      } else if (!dragging) {
        navigateWithin(activeChildren, 0)
      }
      activeChildren = null
      dragging = false
    }

    function onTouchCancel() {
      activeChildren = null
      dragging = false
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchCancel, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchCancel)
    }
  }, [router])

  function handleGroupClick(children: BottomNavChild[]) {
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
      <nav ref={navRef} className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#111111] border-t border-white/10 flex items-stretch">
        {BOTTOM_NAV.map(link => {
          const active = link.children
            ? link.children.some(c => isActiveHref(c.href))
            : isActiveHref(link.href)

          if (link.children) {
            const groupChildren = link.children
            return (
              <div
                key={link.href}
                data-group={link.href}
                role="button"
                tabIndex={0}
                onClick={() => handleGroupClick(groupChildren)}
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
