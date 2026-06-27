import { afterEach, expect, test } from 'vitest'
import { db } from '@/lib/db'
import {
  enableLock,
  hasVault,
  unlockWithPin,
  WrongPinError,
  LockedOutError,
  resetVault,
} from '@/lib/pinLock'
import type { AuthSession } from '@/lib/auth'

const session: AuthSession = { accessToken: 'tok-abc', expiresAt: 9_999_999_999_000 }

afterEach(async () => {
  await db.vault.clear()
})

test('enable then unlock with the correct PIN returns the session', async () => {
  expect(await hasVault()).toBe(false)
  await enableLock({ pin: '1234', session })
  expect(await hasVault()).toBe(true)

  const unlocked = await unlockWithPin('1234')
  expect(unlocked).toEqual(session)
})

test('wrong PIN throws WrongPinError', async () => {
  await enableLock({ pin: '1234', session })
  await expect(unlockWithPin('0000')).rejects.toBeInstanceOf(WrongPinError)
})

test('five wrong PINs lock out further attempts', async () => {
  await enableLock({ pin: '1234', session })
  for (let i = 0; i < 5; i++) {
    await expect(unlockWithPin('0000')).rejects.toBeInstanceOf(WrongPinError)
  }
  await expect(unlockWithPin('1234')).rejects.toBeInstanceOf(LockedOutError)
})

test('a correct PIN resets the failed-attempt counter', async () => {
  await enableLock({ pin: '1234', session })
  await expect(unlockWithPin('0000')).rejects.toBeInstanceOf(WrongPinError)
  await unlockWithPin('1234')
  await expect(unlockWithPin('0000')).rejects.toBeInstanceOf(WrongPinError)
  const after = await db.vault.get(1)
  expect(after?.failedAttempts).toBe(1)
})

test('four wrong PINs then a correct PIN still unlocks and resets the counter', async () => {
  await enableLock({ pin: '1234', session })
  for (let i = 0; i < 4; i++) {
    await expect(unlockWithPin('0000')).rejects.toBeInstanceOf(WrongPinError)
  }
  expect(await unlockWithPin('1234')).toEqual(session)
  await expect(unlockWithPin('0000')).rejects.toBeInstanceOf(WrongPinError)
  const after = await db.vault.get(1)
  expect(after?.failedAttempts).toBe(1)
})

test('resetVault wipes the vault', async () => {
  await enableLock({ pin: '1234', session })
  await resetVault()
  expect(await hasVault()).toBe(false)
})
