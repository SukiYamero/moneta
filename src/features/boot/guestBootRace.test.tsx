import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
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
    restore: vi.fn().mockResolvedValue(undefined),
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('continueAsGuest() vs. the boot sequence — the recency race', () => {
  it('binds the guest profile, not a more-recently-touched Google profile that predates it, on the very next boot', async () => {
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
      <MemoryRouter>
        <RequireAuth>
          <BootGate>
            <div>app</div>
          </BootGate>
        </RequireAuth>
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: /invitado/i }))

    await waitFor(() => {
      expect(useBootStore.getState().status).toBe('ready')
    })

    expect(getActiveProfileBinding()?.profile.id).toBe(DEFAULT_PROFILE_ID)
  })
})
