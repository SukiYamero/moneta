import { describe, it, expect } from 'vitest'
import { enableLockErrorCopy, unlockErrorCopy } from '@/features/lock/errorCopy'

describe('unlockErrorCopy', () => {
  it('maps a wrong PIN to actionable Spanish copy', () => {
    expect(unlockErrorCopy('lock: wrong pin')).toBe('PIN incorrecto. Intenta de nuevo.')
  })

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
