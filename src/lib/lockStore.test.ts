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
    // lockStore.ts subscribes at module scope (the logout-relock fix,
    // specs.md §12) — a bare vi.fn() here just needs to exist so that call
    // doesn't throw; the subscription tests below capture the registered
    // listener directly instead of exercising a real zustand store.
    subscribe: authStoreSubscribe,
  },
}))
const stopSyncSession = vi.fn()
// Isolates this suite from the real sync engine/repoProvider/i18n chain
// `syncSession.ts` otherwise pulls in — lockStore.ts's only use of it is
// the one call under test below (specs.md §10.26 §2's "stop on lock").
vi.mock('@/lib/sync/syncSession', () => ({ stopSyncSession }))

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

  test("lock() stops the sync session (specs.md §10.26 §2) — the one transition syncSession.ts's own authStore subscription structurally cannot see, since locking never touches authStore", async () => {
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
    await useLockStore.getState().unlockPin('1234')
    expect(hydrate).toHaveBeenCalledWith(session, user)
    expect(useLockStore.getState().phase).toBe('unlocked')
  })

  test('unlockBiometric hydrates auth and unlocks', async () => {
    pinLock.unlockWithBiometric.mockResolvedValue({ session, user })
    const { useLockStore } = await import('@/lib/lockStore')
    await useLockStore.getState().unlockBiometric()
    expect(hydrate).toHaveBeenCalledWith(session, user)
    expect(useLockStore.getState().phase).toBe('unlocked')
  })

  // Finding 3 (HIGH): resume() used to infer success from "hydrate() didn't
  // throw" — but hydrate() owns its own errors and resolves into
  // `status: 'error'` instead (docs/error-handling.md's documented pattern).
  // A correct PIN unlocking a vault whose cached token has since expired
  // must not be reported as a clean success.
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

  // specs.md §10.11: a correct PIN with no network must reach 'authenticated'
  // via hydrate()'s own redesign — resume() no longer manufactures
  // SESSION_RESTORE_ERROR for that case since hydrate() (real implementation)
  // doesn't fail for it anymore. This mock still proves resume() passes the
  // cached profile through, which is what makes that redesign possible.
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

  // specs.md §12 backlog: a same-tab logout() must re-lock the vault, or the
  // DEK stays resident in memory. lockStore.ts can't import authStore.ts's
  // logout() to call lock() (that would be a real circular import, since
  // authStore.ts is already imported by this module) — it listens for the
  // one transition an explicit logout() produces via useAuthStore.subscribe
  // instead. vi.resetModules() forces the module body (and its one-time
  // subscribe() registration) to run again, since a later test's dynamic
  // import would otherwise hit the ESM cache and register nothing new.
  describe('logout-relock subscription (specs.md §12, superseded by §10.20)', () => {
    // specs.md §10.20: authStore.logout() now invalidates the vault itself
    // (resetVault(), fire-and-forget from authStore.ts), so re-locking
    // behind it — the old behavior — would strand this tab on a PIN screen
    // that can never succeed (the vault it guards is being deleted). The
    // listener now reflects "no account, no vault" directly: phase back to
    // 'unlocked', enabled false, same end state reset() reaches after
    // wiping the vault directly. forgetDek() still runs synchronously here,
    // defensively, since the vault's own invalidation is fire-and-forget and
    // hasn't necessarily landed yet.
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

    // No longer gated on "was the lock enabled" — a logout() invalidates
    // whatever vault might exist unconditionally, so the listener resets
    // unconditionally too. Calling forgetDek()/resetting state when there
    // was never anything to reset is a harmless no-op.
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
