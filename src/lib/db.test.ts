import { afterEach, expect, test } from 'vitest'
import { db, VAULT_ID, type LockVault } from '@/lib/db'

afterEach(async () => {
  await db.vault.clear()
  await db.movimientos.clear()
  await db.activos.clear()
  await db.config.clear()
})

const sampleVault = (): LockVault => {
  return {
    schemaVersion: 1,
    tokenCipher: new Uint8Array([1, 2, 3]),
    tokenIv: new Uint8Array([4, 5, 6]),
    pinSalt: new Uint8Array([7, 8, 9]),
    pinIterations: 310_000,
    dekWrappedByPin: new Uint8Array([10, 11, 12]),
    pinWrapIv: new Uint8Array([13, 14, 15]),
    failedAttempts: 0,
    lastActiveAt: 0,
  }
}

test('vault round-trips through IndexedDB', async () => {
  await db.vault.put({ id: VAULT_ID, ...sampleVault() })
  const read = await db.vault.get(VAULT_ID)
  expect(read?.tokenCipher).toEqual(new Uint8Array([1, 2, 3]))
  expect(read?.failedAttempts).toBe(0)
})

test('v2 upgrade is additive: vault survives alongside the new tables', async () => {
  expect(db.verno).toBe(2)
  expect(db.tables.map((t) => t.name).toSorted()).toEqual(
    ['activos', 'config', 'movimientos', 'vault'].toSorted(),
  )
  await db.vault.put({ id: VAULT_ID, ...sampleVault() })
  await db.movimientos.put({
    id: 'm1',
    fecha: '2026-01-01',
    seccion: 'sec_personal',
    categoria: 'cat_sueldo',
    tipo: 'ingreso',
    monto: 1000,
    moneda: 'COP',
    createdAt: '2026-01-01T00:00:00.000Z',
  })
  expect(await db.vault.get(VAULT_ID)).toBeDefined()
  expect(await db.movimientos.get('m1')).toBeDefined()
})

test('movimientos supports a seccion+fecha compound-index range query', async () => {
  await db.movimientos.bulkPut([
    {
      id: 'm1',
      fecha: '2026-01-01',
      seccion: 'sec_trabajo',
      categoria: 'cat_sueldo',
      tipo: 'ingreso',
      monto: 1000,
      moneda: 'COP',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'm2',
      fecha: '2026-06-01',
      seccion: 'sec_trabajo',
      categoria: 'cat_sueldo',
      tipo: 'ingreso',
      monto: 1000,
      moneda: 'COP',
      createdAt: '2026-06-01T00:00:00.000Z',
    },
  ])
  const inRange = await db.movimientos
    .where('[seccion+fecha]')
    .between(['sec_trabajo', '2026-01-01'], ['sec_trabajo', '2026-02-01'], true, true)
    .toArray()
  expect(inRange.map((m) => m.id)).toEqual(['m1'])
})
