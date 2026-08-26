import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// This file exercises the switcher's UI behavior, not the real sync
// trigger wiring (`switchProfile.test.ts` already covers that in
// isolation) — mocked so a switch here never registers real window
// event listeners that could outlive one test.
vi.mock('@/lib/sync/syncSession', () => ({
  startSyncSession: vi.fn(),
  stopSyncSession: vi.fn(),
}))

import {
  __clearRegistryForTests,
  getActiveProfile,
  getActiveProfileId,
  getProfile,
  getProfileDatabase,
  registerProfile,
} from '@/lib/profiles'
import { ProfilesSection } from '@/features/profile/ProfilesSection'
import { useProfiles, type UseProfilesResult } from '@/features/profile/useProfiles'

// Defaults to the real hook so registry-backed tests are untouched; only the
// anti-flash tests reassign to a fixed 'loading' return. Never
// `mockReturnValueOnce`, which falls through to the real hook mid-render and
// violates React's stable-hook-order rule.
const { realUseProfiles } = vi.hoisted(() => ({ realUseProfiles: vi.fn() }))
vi.mock('@/features/profile/useProfiles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/profile/useProfiles')>()
  realUseProfiles.mockImplementation(actual.useProfiles)
  return { ...actual, useProfiles: vi.fn(actual.useProfiles) }
})
const mUseProfiles = vi.mocked(useProfiles)

const LOADING_STATE: UseProfilesResult = {
  status: 'loading',
  profiles: [],
  activeProfileId: null,
  switchingId: null,
  goneProfile: null,
  switchTo: vi.fn(),
  dismissGoneProfile: vi.fn(),
  removeGoneProfile: vi.fn(),
}

afterEach(async () => {
  mUseProfiles.mockImplementation(realUseProfiles)
  await __clearRegistryForTests()
})

describe('ProfilesSection', () => {
  it('renders the adopted default profile even when it is the only one, with a truthful "this device" label, not the raw stored name', async () => {
    render(<ProfilesSection />)
    expect(await screen.findByText('Este dispositivo')).toBeInTheDocument()
    expect(screen.queryByText('Local')).not.toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
  })

  it('lists every profile and marks only the active one', async () => {
    await getActiveProfile()
    await registerProfile({
      id: 'p2',
      label: 'alex@example.com',
      kind: 'google',
      databaseName: 'kurobello-p2',
    })

    render(<ProfilesSection />)
    expect(await screen.findByText('alex@example.com')).toBeInTheDocument()
    expect(screen.getByText('Este dispositivo')).toBeInTheDocument()
    // Only the most-recently-registered profile (p2) is marked active.
    expect(screen.getAllByText('Activo')).toHaveLength(1)
  })

  it('switching to another profile rebinds the app and moves the active badge', async () => {
    const user = userEvent.setup()
    await getActiveProfile() // adopts the default local profile first
    const registered = await registerProfile({
      id: 'p-switch',
      label: 'alex@example.com',
      kind: 'google',
      databaseName: 'kurobello-switch-ui-test',
    })
    // The switcher's pre-check reads the target's owner marker, only ever
    // present after a prior bind — simulate that bind directly.
    await getProfileDatabase(registered.databaseName).profileOwner.put({
      id: 1,
      kind: 'google',
      createdAt: registered.createdAt,
    })
    // registerProfile() makes this the most-recently-touched profile, which
    // would resolve as active by recency alone and disable its own row
    // before the click — pin the default active explicitly first instead.
    const { setActiveProfileId, DEFAULT_PROFILE_ID } = await import('@/lib/profiles')
    await setActiveProfileId(DEFAULT_PROFILE_ID)

    render(<ProfilesSection />)
    const row = await screen.findByText('alex@example.com')
    await user.click(row.closest('button')!)

    // One condition over the whole settled state — three separate `waitFor`s
    // would each pass individually mid-switch, before the badge has actually
    // moved to the new row.
    await waitFor(() => {
      expect(screen.getAllByText('Activo')).toHaveLength(1)
      expect(screen.getByText('alex@example.com').closest('button')).toContainElement(
        screen.getByText('Activo'),
      )
    })
    expect(await getActiveProfileId()).toBe('p-switch')
  })

  it('offers to remove a profile whose database is gone, instead of switching to it', async () => {
    const user = userEvent.setup()
    await getActiveProfile()
    await registerProfile({
      id: 'p-gone',
      label: 'gone@example.com',
      kind: 'google',
      databaseName: 'kurobello-gone-ui-test',
    })
    // No owner marker written — the database looks freshly created/empty.
    // Registering it makes it the most-recently-touched profile, which would
    // resolve as active by recency alone and disable its own row before the
    // click — pin the default active explicitly first instead.
    const { setActiveProfileId, DEFAULT_PROFILE_ID } = await import('@/lib/profiles')
    await setActiveProfileId(DEFAULT_PROFILE_ID)

    render(<ProfilesSection />)
    const row = await screen.findByText('gone@example.com')
    await user.click(row.closest('button')!)

    expect(await screen.findByText(/ya no están/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Quitar' }))

    await waitFor(async () => expect(await getProfile('p-gone')).toBeUndefined())
  })

  // `useProfiles` is mocked because its real 'loading' window (an IndexedDB
  // read) is too brief to hold open under fake timers.
  it('shows nothing yet immediately while the registry read is pending, before the anti-flash delay elapses', () => {
    mUseProfiles.mockImplementation(() => LOADING_STATE)
    vi.useFakeTimers()
    render(<ProfilesSection />)
    expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('shows the skeleton once the anti-flash delay elapses while the registry read is still pending', () => {
    mUseProfiles.mockImplementation(() => LOADING_STATE)
    vi.useFakeTimers()
    render(<ProfilesSection />)
    act(() => vi.advanceTimersByTime(150))
    expect(screen.getByText(/cargando/i)).toBeInTheDocument()
    vi.useRealTimers()
  })
})
