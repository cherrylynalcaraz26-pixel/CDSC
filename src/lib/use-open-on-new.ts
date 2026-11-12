'use client'

// Lets the header's "New" menu open a page's create form directly:
//   • navigating to  /page?new=1  opens it once the page mounts, then the
//     param is removed from the URL;
//   • if you're already on the page, the header fires a `cdsc:new` event.
// Reads window.location instead of useSearchParams so pages need no Suspense.

import { useEffect, useRef } from 'react'

export const NEW_EVENT = 'cdsc:new'

export function useOpenOnNew(open: () => void) {
  const ref = useRef(open)
  useEffect(() => { ref.current = open })

  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('new') === '1') {
      url.searchParams.delete('new')
      window.history.replaceState(window.history.state, '', url.pathname + (url.search || '') + url.hash)
      ref.current()
    }
    const onEvent = () => ref.current()
    window.addEventListener(NEW_EVENT, onEvent)
    return () => window.removeEventListener(NEW_EVENT, onEvent)
  }, [])
}
