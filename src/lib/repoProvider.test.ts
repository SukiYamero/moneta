import { describe, expect, it } from 'vitest'
import { fakeRepo } from '@/lib/repo.fake'
import { getRepo } from '@/lib/repoProvider'

describe('getRepo()', () => {
  it('returns the shared fake repo singleton', () => {
    expect(getRepo()).toBe(fakeRepo)
  })

  it('returns the same instance across calls', () => {
    expect(getRepo()).toBe(getRepo())
  })
})
