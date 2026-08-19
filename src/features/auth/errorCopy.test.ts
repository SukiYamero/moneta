import { describe, it, expect } from 'vitest'
import { AuthError } from '@/lib/auth'
import { DriveError } from '@/lib/drive'
import { driveErrorCopy, loginErrorCopy } from '@/features/auth/errorCopy'

// Every mapped key below is derived from the real AuthError/DriveError
// construction (`new AuthError(reason).message`), never restated as a
// literal — if auth.ts/drive.ts ever change the "auth: "/"drive: " message
// template, these tests fail instead of the copy table silently going
// stale while `bun run check` stays green (the exact drift this suite
// exists to catch, per docs/error-handling.md §7). The expected output is
// now a stable translation key, not a Spanish sentence — a copy reword no
// longer breaks this suite, only a change in which error gets recognized
// does.
describe('loginErrorCopy', () => {
  it('maps a known AuthError reason to its translation key', () => {
    expect(loginErrorCopy(new AuthError('access_denied').message)).toBe('errors.accessDenied')
  })

  it('maps a missing client id to its translation key', () => {
    expect(loginErrorCopy(new AuthError('missing VITE_GOOGLE_CLIENT_ID').message)).toBe(
      'errors.missingClientId',
    )
  })

  it('maps a GIS script load failure to its translation key', () => {
    expect(loginErrorCopy(new AuthError('GIS failed to load').message)).toBe(
      'errors.gisFailedToLoad',
    )
  })

  it('maps a closed popup to its translation key', () => {
    expect(loginErrorCopy(new AuthError('popup_closed').message)).toBe('errors.popupClosed')
  })

  it('maps a blocked popup to its translation key', () => {
    expect(loginErrorCopy(new AuthError('popup_failed_to_open').message)).toBe(
      'errors.popupFailedToOpen',
    )
  })

  it('falls back to the generic login key for a reason the table deliberately does not know', () => {
    expect(loginErrorCopy(new AuthError('some_future_gis_error').message)).toBe(
      'errors.loginDefault',
    )
  })

  it('never returns the raw message it was given for an unmapped case', () => {
    const raw = new AuthError('some_future_gis_error').message
    expect(loginErrorCopy(raw)).not.toBe(raw)
  })
})

describe('driveErrorCopy', () => {
  it('maps a known AuthError reason (Drive scope denied) to its translation key', () => {
    expect(driveErrorCopy(new AuthError('access_denied').message)).toBe('errors.accessDenied')
  })

  it('falls back to the generic drive key for a dynamic DriveError message', () => {
    expect(driveErrorCopy(new DriveError('list 403').message)).toBe('errors.driveDefault')
  })
})
