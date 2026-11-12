'use client'

import { useEffect } from 'react'

/**
 * Discourages saving the website's photos and videos: blocks the right-click
 * menu and dragging on images/videos (text stays selectable and copyable).
 * Anything a browser displays can still be captured, so this is a deterrent.
 */
export function NoDownload() {
  useEffect(() => {
    const isMedia = (t: EventTarget | null) =>
      t instanceof HTMLElement && !!t.closest('img, video, picture, [data-protect]')
    const block = (e: Event) => { if (isMedia(e.target)) e.preventDefault() }
    document.addEventListener('contextmenu', block)
    document.addEventListener('dragstart', block)
    return () => {
      document.removeEventListener('contextmenu', block)
      document.removeEventListener('dragstart', block)
    }
  }, [])
  return null
}
