import { LOCKED_OUT_ERROR, NO_SESSION_ERROR, SESSION_RESTORE_ERROR } from '@/lib/lockStore'
// Maps a raw pinLock.ts/lockStore.ts error message (English, developer-
// facing) to the Spanish copy a user actually sees. docs/error-handling.md
// §7: never render `.message` raw in the DOM. Keyed by message, not a
// `code`: `WrongPinError`/`LockedOutError`/`BiometricUnavailableError` don't
// carry one (each is checked with `instanceof` at its one call site,
// `lockStore.resume` — docs/error-handling.md §1), and `useLockStore.error`
// collapses them to fixed message strings before a component ever sees them.
const UNLOCK_ERROR_COPY: Record<string, string> = {
  // Not LockedOutError's own message ('lock: too many attempts') —
  // lockStore.resume() substitutes its own string, so key off the exported
  // constant: a rename there is a compile error, not silent drift.
  [LOCKED_OUT_ERROR]: 'Demasiados intentos. Inicia sesión con Google de nuevo.',
  'lock: wrong pin': 'PIN incorrecto. Intenta de nuevo.',
  'lock: biometric unavailable': 'La biometría no está disponible en este dispositivo.',
  [SESSION_RESTORE_ERROR]:
    'Tu PIN es correcto, pero no se pudo restaurar tu sesión. Inicia sesión con Google de nuevo.',
}

const ENABLE_ERROR_COPY: Record<string, string> = {
  [NO_SESSION_ERROR]: 'Necesitas iniciar sesión antes de activar el bloqueo.',
}

const DEFAULT_UNLOCK_COPY = 'No se pudo desbloquear. Intenta de nuevo.'
const DEFAULT_ENABLE_COPY = 'No se pudo activar el bloqueo. Intenta de nuevo.'

export function unlockErrorCopy(message: string): string {
  return UNLOCK_ERROR_COPY[message] ?? DEFAULT_UNLOCK_COPY
}

export function enableLockErrorCopy(message: string): string {
  return ENABLE_ERROR_COPY[message] ?? DEFAULT_ENABLE_COPY
}
