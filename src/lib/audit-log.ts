import type { SupabaseClient } from '@supabase/supabase-js'

// Records who did what to a books-of-accounts row, for the audit trail BIR
// expects a CAS to keep. Never throws — a logging failure shouldn't block the
// actual bookkeeping action, so errors are swallowed after a console warning.
export async function logAudit(
  supabase: SupabaseClient,
  entry: {
    action: 'create' | 'update' | 'void'
    table: string
    recordId: string
    oldValues?: Record<string, unknown> | null
    newValues?: Record<string, unknown> | null
  }
) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('audit_logs').insert({
      user_id: user?.id ?? null,
      action: entry.action,
      table_name: entry.table,
      record_id: entry.recordId,
      old_values: entry.oldValues ?? null,
      new_values: entry.newValues ?? null,
    })
    if (error) console.warn('audit log write failed', error)
  } catch (err) {
    console.warn('audit log write failed', err)
  }
}
