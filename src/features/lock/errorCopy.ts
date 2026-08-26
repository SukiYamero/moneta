import { LOCKED_OUT_ERROR, NO_SESSION_ERROR, SESSION_RESTORE_ERROR } from '@/lib/lockStore'
import type es from '@/lib/i18n/locales/es.json'

type LockErrorKey = `errors.${keyof typeof es.lock.errors}`

const UNLOCK_ERROR_KEY: Record<string, LockErrorKey> = {
  [LOCKED_OUT_ERROR]: 'errors.lockedOut',
  'lock: wrong pin': 'errors.wrongPin',
  'lock: biometric unavailable': 'errors.biometricUnavailable',
  'lock: guest biometric unavailable': 'errors.biometricUnavailable',
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
