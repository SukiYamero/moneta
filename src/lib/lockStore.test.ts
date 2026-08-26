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
// hydrate() (a real authStore action) resolves into `status: 'error'` on
// failure instead of throwing — this mock lets tests drive that outcome so
// resume() can be tested against the actual contract, not an assumption.
let authStatus = 'authenticated'

vi.mock('@/lib/pinLock', () => pinLock)
vi.mock('@/lib/authStore', () => ({
  useAuthStore: {
    getState: () => ({ hydrate, logout, session: authSession, user: authUser, status: authStatus }),
    // lockStore.ts subscribes to this at module scope — a bare vi.fn() here
    // just needs to exist so that call doesn't throw; the subscription
    // tests below capture the registered listener directly instead of
    // exercising a real zustand store.
    subscribe: authStoreSubscribe,
  },
}))
const stopSyncSession = vi.fn()
const startSyncSession = vi.fn()
// Isolates this suite from the real sync engine/repoProvider/i18n chain
// syncSession.ts otherwise pulls in — lockStore.ts's only use of it is the
// stop-on-lock/start-on-unlock calls under test below.
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

  // hasVault() is a raw IndexedDB read with no guard of its own: a rejection
  // must still land on a renderable phase — an unhandled rejection here
  // would leave phase 'unknown' forever, and AppLock (wrapping the whole
  // RouterProvider) renders null forever with no error boundary to catch it.
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

  // The biometric button must reflect whether *this vault* enrolled
  // biometrics (`pinLock.biometricEnabled`), not just platform capability
  // (`isBiometricAvailable`) — otherwise a user who declined biometrics
  // still sees a button that always fails.
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

  // The guest lock can stand in front of a cold start — but only when
  // there's no account marker (the account wins on restore) and the
  // platform credential can actually still succeed (there's no PIN fallback
  // for a guest, so a dead credential must never gate anything).
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

    // A revoked credential or a disabled sensor must never lock a guest out
    // of their own local data — there is no PIN fallback to recover with.
    // Live capability, not the stored enrollment alone, decides.
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

  // Locking never touches authStore, so syncSession.ts's own authStore
  // subscription structurally cannot see this transition — lock() must
  // stop the sync session itself.
  test('lock() stops the sync session', async () => {
    const { useLockStore } = await import('@/lib/lockStore')
    useLockStore.setState({ phase: 'unlocked', enabled: false })
    useLockStore.getState().lock() // disabled — no-op, must not stop anything
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

  // unlockPin() must check hydrate()'s actual outcome, not assume success
  // from "didn't throw" — hydrate() owns its own errors and resolves into
  // `status: 'error'` instead. A correct PIN unlocking a vault whose cached
  // token has since expired must not be reported as a clean success.
  test('resume checks hydrate’s actual outcome instead of assuming success', async () => {
    pinLock.unlockWithPin.mockResolvedValue({ session, user })
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

  // lock()'s stopSyncSession() has no authStore-subscription counterpart to
  // undo it, since hydrate() re-sets status/drive to the exact values a
  // lock never touched — a successful unlock must restart it explicitly.
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

  // A correct PIN with no network must reach 'authenticated' through
  // hydrate() — which requires the vault-cached profile to reach it too.
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

  // resetVault() runs inside unlockPin()'s LockedOutError branch and must
  // itself be guarded — an unguarded rejection here would escape as an
  // unhandled rejection from LockScreen's `void unlockPin(pin)` call site.
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

  // isBackgroundExpired() is a raw IndexedDB read; a rejection must fail
  // closed (re-lock), never default to "stay unlocked" — the PIN throttle
  // is this app's whole brute-force defense.
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

  // A guest's biometric lock is session-less — no vault, no DEK, no
  // lockout. These tests exercise the same onHidden/onVisible entry points
  // as the account path above, just identity-branched.
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

    // deviceStore.ts's clearGuestLock() self-catches a storage failure
    // (its established posture for every device signal here), so
    // disableGuestLock() must not simply assume the clear worked — it
    // re-reads hasGuestLock() instead of trusting a silent success.
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

    // No lockout: a failed guest assertion is retriable, never a wipe — the
    // guest lock gates the UI only, never a cryptographic boundary, so
    // there's nothing to throttle. isBiometricAvailable() still reports
    // true here (platform capability is fine) — a genuine wrong/cancelled
    // attempt, not the "capability gone" case below, so it stays retriable.
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

    // The same edge case as the cold-start gate above, for the
    // background-relock path. WebAuthn deliberately can't distinguish "no
    // matching credential" from "user cancelled" (privacy), so the platform
    // capability check is the only signal safe to act on automatically.
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

  // A same-tab logout() must re-lock the vault, or the DEK stays resident
  // in memory. lockStore.ts can't import authStore.ts's logout() to call
  // lock() (a real circular import, since authStore.ts already imports this
  // module) — it listens for the one transition an explicit logout()
  // produces via useAuthStore.subscribe instead. vi.resetModules() forces
  // the module body (and its one-time subscribe() registration) to run
  // again, since a later test's dynamic import would otherwise hit the ESM
  // cache and register nothing new.
  describe('logout-relock subscription', () => {
    // authStore.logout() invalidates the vault itself (fire-and-forget
    // resetVault()), so this listener must land on "no account, no vault" —
    // phase unlocked, enabled false — never re-lock behind a vault that's
    // being deleted. forgetDek() runs synchronously here too, defensively,
    // since the vault's own invalidation may not have landed yet.
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

    // logout() invalidates whatever vault might exist unconditionally, so
    // this listener resets unconditionally too — calling forgetDek() /
    // resetting state when there was nothing to reset is a harmless no-op.
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

    // restore()'s own silent-auth-failure fallback also lands on status
    // 'idle' (no PIN lock enabled, so this transition never applies to that
    // caller anyway — enabled is false — but the listener itself must not
    // key on 'idle' alone) — a session that was already null stays null,
    // there's no real logout transition here to react to.
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
