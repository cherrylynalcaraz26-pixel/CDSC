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
      { label: 'Categories', href: '/items/categories', icon: ClipboardList },
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

function NavLink({
  item,
  depth = 0,
  onNavigate,
}: {
  item: NavItem
  depth?: number
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(() =>
    item.children?.some(c => c.href && pathname.startsWith(c.href)) ?? false
  )

  const isActive = item.href
    ? pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
    : false

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(o => !o)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            'text-muted-foreground hover:text-foreground hover:bg-accent',
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        {open && (
          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-3">
            {item.children.map(child => (
              <NavLink key={child.label} item={child} depth={depth + 1} onNavigate={onNavigate} />
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
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
        isActive
          ? 'bg-orange-500 text-white'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent',
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
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
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 flex items-center justify-center">
        <Image
          src="/cdsc-logo.jpg"
          alt="CDSC Industrial Supply"
          width={120}
          height={40}
          className="object-contain mix-blend-multiply dark:mix-blend-normal"
          priority
        />
      </div>
      <div className="h-px bg-border mx-3 mb-1" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {navigation.map(item => (
          <NavLink key={item.label} item={item} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* Sign Out */}
      <div className="p-3 border-t">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )
}

/* Desktop sidebar */
export function Sidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-64 border-r bg-card h-screen sticky top-0 shrink-0">
      <SidebarContent />
    </aside>
  )
}

/* Mobile drawer controlled externally */
export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-card border-r shadow-xl transition-transform duration-300 ease-in-out lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent"
        >
          <X className="h-4 w-4" />
        </button>

        <SidebarContent onNavigate={onClose} />
      </aside>
    </>
  )
}
