export interface BackupSyncResult {
  success: boolean
  url: string
  tables: { name: string; rows: number }[]
  syncedAt: string
}

/** Triggers a full database sync to the CDSC Database Backup Google Sheet via
 *  /api/backup-sheets — pulls the core business tables and overwrites the
 *  same Sheet in place so the link stays stable across syncs. */
export async function syncDatabaseBackup(): Promise<BackupSyncResult> {
  const res = await fetch('/api/backup-sheets', { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to sync backup')
  return data as BackupSyncResult
}
