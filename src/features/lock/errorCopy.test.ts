import { describe, it, expect } from 'vitest'
import { BiometricUnavailableError, WrongPinError } from '@/lib/pinLock'
import { LOCKED_OUT_ERROR, NO_SESSION_ERROR, SESSION_RESTORE_ERROR } from '@/lib/lockStore'
import { enableLockErrorCopy, unlockErrorCopy } from '@/features/lock/errorCopy'

describe('unlockErrorCopy', () => {
  // Derived from the real error classes/exported constants, not restated as
  // literals — a message-template change in pinLock.ts, or a rename of one
  // of lockStore.ts's hand-thrown literals, fails these tests instead of
  // silently degrading to the generic fallback (docs/error-handling.md §7).
  it('maps a wrong PIN to actionable Spanish copy', () => {
    expect(unlockErrorCopy(new WrongPinError().message)).toBe('PIN incorrecto. Intenta de nuevo.')
  })

  it('maps unavailable biometrics to actionable Spanish copy', () => {
    expect(unlockErrorCopy(new BiometricUnavailableError().message)).toBe(
      'La biometría no está disponible en este dispositivo.',
    )
  })

  it('maps a lockout to actionable Spanish copy', () => {
    expect(unlockErrorCopy(LOCKED_OUT_ERROR)).toBe(
      'Demasiados intentos. Inicia sesión con Google de nuevo.',
    )
  })

  // Finding 3 (specs.md §11, 2026-08-19): resume() checking hydrate()'s
  // actual outcome, instead of assuming success, needs its own actionable
  // copy distinct from a wrong PIN or a lockout — the PIN itself was correct.
  it('maps a failed session restore to actionable Spanish copy', () => {
    expect(unlockErrorCopy(SESSION_RESTORE_ERROR)).toBe(
      'Tu PIN es correcto, pero no se pudo restaurar tu sesión. Inicia sesión con Google de nuevo.',
    )
  })

  it('falls back to a generic Spanish message for an unmapped message', () => {
    expect(unlockErrorCopy('unlock failed')).toBe('No se pudo desbloquear. Intenta de nuevo.')
  })
})

describe('enableLockErrorCopy', () => {
  it('maps a missing session to actionable Spanish copy', () => {
    expect(enableLockErrorCopy(NO_SESSION_ERROR)).toBe(
      'Necesitas iniciar sesión antes de activar el bloqueo.',
    )
  })

  it('falls back to a generic Spanish message for an unmapped message', () => {
    expect(enableLockErrorCopy('no se pudo activar')).toBe(
      'No se pudo activar el bloqueo. Intenta de nuevo.',
    )
  })
})
