import { afterEach, expect, test } from 'vitest'
import { db, VAULT_ID, type LockVault } from '@/lib/db'

afterEach(async () => {
  await db.vault.clear()
})

function sampleVault(): LockVault {
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
