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

// Defaults to the real hook (`importOriginal`) so the existing registry-backed
// tests below are untouched; only the anti-flash tests below reassign the
// mock's implementation to a fixed 'loading' return for their own render —
// never `mockReturnValueOnce`, which would fall through to the real
// (unmocked) hook mid-render and violate React's stable-hook-order rule.
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

  // specs.md §10.31: tapping a non-active profile switches the app to it.
  it('switching to another profile rebinds the app and moves the active badge', async () => {
    const user = userEvent.setup()
    await getActiveProfile() // adopts the default local profile first
    const registered = await registerProfile({
      id: 'p-switch',
      label: 'alex@example.com',
      kind: 'google',
      databaseName: 'kurobello-switch-ui-test',
    })
    // The switcher's own pre-check reads the target's owner marker — a
    // profile only ever reachable through the switcher after having been
    // bound at least once (specs.md §10.31 §2), so simulate that prior
    // bind directly rather than a full sign-in.
    await getProfileDatabase(registered.databaseName).profileOwner.put({
      id: 1,
      kind: 'google',
      createdAt: registered.createdAt,
    })
    // registerProfile() makes it the most-recently-touched profile, which
    // would otherwise resolve as active by recency alone and disable its
    // own row before the click below — the explicit pointer (specs.md
    // §10.31 §1) is what a device that never opened the switcher relies on
    // instead, so pin it at the default first, exactly the "switching away
    // from local" scenario this test means to exercise.
    const { setActiveProfileId, DEFAULT_PROFILE_ID } = await import('@/lib/profiles')
    await setActiveProfileId(DEFAULT_PROFILE_ID)

    render(<ProfilesSection />)
    const row = await screen.findByText('alex@example.com')
    await user.click(row.closest('button')!)

    // A single condition covering the whole settled state — not three
    // separate `waitFor`s, each individually satisfiable at a different
    // moment while the switch (registry pointer write, then boot.ts's
    // rebind, then the hook's own reload()) is still in progress. Checking
    // "exactly one Activo badge exists" and "it's on alex's row" apart lets
    // a slow rebind pass the first (still on the default's, now-stale,
    // pre-switch row) before the hook has actually caught up.
    await waitFor(() => {
      expect(screen.getAllByText('Activo')).toHaveLength(1)
      expect(screen.getByText('alex@example.com').closest('button')).toContainElement(
        screen.getByText('Activo'),
      )
    })
    expect(await getActiveProfileId()).toBe('p-switch')
  })

  // specs.md §10.31 edge case: a registry row whose database storage was
  // cleared must say so and offer removal, never fail opaquely.
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
    // Registering it makes it the most-recently-touched profile, which
    // would otherwise resolve as active by recency alone and disable its
    // row before the click this test needs ever fires — the explicit
    // pointer (specs.md §10.31 §1) is what makes the default the active
    // one instead, exactly what the switcher UI relies on in practice.
    const { setActiveProfileId, DEFAULT_PROFILE_ID } = await import('@/lib/profiles')
    await setActiveProfileId(DEFAULT_PROFILE_ID)

    render(<ProfilesSection />)
    const row = await screen.findByText('gone@example.com')
    await user.click(row.closest('button')!)

    expect(await screen.findByText(/ya no están/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Quitar' }))

    await waitFor(async () => expect(await getProfile('p-gone')).toBeUndefined())
  })

  // Anti-flash gate (specs.md §10.9), same convention as SearchScreen's own
  // loading tests — `useProfiles` is mocked here because its real 'loading'
  // window (an IndexedDB read) is too brief to hold open under fake timers.
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
