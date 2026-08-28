import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/sync/syncSession', () => ({
  startSyncSession: vi.fn(),
  stopSyncSession: vi.fn(),
}))

import { db } from '@/lib/db'
import { useAuthStore } from '@/lib/authStore'
import { useLockStore } from '@/lib/lockStore'
import { enableLock, hasVault } from '@/lib/pinLock'
import { __clearRegistryForTests, resolveGoogleProfile } from '@/lib/profiles'
import type { AuthSession, GoogleUser } from '@/lib/auth'
import type { Movimiento } from '@/lib/schema'

const session: AuthSession = { accessToken: 'tok-abc', expiresAt: 9_999_999_999_000 }
const user: GoogleUser = { email: 'ana@example.com', name: 'Ana', sub: 'sub-ana' }

const movimiento: Movimiento = {
  id: 'm1',
  fecha: '2026-01-01',
  categoria: 'cat_sueldo',
  tipo: 'ingreso',
  monto: 50_000,
  moneda: 'COP',
  createdAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(async () => {
  useAuthStore.setState({
    status: 'authenticated',
    user,
    session,
    drive: null,
    error: null,
    driveOptIn: 'pending',
    driveConnecting: false,
    driveError: null,
  })
})

afterEach(async () => {
  await db.vault.clear()
  await db.movimientos.clear()
  await __clearRegistryForTests()
})

describe('lockStore.reset() — what "Olvidé mi PIN" actually destroys', () => {
  it("deletes the vault but leaves the profile's movements untouched", async () => {
    await db.movimientos.put(movimiento)
    await enableLock({ pin: '1234', session, user })
    expect(await hasVault()).toBe(true)

    await useLockStore.getState().reset()

    expect(await hasVault()).toBe(false)
    expect(await db.movimientos.get('m1')).toEqual(movimiento)
  })

  it("leaves the account's profile-registry entry in place, so signing back in resolves the same profile", async () => {
    const original = await resolveGoogleProfile({ accountKey: 'sub-ana', label: 'Ana' })
    await db.movimientos.put(movimiento)
    await enableLock({ pin: '1234', session, user })

    await useLockStore.getState().reset()

    const resolvedAgain = await resolveGoogleProfile({ accountKey: 'sub-ana', label: 'Ana' })
    expect(resolvedAgain.id).toBe(original.id)
    expect(resolvedAgain.databaseName).toBe(original.databaseName)
    expect(await db.movimientos.get('m1')).toEqual(movimiento)
  })

  it('clears the device-wide "logged in before" marker, which only changes which cold-start screen renders, not whether the data is reachable', async () => {
    const { markLoggedIn, hasLoggedInBefore } = await import('@/lib/deviceStore')
    await markLoggedIn()
    expect(await hasLoggedInBefore()).toBe(true)

    await useLockStore.getState().reset()

    expect(await hasLoggedInBefore()).toBe(false)
  })
})
