/**
 * Gmail API sender using Google Identity Services (OAuth implicit flow).
 *
 * IMPORTANT: requestAccessToken() must be called synchronously from a user
 * click event — any await before it causes browsers to block the popup.
 * Call preloadGsi() on component mount, then sendEmailWithGmail() on click.
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

/** Call this in useEffect on mount to pre-load the GSI script. */
export function preloadGsi(): void {
  if (typeof window === 'undefined') return
  if (document.getElementById('gsi-script')) return
  const script = document.createElement('script')
  script.id = 'gsi-script'
  script.src = 'https://accounts.google.com/gsi/client'
  script.async = true
  document.head.appendChild(script)
}

function toBase64Url(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function buildMime(opts: {
  to: string
  subject: string
  body: string
}): string {
  const boundary = `cdsc_${Date.now()}`
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
    `--${boundary}--`,
  ].join('\r\n')
  return `${headers}\r\n\r\n${textPart}`
}

async function sendViaApi(accessToken: string, opts: SendEmailOptions): Promise<void> {
  const mime = buildMime({ to: opts.to, subject: opts.subject, body: opts.body })
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: toBase64Url(mime) }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Gmail API error ${res.status}`)
  }
}

export interface SendEmailOptions {
  to: string
  subject: string
  body: string
  printHtml?: string
  pdfFilename?: string
  onSuccess?: () => void
  onError?: (msg: string) => void
}

/**
 * Call this DIRECTLY from a button onClick (no await before it).
 * It synchronously opens the Google sign-in popup, then sends the email.
 */
export function sendEmailWithGmail(opts: SendEmailOptions): void {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  if (!clientId || clientId === 'paste_your_client_id_here') {
    opts.onError?.('Google Client ID is not configured.')
    return
  }
  if (!window.google?.accounts?.oauth2) {
    opts.onError?.('Google sign-in is still loading — please wait a moment and try again.')
    return
  }

  // requestAccessToken() must run synchronously here (no await above this line)
  const client = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/gmail.send',
    callback: async (res) => {
      if (res.error || !res.access_token) {
        opts.onError?.(res.error ?? 'Google sign-in was cancelled or failed.')
        return
      }
      try {
        // Trigger print window
        if (opts.printHtml) {
          const win = window.open('', '_blank', 'width=900,height=700')
          if (win) {
            win.document.write(opts.printHtml)
            win.document.close()
            setTimeout(() => { win.print(); win.close() }, 600)
          }
        }
        await sendViaApi(res.access_token, opts)
        opts.onSuccess?.()
      } catch (err: unknown) {
        opts.onError?.(err instanceof Error ? err.message : 'Failed to send email')
      }
    },
  })
  client.requestAccessToken()
}
