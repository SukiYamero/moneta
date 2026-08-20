import { describe, it, expect } from 'vitest'
import { BiometricUnavailableError, WrongPinError } from '@/lib/pinLock'
import { LOCKED_OUT_ERROR, NO_SESSION_ERROR, SESSION_RESTORE_ERROR } from '@/lib/lockStore'
import { enableLockErrorCopy, unlockErrorCopy } from '@/features/lock/errorCopy'

// Derived from the real error classes/exported constants, not restated as
// literals — a message-template change in pinLock.ts, or a rename of one
// of lockStore.ts's hand-thrown literals, fails these tests instead of
// silently degrading to the generic fallback (docs/error-handling.md §7).
// The expected output is a translation key, not Spanish copy — the
// component resolves it (`t(unlockErrorCopy(error))`), the same split
// `src/features/auth/errorCopy.test.ts` already tests against.
describe('unlockErrorCopy', () => {
  it('maps a wrong PIN to its translation key', () => {
    expect(unlockErrorCopy(new WrongPinError().message)).toBe('errors.wrongPin')
  })

  it('maps unavailable biometrics to its translation key', () => {
    expect(unlockErrorCopy(new BiometricUnavailableError().message)).toBe(
      'errors.biometricUnavailable',
    )
  })

  it('maps a lockout to its translation key', () => {
    expect(unlockErrorCopy(LOCKED_OUT_ERROR)).toBe('errors.lockedOut')
  })

  // Finding 3 (specs.md §11, 2026-08-19): resume() checking hydrate()'s
  // actual outcome, instead of assuming success, needs its own actionable
  // copy distinct from a wrong PIN or a lockout — the PIN itself was correct.
  it('maps a failed session restore to its translation key', () => {
    expect(unlockErrorCopy(SESSION_RESTORE_ERROR)).toBe('errors.sessionRestoreFailed')
  })

  it('falls back to the generic unlock key for an unmapped message', () => {
    expect(unlockErrorCopy('unlock failed')).toBe('errors.unlockDefault')
  })
})

describe('enableLockErrorCopy', () => {
  it('maps a missing session to its translation key', () => {
    expect(enableLockErrorCopy(NO_SESSION_ERROR)).toBe('errors.noSession')
  })

  it('falls back to the generic enable key for an unmapped message', () => {
    expect(enableLockErrorCopy('no se pudo activar')).toBe('errors.enableDefault')
  })
})
