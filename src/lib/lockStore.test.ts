import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const pinLock = {
  hasVault: vi.fn(),
  isBiometricAvailable: vi.fn(),
  biometricEnabled: vi.fn(),
  enableLock: vi.fn(),
  unlockWithPin: vi.fn(),
  unlockWithBiometric: vi.fn(),
  resetVault: vi.fn(),
  markActive: vi.fn(),
  isBackgroundExpired: vi.fn(),
  forgetDek: vi.fn(),
  LockedOutError: class LockedOutError extends Error {},
}
const hydrate = vi.fn()
const logout = vi.fn()
let authSession: unknown = null
// hydrate() (a real authStore action) resolves into `status: 'error'` on
// failure instead of throwing — this mock lets tests drive that outcome so
// resume() can be tested against the actual contract, not an assumption.
let authStatus = 'authenticated'

vi.mock('@/lib/pinLock', () => pinLock)
vi.mock('@/lib/authStore', () => ({
  useAuthStore: { getState: () => ({ hydrate, logout, session: authSession, status: authStatus }) },
}))

const session = { accessToken: 'tok', expiresAt: 9_999_999_999_000 }

beforeEach(() => {
  vi.clearAllMocks()
  authSession = null
  authStatus = 'authenticated'
})

afterEach(async () => {
  const { useLockStore } = await import('@/lib/lockStore')
  useLockStore.setState({
    phase: 'unknown',
    biometricAvailable: false,
    biometricEnrolled: false,
    error: null,
    enabled: false,
  })
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

  test('init forgets any DEK before landing on the locked phase', async () => {
    pinLock.hasVault.mockResolvedValue(true)
    pinLock.isBiometricAvailable.mockResolvedValue(false)
    const { useLockStore } = await import('@/lib/lockStore')
    await useLockStore.getState().init()
    expect(pinLock.forgetDek).toHaveBeenCalledOnce()
  })

  test('init unlocks when no vault exists', async () => {
    pinLock.hasVault.mockResolvedValue(false)
    pinLock.isBiometricAvailable.mockResolvedValue(false)
    const { useLockStore } = await import('@/lib/lockStore')
    await useLockStore.getState().init()
    expect(useLockStore.getState().phase).toBe('unlocked')
    expect(useLockStore.getState().enabled).toBe(false)
    expect(pinLock.forgetDek).not.toHaveBeenCalled()
  })

  test('init reports enabled when a vault exists', async () => {
    pinLock.hasVault.mockResolvedValue(true)
    pinLock.isBiometricAvailable.mockResolvedValue(false)
    const { useLockStore } = await import('@/lib/lockStore')
    await useLockStore.getState().init()
    expect(useLockStore.getState().enabled).toBe(true)
  })

  // Finding 1 (CRITICAL): hasVault() is a raw IndexedDB read with no guard
  // of its own. Before this fix, its rejection propagated out of init()
  // entirely, `set()` never ran, phase stayed 'unknown' forever, and
  // AppLock — which wraps the whole RouterProvider — rendered null forever:
  // an unrecoverable white screen with no error boundary able to catch it
  // (it's an unhandled rejection in a useEffect, not a render throw).
  test('init still lands on a renderable phase when hasVault() rejects', async () => {
    pinLock.hasVault.mockRejectedValueOnce(new Error('IDB blocked in private mode'))
    pinLock.isBiometricAvailable.mockResolvedValue(false)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { useLockStore } = await import('@/lib/lockStore')

    await useLockStore.getState().init()

    expect(useLockStore.getState().phase).toBe('unlocked')
    expect(useLockStore.getState().enabled).toBe(false)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  test('init still lands on a renderable phase when isBiometricAvailable() rejects unexpectedly', async () => {
    pinLock.hasVault.mockResolvedValue(false)
    pinLock.isBiometricAvailable.mockRejectedValueOnce(new Error('unexpected'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { useLockStore } = await import('@/lib/lockStore')

    await useLockStore.getState().init()

    expect(useLockStore.getState().phase).toBe('unlocked')
    error.mockRestore()
  })

  // Finding 9 (LOW): the biometric button was gated on platform capability
  // (`isBiometricAvailable`) instead of whether *this vault* enrolled
  // biometrics (`pinLock.biometricEnabled`) — a user who declined biometrics
  // still saw a button that always fails.
  test('init reports biometricEnrolled from the vault, independent of platform capability', async () => {
    pinLock.hasVault.mockResolvedValue(true)
    pinLock.isBiometricAvailable.mockResolvedValue(true)
    pinLock.biometricEnabled.mockResolvedValue(false)
    const { useLockStore } = await import('@/lib/lockStore')

    await useLockStore.getState().init()

    expect(useLockStore.getState().biometricAvailable).toBe(true)
    expect(useLockStore.getState().biometricEnrolled).toBe(false)
  })

  test('init sets biometricEnrolled true once the vault has biometrics enrolled', async () => {
    pinLock.hasVault.mockResolvedValue(true)
    pinLock.isBiometricAvailable.mockResolvedValue(true)
    pinLock.biometricEnabled.mockResolvedValue(true)
    const { useLockStore } = await import('@/lib/lockStore')

    await useLockStore.getState().init()

    expect(useLockStore.getState().biometricEnrolled).toBe(true)
  })

  test('init does not consult vault-level biometric enrollment when there is no vault', async () => {
    pinLock.hasVault.mockResolvedValue(false)
    pinLock.isBiometricAvailable.mockResolvedValue(true)
    const { useLockStore } = await import('@/lib/lockStore')

    await useLockStore.getState().init()

    expect(pinLock.biometricEnabled).not.toHaveBeenCalled()
    expect(useLockStore.getState().biometricEnrolled).toBe(false)
  })

  test('enable throws when there is no session', async () => {
    const { useLockStore } = await import('@/lib/lockStore')
    await expect(useLockStore.getState().enable('1234', false)).rejects.toThrow('lock: no session')
  })

  test('enable creates the vault and marks the lock enabled', async () => {
    authSession = session
    pinLock.enableLock.mockResolvedValue(undefined)
    const { useLockStore } = await import('@/lib/lockStore')
    await useLockStore.getState().enable('1234', false)
    expect(pinLock.enableLock).toHaveBeenCalledWith({ pin: '1234', session, biometric: false })
    expect(useLockStore.getState().enabled).toBe(true)
    expect(useLockStore.getState().phase).toBe('unlocked')
  })

  test('lock re-locks only when enabled', async () => {
    const { useLockStore } = await import('@/lib/lockStore')
    useLockStore.setState({ phase: 'unlocked', enabled: false })
    useLockStore.getState().lock()
    expect(useLockStore.getState().phase).toBe('unlocked')
    expect(pinLock.forgetDek).not.toHaveBeenCalled()
    useLockStore.setState({ enabled: true })
    useLockStore.getState().lock()
    expect(useLockStore.getState().phase).toBe('locked')
    expect(pinLock.forgetDek).toHaveBeenCalledOnce()
  })

  test('reset clears the enabled flag', async () => {
    const { useLockStore } = await import('@/lib/lockStore')
    useLockStore.setState({ phase: 'locked', enabled: true })
    await useLockStore.getState().reset()
    expect(useLockStore.getState().enabled).toBe(false)
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

  // Finding 3 (HIGH): resume() used to infer success from "hydrate() didn't
  // throw" — but hydrate() owns its own errors and resolves into
  // `status: 'error'` instead (docs/error-handling.md's documented pattern).
  // A correct PIN unlocking a vault whose cached token has since expired
  // must not be reported as a clean success.
  test('resume checks hydrate’s actual outcome instead of assuming success', async () => {
    pinLock.unlockWithPin.mockResolvedValue(session)
    hydrate.mockImplementation(async () => {
      authStatus = 'error'
    })
    const { useLockStore } = await import('@/lib/lockStore')
    useLockStore.setState({ phase: 'locked', error: null })

    await useLockStore.getState().unlockPin('1234')

    // The PIN itself was correct — no reason to demand it again.
    expect(useLockStore.getState().phase).toBe('unlocked')
    // But it must not claim a clean success it didn't get.
    expect(useLockStore.getState().error).not.toBeNull()
  })

  test('resume reports a clean success when hydrate genuinely succeeded', async () => {
    pinLock.unlockWithPin.mockResolvedValue(session)
    hydrate.mockImplementation(async () => {
      authStatus = 'authenticated'
    })
    const { useLockStore } = await import('@/lib/lockStore')
    useLockStore.setState({ phase: 'locked', error: 'stale error from a previous attempt' })

    await useLockStore.getState().unlockPin('1234')

    expect(useLockStore.getState().phase).toBe('unlocked')
    expect(useLockStore.getState().error).toBeNull()
  })

  test('wrong pin sets error without changing phase', async () => {
    pinLock.unlockWithPin.mockRejectedValue(new Error('wrong pin'))
    const { useLockStore } = await import('@/lib/lockStore')
    useLockStore.setState({ phase: 'locked' })
    await useLockStore.getState().unlockPin('9999')
    expect(useLockStore.getState().phase).toBe('locked')
    expect(useLockStore.getState().error).toBe('wrong pin')
  })

  test('lockout resets the vault, logs out, and unlocks for fresh login', async () => {
    pinLock.unlockWithPin.mockRejectedValue(new pinLock.LockedOutError())
    const { useLockStore } = await import('@/lib/lockStore')
    await useLockStore.getState().unlockPin('0000')
    expect(pinLock.resetVault).toHaveBeenCalled()
    expect(logout).toHaveBeenCalled()
    expect(useLockStore.getState().phase).toBe('unlocked')
  })

  // Sweep (category 1): resume()'s LockedOutError branch does more async
  // work (resetVault()) inside a catch block that itself wasn't guarded —
  // its rejection would have escaped resume() entirely as an unhandled
  // rejection from a `void unlockPin(pin)` call site in LockScreen.
  test('lockout still lands on a renderable, logged-out state even if resetVault() itself fails', async () => {
    pinLock.unlockWithPin.mockRejectedValue(new pinLock.LockedOutError())
    pinLock.resetVault.mockRejectedValueOnce(new Error('IDB blocked'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { useLockStore } = await import('@/lib/lockStore')

    await expect(useLockStore.getState().unlockPin('0000')).resolves.toBeUndefined()

    expect(logout).toHaveBeenCalled()
    expect(useLockStore.getState().phase).toBe('unlocked')
    expect(useLockStore.getState().enabled).toBe(false)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  test('reset wipes the vault, logs out, and unlocks for fresh login', async () => {
    const { useLockStore } = await import('@/lib/lockStore')
    useLockStore.setState({ phase: 'locked' })
    await useLockStore.getState().reset()
    expect(pinLock.resetVault).toHaveBeenCalled()
    expect(logout).toHaveBeenCalled()
    expect(useLockStore.getState().phase).toBe('unlocked')
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
    expect(pinLock.forgetDek).toHaveBeenCalledOnce()
  })

  test('onVisible does not touch the DEK when the background timeout has not elapsed', async () => {
    pinLock.isBackgroundExpired.mockResolvedValue(false)
    const { useLockStore } = await import('@/lib/lockStore')
    useLockStore.setState({ phase: 'unlocked' })
    await useLockStore.getState().onVisible()
    expect(useLockStore.getState().phase).toBe('unlocked')
    expect(pinLock.forgetDek).not.toHaveBeenCalled()
  })

  // Sweep (category 1): an unguarded await feeding a state transition.
  // isBackgroundExpired() is a raw IndexedDB read; if it rejects mid-session
  // (same storage failures as finding 1), the old code let the rejection
  // escape from a `void onVisible()` call site in AppLock's visibilitychange
  // listener and silently skipped the re-lock `set()`. Fail closed instead —
  // the 5-attempt PIN throttle is this app's whole brute-force defense
  // (specs.md §5), so an ambiguous read must not default to "stay unlocked."
  test('onVisible re-locks (fails closed) when isBackgroundExpired() itself rejects', async () => {
    pinLock.isBackgroundExpired.mockRejectedValueOnce(new Error('IDB blocked'))
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { useLockStore } = await import('@/lib/lockStore')
    useLockStore.setState({ phase: 'unlocked' })

    await expect(useLockStore.getState().onVisible()).resolves.toBeUndefined()

    expect(useLockStore.getState().phase).toBe('locked')
    expect(pinLock.forgetDek).toHaveBeenCalledOnce()
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  test('clearError clears a stale error without touching phase or enabled', async () => {
    const { useLockStore, LOCKED_OUT_ERROR } = await import('@/lib/lockStore')
    useLockStore.setState({ phase: 'unlocked', enabled: false, error: LOCKED_OUT_ERROR })

    useLockStore.getState().clearError()

    expect(useLockStore.getState().error).toBeNull()
    expect(useLockStore.getState().phase).toBe('unlocked')
  })
})
