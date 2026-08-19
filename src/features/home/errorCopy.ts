import type { RepoErrorCode } from '@/lib/repo'
import type es from '@/lib/i18n/locales/es.json'

// Unlike src/features/auth/errorCopy.ts (keyed by a raw Error message,
// since AuthError/DriveError don't carry a `code`), dataStore.error is
// already a typed RepoErrorCode — this Record is exhaustive over that
// union, so there is no drift to guard with a test: a missing case is a
// compile error, not a silent fallback (docs/error-handling.md §7).
type HomeErrorKey = `error.codes.${keyof typeof es.home.error.codes}`

const HOME_ERROR_KEY: Record<RepoErrorCode, HomeErrorKey> = {
  not_found: 'error.codes.notFound',
  schema_mismatch: 'error.codes.schemaMismatch',
  invalid_input: 'error.codes.invalidInput',
  network: 'error.codes.network',
  unknown: 'error.codes.unknown',
}

export const homeErrorCopy = (code: RepoErrorCode): HomeErrorKey => HOME_ERROR_KEY[code]
