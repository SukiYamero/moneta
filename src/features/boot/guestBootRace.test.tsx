import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { BootGate } from '@/features/boot/BootGate'
import { useAuthStore } from '@/lib/authStore'
import { __resetBootStoreForTests, useBootStore } from '@/lib/boot'
import { useDataStore } from '@/lib/dataStore'
import { getActiveProfileBinding, __resetRepoBindingForTests } from '@/lib/repoProvider'
import { __resetOutboxDatabaseForTests } from '@/lib/outbox'
import {
  __clearRegistryForTests,
  DEFAULT_PROFILE_DATABASE_NAME,
  DEFAULT_PROFILE_ID,
  makeProfileDatabaseName,
  registerProfile,
} from '@/lib/profiles'

// Not module-mocked: this test runs the real profile registry (fake-
// indexeddb), the real boot sequence, and the real repoProvider/outbox
// bindings — it exists to answer one question empirically rather than by
// reasoning about it (operator's brief, track-boot review): does
// `continueAsGuest()`'s unawaited `touchLastUsed()` reliably land before
// `BootGate`'s effect-driven `run()` reads the profile registry?

beforeEach(async () => {
  await __clearRegistryForTests()
  __resetRepoBindingForTests()
  __resetBootStoreForTests()
  __resetOutboxDatabaseForTests()
  useDataStore.setState({
    movimientos: [],
    activos: [],
    config: null,
    status: 'idle',
    error: null,
  })
  useAuthStore.setState({
    status: 'idle',
    user: null,
    session: null,
    drive: null,
    error: null,
    driveOptIn: 'pending',
    driveConnecting: false,
    driveError: null,
    // RequireAuth attempts a silent restore() on mount when idle — stub it
    // so this test exercises continueAsGuest()'s own path only.
    restore: vi.fn().mockResolvedValue(undefined),
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('continueAsGuest() vs. the boot sequence — the recency race', () => {
  it('binds the guest profile, not a more-recently-touched Google profile that predates it, on the very next boot', async () => {
    // Simulates a device that signed into a Google account (touched more
    // recently than the untouched default profile) and later signed out —
    // the scenario the track's own comment on continueAsGuest() names.
    await registerProfile({
      id: DEFAULT_PROFILE_ID,
      label: 'Local',
      kind: 'local',
      databaseName: DEFAULT_PROFILE_DATABASE_NAME,
    })
    await registerProfile({
      id: 'google-1',
      label: 'Someone',
      kind: 'google',
      databaseName: makeProfileDatabaseName('google-1'),
      accountKey: 'someone@example.com',
    })

    render(
      <RequireAuth>
        <BootGate>
          <div>app</div>
        </BootGate>
      </RequireAuth>,
    )

    await userEvent.click(screen.getByRole('button', { name: /invitado/i }))

    await waitFor(() => {
      expect(useBootStore.getState().status).toBe('ready')
    })

    // The claim under test: does the boot sequence's registry read see the
    // guest touch, or does it still see the older, more-recent-by-the-old-
    // clock Google profile because the touch's IndexedDB write hadn't
    // landed yet when the read fired?
    expect(getActiveProfileBinding()?.profile.id).toBe(DEFAULT_PROFILE_ID)
  })
})
