import type { RepoErrorCode } from '@/lib/repo'
import type es from '@/lib/i18n/locales/es.json'

// Shared by every screen with a top-level `error.codes` group in its own
// locale namespace (home/search/history) — moved here from
// src/features/home/errorCopy.ts because it was never Home-specific: it
// maps a global RepoErrorCode, and a user with no connection deserves the
// same true message on all three screens, not a generic string on two of
// them (specs.md §10.11). Typed off home's copy of the shape rather than a
// namespace-bound one — every namespace that wants this table keeps an
// identically-shaped `error.codes` group (i18n/README.md's key-parity rule
// already requires the four locale files to agree; this is that same
// requirement applied across namespaces within one locale), and each
// caller's own `useTranslation(<namespace>)` checks the returned literal
// against its own namespace's keys at the call site.
type ErrorCodeKey = keyof typeof es.home.error.codes
export type RepoErrorCopyKey = `error.codes.${ErrorCodeKey}`

const REPO_ERROR_KEY: Record<RepoErrorCode, RepoErrorCopyKey> = {
  not_found: 'error.codes.notFound',
  schema_mismatch: 'error.codes.schemaMismatch',
  invalid_input: 'error.codes.invalidInput',
  network: 'error.codes.network',
  unknown: 'error.codes.unknown',
}

export const repoErrorCopyKey = (code: RepoErrorCode): RepoErrorCopyKey => REPO_ERROR_KEY[code]
