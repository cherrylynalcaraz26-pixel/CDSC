'use client'

import { useState } from 'react'
import { Sidebar, MobileSidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { SearchProvider } from '@/context/search-context'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <SearchProvider>
      <div className="flex h-screen overflow-hidden bg-muted/30">
        {/* Desktop sidebar */}
        <Sidebar />

        {/* Mobile drawer */}
        <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Header onMenuClick={() => setMobileOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </SearchProvider>
  )
}
