'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, Package, ShoppingCart, FileText,
  Truck, Warehouse, RotateCcw, Cpu, UserCheck, Calculator,
  FileBarChart, Settings, ChevronDown, ChevronRight, Building2,
  BarChart3, ClipboardList, SlidersHorizontal, ArrowRightLeft,
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
  { label: 'Settings', href: '/settings', icon: Settings },
]

function NavLink({ item, depth = 0 }: { item: NavItem; depth?: number }) {
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
          <div className="ml-4 mt-1 space-y-0.5 border-l border-border pl-3">
            {item.children.map(child => (
              <NavLink key={child.label} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Link
      href={item.href!}
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

export function Sidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-64 border-r bg-card h-screen sticky top-0">
      {/* Logo */}
      <div className="p-4 border-b flex items-center justify-center">
        <Image
          src="/logo.png"
          alt="CDSC Industrial Supply"
          width={180}
          height={60}
          className="object-contain"
          priority
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {navigation.map(item => (
          <NavLink key={item.label} item={item} />
        ))}
      </nav>
    </aside>
  )
}
