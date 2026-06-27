import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const pinLock = {
  hasVault: vi.fn(),
  isBiometricAvailable: vi.fn(),
  enableLock: vi.fn(),
  unlockWithPin: vi.fn(),
  unlockWithBiometric: vi.fn(),
  resetVault: vi.fn(),
  markActive: vi.fn(),
  isBackgroundExpired: vi.fn(),
  LockedOutError: class LockedOutError extends Error {},
}
const hydrate = vi.fn()
const logout = vi.fn()

vi.mock('@/lib/pinLock', () => pinLock)
vi.mock('@/lib/authStore', () => ({
  useAuthStore: { getState: () => ({ hydrate, logout }) },
}))

const session = { accessToken: 'tok', expiresAt: 9_999_999_999_000 }

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(async () => {
  const { useLockStore } = await import('@/lib/lockStore')
  useLockStore.setState({ phase: 'unknown', biometricAvailable: false, error: null })
})

describe('useLockStore', () => {
  test('init locks when a vault exists', async () => {
    pinLock.hasVault.mockResolvedValue(true)
    pinLock.isBiometricAvailable.mockResolvedValue(true)
    const { useLockStore } = await import('@/lib/lockStore')
    await useLockStore.getState().init()
    expect(useLockStore.getState().phase).toBe('locked')
    expect(useLockStore.getState().biometricAvailable).toBe(true)
  })

  test('init unlocks when no vault exists', async () => {
    pinLock.hasVault.mockResolvedValue(false)
    pinLock.isBiometricAvailable.mockResolvedValue(false)
    const { useLockStore } = await import('@/lib/lockStore')
    await useLockStore.getState().init()
    expect(useLockStore.getState().phase).toBe('unlocked')
  })

  test('enable throws when there is no session', async () => {
    const { useLockStore } = await import('@/lib/lockStore')
    await expect(useLockStore.getState().enable('1234', false)).rejects.toThrow('lock: no session')
  })

  test('unlockPin hydrates auth and unlocks', async () => {
    pinLock.unlockWithPin.mockResolvedValue(session)
    const { useLockStore } = await import('@/lib/lockStore')
    await useLockStore.getState().unlockPin('1234')
    expect(hydrate).toHaveBeenCalledWith(session)
    expect(useLockStore.getState().phase).toBe('unlocked')
  })

  test('unlockBiometric hydrates auth and unlocks', async () => {
    pinLock.unlockWithBiometric.mockResolvedValue(session)
    const { useLockStore } = await import('@/lib/lockStore')
    await useLockStore.getState().unlockBiometric()
    expect(hydrate).toHaveBeenCalledWith(session)
    expect(useLockStore.getState().phase).toBe('unlocked')
  })

  test('wrong pin sets error without changing phase', async () => {
    pinLock.unlockWithPin.mockRejectedValue(new Error('wrong pin'))
    const { useLockStore } = await import('@/lib/lockStore')
    useLockStore.setState({ phase: 'locked' })
    await useLockStore.getState().unlockPin('9999')
    expect(useLockStore.getState().phase).toBe('locked')
    expect(useLockStore.getState().error).toBe('wrong pin')
  })

  test('lockout resets the vault and logs out', async () => {
    pinLock.unlockWithPin.mockRejectedValue(new pinLock.LockedOutError())
    const { useLockStore } = await import('@/lib/lockStore')
    await useLockStore.getState().unlockPin('0000')
    expect(pinLock.resetVault).toHaveBeenCalled()
    expect(logout).toHaveBeenCalled()
    expect(useLockStore.getState().phase).toBe('locked')
  })

  test('onHidden marks active only when unlocked', async () => {
    const { useLockStore } = await import('@/lib/lockStore')
    useLockStore.setState({ phase: 'locked' })
    useLockStore.getState().onHidden()
    expect(pinLock.markActive).not.toHaveBeenCalled()
    useLockStore.setState({ phase: 'unlocked' })
    useLockStore.getState().onHidden()
    expect(pinLock.markActive).toHaveBeenCalled()
  })

  test('onVisible re-locks after background expiry', async () => {
    pinLock.isBackgroundExpired.mockResolvedValue(true)
    const { useLockStore } = await import('@/lib/lockStore')
    useLockStore.setState({ phase: 'unlocked' })
    await useLockStore.getState().onVisible()
    expect(useLockStore.getState().phase).toBe('locked')
  })
})
