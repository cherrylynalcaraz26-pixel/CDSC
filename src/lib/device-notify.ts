// Device (OS) notifications for staff — new messages, quotation requests,
// orders and leads pop up as Windows / macOS / Android notifications while the
// system is open (even in a background tab). When the tab is in front, an
// in-app toast is shown instead. Turned on per device from the bell menu.

import { toast } from 'sonner'

const SEEN_KEY = 'cdsc-notified-ids'
const PREF_KEY = 'cdsc-device-notify'

export interface DeviceAlert { id: string; title: string; body: string; href: string }

export const deviceNotifySupported = () => typeof window !== 'undefined' && 'Notification' in window

export function deviceNotifyEnabled() {
  return deviceNotifySupported() && Notification.permission === 'granted' && localStorage.getItem(PREF_KEY) !== 'off'
}

export async function enableDeviceNotify(): Promise<NotificationPermission | 'unsupported'> {
  if (!deviceNotifySupported()) return 'unsupported'
  const p = await Notification.requestPermission()
  if (p === 'granted') {
    localStorage.setItem(PREF_KEY, 'on')
    new Notification('Notifications are on', {
      body: 'You will be alerted on this device for new messages, orders and requests.',
      icon: '/icon-192.png',
    })
  }
  return p
}

export function disableDeviceNotify() {
  localStorage.setItem(PREF_KEY, 'off')
}

/**
 * Alert for items not seen before on this device. The first run only records
 * what already exists, so opening the app never floods old notifications.
 */
export function notifyNew(items: DeviceAlert[], open: (href: string) => void) {
  if (typeof window === 'undefined') return
  const raw = localStorage.getItem(SEEN_KEY)
  const seen = new Set<string>(raw ? (JSON.parse(raw) as string[]) : [])
  const fresh = raw ? items.filter(i => !seen.has(i.id)) : []
  for (const i of items) seen.add(i.id)
  localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen).slice(-500)))
  if (!fresh.length) return

  const inFront = document.visibilityState === 'visible' && document.hasFocus()
  for (const a of fresh.slice(0, 5)) {
    if (inFront || !deviceNotifyEnabled()) {
      toast(a.title, { description: a.body, action: { label: 'Open', onClick: () => open(a.href) } })
      continue
    }
    const n = new Notification(a.title, { body: a.body, icon: '/icon-192.png', tag: a.id })
    n.onclick = () => { window.focus(); open(a.href); n.close() }
  }
  if (fresh.length > 5 && !inFront && deviceNotifyEnabled()) {
    new Notification(`${fresh.length - 5} more updates`, { body: 'Open CDSC to see everything new.', icon: '/icon-192.png' })
  }
}
