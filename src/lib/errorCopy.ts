import type { RepoErrorCode } from '@/lib/repo'
import type es from '@/lib/i18n/locales/es.json'

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
