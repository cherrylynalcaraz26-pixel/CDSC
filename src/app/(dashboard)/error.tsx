'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/error-message'

export default function DashboardErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">This page ran into a problem</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {getErrorMessage(error, "We couldn't load this page. Your data is safe — please try again.")}
        </p>
      </div>
      <Button variant="outline" onClick={() => reset()}>Try again</Button>
      {error.digest && (
        <p className="text-xs text-muted-foreground/60">Reference: {error.digest}</p>
      )}
    </div>
  )
}
