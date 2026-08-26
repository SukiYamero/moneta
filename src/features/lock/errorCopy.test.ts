import { describe, it, expect } from 'vitest'
import {
  BiometricUnavailableError,
  GuestBiometricUnavailableError,
  WrongPinError,
} from '@/lib/pinLock'
import { LOCKED_OUT_ERROR, NO_SESSION_ERROR, SESSION_RESTORE_ERROR } from '@/lib/lockStore'
import { enableLockErrorCopy, unlockErrorCopy } from '@/features/lock/errorCopy'

describe('unlockErrorCopy', () => {
  it.each([
    ['a wrong PIN', new WrongPinError().message, 'errors.wrongPin'],
    ['unavailable biometrics', new BiometricUnavailableError().message, 'errors.biometricUnavailable'],
    [
      'an unavailable guest biometric',
      new GuestBiometricUnavailableError().message,
      'errors.biometricUnavailable',
    ],
    ['a lockout', LOCKED_OUT_ERROR, 'errors.lockedOut'],
    ['a failed session restore', SESSION_RESTORE_ERROR, 'errors.sessionRestoreFailed'],
  ])('maps %s to its translation key', (_desc, message, key) => {
    expect(unlockErrorCopy(message)).toBe(key)
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
