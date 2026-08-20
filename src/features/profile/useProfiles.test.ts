import { afterEach, describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import {
  __clearRegistryForTests,
  DEFAULT_PROFILE_ID,
  getActiveProfile,
  registerProfile,
} from '@/lib/profiles'
import { useProfiles } from '@/features/profile/useProfiles'

afterEach(async () => {
  await __clearRegistryForTests()
})

describe('useProfiles', () => {
  it('starts loading and settles on a fresh device with the adopted default profile', async () => {
    const { result } = renderHook(() => useProfiles())
    expect(result.current.status).toBe('loading')

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.profiles).toHaveLength(1)
    expect(result.current.activeProfileId).toBe(DEFAULT_PROFILE_ID)
  })

  it('lists every registered profile and marks the most recently used one active', async () => {
    await getActiveProfile() // adopts the default first, same ordering profileRegistry.test.ts relies on
    await registerProfile({
      id: 'p2',
      label: 'Cuenta de Google',
      kind: 'google',
      databaseName: 'kurobello-p2',
    })

    const { result } = renderHook(() => useProfiles())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    expect(result.current.profiles.map((p) => p.id).toSorted()).toEqual(
      [DEFAULT_PROFILE_ID, 'p2'].toSorted(),
    )
    // registerProfile() always mints a strictly later lastUsedAt than the
    // lazily-adopted default (profileRegistry.ts), so the just-registered
    // profile is the active one.
    expect(result.current.activeProfileId).toBe('p2')
  })
})
