import { afterEach, expect, test } from 'vitest'
import { db } from '@/lib/db'
import { enableLock, hasVault, unlockWithPin, WrongPinError } from '@/lib/pinLock'
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
