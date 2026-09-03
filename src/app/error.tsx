'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/error-message'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {getErrorMessage(error, "We couldn't load this page. Please try again, or head back to the dashboard.")}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => reset()}>Try again</Button>
        <Button onClick={() => { window.location.href = '/dashboard' }}>Go to dashboard</Button>
      </div>
      {error.digest && (
        <p className="text-xs text-muted-foreground/60">Reference: {error.digest}</p>
      )}
    </div>
  )
}
