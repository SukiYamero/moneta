import { LOCKED_OUT_ERROR, NO_SESSION_ERROR, SESSION_RESTORE_ERROR } from '@/lib/lockStore'
import type es from '@/lib/i18n/locales/es.json'

// Maps a raw pinLock.ts/lockStore.ts error message (English, developer-
// facing) to a translation key in the `lock` namespace's `errors` group —
// never Spanish copy directly, the same pattern `src/features/auth/errorCopy.ts`
// already established. docs/error-handling.md §7: never render `.message`
// raw in the DOM. Keyed by message, not a `code`:
// `WrongPinError`/`LockedOutError`/`BiometricUnavailableError` don't carry
// one (each is checked with `instanceof` at its one call site,
// `lockStore.resume` — docs/error-handling.md §1), and `useLockStore.error`
// collapses them to fixed message strings before a component ever sees them.
type LockErrorKey = `errors.${keyof typeof es.lock.errors}`

const UNLOCK_ERROR_KEY: Record<string, LockErrorKey> = {
  // Not LockedOutError's own message ('lock: too many attempts') —
  // lockStore.resume() substitutes its own string, so key off the exported
  // constant: a rename there is a compile error, not silent drift.
  [LOCKED_OUT_ERROR]: 'errors.lockedOut',
  'lock: wrong pin': 'errors.wrongPin',
  'lock: biometric unavailable': 'errors.biometricUnavailable',
  [SESSION_RESTORE_ERROR]: 'errors.sessionRestoreFailed',
}

const ENABLE_ERROR_KEY: Record<string, LockErrorKey> = {
  [NO_SESSION_ERROR]: 'errors.noSession',
}

const DEFAULT_UNLOCK_KEY: LockErrorKey = 'errors.unlockDefault'
const DEFAULT_ENABLE_KEY: LockErrorKey = 'errors.enableDefault'

export const unlockErrorCopy = (message: string): LockErrorKey => {
  return UNLOCK_ERROR_KEY[message] ?? DEFAULT_UNLOCK_KEY
}

export const enableLockErrorCopy = (message: string): LockErrorKey => {
  return ENABLE_ERROR_KEY[message] ?? DEFAULT_ENABLE_KEY
}
