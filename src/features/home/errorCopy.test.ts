import { describe, expect, it } from 'vitest'
import type { RepoErrorCode } from '@/lib/repo'
import { homeErrorCopy } from '@/features/home/errorCopy'

describe('homeErrorCopy', () => {
  const cases: [RepoErrorCode, string][] = [
    ['not_found', 'error.codes.notFound'],
    ['schema_mismatch', 'error.codes.schemaMismatch'],
    ['invalid_input', 'error.codes.invalidInput'],
    ['network', 'error.codes.network'],
    ['unknown', 'error.codes.unknown'],
  ]

  it.each(cases)('maps %s to its translation key', (code, key) => {
    expect(homeErrorCopy(code)).toBe(key)
  })
})
