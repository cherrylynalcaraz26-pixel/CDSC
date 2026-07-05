/** Uploads an image file to the app's Google Drive folder via /api/upload-image and
 *  returns a URL suitable for use as an <img src>. Used for item pictures, client logos,
 *  and any other user-uploaded image — none of these are stored in Supabase storage. */
export async function uploadImageToDrive(file: File): Promise<string> {
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
    body: JSON.stringify({ fileBase64, fileName: file.name, mimeType: file.type }),
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
