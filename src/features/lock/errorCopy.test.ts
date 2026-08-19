import { describe, it, expect } from 'vitest'
import { BiometricUnavailableError, WrongPinError } from '@/lib/pinLock'
import { enableLockErrorCopy, unlockErrorCopy } from '@/features/lock/errorCopy'

describe('unlockErrorCopy', () => {
  // Derived from the real error classes, not restated as literals — a
  // message-template change in pinLock.ts fails these tests instead of
  // silently degrading to the generic fallback (docs/error-handling.md §7).
  it('maps a wrong PIN to actionable Spanish copy', () => {
    expect(unlockErrorCopy(new WrongPinError().message)).toBe('PIN incorrecto. Intenta de nuevo.')
  })

  it('maps unavailable biometrics to actionable Spanish copy', () => {
    expect(unlockErrorCopy(new BiometricUnavailableError().message)).toBe(
      'La biometría no está disponible en este dispositivo.',
    )
  })

  // Not derivable from LockedOutError — lockStore.ts's resume() deliberately
  // substitutes this literal instead of forwarding the class's own message
  // (see the comment on this key in errorCopy.ts). Pinned by string as the
  // best available guard: this test still fails if the substitution ever
  // stops producing exactly 'locked out', even though it can't fail if
  // lockStore.ts's literal changes to some *other* string — that residual
  // gap is underivable without owning lockStore.ts.
  it('maps a lockout to actionable Spanish copy', () => {
    expect(unlockErrorCopy('locked out')).toBe(
      'Demasiados intentos. Inicia sesión con Google de nuevo.',
    )
  })

  it('falls back to a generic Spanish message for an unmapped message', () => {
    expect(unlockErrorCopy('unlock failed')).toBe('No se pudo desbloquear. Intenta de nuevo.')
  })
})

describe('enableLockErrorCopy', () => {
  // Same underivable caveat as 'locked out' above — lockStore.ts's enable()
  // throws a plain `new Error(...)`, not a named class this test can
  // construct from.
  it('maps a missing session to actionable Spanish copy', () => {
    expect(enableLockErrorCopy('lock: no session to protect')).toBe(
      'Necesitas iniciar sesión antes de activar el bloqueo.',
    )
  })

  it('falls back to a generic Spanish message for an unmapped message', () => {
    expect(enableLockErrorCopy('no se pudo activar')).toBe(
      'No se pudo activar el bloqueo. Intenta de nuevo.',
    )
  })
})
