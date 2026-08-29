import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { db } from '@/lib/db'
import { deviceDb } from '@/lib/deviceStore'
import type { Movimiento } from '@/lib/schema'
import {
  __clearProfileDatabaseCacheForTests,
  __clearRegistryForTests,
  DEFAULT_PROFILE_ID,
  getProfileDatabase,
  registerProfile,
  setActiveProfileId,
} from '@/lib/profiles'
import { useGuestAdoptionEntry } from '@/features/profile/useGuestAdoptionEntry'

const TARGET_DB_NAME = 'kurobello-adoption-entry-test'

const movimiento = (overrides: Partial<Movimiento> = {}): Movimiento => ({
  id: crypto.randomUUID(),
  fecha: '2026-08-01',
  categoria: 'cat_sueldo',
  tipo: 'ingreso',
  monto: 1000,
  moneda: 'COP',
  createdAt: '2026-08-01T00:00:00.000Z',
  ...overrides,
})

const registerGoogleTarget = async () => {
  const record = await registerProfile({
    id: 'entry-target',
    label: 'Ana',
    kind: 'google',
    databaseName: TARGET_DB_NAME,
  })
  await setActiveProfileId(record.id)
  return record
}

afterEach(async () => {
  await db.movimientos.clear()
  await db.outbox.clear()
  const targetDb = getProfileDatabase(TARGET_DB_NAME)
  await targetDb.movimientos.clear()
  await targetDb.outbox.clear()
  __clearProfileDatabaseCacheForTests(TARGET_DB_NAME)
  await __clearRegistryForTests()
  await deviceDb.adoptedMovements.clear()
})

describe('useGuestAdoptionEntry', () => {
  it('stays hidden when the active profile is the local/guest one', async () => {
    await setActiveProfileId(DEFAULT_PROFILE_ID)
    await db.movimientos.put(movimiento())

    const { result } = renderHook(() => useGuestAdoptionEntry())

    await waitFor(() => expect(result.current.visible).toBe(false))
    expect(result.current.phase).toBe('idle')
  })

  it('stays hidden when the active profile is Google-authenticated but has nothing pending to adopt', async () => {
    await registerGoogleTarget()

    const { result } = renderHook(() => useGuestAdoptionEntry())

    await waitFor(() => expect(result.current.count).toBe(0))
    expect(result.current.visible).toBe(false)
  })

  it('becomes visible with the real count when the active profile is Google-authenticated and guest data is pending', async () => {
    await registerGoogleTarget()
    await db.movimientos.bulkPut([movimiento(), movimiento()])

    const { result } = renderHook(() => useGuestAdoptionEntry())

    await waitFor(() => expect(result.current.visible).toBe(true))
    expect(result.current.count).toBe(2)
  })

  it('adopting copies the guest movements into the target without removing them from the guest profile', async () => {
    const target = await registerGoogleTarget()
    const guestMovements = [movimiento({ id: 'm1' }), movimiento({ id: 'm2' })]
    await db.movimientos.bulkPut(guestMovements)

    const { result } = renderHook(() => useGuestAdoptionEntry())
    await waitFor(() => expect(result.current.visible).toBe(true))

    await act(() => result.current.adopt())

    expect(result.current.phase).toBe('success')
    expect(result.current.adoptedCount).toBe(2)
    const targetDb = getProfileDatabase(target.databaseName)
    expect((await targetDb.movimientos.toArray()).map((m) => m.id).toSorted()).toEqual(
      ['m1', 'm2'].toSorted(),
    )
    expect((await db.movimientos.toArray()).map((m) => m.id).toSorted()).toEqual(
      ['m1', 'm2'].toSorted(),
    )
  })

  it('has nothing left to show once everything pending has been adopted', async () => {
    await registerGoogleTarget()
    await db.movimientos.put(movimiento({ id: 'm1' }))

    const { result } = renderHook(() => useGuestAdoptionEntry())
    await waitFor(() => expect(result.current.visible).toBe(true))
    await act(() => result.current.adopt())

    expect(result.current.count).toBe(0)
  })

  it('surfaces a failure without losing the pending count, so a retry is still offered', async () => {
    const target = await registerGoogleTarget()
    await db.movimientos.put(movimiento({ id: 'm1' }))
    const targetDb = getProfileDatabase(target.databaseName)
    const addSpy = vi.spyOn(targetDb.outbox, 'add').mockRejectedValueOnce(new Error('tab closed'))

    const { result } = renderHook(() => useGuestAdoptionEntry())
    await waitFor(() => expect(result.current.visible).toBe(true))

    await act(() => result.current.adopt())

    expect(result.current.error).toBe('adoption: could not queue movement "m1" for Drive')
    expect(result.current.phase).toBe('idle')
    expect(result.current.visible).toBe(true)
    expect(result.current.count).toBe(1)

    addSpy.mockRestore()
  })
})
