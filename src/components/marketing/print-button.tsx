'use client'

import { Download } from 'lucide-react'

export function PrintButton({ label = 'Download Company Profile' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-2 rounded-md bg-cdsc-accent px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-cdsc-accent-dark"
    >
      <Download className="h-4 w-4" /> {label}
    </button>
  )
}
