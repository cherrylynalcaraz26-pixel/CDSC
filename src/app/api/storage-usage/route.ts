import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'

interface SupabaseUsage {
  dbSizeBytes: number
  storageBytes: number
  storageObjectCount: number
}

interface DriveUsage {
  limitBytes: number | null
  usageBytes: number
  usageInDriveBytes: number
  usageInDriveTrashBytes: number
}

async function getSupabaseUsage(): Promise<SupabaseUsage | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data, error } = await admin.rpc('get_supabase_storage_stats')
  if (error || !data) return null

  return {
    dbSizeBytes: Number(data.db_size_bytes ?? 0),
    storageBytes: Number(data.storage_bytes ?? 0),
    storageObjectCount: Number(data.storage_object_count ?? 0),
  }
}

// Same OAuth client the item/logo picture uploader uses — Drive storage quota
// is account-wide, so no folder ID is needed here.
async function getDriveUsage(): Promise<DriveUsage | null> {
  const clientId = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) return null

  const auth = new google.auth.OAuth2(clientId, clientSecret)
  auth.setCredentials({ refresh_token: refreshToken })
  const drive = google.drive({ version: 'v3', auth })

  const { data } = await drive.about.get({ fields: 'storageQuota' })
  const quota = data.storageQuota
  if (!quota) return null

  return {
    limitBytes: quota.limit != null ? Number(quota.limit) : null,
    usageBytes: Number(quota.usage ?? 0),
    usageInDriveBytes: Number(quota.usageInDrive ?? 0),
    usageInDriveTrashBytes: Number(quota.usageInDriveTrash ?? 0),
  }
}

export async function GET() {
  const [supabase, drive] = await Promise.all([
    getSupabaseUsage().catch(() => null),
    getDriveUsage().catch(() => null),
  ])
  return NextResponse.json({ supabase, drive })
}
