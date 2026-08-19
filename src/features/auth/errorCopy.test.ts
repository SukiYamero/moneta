import { describe, it, expect } from 'vitest'
import { AuthError } from '@/lib/auth'
import { DriveError } from '@/lib/drive'
import { driveErrorCopy, loginErrorCopy } from '@/features/auth/errorCopy'

// Every mapped key below is derived from the real AuthError/DriveError
// construction (`new AuthError(reason).message`), never restated as a
// literal — if auth.ts/drive.ts ever change the "auth: "/"drive: " message
// template, these tests fail instead of the copy table silently going
// stale while `bun run check` stays green (the exact drift this suite
// exists to catch, per docs/error-handling.md §7).
describe('loginErrorCopy', () => {
  it('maps a known AuthError reason to actionable Spanish copy', () => {
    expect(loginErrorCopy(new AuthError('access_denied').message)).toBe(
      'Cancelaste el inicio de sesión con Google.',
    )
  })

  it('maps a missing client id to actionable Spanish copy', () => {
    expect(loginErrorCopy(new AuthError('missing VITE_GOOGLE_CLIENT_ID').message)).toBe(
      'Error de configuración. Intenta más tarde.',
    )
  })

  it('maps a GIS script load failure to actionable Spanish copy', () => {
    expect(loginErrorCopy(new AuthError('GIS failed to load').message)).toBe(
      'No pudimos cargar Google. Revisa tu conexión e intenta de nuevo.',
    )
  })

  it('maps a closed popup to actionable Spanish copy', () => {
    expect(loginErrorCopy(new AuthError('popup_closed').message)).toBe(
      'Cerraste la ventana de Google antes de terminar. Intenta de nuevo.',
    )
  })

  it('maps a blocked popup to actionable Spanish copy', () => {
    expect(loginErrorCopy(new AuthError('popup_failed_to_open').message)).toBe(
      'El navegador bloqueó la ventana de Google. Revisa el bloqueador de ventanas emergentes.',
    )
  })

  it('falls back to a generic Spanish message for a reason the table deliberately does not know', () => {
    expect(loginErrorCopy(new AuthError('some_future_gis_error').message)).toBe(
      'No se pudo iniciar sesión. Intenta de nuevo.',
    )
  })

  it('never returns the raw message it was given for an unmapped case', () => {
    const raw = new AuthError('some_future_gis_error').message
    expect(loginErrorCopy(raw)).not.toBe(raw)
  })
})

describe('driveErrorCopy', () => {
  it('maps a known AuthError reason (Drive scope denied) to actionable Spanish copy', () => {
    expect(driveErrorCopy(new AuthError('access_denied').message)).toBe(
      'Cancelaste el inicio de sesión con Google.',
    )
  })

  it('falls back to a generic Spanish message for a dynamic DriveError message', () => {
    expect(driveErrorCopy(new DriveError('list 403').message)).toBe(
      'No se pudo conectar con Drive. Intenta de nuevo.',
    )
  })
})
