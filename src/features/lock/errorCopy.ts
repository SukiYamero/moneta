// Maps a raw pinLock.ts/lockStore.ts error message (English, developer-
// facing) to the Spanish copy a user actually sees. docs/error-handling.md
// §7: never render `.message` raw in the DOM. Keyed by message, not a
// `code`: `WrongPinError`/`LockedOutError`/`BiometricUnavailableError` don't
// carry one (each is checked with `instanceof` at its one call site,
// `lockStore.resume` — docs/error-handling.md §1), and `useLockStore.error`
// collapses them to fixed message strings before a component ever sees them.
const UNLOCK_ERROR_COPY: Record<string, string> = {
  // Not derivable from LockedOutError().message ('lock: too many attempts')
  // — lockStore.ts's resume() deliberately substitutes this literal instead
  // of forwarding the class's own message (src/lib/lockStore.ts, the
  // LockedOutError branch). errorCopy.ts doesn't own that file, so this key
  // can only be pinned by string, not derived; a rename there breaks this
  // silently, same risk class as the AuthError template coupling
  // (docs/error-handling.md §7).
  'locked out': 'Demasiados intentos. Inicia sesión con Google de nuevo.',
  'lock: wrong pin': 'PIN incorrecto. Intenta de nuevo.',
  'lock: biometric unavailable': 'La biometría no está disponible en este dispositivo.',
}

const ENABLE_ERROR_COPY: Record<string, string> = {
  // Not derivable from a named error class either — lockStore.ts's enable()
  // throws a plain `new Error('lock: no session to protect')` (same file,
  // same caveat as 'locked out' above).
  'lock: no session to protect': 'Necesitas iniciar sesión antes de activar el bloqueo.',
}

const DEFAULT_UNLOCK_COPY = 'No se pudo desbloquear. Intenta de nuevo.'
const DEFAULT_ENABLE_COPY = 'No se pudo activar el bloqueo. Intenta de nuevo.'

export function unlockErrorCopy(message: string): string {
  return UNLOCK_ERROR_COPY[message] ?? DEFAULT_UNLOCK_COPY
}

export function enableLockErrorCopy(message: string): string {
  return ENABLE_ERROR_COPY[message] ?? DEFAULT_ENABLE_COPY
}
