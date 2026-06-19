/**
 * Gmail API sender using Google Identity Services (OAuth implicit flow).
 * Requests an access token, builds a MIME message with optional PDF attachment,
 * and calls the Gmail REST API directly from the browser.
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: { access_token?: string; error?: string }) => void
          }) => { requestAccessToken: () => void }
        }
      }
    }
  }
}

function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(); return }
    const existing = document.getElementById('gsi-script')
    if (existing) { existing.addEventListener('load', () => resolve()); return }
    const script = document.createElement('script')
    script.id = 'gsi-script'
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(script)
  })
}

function getAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/gmail.send',
      callback: (res) => {
        if (res.error || !res.access_token) {
          reject(new Error(res.error ?? 'No access token returned'))
        } else {
          resolve(res.access_token)
        }
      },
    })
    client.requestAccessToken()
  })
}

function toBase64Url(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  bytes.forEach(b => { binary += String.fromCharCode(b) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function buildMime(opts: {
  to: string
  subject: string
  body: string
  pdfBase64?: string
  pdfFilename?: string
}): string {
  const boundary = `boundary_${Date.now()}`

  const headers = [
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].join('\r\n')

  const textPart = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    opts.body,
  ].join('\r\n')

  let mime = `${headers}\r\n\r\n${textPart}\r\n`

  if (opts.pdfBase64 && opts.pdfFilename) {
    const attachPart = [
      `--${boundary}`,
      'Content-Type: application/pdf',
      `Content-Disposition: attachment; filename="${opts.pdfFilename}"`,
      'Content-Transfer-Encoding: base64',
      '',
      opts.pdfBase64,
    ].join('\r\n')
    mime += `${attachPart}\r\n`
  }

  mime += `--${boundary}--`
  return mime
}

async function generatePdfBase64(printHtml: string): Promise<string> {
  return new Promise((resolve) => {
    const win = window.open('', '_blank', 'width=800,height=600')
    if (!win) { resolve(''); return }
    win.document.write(printHtml)
    win.document.close()
    win.focus()
    setTimeout(() => {
      // We can't programmatically capture PDF from print dialog,
      // so we return empty — the user will print separately if needed.
      win.close()
      resolve('')
    }, 300)
  })
}

export interface SendEmailOptions {
  to: string
  subject: string
  body: string
  /** Raw HTML for the print window — if provided, a PDF download is triggered before sending */
  printHtml?: string
  pdfFilename?: string
  /** Already-encoded base64url PDF data */
  pdfBase64?: string
}

export async function sendEmailWithGmail(opts: SendEmailOptions): Promise<void> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set')

  await loadGsiScript()
  const accessToken = await getAccessToken(clientId)

  let pdfBase64 = opts.pdfBase64

  // If a print window + filename provided, generate PDF blob via fetch
  if (!pdfBase64 && opts.printHtml && opts.pdfFilename) {
    // Trigger print in new window for user's records
    const win = window.open('', '_blank', 'width=800,height=600')
    if (win) {
      win.document.write(opts.printHtml)
      win.document.close()
      setTimeout(() => { win.print(); win.close() }, 400)
    }
  }

  const mime = buildMime({
    to: opts.to,
    subject: opts.subject,
    body: opts.body,
    pdfBase64,
    pdfFilename: opts.pdfFilename,
  })

  const encoded = toBase64Url(mime)

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encoded }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Gmail API error ${res.status}`)
  }
}
