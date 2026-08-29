import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
import { GuestAdoptionSection } from '@/features/profile/GuestAdoptionSection'

const TARGET_DB_NAME = 'kurobello-adoption-section-test'

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
    id: 'section-target',
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

describe('GuestAdoptionSection', () => {
  it('renders nothing on the local/guest profile — the overwhelmingly common case', async () => {
    await setActiveProfileId(DEFAULT_PROFILE_ID)
    const { container } = render(<GuestAdoptionSection />)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the real pending count on a Google profile with unadopted guest data', async () => {
    await registerGoogleTarget()
    await db.movimientos.bulkPut([movimiento(), movimiento(), movimiento()])

    render(<GuestAdoptionSection />)

    expect(await screen.findByText(/3/)).toBeInTheDocument()
  })

  it('tapping the CTA copies the data and shows a success confirmation, without an error', async () => {
    const user = userEvent.setup()
    const target = await registerGoogleTarget()
    await db.movimientos.put(movimiento({ id: 'm1' }))

    render(<GuestAdoptionSection />)
    const cta = await screen.findByRole('button')
    await user.click(cta)

    await waitFor(() => expect(screen.queryByRole('button')).not.toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    const targetDb = getProfileDatabase(target.databaseName)
    expect((await targetDb.movimientos.toArray()).map((m) => m.id)).toEqual(['m1'])
  })
})
