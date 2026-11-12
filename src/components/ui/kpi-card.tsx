import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type KpiTone = 'red' | 'rose' | 'blue' | 'green' | 'amber' | 'violet' | 'slate' | 'teal'

const TONES: Record<KpiTone, { icon: string; glow: string; bar: string }> = {
  red:    { icon: 'from-[#E8112D] to-[#F43F5E] shadow-red-500/30',   glow: 'bg-red-500/10',    bar: 'from-[#E8112D] to-[#F43F5E]' },
  rose:   { icon: 'from-rose-500 to-pink-500 shadow-rose-500/30',    glow: 'bg-rose-500/10',   bar: 'from-rose-500 to-pink-500' },
  blue:   { icon: 'from-blue-500 to-indigo-600 shadow-blue-500/30',  glow: 'bg-blue-500/10',   bar: 'from-blue-500 to-indigo-600' },
  green:  { icon: 'from-emerald-500 to-green-600 shadow-emerald-500/30', glow: 'bg-emerald-500/10', bar: 'from-emerald-500 to-green-600' },
  amber:  { icon: 'from-amber-400 to-amber-600 shadow-amber-500/30', glow: 'bg-amber-500/10',  bar: 'from-amber-400 to-amber-600' },
  violet: { icon: 'from-violet-500 to-purple-600 shadow-violet-500/30', glow: 'bg-violet-500/10', bar: 'from-violet-500 to-purple-600' },
  slate:  { icon: 'from-slate-500 to-slate-700 shadow-slate-500/30', glow: 'bg-slate-500/10',  bar: 'from-slate-500 to-slate-700' },
  teal:   { icon: 'from-teal-500 to-cyan-600 shadow-teal-500/30',    glow: 'bg-teal-500/10',   bar: 'from-teal-500 to-cyan-600' },
}

/** Premium KPI tile used across the system. */
export function KpiCard({
  label, value, sub, icon: Icon, tone = 'red', onClick, active = false, className,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon?: LucideIcon
  tone?: KpiTone
  onClick?: () => void
  active?: boolean
  className?: string
}) {
  const t = TONES[tone]
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'group relative w-full overflow-hidden rounded-2xl bg-card p-4 text-left shadow-[0_6px_24px_-12px_rgba(15,23,42,0.25)] ring-1 ring-black/[0.04] transition duration-300 sm:p-5',
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-16px_rgba(15,23,42,0.35)]',
        active && 'ring-2 ring-[#E8112D]/60',
        className,
      )}
    >
      <span aria-hidden className={cn('pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl transition duration-500 group-hover:scale-125', t.glow)} />
      <span aria-hidden className={cn('absolute inset-x-0 bottom-0 h-[3px] origin-left scale-x-0 bg-linear-to-r transition duration-500 group-hover:scale-x-100', t.bar, active && 'scale-x-100')} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <div className="mt-1.5 truncate text-2xl font-black tracking-tight tabular-nums sm:text-[1.7rem]">{value}</div>
          {sub && <div className="mt-1 truncate text-xs text-muted-foreground">{sub}</div>}
        </div>
        {Icon && (
          <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-lg transition duration-300 group-hover:rotate-6 group-hover:scale-105', t.icon)}>
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
    </Tag>
  )
}
