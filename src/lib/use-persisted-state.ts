'use client'

import { useEffect, useState } from 'react'

// Keeps a piece of UI state (filters, view toggles, etc.) alive across a tab
// switch or a back/forward navigation within the same browser tab — Next.js
// remounts the page component fresh each time, which would otherwise reset
// it back to `initial`. Deliberately sessionStorage (not localStorage): the
// last-used filters should follow this browser tab, not leak into a new one.
export function usePersistedState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initial
    try {
      const raw = window.sessionStorage.getItem(key)
      return raw != null ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(state))
    } catch {
      // ignore storage errors (e.g. private browsing quota)
    }
  }, [key, state])

  return [state, setState] as const
}
