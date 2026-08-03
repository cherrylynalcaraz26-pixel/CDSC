'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, Package, ShoppingCart, FileText,
  Truck, Warehouse, RotateCcw, UserCheck, Calculator,
  FileBarChart, Settings, ChevronDown, ChevronRight, Building2,
  SlidersHorizontal, ArrowRightLeft, LogOut, X, Wrench,
  Receipt, PanelLeftClose, PanelLeftOpen, ClipboardList, BoxesIcon,
  TrendingUp, MessageSquare, Globe,
  BookOpen, Banknote, BarChart3, Scale, FileSpreadsheet,
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
    ],
  },
  {
    label: 'Accounting', icon: Calculator,
    children: [
      { label: 'Overview', href: '/accounting?tab=overview', icon: Calculator },
      { label: 'Collections', href: '/accounting?tab=collections', icon: Receipt },
      { label: 'BIR Compliance', href: '/accounting?tab=bir', icon: FileText },
    ],
  },
  {
    label: 'Bookkeeping', icon: FileBarChart,
    children: [
      { label: 'Sales Journal', href: '/accounting?tab=bookkeeping&sub=crj', icon: BookOpen },
      { label: 'Disbursements', href: '/accounting?tab=bookkeeping&sub=cdj', icon: Banknote },
      { label: 'Chart of Accounts', href: '/accounting?tab=bookkeeping&sub=coa', icon: FileSpreadsheet },
      { label: 'General Ledger', href: '/accounting?tab=bookkeeping&sub=gl', icon: BarChart3 },
      { label: 'Trial Balance', href: '/accounting?tab=bookkeeping&sub=tb', icon: Scale },
      { label: 'Income Statement', href: '/accounting?tab=bookkeeping&sub=is', icon: TrendingUp },
      { label: 'Balance Sheet', href: '/accounting?tab=bookkeeping&sub=bs', icon: FileSpreadsheet },
    ],
  },
  { label: 'Messages', href: '/messages', icon: MessageSquare },
  {
    label: 'Setup', icon: Wrench,
    children: [
      { label: 'Configuration', href: '/setup', icon: SlidersHorizontal },
      { label: 'Clients', href: '/clients', icon: Users },
      { label: 'Reports', href: '/reports', icon: FileBarChart },
      { label: 'Users', href: '/users', icon: Users },
    ],
  },
  { label: 'Company Profile', href: '/settings', icon: Settings },
]

// Some sidebar links (Accounting's sub-tabs) share one route and are distinguished only
// by query string (?tab=...&sub=...) — so active-state matching needs to compare those
// too, falling back to each param's default value when the URL doesn't have it yet.
const QUERY_PARAM_DEFAULTS: Record<string, string> = { tab: 'overview', sub: 'crj' }

function checkActive(pathname: string, href: string, search: URLSearchParams) {
  const [hrefPath, hrefQuery] = href.split('?')
  const pathMatches = hrefPath === '/dashboard' ? pathname === '/dashboard' : (pathname === hrefPath || pathname.startsWith(hrefPath + '/'))
  if (!pathMatches) return false
  if (!hrefQuery) return true
  const hrefParams = new URLSearchParams(hrefQuery)
  for (const [key, value] of hrefParams.entries()) {
    const current = search.get(key) ?? QUERY_PARAM_DEFAULTS[key] ?? ''
    if (current !== value) return false
  }
  return true
}

function itemMatches(pathname: string, search: URLSearchParams, item: NavItem): boolean {
  if (item.href) return checkActive(pathname, item.href, search)
  if (item.children) return hasActiveChild(pathname, search, item.children)
  return false
}

function hasActiveChild(pathname: string, search: URLSearchParams, children: NavItem[]): boolean {
  return children.some(c => itemMatches(pathname, search, c))
}

// Sums badge counts for an item's own href plus, for group items, every
// descendant's href — so a collapsed "Purchasing" icon still surfaces a
// count even though its badge actually lives on the nested "Quotation" link.
function sumBadge(item: NavItem, badges: Record<string, number>): number {
  if (item.href) return badges[item.href] ?? 0
  if (item.children) return item.children.reduce((sum, c) => sum + sumBadge(c, badges), 0)
  return 0
}

function BadgePill({ count }: { count: number }) {
  if (!count) return null
  return (
    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
      {count > 99 ? '99+' : count}
    </span>
  )
}

function NavLink({
  item, collapsed, onNavigate, badges,
}: {
  item: NavItem
  collapsed: boolean
  onNavigate?: () => void
  badges: Record<string, number>
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const active = item.href ? checkActive(pathname, item.href, searchParams) : false
  const childActive = item.children ? hasActiveChild(pathname, searchParams, item.children) : false
  const [open, setOpen] = useState(() => childActive)
  const badge = sumBadge(item, badges)

  if (item.children) {
    if (collapsed) {
      return (
        <div className="relative group">
          <button
            title={badge ? `${item.label} (${badge} new)` : item.label}
            className={cn(
              'relative w-full flex items-center justify-center h-9 rounded-md transition-colors',
              childActive ? 'text-red-400' : 'text-white/40 hover:text-white/80 hover:bg-white/10',
            )}
          >
            <item.icon className="h-[16px] w-[16px] shrink-0" />
            {!!badge && <span className="absolute top-1 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />}
          </button>
          <div className="absolute left-full top-0 ml-1 hidden group-hover:block z-50 min-w-[180px] max-h-[80vh] overflow-y-auto bg-[#1a1a1a] border border-white/10 rounded-lg py-1 shadow-xl">
            <p className="text-[11px] font-semibold text-white/30 px-3 py-1.5 uppercase tracking-wider">{item.label}</p>
            {item.children.map(child => {
              if (child.children) {
                return (
                  <div key={child.label}>
                    <p className="text-[10px] font-semibold text-white/25 px-3 pt-2 pb-1 uppercase tracking-wider border-t border-white/5 mt-1">{child.label}</p>
                    {child.children.map(grandchild => {
                      const gActive = grandchild.href ? checkActive(pathname, grandchild.href, searchParams) : false
                      const gBadge = sumBadge(grandchild, badges)
                      return (
                        <Link
                          key={grandchild.label}
                          href={grandchild.href!}
                          onClick={onNavigate}
                          className={cn(
                            'flex items-center gap-2 px-3 py-1.5 text-[13px] transition-colors',
                            gActive ? 'text-red-400 bg-red-600/10' : 'text-white/60 hover:text-white hover:bg-white/10',
                          )}
                        >
                          <grandchild.icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="flex-1">{grandchild.label}</span>
                          <BadgePill count={gBadge} />
                        </Link>
                      )
                    })}
                  </div>
                )
              }
              const cActive = child.href ? checkActive(pathname, child.href, searchParams) : false
              const cBadge = sumBadge(child, badges)
              return (
                <Link
                  key={child.label}
                  href={child.href!}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 text-[13px] transition-colors',
                    cActive ? 'text-red-400 bg-red-600/10' : 'text-white/60 hover:text-white hover:bg-white/10',
                  )}
                >
                  <child.icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1">{child.label}</span>
                  <BadgePill count={cBadge} />
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
            childActive ? 'text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/10',
          )}
        >
          <item.icon className="h-[15px] w-[15px] shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          <BadgePill count={badge} />
          {open
            ? <ChevronDown className="h-3 w-3 opacity-40" />
            : <ChevronRight className="h-3 w-3 opacity-40" />}
        </button>
        {open && (
          <div className="mt-0.5 ml-3 pl-3 border-l border-white/10 space-y-0.5">
            {item.children.map(child => (
              <NavLink key={child.label} item={child} collapsed={false} onNavigate={onNavigate} badges={badges} />
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
        title={badge ? `${item.label} (${badge} new)` : item.label}
        className={cn(
          'relative flex items-center justify-center h-9 rounded-md transition-colors',
          active
            ? 'bg-red-600/20 text-red-400 border-l-2 border-red-500'
            : 'text-white/40 hover:text-white/80 hover:bg-white/10',
        )}
      >
        <item.icon className={cn('h-[16px] w-[16px] shrink-0', active ? 'text-red-400' : '')} />
        {!!badge && <span className="absolute top-1 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />}
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
          : 'text-white/50 hover:text-white/80 hover:bg-white/10',
      )}
    >
      <item.icon className={cn('h-[15px] w-[15px] shrink-0', active ? 'text-red-400' : '')} />
      <span className="flex-1">{item.label}</span>
      <BadgePill count={badge} />
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
  const displayName = company.company_name || 'CDSC Industrial Supply'
  const [badges, setBadges] = useState<Record<string, number>>({})

  useEffect(() => {
    const supabase = createClient()
    async function loadBadges() {
      const [messages, quotationRequests, draftOrders, newLeads] = await Promise.all([
        supabase.from('client_messages').select('id', { count: 'exact', head: true }).eq('status', 'unread'),
        supabase.from('quotation_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('sales_orders').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('crm_leads').select('id', { count: 'exact', head: true }).eq('stage', 'new_lead'),
      ])
      setBadges({
        '/messages': messages.count ?? 0,
        '/quotation': quotationRequests.count ?? 0,
        '/sales-orders': draftOrders.count ?? 0,
        '/crm': newLeads.count ?? 0,
      })
    }
    loadBadges()
    const interval = setInterval(loadBadges, 30000)
    return () => clearInterval(interval)
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex flex-col h-full bg-[#111111]">
      <div className={cn('py-4 flex items-center gap-3 transition-all', collapsed ? 'px-3 justify-center' : 'px-4')}>
        {collapsed ? (
          <button onClick={onToggleCollapse} title="Expand sidebar" className="h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-white flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} alt={displayName} className="h-full w-full object-contain p-1" />
          </button>
        ) : (
          <>
            <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-white flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc} alt={displayName} className="h-full w-full object-contain p-1" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white font-semibold text-sm leading-tight truncate">{displayName}</div>
              <div className="text-white/35 text-[11px] leading-tight">Admin Portal</div>
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
          <NavLink key={item.label} item={item} collapsed={collapsed} onNavigate={onNavigate} badges={badges} />
        ))}
      </nav>

      <div className={cn('p-3 border-t border-white/8 space-y-1', collapsed && 'flex flex-col items-center space-y-1')}>
        <a
          href="https://cdscindustrialsupply.netlify.app"
          target="_blank"
          rel="noopener noreferrer"
          title="Visit Website"
          className={cn(
            'flex items-center gap-2.5 rounded-md text-[13px] font-medium text-white/40 hover:text-blue-400 hover:bg-white/10 transition-colors',
            collapsed ? 'h-9 w-9 justify-center' : 'w-full px-3 py-2',
          )}
        >
          <Globe className="h-[15px] w-[15px] shrink-0" />
          {!collapsed && <span>Visit Website</span>}
        </a>
        <button
          onClick={handleSignOut}
          title="Sign Out"
          className={cn(
            'flex items-center gap-2.5 rounded-md text-[13px] font-medium text-white/40 hover:text-red-400 hover:bg-white/10 transition-colors',
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

export function Sidebar({
  collapsed: externalCollapsed,
  onToggleCollapse: externalToggle,
}: {
  collapsed?: boolean
  onToggleCollapse?: () => void
} = {}) {
  const [localCollapsed, setLocalCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })

  const collapsed = externalCollapsed !== undefined ? externalCollapsed : localCollapsed

  function toggle() {
    if (externalToggle) {
      externalToggle()
    } else {
      setLocalCollapsed(c => {
        localStorage.setItem('sidebar-collapsed', String(!c))
        return !c
      })
    }
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
        <SidebarContent collapsed={false} onToggleCollapse={onClose} onNavigate={onClose} />
      </aside>
    </>
  )
}