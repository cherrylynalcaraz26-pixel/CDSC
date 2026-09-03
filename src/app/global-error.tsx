'use client'

import { useEffect } from 'react'
import { getErrorMessage } from '@/lib/error-message'

// Catches errors thrown by the root layout itself (outside the reach of
// src/app/error.tsx), so a crash there still shows a page a user can read
// and recover from instead of a blank screen or the raw Next.js overlay.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '1.5rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif', background: '#fafafa', color: '#1a1a1a' }}>
        <div style={{ display: 'flex', height: '3rem', width: '3rem', alignItems: 'center', justifyContent: 'center', borderRadius: '9999px', background: 'rgba(220, 38, 38, 0.1)', fontSize: '1.5rem' }}>
          ⚠️
        </div>
        <div>
          <h1 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ maxWidth: '24rem', fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
            {getErrorMessage(error, 'The application failed to load. Please try again.')}
          </p>
        </div>
        <button
          onClick={() => reset()}
          style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '0.875rem' }}
        >
          Try again
        </button>
        {error.digest && (
          <p style={{ fontSize: '0.75rem', color: '#999' }}>Reference: {error.digest}</p>
        )}
      </body>
    </html>
  )
}
