export const DRIVE_SCOPES =
  'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata'

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const ABOUT_URL = 'https://www.googleapis.com/drive/v3/about?fields=user'

export class AuthError extends Error {
  constructor(reason: string) {
    super(`auth: ${reason}`)
    this.name = 'AuthError'
  }
}

export type AuthSession = { accessToken: string; expiresAt: number }
export type GoogleUser = { email: string; name: string; photoLink?: string }

function clientId(): string {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!id) throw new AuthError('missing VITE_GOOGLE_CLIENT_ID')
  return id
}

export function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new AuthError('GIS failed to load')), {
        once: true,
      })
      return
    }
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new AuthError('GIS failed to load'))
    document.head.appendChild(script)
  })
}

export function requestAccessToken(prompt: '' | 'consent' = ''): Promise<AuthSession> {
  const makeRequest = (): Promise<AuthSession> =>
    new Promise<AuthSession>((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId(),
        scope: DRIVE_SCOPES,
        callback: (resp) => {
          if (resp.error) {
            reject(new AuthError(resp.error))
            return
          }
          resolve({
            accessToken: resp.access_token,
            expiresAt: Date.now() + Number(resp.expires_in) * 1000,
          })
        },
        error_callback: (err) => reject(new AuthError(err.type)),
      })
      client.requestAccessToken({ prompt })
    })

  // When GIS is already loaded, initTokenClient must be called synchronously
  // so callers can interact with the token client in the same tick.
  if (window.google?.accounts?.oauth2) return makeRequest()
  return loadGis().then(() => makeRequest())
}

export async function fetchGoogleUser(accessToken: string): Promise<GoogleUser> {
  const res = await fetch(ABOUT_URL, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new AuthError(`about ${res.status}`)
  const data = (await res.json()) as {
    user: { emailAddress: string; displayName: string; photoLink?: string }
  }
  return {
    email: data.user.emailAddress,
    name: data.user.displayName,
    photoLink: data.user.photoLink,
  }
}
