// Delete a record (and its child rows) with confirmation and an Undo button.
//
//   await deleteWithUndo(supabase, {
//     table: 'pull_outs', id: r.id, label: 'Pull out PU-2026-00001',
//     children: [{ table: 'pull_out_items', fk: 'pull_out_id' }],
//     onChange: load,
//   })
//
// Flow: ask → copy the row + children → delete → toast "… deleted  [Undo]".
// Undo re-inserts the exact rows (same ids and numbers), parent first.

import { toast } from 'sonner'
import type { SupabaseClient } from '@supabase/supabase-js'
import { confirmDelete } from '@/components/ui/confirm'
import { getErrorMessage } from '@/lib/error-message'

export interface DeleteWithUndoOptions {
  table: string
  id: string | number
  /** Column the id matches (default "id"). */
  key?: string
  /** Shown in the question and the toast, e.g. 'item "Safety Helmet"'. */
  label: string
  /** Child tables removed along with the record (FK cascade or explicit). */
  children?: { table: string; fk: string; /** delete explicitly (no FK cascade) */ explicit?: boolean }[]
  /** Skip the question when the page already asked. */
  skipConfirm?: boolean
  /** Extra line under the question. */
  warning?: string
  onChange?: () => void | Promise<void>
}

export async function deleteWithUndo(supabase: SupabaseClient, o: DeleteWithUndoOptions): Promise<boolean> {
  const key = o.key ?? 'id'
  if (!o.skipConfirm && !(await confirmDelete(o.label, o.warning))) return false

  const { data: row } = await supabase.from(o.table).select('*').eq(key, o.id).maybeSingle()
  const kids: { table: string; rows: Record<string, unknown>[] }[] = []
  for (const c of o.children ?? []) {
    const { data } = await supabase.from(c.table).select('*').eq(c.fk, o.id)
    kids.push({ table: c.table, rows: (data ?? []) as Record<string, unknown>[] })
    if (c.explicit) {
      const { error } = await supabase.from(c.table).delete().eq(c.fk, o.id)
      if (error) { toast.error(getErrorMessage(error)); return false }
    }
  }

  const { error } = await supabase.from(o.table).delete().eq(key, o.id)
  if (error) {
    // Put back explicitly-removed children if the parent could not be deleted.
    for (const k of kids) if ((o.children ?? []).find(c => c.table === k.table)?.explicit && k.rows.length) {
      await supabase.from(k.table).insert(k.rows)
    }
    toast.error(getErrorMessage(error, `Could not delete ${o.label}`))
    return false
  }
  await o.onChange?.()

  const name = o.label.charAt(0).toUpperCase() + o.label.slice(1)
  toast.success(`${name} deleted`, {
    duration: 8000,
    action: row ? {
      label: 'Undo',
      onClick: async () => {
        const { error: e1 } = await supabase.from(o.table).insert(row)
        if (e1) { toast.error(getErrorMessage(e1, 'Could not undo')); return }
        for (const k of kids) {
          if (!k.rows.length) continue
          const { error: e2 } = await supabase.from(k.table).insert(k.rows)
          if (e2) { toast.error(getErrorMessage(e2, `Restored ${o.label}, but not all of its lines`)); break }
        }
        toast.success(`${name} restored`)
        await o.onChange?.()
      },
    } : undefined,
  })
  return true
}
