import { describe, it, expect } from 'vitest'
import { driveErrorCopy, loginErrorCopy } from '@/features/auth/errorCopy'

describe('loginErrorCopy', () => {
  it('maps a known AuthError message to actionable Spanish copy', () => {
    expect(loginErrorCopy('auth: access_denied')).toBe('Cancelaste el inicio de sesión con Google.')
  })

  it('falls back to a generic Spanish message for an unmapped message', () => {
    expect(loginErrorCopy('auth: some_future_gis_error')).toBe(
      'No se pudo iniciar sesión. Intenta de nuevo.',
    )
  })

  it('never returns the raw message it was given for an unmapped case', () => {
    const raw = 'auth: missing VITE_GOOGLE_CLIENT_ID'
    expect(loginErrorCopy(raw)).not.toBe(raw)
  })
})

describe('driveErrorCopy', () => {
  it('maps a known AuthError message (Drive scope denied) to actionable Spanish copy', () => {
    expect(driveErrorCopy('auth: access_denied')).toBe('Cancelaste el inicio de sesión con Google.')
  })

  it('falls back to a generic Spanish message for a dynamic DriveError message', () => {
    expect(driveErrorCopy('drive: list 403')).toBe(
      'No se pudo conectar con Drive. Intenta de nuevo.',
    )
  })
})
