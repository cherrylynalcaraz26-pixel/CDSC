'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, Package, ShoppingCart, FileText,
  Truck, Warehouse, RotateCcw, UserCheck, Calculator,
  FileBarChart, Settings, ChevronDown, ChevronRight, Building2,
  SlidersHorizontal, ArrowRightLeft, LogOut, X, Wrench,
  Receipt, PanelLeftClose, PanelLeftOpen, ClipboardList, BoxesIcon,
  TrendingUp,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useCompany } from '@/context/company-context'

interface NavItem {
  label: string
  href?: string
  icon: React.ComponentType<{ className?: string }>
  children?: NavItem[]
}

const navigation: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'CRM / Inquiry', href: '/crm', icon: TrendingUp },
  {
    label: 'Purchasing', icon: ShoppingCart,
    children: [
      { label: 'Purchase Orders', href: '/purchase-orders', icon: ShoppingCart },
      { label: 'Quotation', href: '/quotation', icon: FileText },
      { label: 'Sales Orders', href: '/sales-orders', icon: Receipt },
    ],
  },
  {
    label: 'Warehouse', icon: Warehouse,
    children: [
      { label: 'Receiving', href: '/receiving', icon: Truck },
      { label: 'Inventory', href: '/inventory', icon: BoxesIcon },
      { label: 'DR Logs', href: '/dr-logs', icon: ClipboardList },
      { label: 'CSI Monitoring', href: '/csi-monitoring', icon: FileText },
      { label: 'Pull Out & Billing', href: '/pull-out-billing', icon: FileText },
    ],
  },
  { label: 'Accounting', href: '/accounting', icon: Calculator },
  {
    label: 'Setup', icon: Wrench,
    children: [
      { label: 'Configuration', href: '/setup', icon: SlidersHorizontal },
      { label: 'Reports', href: '/reports', icon: FileBarChart },
      { label: 'Users', href: '/users', icon: Users },
    ],
  },
  { label: 'Company Profile', href: '/settings', icon: Settings },
]

function checkActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(href + '/')
}

function hasActiveChild(pathname: string, children: NavItem[]): boolean {
  return children.some(c => c.href ? checkActive(pathname, c.href) : false)
}

function NavLink({
  item, collapsed, onNavigate,
}: {
  item: NavItem
  collapsed: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const active = item.href ? checkActive(pathname, item.href) : false
  const childActive = item.children ? hasActiveChild(pathname, item.children) : false
  const [open, setOpen] = useState(() => childActive)

  if (item.children) {
    if (collapsed) {
      return (
        <div className="relative group">
          <button
            title={item.label}
            className={cn(
              'w-full flex items-center justify-center h-9 rounded-md transition-colors',
              childActive ? 'text-red-400' : 'text-white/40 hover:text-white/80 hover:bg-white/5',
            )}
          >
            <item.icon className="h-[16px] w-[16px] shrink-0" />
          </button>
          <div className="absolute left-full top-0 ml-1 hidden group-hover:block z-50 min-w-[180px] bg-[#1a1a1a] border border-white/10 rounded-lg py-1 shadow-xl">
            <p className="text-[11px] font-semibold text-white/30 px-3 py-1.5 uppercase tracking-wider">{item.label}</p>
            {item.children.map(child => {
              const cActive = child.href ? checkActive(pathname, child.href) : false
              return (
                <Link
                  key={child.label}
                  href={child.href!}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 text-[13px] transition-colors',
                    cActive ? 'text-red-400 bg-red-600/10' : 'text-white/60 hover:text-white hover:bg-white/5',
                  )}
                >
                  <child.icon className="h-3.5 w-3.5 shrink-0" />
                  {child.label}
                </Link>
              )
            })}
          </div>
        </div>
      )
    }

    return (
      <div>
        <button
          onClick={() => setOpen(o => !o)}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors',
            childActive ? 'text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/5',
          )}
        >
          <item.icon className="h-[15px] w-[15px] shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          {open
            ? <ChevronDown className="h-3 w-3 opacity-40" />
            : <ChevronRight className="h-3 w-3 opacity-40" />}
        </button>
        {open && (
          <div className="mt-0.5 ml-3 pl-3 border-l border-white/10 space-y-0.5">
            {item.children.map(child => (
              <NavLink key={child.label} item={child} collapsed={false} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (collapsed) {
    return (
      <Link
        href={item.href!}
        onClick={onNavigate}
        title={item.label}
        className={cn(
          'flex items-center justify-center h-9 rounded-md transition-colors',
          active
            ? 'bg-red-600/20 text-red-400 border-l-2 border-red-500'
            : 'text-white/40 hover:text-white/80 hover:bg-white/5',
        )}
      >
        <item.icon className={cn('h-[16px] w-[16px] shrink-0', active ? 'text-red-400' : '')} />
      </Link>
    )
  }

  return (
    <Link
      href={item.href!}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors',
        active
          ? 'bg-red-600/20 text-red-400 border-l-2 border-red-500'
          : 'text-white/50 hover:text-white/80 hover:bg-white/5',
      )}
    >
      <item.icon className={cn('h-[15px] w-[15px] shrink-0', active ? 'text-red-400' : '')} />
      <span>{item.label}</span>
    </Link>
  )
}

function SidebarContent({
  collapsed, onToggleCollapse, onNavigate,
}: {
  collapsed: boolean
  onToggleCollapse: () => void
  onNavigate?: () => void
}) {
  const router = useRouter()
  const { company } = useCompany()
  const logoSrc = company.logo_url || '/cdsc-logo.jpg'
  const displayName = company.company_short_name || company.company_name || 'CDSC'

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex flex-col h-full bg-[#111111]">
      <div className={cn('py-4 flex items-center gap-3 transition-all', collapsed ? 'px-3 justify-center' : 'px-4')}>
        {collapsed ? (
          <button onClick={onToggleCollapse} title="Expand sidebar" className="relative h-8 w-8 shrink-0">
            <Image src={logoSrc} alt={displayName} fill className="rounded-md object-cover" priority />
          </button>
        ) : (
          <>
            <div className="relative h-8 w-8 shrink-0">
              <Image src={logoSrc} alt={displayName} fill className="rounded-md object-cover" priority />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white font-semibold text-sm leading-tight truncate">{displayName}</div>
              <div className="text-white/35 text-[11px] leading-tight">ERP System</div>
            </div>
            <button
              onClick={onToggleCollapse}
              title="Collapse sidebar"
              className="text-white/40 hover:text-white/80 transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      <div className="h-px bg-white/8 mx-3 mb-2" />

      <nav className={cn('flex-1 overflow-y-auto pb-2 space-y-0.5 scrollbar-thin', collapsed ? 'px-1.5' : 'px-2')}>
        {navigation.map(item => (
          <NavLink key={item.label} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className={cn('p-3 border-t border-white/8', collapsed && 'flex flex-col items-center')}>
        <button
          onClick={handleSignOut}
          title="Sign Out"
          className={cn(
            'flex items-center gap-2.5 rounded-md text-[13px] font-medium text-white/40 hover:text-red-400 hover:bg-white/5 transition-colors',
            collapsed ? 'h-9 w-9 justify-center' : 'w-full px-3 py-2',
          )}
        >
          <LogOut className="h-[15px] w-[15px] shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  )
}

export function Sidebar() {
  

    const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })

  function toggle() {
    setCollapsed(c => {
      localStorage.setItem('sidebar-collapsed', String(!c))
      return !c
    })
  }

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col h-screen sticky top-0 shrink-0 transition-all duration-200',
        collapsed ? 'w-14' : 'w-56',
      )}
    >
      <SidebarContent collapsed={collapsed} onToggleCollapse={toggle} />
    </aside>
  )
}

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={onClose} />}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-60 transition-transform duration-300 ease-in-out lg:hidden',
        open ? 'translate-x-0' : '-translate-x-full',
      )}>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 h-7 w-7 flex items-center justify-center rounded text-white/40 hover:text-white hover:bg-white/10 z-10"
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarContent collapsed={false} onToggleCollapse={onClose} onNavigate={onClose} />
      </aside>
    </>
  )
}