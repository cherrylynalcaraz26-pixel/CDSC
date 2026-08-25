/** Uploads an image file to the app's Google Drive folder via /api/upload-image and
 *  returns a URL suitable for use as an <img src>. Used for item pictures, client logos,
 *  and any other user-uploaded image — none of these are stored in Supabase storage.
 *
 *  `displayName` overrides the stored file's name (extension is preserved automatically);
 *  `folder` files it into a named subfolder of the main Drive folder, creating it if needed. */
export async function uploadImageToDrive(file: File, options?: { displayName?: string; folder?: string }): Promise<string> {
  const fileBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : ''
  const fileName = options?.displayName ? `${options.displayName}${ext}` : file.name

  const res = await fetch('/api/upload-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileBase64, fileName, mimeType: file.type, folder: options?.folder }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to upload image')
  return data.url as string
}

/** Appends a cache-busting timestamp to an image URL, safely handling URLs that already
 *  have a query string (Drive thumbnail links do: ?id=...&sz=...) vs legacy plain URLs. */
export function cacheBustImageUrl(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`
}

/** Uploads any file (not just images — PDFs, docs, spreadsheets…) to the app's Google
 *  Drive folder via /api/upload-image and returns a viewable/downloadable link, for use
 *  as a message/reply attachment. Unlike uploadImageToDrive's thumbnail URL (built for
 *  inline <img> previews), this returns Drive's generic file-viewer link so any file type
 *  opens correctly in a new tab. */
export async function uploadFileToDrive(file: File, options?: { folder?: string }): Promise<{ url: string; name: string }> {
  const fileBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const res = await fetch('/api/upload-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileBase64, fileName: file.name, mimeType: file.type || 'application/octet-stream', folder: options?.folder }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to upload file')
  return { url: `https://drive.google.com/file/d/${data.fileId}/view`, name: file.name }
}
