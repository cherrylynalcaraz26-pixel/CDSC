'use client'

// App-wide confirmation dialog.
//
//   if (!(await confirmAction({ title: 'Delete item?', description: '…' }))) return
//
// <ConfirmHost /> is mounted once in the root layout; confirmAction() can be
// called from any event handler and resolves true (confirmed) or false.

import { useSyncExternalStore } from 'react'
import { AlertTriangle, Trash2, HelpCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ConfirmOptions {
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** "danger" (default) for deletes / voids, "default" for other questions. */
  tone?: 'danger' | 'default'
}

type Req = ConfirmOptions & { resolve: (ok: boolean) => void }

let current: Req | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }

export function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  current?.resolve(false)
  return new Promise(resolve => {
    current = { ...opts, resolve }
    emit()
  })
}

/** Shorthand for the common "Delete X?" question. */
export function confirmDelete(what: string, extra?: React.ReactNode) {
  return confirmAction({
    title: `Delete ${what}?`,
    description: extra ?? 'You can undo this right after deleting.',
    confirmLabel: 'Delete',
  })
}

/**
 * Ask before removing a filled-in line from a form (item rows in PO, SO,
 * Quotation, Pull Out…). Blank rows are removed without asking.
 */
export function confirmRemoveLine(row: unknown): Promise<boolean> {
  const r = (row ?? {}) as Record<string, unknown>
  const name = ['item_name', 'name', 'description', 'item', 'product_name']
    .map(k => r[k]).find(v => typeof v === 'string' && v.trim()) as string | undefined
  if (!name) return Promise.resolve(true)
  return confirmAction({
    title: 'Remove this item?',
    description: <>&ldquo;{name}&rdquo; will be removed from this list.</>,
    confirmLabel: 'Remove',
  })
}

function close(ok: boolean) {
  const req = current
  current = null
  emit()
  req?.resolve(ok)
}

export function ConfirmHost() {
  const req = useSyncExternalStore(subscribe, () => current, () => null)
  const danger = (req?.tone ?? 'danger') === 'danger'
  const Icon = danger ? (/delete|remove/i.test(req?.confirmLabel ?? 'delete') ? Trash2 : AlertTriangle) : HelpCircle

  return (
    <Dialog open={!!req} onOpenChange={o => { if (!o) close(false) }}>
      <DialogContent className="max-w-md" showCloseButton={false}>
        {req && (
          <div className="flex flex-col items-center px-2 pt-2 text-center">
            <span
              className={cn(
                'relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg',
                danger ? 'bg-linear-to-br from-rose-500 to-red-600 shadow-red-500/30' : 'bg-linear-to-br from-blue-500 to-indigo-600 shadow-blue-500/30',
              )}
            >
              <span className={cn('absolute inset-0 rounded-2xl motion-safe:animate-ping opacity-20', danger ? 'bg-red-500' : 'bg-blue-500')} />
              <Icon className="relative h-6 w-6" />
            </span>
            <DialogTitle className="text-lg font-semibold">{req.title}</DialogTitle>
            {req.description && (
              <DialogDescription className="mt-1.5 text-sm text-muted-foreground">{req.description}</DialogDescription>
            )}
            <div className="mt-6 grid w-full grid-cols-2 gap-2">
              <Button variant="outline" className="h-10" onClick={() => close(false)}>{req.cancelLabel ?? 'Cancel'}</Button>
              <Button
                autoFocus
                className={cn('h-10 text-white', danger ? 'bg-linear-to-r from-rose-500 to-red-600 hover:opacity-90' : 'bg-linear-to-r from-blue-500 to-indigo-600 hover:opacity-90')}
                onClick={() => close(true)}
              >
                {req.confirmLabel ?? (danger ? 'Delete' : 'Confirm')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
