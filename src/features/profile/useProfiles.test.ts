import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
  __clearRegistryForTests,
  DEFAULT_PROFILE_ID,
  getActiveProfile,
  registerProfile,
} from '@/lib/profiles'
import { switchToProfile } from '@/lib/profiles/switchProfile'
import { toast } from '@/lib/toastStore'
import { useProfiles } from '@/features/profile/useProfiles'

vi.mock('@/lib/profiles/switchProfile', () => ({ switchToProfile: vi.fn() }))
const mSwitchToProfile = vi.mocked(switchToProfile)

afterEach(async () => {
  await __clearRegistryForTests()
  mSwitchToProfile.mockReset()
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
    await getActiveProfile()
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
    expect(result.current.activeProfileId).toBe('p2')
  })

  it('surfaces a check failure as a toast, never as the gone-profile removal dialog', async () => {
    mSwitchToProfile.mockResolvedValue({ outcome: 'switch-check-failed' })
    const toastSpy = vi.spyOn(toast, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useProfiles())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    const target = result.current.profiles[0]!
    await act(() => result.current.switchTo(target))

    expect(toastSpy).toHaveBeenCalledWith('profile:profiles.switchError')
    expect(result.current.goneProfile).toBeNull()
    expect(result.current.switchingId).toBeNull()

    toastSpy.mockRestore()
  })
})
