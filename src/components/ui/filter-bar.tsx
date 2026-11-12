'use client'

// One layout for every list page's toolbar, so filters and buttons sit in the
// same place everywhere:
//
//   [ dropdown filters ] [ date range ] [ view switch ]  ·····  [ secondary ] [ PRIMARY ]
//
//   • filters on the left, all 36px tall (h-9), labelled inside the control;
//   • the date range is one control: a preset menu, plus From/To when "Custom";
//   • actions on the right — outline buttons first, the red primary button last.

import { CalendarDays, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { useState } from 'react'

export function FilterBar({ children, actions, className }: { children?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2.5 shadow-sm', className)}>
      {children}
      {actions && <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{actions}</div>}
    </div>
  )
}

/** Same height/text size for every select trigger in a FilterBar. */
export const FILTER_TRIGGER = 'h-9 min-w-36 text-sm'

// ── Date range ────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export type DatePreset = 'all' | 'today' | 'week' | 'month' | 'last_month' | 'quarter' | 'year' | 'custom'
const PRESET_LABEL: Record<DatePreset, string> = {
  all: 'All dates', today: 'Today', week: 'This week', month: 'This month', last_month: 'Last month',
  quarter: 'This quarter', year: 'This year', custom: 'Custom range…',
}

export function presetRange(p: DatePreset, now = new Date()): { from: string; to: string } {
  const y = now.getFullYear(), m = now.getMonth()
  switch (p) {
    case 'today': return { from: iso(now), to: iso(now) }
    case 'week': { const s = new Date(now); s.setDate(now.getDate() - ((now.getDay() + 6) % 7)); const e = new Date(s); e.setDate(s.getDate() + 6); return { from: iso(s), to: iso(e) } }
    case 'month': return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) }
    case 'last_month': return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) }
    case 'quarter': { const q = Math.floor(m / 3) * 3; return { from: iso(new Date(y, q, 1)), to: iso(new Date(y, q + 3, 0)) } }
    case 'year': return { from: `${y}-01-01`, to: `${y}-12-31` }
    default: return { from: '', to: '' }
  }
}

function detectPreset(from: string, to: string): DatePreset {
  if (!from && !to) return 'all'
  for (const p of ['today', 'week', 'month', 'last_month', 'quarter', 'year'] as DatePreset[]) {
    const r = presetRange(p)
    if (r.from === from && r.to === to) return p
  }
  return 'custom'
}

/** Date range filter. `from` / `to` are 'YYYY-MM-DD' or '' (open-ended). */
export function DateRangeFilter({ from, to, onChange, label = 'Date' }: {
  from: string; to: string; onChange: (from: string, to: string) => void; label?: string
}) {
  const detected = detectPreset(from, to)
  const [forceCustom, setForceCustom] = useState(false)
  const preset: DatePreset = forceCustom ? 'custom' : detected
  const active = !!(from || to)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={preset} onValueChange={v => {
        const p = (v ?? 'all') as DatePreset
        if (p === 'custom') { setForceCustom(true); return }
        setForceCustom(false)
        const r = presetRange(p); onChange(r.from, r.to)
      }}>
        <SelectTrigger className={cn(FILTER_TRIGGER, 'gap-2', active && 'border-[#E8112D]/40 bg-red-50/60 dark:bg-red-950/20')}>
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{preset === 'all' ? label + ': All' : PRESET_LABEL[preset].replace('…', '')}</span>
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(PRESET_LABEL) as DatePreset[]).map(p => <SelectItem key={p} value={p}>{PRESET_LABEL[p]}</SelectItem>)}
        </SelectContent>
      </Select>
      {preset === 'custom' && (
        <div className="flex items-center gap-1.5">
          <Input type="date" aria-label="From" className="h-9 w-38 text-sm" value={from} max={to || undefined} onChange={e => onChange(e.target.value, to)} />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" aria-label="To" className="h-9 w-38 text-sm" value={to} min={from || undefined} onChange={e => onChange(from, e.target.value)} />
        </div>
      )}
      {active && (
        <button type="button" onClick={() => { setForceCustom(false); onChange('', '') }} title="Clear dates"
          className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="h-3.5 w-3.5" />Clear
        </button>
      )}
    </div>
  )
}

// ── View switch (By SI / All Items …) ─────────────────────────────────────

export function Segmented<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void
  options: { value: T; label: string; icon?: React.ComponentType<{ className?: string }> }[]
}) {
  return (
    <div className="inline-flex h-9 items-center rounded-lg bg-muted p-0.5">
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cn('inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors',
            value === o.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
          {o.icon && <o.icon className="h-3.5 w-3.5" />}{o.label}
        </button>
      ))}
    </div>
  )
}
