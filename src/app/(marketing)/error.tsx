'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { getErrorMessage } from '@/lib/error-message'

export default function MarketingErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-cdsc-tint">
        <AlertTriangle className="size-6 text-cdsc-accent" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-cdsc-ink">This page didn&apos;t load</h1>
        <p className="text-sm text-cdsc-ink/70">
          {getErrorMessage(error, 'Please try again, or contact us if the problem continues.')}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="rounded-lg border border-cdsc-line px-4 py-2 text-sm font-medium text-cdsc-ink hover:bg-cdsc-tint"
        >
          Try again
        </button>
        <Link href="/" className="rounded-lg bg-cdsc-accent px-4 py-2 text-sm font-medium text-white hover:bg-cdsc-accent-dark">
          Back to home
        </Link>
      </div>
      {error.digest && (
        <p className="text-xs text-cdsc-ink/40">Reference: {error.digest}</p>
      )}
    </div>
  )
}
