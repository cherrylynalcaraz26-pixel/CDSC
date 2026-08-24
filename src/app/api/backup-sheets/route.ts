import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'
import ExcelJS from 'exceljs'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

export const maxDuration = 60

const BACKUP_FILE_NAME = 'CDSC Database Backup'

// Table name -> tab title (Title Case, acronyms kept upper-case). Order here
// is the order tabs appear in the workbook.
const TABLES: { table: string; tab: string }[] = [
  { table: 'items', tab: 'Items' },
  { table: 'suppliers', tab: 'Suppliers' },
  { table: 'purchase_orders', tab: 'Purchase Orders' },
  { table: 'po_items', tab: 'PO Items' },
  { table: 'clients', tab: 'Clients' },
  { table: 'sales_orders', tab: 'Sales Orders' },
  { table: 'so_items', tab: 'SO Items' },
  { table: 'warehouse_stock', tab: 'Warehouse Stock' },
  { table: 'warehouse_stock_ledger', tab: 'Warehouse Stock Ledger' },
]

const HEADER_FILL = 'FFB91C1C' // CDSC brand red, ARGB
const HEADER_FONT = 'FFFFFFFF'

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

    const wb = new ExcelJS.Workbook()
    const tableCounts: { name: string; rows: number }[] = []

    for (const { table, tab } of TABLES) {
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

      const ws = wb.addWorksheet(tab, { views: [{ state: 'frozen', ySplit: 1 }] })
      const columns = flat.length > 0 ? Object.keys(flat[0]) : []
      ws.columns = columns.map(col => {
        const maxLen = flat.slice(0, 200).reduce((m, row) => {
          const v = row[col]
          return v == null ? m : Math.max(m, String(v).length)
        }, col.length)
        return { header: col, key: col, width: Math.min(Math.max(maxLen + 2, 10), 50) }
      })
      ws.addRows(flat)

      const headerRow = ws.getRow(1)
      headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: HEADER_FONT } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      })
      if (columns.length > 0) {
        ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
      }

      tableCounts.push({ name: table, rows: rows.length })
    }

    const buffer = Buffer.from(await wb.xlsx.writeBuffer())
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
