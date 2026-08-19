// Login asks for identity only; Drive scopes are requested incrementally
// (see connectDrive) so the app is usable local-first without a Drive consent.
export const IDENTITY_SCOPES = 'openid email profile'
export const DRIVE_SCOPES =
  'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata'

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

export class AuthError extends Error {
  constructor(reason: string) {
    super(`auth: ${reason}`)
    this.name = 'AuthError'
  }
}

export type AuthSession = { accessToken: string; expiresAt: number }
export type GoogleUser = { email: string; name: string; photoLink?: string }

const clientId = (): string => {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!id) throw new AuthError('missing VITE_GOOGLE_CLIENT_ID')
  return id
}

export const loadGis = (): Promise<void> => {
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

export const requestAccessToken = (
  prompt: '' | 'consent' = '',
  scope: string = IDENTITY_SCOPES,
): Promise<AuthSession> => {
  const makeRequest = (): Promise<AuthSession> =>
    new Promise<AuthSession>((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId(),
        scope,
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

export const fetchGoogleUser = async (accessToken: string): Promise<GoogleUser> => {
  const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new AuthError(`userinfo ${res.status}`)
  const data = (await res.json()) as { email: string; name: string; picture?: string }
  return { email: data.email, name: data.name, photoLink: data.picture }
}
