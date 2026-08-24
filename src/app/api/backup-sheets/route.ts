import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'
import * as XLSX from 'xlsx'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

export const maxDuration = 60

const BACKUP_FILE_NAME = 'CDSC Database Backup'

// One tab per core business table, in the order they appear in the workbook.
const TABLES = [
  'items',
  'suppliers',
  'purchase_orders',
  'po_items',
  'clients',
  'sales_orders',
  'so_items',
  'warehouse_stock',
  'warehouse_stock_ledger',
] as const

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Same OAuth2 Drive connection already used for image uploads (see
// /api/upload-image) — service accounts can't own files on a personal Drive,
// so this authenticates as the connected Google account instead.
function getDriveClient() {
  const clientId = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN
  const folderId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID || process.env.GOOGLE_DRIVE_FOLDER_ID
  if (!clientId || !clientSecret || !refreshToken || !folderId) return null

  const auth = new google.auth.OAuth2(clientId, clientSecret)
  auth.setCredentials({ refresh_token: refreshToken })
  return { drive: google.drive({ version: 'v3', auth }), folderId }
}

export async function POST() {
  try {
    const supabase = getSupabaseAdmin()
    if (!supabase) {
      return NextResponse.json({ error: 'Server not configured for database access.' }, { status: 500 })
    }
    const client = getDriveClient()
    if (!client) {
      return NextResponse.json({
        error: 'Google Drive is not configured on the server. Set GOOGLE_DRIVE_OAUTH_CLIENT_ID, GOOGLE_DRIVE_OAUTH_CLIENT_SECRET, GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN, and GOOGLE_DRIVE_FOLDER_ID.',
      }, { status: 500 })
    }
    const { drive, folderId } = client

    const wb = XLSX.utils.book_new()
    const tableCounts: { name: string; rows: number }[] = []

    for (const table of TABLES) {
      const rows = await fetchAllRows<Record<string, unknown>>((from, to) =>
        supabase.from(table).select('*').order('id', { ascending: true }).range(from, to)
      )
      // Stringify nested JSON columns so they render as text instead of "[object Object]".
      const flat = rows.map(row => {
        const out: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(row)) {
          out[key] = value && typeof value === 'object' ? JSON.stringify(value) : value
        }
        return out
      })
      const ws = flat.length > 0 ? XLSX.utils.json_to_sheet(flat) : XLSX.utils.aoa_to_sheet([[]])
      XLSX.utils.book_append_sheet(wb, ws, table.slice(0, 31))
      tableCounts.push({ name: table, rows: rows.length })
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    const { Readable } = await import('stream')
    const xlsxMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

    // Reuse the same file (and link) across syncs instead of creating a new one every time.
    const escapedName = BACKUP_FILE_NAME.replace(/'/g, "\\'")
    const existing = await drive.files.list({
      q: `'${folderId}' in parents and name = '${escapedName}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
      fields: 'files(id)',
      pageSize: 1,
    })
    const existingId = existing.data.files?.[0]?.id

    let fileId: string | null | undefined
    let webViewLink: string | null | undefined

    if (existingId) {
      const updated = await drive.files.update({
        fileId: existingId,
        media: { mimeType: xlsxMime, body: Readable.from(buffer) },
        fields: 'id, webViewLink',
      })
      fileId = updated.data.id
      webViewLink = updated.data.webViewLink
    } else {
      const created = await drive.files.create({
        requestBody: {
          name: BACKUP_FILE_NAME,
          parents: [folderId],
          mimeType: 'application/vnd.google-apps.spreadsheet',
        },
        media: { mimeType: xlsxMime, body: Readable.from(buffer) },
        fields: 'id, webViewLink',
      })
      fileId = created.data.id
      webViewLink = created.data.webViewLink
      if (fileId) {
        await drive.permissions.create({
          fileId,
          requestBody: { role: 'reader', type: 'anyone' },
        })
      }
    }

    if (!fileId) throw new Error('Drive did not return a file id')

    return NextResponse.json({
      success: true,
      url: webViewLink ?? `https://docs.google.com/spreadsheets/d/${fileId}/edit`,
      tables: tableCounts,
      syncedAt: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to sync backup'
    console.error('[backup-sheets]', message)
    const friendly = /invalid_grant/i.test(message)
      ? 'Google Drive connection has expired or was revoked. An admin needs to generate a new Google Drive refresh token (GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN) to re-enable syncing.'
      : message
    return NextResponse.json({ error: friendly }, { status: 500 })
  }
}
