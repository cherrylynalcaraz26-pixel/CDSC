'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { MessageSquare, X, Maximize2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { MessagesView } from './messages-view'

/**
 * Floating chat button (lower right) that opens the Messages inbox in a panel,
 * replacing the old "Messages" sidebar link. Hidden on /messages itself.
 */
export function FloatingMessages() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { count } = await supabase.from('client_messages').select('id', { count: 'exact', head: true }).eq('status', 'unread')
      setUnread(count ?? 0)
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (pathname.startsWith('/messages')) return null

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/20 lg:bg-transparent" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label="Messages"
            onClick={e => e.stopPropagation()}
            className="fixed bottom-36 right-3 left-3 top-16 lg:left-auto lg:top-auto lg:bottom-24 lg:right-6 lg:w-[min(1000px,calc(100vw-20rem))] lg:h-[min(680px,calc(100vh-8rem))] flex flex-col rounded-2xl bg-background shadow-2xl shadow-black/25 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#F84400] text-white">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="h-4 w-4" /> Messages
              </span>
              <div className="flex items-center gap-1">
                <Link
                  href="/messages"
                  onClick={() => setOpen(false)}
                  title="Open full page"
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-white/15"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  title="Close"
                  className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-white/15"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-muted/30">
              <MessagesView embedded />
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title={unread ? `Messages (${unread} unread)` : 'Messages'}
        className={cn(
          'fixed z-50 right-4 bottom-20 lg:right-6 lg:bottom-6 h-14 w-14 rounded-full bg-[#F84400] text-white shadow-lg shadow-orange-900/30',
          'flex items-center justify-center transition-transform hover:scale-105 hover:bg-[#e03d00]',
        )}
      >
        {open ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
        {!!unread && !open && (
          <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-white text-[#F84400] text-[11px] font-bold flex items-center justify-center shadow">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
    </>
  )
}
