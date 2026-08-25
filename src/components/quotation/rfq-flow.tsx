'use client'

import { Check, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const ADMIN_LABELS = ['Request', 'Processing', 'Sending Quotation', 'Done']
const CLIENT_LABELS = ['Request', 'Reviewing', 'Sending Quotation', 'Done']

const STEP_INDEX: Record<string, number> = { pending: 0, processing: 1, quoted: 2, done: 3 }

// Visualizes an RFQ's lifecycle as a pipeline instead of a static status
// badge. "declined" is a terminal branch of its own (it can happen either
// before a Quotation ever exists, or after the client declines one) so it
// renders as a standalone marker rather than a step on the 0–3 track.
export function RfqFlowStepper({
  status, variant = 'admin', compact = false,
}: {
  status: string
  variant?: 'admin' | 'client'
  compact?: boolean
}) {
  const labels = variant === 'admin' ? ADMIN_LABELS : CLIENT_LABELS

  if (status === 'declined') {
    return (
      <span className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-medium',
        compact ? 'text-[11px]' : 'text-sm',
      )}>
        <XCircle className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />Declined
      </span>
    )
  }

  const current = STEP_INDEX[status] ?? 0

  return (
    <div className="flex items-center">
      {labels.map((label, i) => {
        const isLastStep = i === labels.length - 1
        // The final step has no step after it to prove it's finished, so reaching
        // it (current === i) already means the flow is complete — treat it as
        // done rather than "in progress" like every other step.
        const isDone = i < current || (isLastStep && i === current)
        const isCurrent = i === current && !isLastStep
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={cn(
                'flex items-center justify-center rounded-full font-bold shrink-0 transition-colors',
                compact ? 'h-5 w-5 text-[10px]' : 'h-7 w-7 text-xs',
                isDone
                  ? 'bg-green-600 text-white'
                  : isCurrent
                    ? 'bg-red-600 text-white ring-4 ring-red-100'
                    : 'bg-gray-100 text-gray-400 border border-gray-200',
              )}>
                {isDone ? <Check className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} /> : i + 1}
              </div>
              {!compact && (
                <span className={cn(
                  'mt-1 text-[10px] font-medium text-center max-w-[74px] leading-tight',
                  isCurrent ? 'text-red-600' : isDone ? 'text-green-700' : 'text-gray-400',
                )}>
                  {label}
                </span>
              )}
            </div>
            {i < labels.length - 1 && (
              <div className={cn(
                'h-0.5 shrink-0 transition-colors',
                compact ? 'w-4 mx-1' : 'w-8 sm:w-10 mx-1.5',
                isDone ? 'bg-green-600' : 'bg-gray-200',
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}
