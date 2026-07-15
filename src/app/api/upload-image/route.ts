import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

// Allow reasonably large images (logos, item photos)
export const maxDuration = 30

// Uploads authenticate as the connected Google account (OAuth) rather than a bare
// service account — service accounts have no storage quota of their own on a personal
// (non-Workspace) Drive, so file creation fails with storageQuotaExceeded even when the
// destination folder is shared with them.
function getDriveClient() {
  const clientId = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID
  if (!clientId || !clientSecret || !refreshToken || !folderId) return null

  const auth = new google.auth.OAuth2(clientId, clientSecret)
  auth.setCredentials({ refresh_token: refreshToken })
  return { drive: google.drive({ version: 'v3', auth }), folderId }
}

// Finds an existing named subfolder under `parentId`, creating it if it doesn't exist yet.
async function findOrCreateSubfolder(drive: ReturnType<typeof google.drive>, parentId: string, name: string) {
  const escaped = name.replace(/'/g, "\\'")
  const existing = await drive.files.list({
    q: `'${parentId}' in parents and name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id)',
    pageSize: 1,
  })
  const found = existing.data.files?.[0]?.id
  if (found) return found

  const created = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
  })
  if (!created.data.id) throw new Error(`Failed to create Drive subfolder "${name}"`)
  return created.data.id
}

// Every image in the app (item pictures, client logos) is uploaded here and stored in a
// shared Google Drive folder via a service account, rather than Supabase storage.
export async function POST(req: NextRequest) {
  try {
    const { fileBase64, fileName, mimeType, folder } = await req.json()
    if (!fileBase64 || !fileName || !mimeType) {
      return NextResponse.json({ error: 'Missing required fields: fileBase64, fileName, mimeType' }, { status: 400 })
    }

    const client = getDriveClient()
    if (!client) {
      return NextResponse.json({
        error: 'Google Drive is not configured on the server. Set GOOGLE_DRIVE_OAUTH_CLIENT_ID, GOOGLE_DRIVE_OAUTH_CLIENT_SECRET, GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN, and GOOGLE_DRIVE_FOLDER_ID.',
      }, { status: 500 })
    }
    const { drive, folderId: rootFolderId } = client
    const folderId = folder ? await findOrCreateSubfolder(drive, rootFolderId, folder) : rootFolderId

    const buffer = Buffer.from(fileBase64, 'base64')
    const { Readable } = await import('stream')

    const uploaded = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType,
        body: Readable.from(buffer),
      },
      fields: 'id',
    })

    const fileId = uploaded.data.id
    if (!fileId) throw new Error('Drive upload did not return a file id')

    // Make the file viewable via link so it can be embedded as an <img src>.
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    })

    const url = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`
    return NextResponse.json({ success: true, url, fileId })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to upload image'
    console.error('[upload-image]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
