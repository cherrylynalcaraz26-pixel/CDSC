/**
 * Gmail API sender using Google Identity Services (OAuth implicit flow).
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

let gsiLoading: Promise<void> | null = null

function loadGsiScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (gsiLoading) return gsiLoading

  gsiLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => {
      console.log('[gmail-send] GSI script loaded')
      resolve()
    }
    script.onerror = () => {
      gsiLoading = null
      reject(new Error('Failed to load Google Identity Services script'))
    }
    document.head.appendChild(script)
  })

  return gsiLoading
}

function getAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log('[gmail-send] requesting token for client:', clientId.slice(0, 20) + '…')
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/gmail.send',
      callback: (res) => {
        if (res.error || !res.access_token) {
          console.error('[gmail-send] token error:', res.error)
          reject(new Error(res.error ?? 'No access token returned'))
        } else {
          console.log('[gmail-send] token received')
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

function buildMime(opts: {
  to: string
  subject: string
  body: string
  pdfBase64?: string
  pdfFilename?: string
}): string {
  const boundary = `cdsc_boundary_${Date.now()}`

  const headers = [
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].join('\r\n')

  const textPart = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
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

export interface SendEmailOptions {
  to: string
  subject: string
  body: string
  printHtml?: string
  pdfFilename?: string
  pdfBase64?: string
}

export async function sendEmailWithGmail(opts: SendEmailOptions): Promise<void> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  if (!clientId || clientId === 'paste_your_client_id_here') {
    throw new Error('Google Client ID is not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to Vercel environment variables.')
  }

  console.log('[gmail-send] loading GSI script…')
  await loadGsiScript()

  const accessToken = await getAccessToken(clientId)

  // Trigger print window for user's records
  if (opts.printHtml) {
    const win = window.open('', '_blank', 'width=900,height=700')
    if (win) {
      win.document.write(opts.printHtml)
      win.document.close()
      setTimeout(() => { win.print(); win.close() }, 600)
    }
  }

  const mime = buildMime({
    to: opts.to,
    subject: opts.subject,
    body: opts.body,
    pdfBase64: opts.pdfBase64,
    pdfFilename: opts.pdfFilename,
  })

  console.log('[gmail-send] sending via Gmail API…')
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
    console.error('[gmail-send] API error:', err)
    throw new Error(err?.error?.message ?? `Gmail API error ${res.status}`)
  }

  console.log('[gmail-send] email sent successfully')
}
