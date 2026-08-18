'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationBarProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

// Builds the compact "1 … 98 99 100 … 1180" page list: always the first and last
// page, the current page and its immediate neighbors, collapsing any gap into '…'.
function getPageList(current: number, total: number): (number | '…')[] {
  const pages = new Set([1, total, current - 1, current, current + 1])
  const sorted = [...pages].filter(p => p >= 1 && p <= total).sort((a, b) => a - b)
  const result: (number | '…')[] = []
  let prev = 0
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push('…')
    result.push(p)
    prev = p
  }
  return result
}

export function PaginationBar({ page, totalPages, onPageChange, className }: PaginationBarProps) {
  const [goTo, setGoTo] = useState('')

  function submitGoTo() {
    const n = parseInt(goTo, 10)
    if (!isNaN(n)) onPageChange(Math.min(totalPages, Math.max(1, n)))
    setGoTo('')
  }

  if (totalPages <= 1) return null

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <div className="flex items-center gap-1 rounded-full border bg-muted/30 p-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="h-8 w-8 shrink-0 rounded-full bg-background border flex items-center justify-center disabled:opacity-40 hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {getPageList(page, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-1.5 text-sm text-muted-foreground select-none">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                'h-8 min-w-8 px-2 rounded-full text-sm font-medium transition-colors',
                p === page ? 'bg-red-600 text-white' : 'text-foreground hover:bg-muted',
              )}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="h-8 w-8 shrink-0 rounded-full bg-background border flex items-center justify-center disabled:opacity-40 hover:bg-muted transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        Go to
        <input
          type="number"
          min={1}
          max={totalPages}
          value={goTo}
          onChange={e => setGoTo(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submitGoTo() }}
          className="h-8 w-14 rounded-md border bg-background px-2 text-center text-sm text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        Page
      </div>
    </div>
  )
}
