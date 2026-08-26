import { describe, it, expect } from 'vitest'
import { AuthError } from '@/lib/auth'
import { DriveError } from '@/lib/drive'
import { driveErrorCopy, loginErrorCopy } from '@/features/auth/errorCopy'

// Every mapped key below is derived from the real AuthError/DriveError
// construction (`new AuthError(reason).message`), never restated as a
// literal — if auth.ts/drive.ts ever change the "auth: "/"drive: " message
// template, these tests fail instead of the copy table silently going stale.
// The expected output is a stable translation key, not a Spanish sentence —
// a copy reword doesn't break this suite, only a recognition change does.
describe('loginErrorCopy', () => {
  it.each([
    ['access_denied', 'errors.accessDenied'],
    ['missing VITE_GOOGLE_CLIENT_ID', 'errors.missingClientId'],
    ['GIS failed to load', 'errors.gisFailedToLoad'],
    ['popup_closed', 'errors.popupClosed'],
    ['popup_failed_to_open', 'errors.popupFailedToOpen'],
  ])('maps AuthError reason %s to %s', (reason, key) => {
    expect(loginErrorCopy(new AuthError(reason).message)).toBe(key)
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
