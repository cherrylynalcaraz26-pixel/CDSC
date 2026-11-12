'use client'

import { Download } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PrintButton({
  label = 'Download Company Profile',
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={cn(
        'print:hidden inline-flex items-center gap-2 rounded-md bg-cdsc-accent px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-cdsc-accent-dark',
        className,
      )}
    >
      <Download className="h-4 w-4" /> {label}
    </button>
  )
}
