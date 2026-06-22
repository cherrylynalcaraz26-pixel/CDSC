'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Building2, LogOut, FileText, Home, Loader2, Package, Settings } from 'lucide-react'
import Link from 'next/link'

export default function PortalAppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)
  const [clientName, setClientName] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace('/portal/login')
        return
      }
      // Verify this user is a client role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', data.session.user.id)
        .single()
      if (!profile || profile.role !== 'client') {
        await supabase.auth.signOut()
        router.replace('/portal/login')
        return
      }
      setClientName(profile.full_name ?? data.session.user.email ?? '')
      setChecking(false)
    })
  }, [])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/portal/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded bg-red-600 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-sm">CDSC Client Portal</span>
          </div>
          <nav className="flex items-center gap-1 ml-6">
            <Link href="/portal" className={`text-sm px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${pathname === '/portal' ? 'bg-red-50 text-red-600 font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-gray-100'}`}>
              <Home className="h-3.5 w-3.5" /> Dashboard
            </Link>
            <Link href="/portal/inventory" className={`text-sm px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${pathname?.startsWith('/portal/inventory') ? 'bg-red-50 text-red-600 font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-gray-100'}`}>
              <Package className="h-3.5 w-3.5" /> Inventory
            </Link>
            <Link href="/portal/requests" className={`text-sm px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${pathname?.startsWith('/portal/requests') ? 'bg-red-50 text-red-600 font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-gray-100'}`}>
              <FileText className="h-3.5 w-3.5" /> My Requests
            </Link>
            <Link href="/portal/settings" className={`text-sm px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${pathname?.startsWith('/portal/settings') ? 'bg-red-50 text-red-600 font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-gray-100'}`}>
              <Settings className="h-3.5 w-3.5" /> Settings
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{clientName}</span>
            <button onClick={signOut} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-red-600 transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
