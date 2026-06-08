'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, Users, Package, ShoppingCart, FileText,
  Truck, Warehouse, RotateCcw, Cpu, UserCheck, Calculator,
  FileBarChart, Settings, ChevronDown, ChevronRight, Building2,
  ClipboardList, SlidersHorizontal, ArrowRightLeft, LogOut, X, Wrench,
} from 'lucide-react'
import { useState } from 'react'

interface NavItem {
  label: string
  href?: string
  icon: React.ComponentType<{ className?: string }>
  children?: NavItem[]
}

const navigation: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Suppliers', href: '/suppliers', icon: Building2 },
  {
    label: 'Item Master', icon: Package,
    children: [
      { label: 'Item List', href: '/items', icon: Package },
    ],
  },
  {
    label: 'Purchasing', icon: ShoppingCart,
    children: [
      { label: 'Purchase Requests', href: '/purchase-requests', icon: FileText },
      { label: 'Purchase Orders', href: '/purchase-orders', icon: ShoppingCart },
    ],
  },
  {
    label: 'Warehouse', icon: Warehouse,
    children: [
      { label: 'Receiving', href: '/receiving', icon: Truck },
      { label: 'Stock Transfer', href: '/warehouse/transfer', icon: ArrowRightLeft },
      { label: 'Stock Adjustment', href: '/warehouse/adjustment', icon: SlidersHorizontal },
      { label: 'Returns', href: '/returns', icon: RotateCcw },
    ],
  },
  { label: 'Assets', href: '/assets', icon: Cpu },
  { label: 'My Requests', href: '/employee-requests', icon: UserCheck },
  {
    label: 'Accounting', icon: Calculator,
    children: [
      { label: 'Overview', href: '/accounting', icon: Calculator },
      { label: 'BIR Compliance', href: '/bir', icon: FileBarChart },
    ],
  },
  { label: 'Reports', href: '/reports', icon: FileBarChart },
  { label: 'Users', href: '/users', icon: Users },
  { label: 'Setup', href: '/setup', icon: Wrench },
  { label: 'Settings', href: '/settings', icon: Settings },
]

function checkActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(href + '/')
}

function hasActiveChild(pathname: string, children: NavItem[]): boolean {
  return children.some(c => c.href ? checkActive(pathname, c.href) : false)
}

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname()
  const active = item.href ? checkActive(pathname, item.href) : false
  const childActive = item.children ? hasActiveChild(pathname, item.children) : false
  const [open, setOpen] = useState(() => childActive)

  if (item.children) {
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
              <NavLink key={child.label} item={child} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </div>
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

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter()
  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex flex-col h-full bg-[#111111]">
      {/* Logo area */}
      <div className="px-4 py-5 flex items-center gap-3">
        <div className="relative h-8 w-8 shrink-0">
          <Image
            src="/cdsc-logo.jpg"
            alt="CDSC"
            fill
            className="rounded object-contain"
            priority
          />
        </div>
        <div className="min-w-0">
          <div className="text-white font-semibold text-sm leading-tight truncate">CDSC Industrial</div>
          <div className="text-white/35 text-[11px] leading-tight">Supply ERP</div>
        </div>
      </div>

      <div className="h-px bg-white/8 mx-3 mb-2" />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5 scrollbar-thin">
        {navigation.map(item => (
          <NavLink key={item.label} item={item} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* Sign Out */}
      <div className="p-3 border-t border-white/8">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium text-white/40 hover:text-red-400 hover:bg-white/5 transition-colors"
        >
          <LogOut className="h-[15px] w-[15px] shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-56 h-screen sticky top-0 shrink-0">
      <SidebarContent />
    </aside>
  )
}

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={onClose} />
      )}
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
        <SidebarContent onNavigate={onClose} />
      </aside>
    </>
  )
}
