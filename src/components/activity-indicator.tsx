'use client'

import { useSyncExternalStore } from 'react'
import { Loader2, CheckCircle2, XCircle, Plus, Save, Trash2 } from 'lucide-react'
import { subscribeActivity, getActivity, getServerActivity, type ActivityKind } from '@/lib/activity'
import { cn } from '@/lib/utils'

const LABEL: Record<ActivityKind, { busy: string; done: string; Icon: typeof Save; tone: string }> = {
  adding:   { busy: 'Adding…',   done: 'Added',   Icon: Plus,   tone: 'from-emerald-500 to-emerald-600' },
  saving:   { busy: 'Saving…',   done: 'Saved',   Icon: Save,   tone: 'from-blue-500 to-blue-600' },
  deleting: { busy: 'Deleting…', done: 'Deleted', Icon: Trash2, tone: 'from-rose-500 to-rose-600' },
}

/** Floating status pill (top centre) for every database write in the app. */
export function ActivityIndicator() {
  const s = useSyncExternalStore(subscribeActivity, getActivity, getServerActivity)
  if (s.phase === 'idle') return null
  const l = LABEL[s.kind]
  const ok = s.phase === 'done' ? s.ok : true

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-3 z-[100] -translate-x-1/2 print:hidden"
    >
      <div
        className={cn(
          'flex items-center gap-2.5 rounded-full bg-white/95 py-1.5 pl-1.5 pr-4 text-sm font-medium shadow-xl shadow-black/10 ring-1 ring-black/5 backdrop-blur animate-in fade-in-0 slide-in-from-top-2 duration-200',
        )}
      >
        <span
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full bg-linear-to-br text-white',
            s.phase === 'done' && !ok ? 'from-red-500 to-red-600' : l.tone,
          )}
        >
          {s.phase === 'busy' ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        </span>
        <span className="text-slate-700">
          {s.phase === 'busy' ? l.busy : ok ? l.done : 'Something went wrong'}
          {s.phase === 'busy' && s.count > 1 && <span className="ml-1 text-xs text-slate-400">({s.count})</span>}
        </span>
        {s.phase === 'busy' && (
          <span className="absolute inset-x-4 -bottom-px h-0.5 overflow-hidden rounded-full">
            <span className={cn('block h-full w-1/3 animate-[indeterminate_1.1s_ease-in-out_infinite] rounded-full bg-linear-to-r', l.tone)} />
          </span>
        )}
      </div>
    </div>
  )
}
