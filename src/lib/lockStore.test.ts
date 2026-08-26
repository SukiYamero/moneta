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
  hasGuestLock: vi.fn(),
  enableGuestLock: vi.fn(),
  disableGuestLock: vi.fn(),
  verifyGuestLock: vi.fn(),
  markGuestLockActive: vi.fn(),
  isGuestLockBackgroundExpired: vi.fn(),
  hasLoggedInBefore: vi.fn(),
  hasUsedGuestBefore: vi.fn(),
}
const hydrate = vi.fn()
const logout = vi.fn()
const authStoreSubscribe = vi.fn()
let authSession: unknown = null
let authUser: unknown = null
let authStatus = 'authenticated'

vi.mock('@/lib/pinLock', () => pinLock)
vi.mock('@/lib/authStore', () => ({
  useAuthStore: {
    getState: () => ({ hydrate, logout, session: authSession, user: authUser, status: authStatus }),
    subscribe: authStoreSubscribe,
  },
}))
const stopSyncSession = vi.fn()
const startSyncSession = vi.fn()
vi.mock('@/lib/sync/syncSession', () => ({ stopSyncSession, startSyncSession }))

const session = { accessToken: 'tok', expiresAt: 9_999_999_999_000 }
const user = { email: 'a@b.com', name: 'Ana' }

beforeEach(() => {
  vi.clearAllMocks()
  authSession = null
  authUser = null
  authStatus = 'authenticated'
})

afterEach(async () => {
  const { useLockStore } = await import('@/lib/lockStore')
  useLockStore.setState({
    phase: 'unknown',
    lockKind: null,
    biometricAvailable: false,
    biometricEnrolled: false,
    guestLockEnabled: false,
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
    expect(useLockStore.getState().lockKind).toBe('account')
  })

  test('init sets no lockKind when it lands on unlocked', async () => {
    pinLock.hasVault.mockResolvedValue(false)
    pinLock.isBiometricAvailable.mockResolvedValue(false)
    const { useLockStore } = await import('@/lib/lockStore')
    await useLockStore.getState().init()
    expect(useLockStore.getState().lockKind).toBeNull()
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

  describe('the cold-start guest gate', () => {
    test('gates the cold start on the guest lock when there is no account marker and the platform capability is live', async () => {
      pinLock.hasVault.mockResolvedValue(false)
      pinLock.isBiometricAvailable.mockResolvedValue(true)
      pinLock.hasLoggedInBefore.mockResolvedValue(false)
      pinLock.hasUsedGuestBefore.mockResolvedValue(true)
      pinLock.hasGuestLock.mockResolvedValue(true)
      const { useLockStore } = await import('@/lib/lockStore')

      await useLockStore.getState().init()

      const s = useLockStore.getState()
      expect(s.phase).toBe('locked')
      expect(s.lockKind).toBe('guest')
      expect(s.guestLockEnabled).toBe(true)
      expect(pinLock.forgetDek).toHaveBeenCalledOnce()
    })

    test('does not gate the cold start behind the guest lock when the account marker is present, even with a guest lock enrolled', async () => {
      pinLock.hasVault.mockResolvedValue(false)
      pinLock.isBiometricAvailable.mockResolvedValue(true)
      pinLock.hasLoggedInBefore.mockResolvedValue(true)
      pinLock.hasUsedGuestBefore.mockResolvedValue(true)
      pinLock.hasGuestLock.mockResolvedValue(true)
      const { useLockStore } = await import('@/lib/lockStore')

      await useLockStore.getState().init()

      const s = useLockStore.getState()
      expect(s.phase).toBe('unlocked')
      expect(s.lockKind).toBeNull()
      expect(pinLock.hasGuestLock).not.toHaveBeenCalled()
    })

    test('does not gate the cold start when the guest marker is absent, even if a guest lock row exists', async () => {
      pinLock.hasVault.mockResolvedValue(false)
      pinLock.isBiometricAvailable.mockResolvedValue(true)
      pinLock.hasLoggedInBefore.mockResolvedValue(false)
      pinLock.hasUsedGuestBefore.mockResolvedValue(false)
      const { useLockStore } = await import('@/lib/lockStore')

      await useLockStore.getState().init()

      expect(useLockStore.getState().phase).toBe('unlocked')
      expect(pinLock.hasGuestLock).not.toHaveBeenCalled()
    })

    test('degrades to unlocked and clears the stale enrollment when the platform capability is gone', async () => {
      pinLock.hasVault.mockResolvedValue(false)
      pinLock.isBiometricAvailable.mockResolvedValue(false)
      pinLock.hasLoggedInBefore.mockResolvedValue(false)
      pinLock.hasUsedGuestBefore.mockResolvedValue(true)
      pinLock.hasGuestLock.mockResolvedValue(true)
      pinLock.disableGuestLock.mockResolvedValue(undefined)
      const { useLockStore } = await import('@/lib/lockStore')

      await useLockStore.getState().init()

      const s = useLockStore.getState()
      expect(s.phase).toBe('unlocked')
      expect(s.lockKind).toBeNull()
      expect(s.guestLockEnabled).toBe(false)
      expect(pinLock.disableGuestLock).toHaveBeenCalled()
      expect(pinLock.forgetDek).not.toHaveBeenCalled()
    })
  })

  test('enable throws when there is no session', async () => {
    const { useLockStore } = await import('@/lib/lockStore')
    await expect(useLockStore.getState().enable('1234', false)).rejects.toThrow('lock: no session')
  })

  test('enable creates the vault and marks the lock enabled', async () => {
    authSession = session
    authUser = user
    pinLock.enableLock.mockResolvedValue(undefined)
    const { useLockStore } = await import('@/lib/lockStore')
    await useLockStore.getState().enable('1234', false)
    expect(pinLock.enableLock).toHaveBeenCalledWith({
      pin: '1234',
      session,
      user,
      biometric: false,
    })
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

  test('lock() stops the sync session', async () => {
    const { useLockStore } = await import('@/lib/lockStore')
    useLockStore.setState({ phase: 'unlocked', enabled: false })
    useLockStore.getState().lock()
    expect(stopSyncSession).not.toHaveBeenCalled()

    useLockStore.setState({ enabled: true })
    useLockStore.getState().lock()
    expect(stopSyncSession).toHaveBeenCalledOnce()
  })

  test('reset clears the enabled flag', async () => {
    const { useLockStore } = await import('@/lib/lockStore')
    useLockStore.setState({ phase: 'locked', enabled: true })
    await useLockStore.getState().reset()
    expect(useLockStore.getState().enabled).toBe(false)
  })

  test('unlockPin hydrates auth and unlocks', async () => {
    pinLock.unlockWithPin.mockResolvedValue({ session, user })
    const { useLockStore } = await import('@/lib/lockStore')
    useLockStore.setState({ lockKind: 'account' })
    await useLockStore.getState().unlockPin('1234')
    expect(hydrate).toHaveBeenCalledWith(session, user)
    expect(useLockStore.getState().phase).toBe('unlocked')
    expect(useLockStore.getState().lockKind).toBeNull()
  })

  test('unlockBiometric hydrates auth and unlocks', async () => {
    pinLock.unlockWithBiometric.mockResolvedValue({ session, user })
    const { useLockStore } = await import('@/lib/lockStore')
    await useLockStore.getState().unlockBiometric()
    expect(hydrate).toHaveBeenCalledWith(session, user)
    expect(useLockStore.getState().phase).toBe('unlocked')
  })

  test('resume checks hydrate’s actual outcome instead of assuming success', async () => {
    pinLock.unlockWithPin.mockResolvedValue({ session, user })
    hydrate.mockImplementation(async () => {
      authStatus = 'error'
    })
    const { useLockStore } = await import('@/lib/lockStore')
    useLockStore.setState({ phase: 'locked', error: null })

    await useLockStore.getState().unlockPin('1234')

    expect(useLockStore.getState().phase).toBe('unlocked')
    expect(useLockStore.getState().error).not.toBeNull()
  })

  test('resume reports a clean success when hydrate genuinely succeeded', async () => {
    pinLock.unlockWithPin.mockResolvedValue({ session, user })
    hydrate.mockImplementation(async () => {
      authStatus = 'authenticated'
    })
    const { useLockStore } = await import('@/lib/lockStore')
    useLockStore.setState({ phase: 'locked', error: 'stale error from a previous attempt' })

    await useLockStore.getState().unlockPin('1234')

    expect(useLockStore.getState().phase).toBe('unlocked')
    expect(useLockStore.getState().error).toBeNull()
  })

  test('a successful unlock restarts the sync session', async () => {
    pinLock.unlockWithPin.mockResolvedValue({ session, user })
    hydrate.mockImplementation(async () => {
      authStatus = 'authenticated'
    })
    const { useLockStore } = await import('@/lib/lockStore')
    useLockStore.setState({ phase: 'locked', error: null })

    await useLockStore.getState().unlockPin('1234')

    expect(startSyncSession).toHaveBeenCalledOnce()
  })

  test('a failed unlock (hydrate did not reach authenticated) does not restart the sync session', async () => {
    pinLock.unlockWithPin.mockResolvedValue({ session, user })
    hydrate.mockImplementation(async () => {
      authStatus = 'error'
    })
    const { useLockStore } = await import('@/lib/lockStore')
    useLockStore.setState({ phase: 'locked', error: null })

    await useLockStore.getState().unlockPin('1234')

    expect(startSyncSession).not.toHaveBeenCalled()
  })

  test('unlockPin passes the vault-cached profile through to hydrate, even when null', async () => {
    pinLock.unlockWithPin.mockResolvedValue({ session, user: null })
    const { useLockStore } = await import('@/lib/lockStore')

    await useLockStore.getState().unlockPin('1234')

    expect(hydrate).toHaveBeenCalledWith(session, null)
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
    expect(useLockStore.getState().lockKind).toBe('account')
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

  describe('guest biometric lock', () => {
    test('initGuestLock reads hasGuestLock into state', async () => {
      pinLock.hasGuestLock.mockResolvedValue(true)
      const { useLockStore } = await import('@/lib/lockStore')
      await useLockStore.getState().initGuestLock()
      expect(useLockStore.getState().guestLockEnabled).toBe(true)
    })

    test('initGuestLock fails open (not enrolled) when the read rejects', async () => {
      pinLock.hasGuestLock.mockRejectedValueOnce(new Error('IDB blocked'))
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { useLockStore } = await import('@/lib/lockStore')

      await useLockStore.getState().initGuestLock()

      expect(useLockStore.getState().guestLockEnabled).toBe(false)
      expect(error).toHaveBeenCalled()
      error.mockRestore()
    })

    test('enableGuestLock enrolls the credential and marks it enabled', async () => {
      pinLock.enableGuestLock.mockResolvedValue(undefined)
      const { useLockStore } = await import('@/lib/lockStore')
      await useLockStore.getState().enableGuestLock()
      expect(pinLock.enableGuestLock).toHaveBeenCalled()
      expect(useLockStore.getState().guestLockEnabled).toBe(true)
    })

    test('enableGuestLock propagates a registration failure without marking it enabled', async () => {
      pinLock.enableGuestLock.mockRejectedValue(new Error('lock: guest biometric unavailable'))
      const { useLockStore } = await import('@/lib/lockStore')
      await expect(useLockStore.getState().enableGuestLock()).rejects.toThrow()
      expect(useLockStore.getState().guestLockEnabled).toBe(false)
    })

    test('disableGuestLock clears the enrollment', async () => {
      pinLock.hasGuestLock.mockResolvedValue(false)
      const { useLockStore } = await import('@/lib/lockStore')
      useLockStore.setState({ guestLockEnabled: true })
      await useLockStore.getState().disableGuestLock()
      expect(pinLock.disableGuestLock).toHaveBeenCalled()
      expect(useLockStore.getState().guestLockEnabled).toBe(false)
    })

    test('disableGuestLock reflects a silently-failed clear rather than lying that it worked', async () => {
      pinLock.hasGuestLock.mockResolvedValue(true)
      const { useLockStore } = await import('@/lib/lockStore')
      useLockStore.setState({ guestLockEnabled: true })
      await useLockStore.getState().disableGuestLock()
      expect(pinLock.disableGuestLock).toHaveBeenCalled()
      expect(useLockStore.getState().guestLockEnabled).toBe(true)
    })

    test('unlockGuest unlocks on a successful assertion', async () => {
      pinLock.verifyGuestLock.mockResolvedValue(undefined)
      const { useLockStore } = await import('@/lib/lockStore')
      useLockStore.setState({ phase: 'locked', lockKind: 'guest', error: 'stale' })

      await useLockStore.getState().unlockGuest()

      expect(useLockStore.getState().phase).toBe('unlocked')
      expect(useLockStore.getState().error).toBeNull()
      expect(useLockStore.getState().lockKind).toBeNull()
    })

    test('unlockGuest sets an error and stays locked on a failed assertion, never wiping anything', async () => {
      pinLock.verifyGuestLock.mockRejectedValue(new Error('lock: guest biometric unavailable'))
      pinLock.isBiometricAvailable.mockResolvedValue(true)
      const { useLockStore } = await import('@/lib/lockStore')
      useLockStore.setState({ phase: 'locked', error: null })

      await useLockStore.getState().unlockGuest()

      expect(useLockStore.getState().phase).toBe('locked')
      expect(useLockStore.getState().error).toBe('lock: guest biometric unavailable')
      expect(pinLock.resetVault).not.toHaveBeenCalled()
      expect(logout).not.toHaveBeenCalled()
      expect(pinLock.disableGuestLock).not.toHaveBeenCalled()
    })

    // WebAuthn can't distinguish "no matching credential" from "user cancelled" (privacy).
    test('unlockGuest degrades to unlocked and clears the stale enrollment when the platform capability is gone', async () => {
      pinLock.verifyGuestLock.mockRejectedValue(new Error('AbortError'))
      pinLock.isBiometricAvailable.mockResolvedValue(false)
      pinLock.disableGuestLock.mockResolvedValue(undefined)
      const { useLockStore } = await import('@/lib/lockStore')
      useLockStore.setState({
        phase: 'locked',
        lockKind: 'guest',
        guestLockEnabled: true,
        error: null,
      })

      await useLockStore.getState().unlockGuest()

      const s = useLockStore.getState()
      expect(s.phase).toBe('unlocked')
      expect(s.lockKind).toBeNull()
      expect(s.guestLockEnabled).toBe(false)
      expect(s.error).toBeNull()
      expect(pinLock.disableGuestLock).toHaveBeenCalled()
    })

    test('onHidden touches the guest lock, not the account vault, for a guest', async () => {
      authStatus = 'guest'
      const { useLockStore } = await import('@/lib/lockStore')
      useLockStore.setState({ phase: 'unlocked', guestLockEnabled: true })

      useLockStore.getState().onHidden()

      expect(pinLock.markGuestLockActive).toHaveBeenCalled()
      expect(pinLock.markActive).not.toHaveBeenCalled()
    })

    test('onHidden does nothing for a guest with no guest lock enrolled', async () => {
      authStatus = 'guest'
      const { useLockStore } = await import('@/lib/lockStore')
      useLockStore.setState({ phase: 'unlocked', guestLockEnabled: false })

      useLockStore.getState().onHidden()

      expect(pinLock.markGuestLockActive).not.toHaveBeenCalled()
    })

    test('onVisible re-locks a guest after background expiry', async () => {
      authStatus = 'guest'
      pinLock.isGuestLockBackgroundExpired.mockResolvedValue(true)
      const { useLockStore } = await import('@/lib/lockStore')
      useLockStore.setState({ phase: 'unlocked', guestLockEnabled: true })

      await useLockStore.getState().onVisible()

      expect(useLockStore.getState().phase).toBe('locked')
      expect(useLockStore.getState().lockKind).toBe('guest')
      expect(pinLock.isBackgroundExpired).not.toHaveBeenCalled()
    })

    test('onVisible never re-locks a guest with no guest lock enrolled', async () => {
      authStatus = 'guest'
      const { useLockStore } = await import('@/lib/lockStore')
      useLockStore.setState({ phase: 'unlocked', guestLockEnabled: false })

      await useLockStore.getState().onVisible()

      expect(useLockStore.getState().phase).toBe('unlocked')
      expect(pinLock.isGuestLockBackgroundExpired).not.toHaveBeenCalled()
    })

    test('onVisible re-locks a guest (fails closed) when isGuestLockBackgroundExpired() rejects', async () => {
      authStatus = 'guest'
      pinLock.isGuestLockBackgroundExpired.mockRejectedValueOnce(new Error('IDB blocked'))
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { useLockStore } = await import('@/lib/lockStore')
      useLockStore.setState({ phase: 'unlocked', guestLockEnabled: true })

      await expect(useLockStore.getState().onVisible()).resolves.toBeUndefined()

      expect(useLockStore.getState().phase).toBe('locked')
      expect(error).toHaveBeenCalled()
      error.mockRestore()
    })
  })

  test('clearError clears a stale error without touching phase or enabled', async () => {
    const { useLockStore, LOCKED_OUT_ERROR } = await import('@/lib/lockStore')
    useLockStore.setState({ phase: 'unlocked', enabled: false, error: LOCKED_OUT_ERROR })

    useLockStore.getState().clearError()

    expect(useLockStore.getState().error).toBeNull()
    expect(useLockStore.getState().phase).toBe('unlocked')
  })

  describe('logout-relock subscription', () => {
    test('resets to unlocked/disabled when status settles on idle with a newly-cleared session', async () => {
      vi.resetModules()
      const { useLockStore } = await import('@/lib/lockStore')
      useLockStore.setState({ phase: 'unlocked', enabled: true })

      const listener = authStoreSubscribe.mock.calls.at(-1)![0] as (
        state: { status: string; session: unknown },
        prevState: { status: string; session: unknown },
      ) => void
      listener(
        { status: 'idle', session: null },
        { status: 'authenticated', session: { accessToken: 'tok', expiresAt: 1 } },
      )

      expect(useLockStore.getState().phase).toBe('unlocked')
      expect(useLockStore.getState().enabled).toBe(false)
      expect(pinLock.forgetDek).toHaveBeenCalled()
    })

    test('forgets the DEK and stays unlocked/disabled even when the lock was never enabled', async () => {
      vi.resetModules()
      const { useLockStore } = await import('@/lib/lockStore')
      useLockStore.setState({ phase: 'unlocked', enabled: false })

      const listener = authStoreSubscribe.mock.calls.at(-1)![0] as (
        state: { status: string; session: unknown },
        prevState: { status: string; session: unknown },
      ) => void
      listener(
        { status: 'idle', session: null },
        { status: 'authenticated', session: { accessToken: 'tok', expiresAt: 1 } },
      )

      expect(useLockStore.getState().phase).toBe('unlocked')
      expect(useLockStore.getState().enabled).toBe(false)
      expect(pinLock.forgetDek).toHaveBeenCalled()
    })

    test('does not fire on an idle-to-idle transition with no session change', async () => {
      vi.resetModules()
      const { useLockStore } = await import('@/lib/lockStore')
      useLockStore.setState({ phase: 'unlocked', enabled: true })

      const listener = authStoreSubscribe.mock.calls.at(-1)![0] as (
        state: { status: string; session: unknown },
        prevState: { status: string; session: unknown },
      ) => void
      listener({ status: 'idle', session: null }, { status: 'idle', session: null })

      expect(useLockStore.getState().phase).toBe('unlocked')
      expect(pinLock.forgetDek).not.toHaveBeenCalled()
    })
  })
})
