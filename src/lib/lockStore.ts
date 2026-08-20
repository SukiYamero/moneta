import { create } from 'zustand'
import { useAuthStore } from '@/lib/authStore'
import {
  biometricEnabled,
  enableLock,
  forgetDek,
  hasVault,
  isBackgroundExpired,
  isBiometricAvailable,
  LockedOutError,
  markActive,
  resetVault,
  unlockWithBiometric,
  unlockWithPin,
  type VaultSession,
} from '@/lib/pinLock'
import { stopSyncSession } from '@/lib/sync/syncSession'

// lockStore substitutes its own message strings instead of forwarding the
// error classes' — exported so `features/lock/errorCopy` keys off these
// instead of restating the literal, making a rename a compile error rather
// than a silent fallback to generic copy (docs/error-handling.md §7).
export const LOCKED_OUT_ERROR = 'locked out'
export const NO_SESSION_ERROR = 'lock: no session to protect'
// Distinct from both of the above: the PIN itself was correct (unlike
// WrongPinError/LockedOutError), but the session it unlocked couldn't be
// restored (hydrate() resolved into `status: 'error'` — an expired cached
// token, a network failure, etc). resume() must not report a clean success
// it didn't get (specs.md §11, 2026-08-19, finding 3).
export const SESSION_RESTORE_ERROR = 'lock: could not restore the session after unlock'

type LockPhase = 'unknown' | 'unlocked' | 'locked'

type LockState = {
  phase: LockPhase
  enabled: boolean
  biometricAvailable: boolean
  // Whether *this vault* enrolled biometrics — distinct from
  // `biometricAvailable` (platform capability, relevant while enrolling in
  // LockSettings). LockScreen must gate its button on this one: offering
  // biometrics to a PIN-only user always fails, even though the device
  // itself supports it (specs.md §11, 2026-08-19, finding 9).
  biometricEnrolled: boolean
  error: string | null
  init: () => Promise<void>
  enable: (pin: string, biometric: boolean) => Promise<void>
  unlockPin: (pin: string) => Promise<void>
  unlockBiometric: () => Promise<void>
  lock: () => void
  onHidden: () => void
  onVisible: () => Promise<void>
  reset: () => Promise<void>
  clearError: () => void
}

const resume = async (
  set: (partial: Partial<LockState>) => void,
  unlock: () => Promise<VaultSession>,
): Promise<void> => {
  try {
    const { session, user } = await unlock()
    await useAuthStore.getState().hydrate(session, user)
    // hydrate() no longer gates on a network call (specs.md §10.11: the
    // vault decrypt above already proved identity locally, fetchGoogleUser
    // is a refresh, never a gate) — a correct PIN with no network now
    // resolves `status: 'authenticated'` here, not SESSION_RESTORE_ERROR.
    // This check stays as a defensive invariant, not a live path: check the
    // actual outcome instead of inferring success from "didn't throw"
    // (docs/error-handling.md §2/§4), in case hydrate() ever grows a real
    // failure mode again. The PIN itself was correct, so there's no reason
    // to re-lock either way.
    if (useAuthStore.getState().status !== 'authenticated') {
      set({ phase: 'unlocked', error: SESSION_RESTORE_ERROR })
      return
    }
    set({ phase: 'unlocked', error: null })
  } catch (e) {
    if (e instanceof LockedOutError) {
      try {
        await resetVault()
      } catch (resetError) {
        // resetVault()'s own vault.delete can fail for the same storage
        // reasons as init()'s hasVault() read below — the lockout must still
        // land on a renderable, logged-out state even if the wipe itself
        // couldn't complete (docs/error-handling.md §3: the whole recovery
        // operation, not just its happy path, needs a home for failure).
        console.error('lock: failed to wipe the vault after lockout', resetError)
      }
      useAuthStore.getState().logout()
      set({ phase: 'unlocked', enabled: false, error: LOCKED_OUT_ERROR })
      return
    }
    set({ error: e instanceof Error ? e.message : 'unlock failed' })
  }
}

export const useLockStore = create<LockState>((set, get) => ({
  phase: 'unknown',
  enabled: false,
  biometricAvailable: false,
  biometricEnrolled: false,
  error: null,
  init: async () => {
    let locked = false
    let available = false
    let enrolled = false
    try {
      // The whole boot-time read, including the vault-level enrollment check
      // that only makes sense once we know a vault exists, is one operation:
      // "figure out what phase to land on." Any part of it failing must
      // still leave the app renderable, never stuck on 'unknown' forever
      // (docs/error-handling.md §3; specs.md §11, 2026-08-19, finding 1).
      ;[locked, available] = await Promise.all([hasVault(), isBiometricAvailable()])
      if (locked) enrolled = await biometricEnabled()
    } catch (e) {
      // Storage unreadable (Safari private browsing blocks IndexedDB
      // outright, as do quota errors and some extensions) must degrade to
      // "no vault" rather than leave AppLock rendering null forever — no
      // error boundary catches this (it's an unhandled rejection in a
      // useEffect, not a render throw). The PIN lock is a convenience layer
      // on top of Google auth, not the only guard on the user's data
      // (specs.md §5), so failing open here is the safe default.
      console.error('lock: could not read vault state at boot, continuing unlocked', e)
    }
    // Guards the invariant "phase locked ⇒ no DEK resident" even on cold start,
    // where activeDek is normally already null — cheap, and keeps every route
    // into 'locked' provably equivalent rather than relying on module-load order.
    if (locked) forgetDek()
    set({
      phase: locked ? 'locked' : 'unlocked',
      enabled: locked,
      biometricAvailable: available,
      biometricEnrolled: enrolled,
    })
  },
  enable: async (pin, biometric) => {
    const { session, user } = useAuthStore.getState()
    if (!session) throw new Error(NO_SESSION_ERROR)
    await enableLock({ pin, session, user, biometric })
    set({ phase: 'unlocked', enabled: true })
  },
  unlockPin: (pin) => resume(set, () => unlockWithPin(pin)),
  unlockBiometric: () => resume(set, () => unlockWithBiometric()),
  lock: () => {
    if (!get().enabled) return
    forgetDek()
    set({ phase: 'locked' })
    // specs.md §10.26 §2: the one transition `syncSession.ts`'s own
    // authStore subscription structurally cannot see — locking never
    // touches `authStore`'s `status`/`drive` (it's a lockStore-only state
    // flip), so nothing there would ever stop the triggers on its own. An
    // in-flight push still completes (this only removes listeners, it
    // can't abort a fetch already sent) — restarted by `hydrate()`'s own
    // `set()` the next time `resume()` unlocks successfully.
    stopSyncSession()
  },
  onHidden: () => {
    if (get().phase === 'unlocked') void markActive()
  },
  onVisible: async () => {
    if (get().phase !== 'unlocked') return
    let expired: boolean
    try {
      expired = await isBackgroundExpired()
    } catch (e) {
      // Fail closed: if we can't tell whether the background timeout
      // elapsed, treat it as elapsed rather than silently leaving the app
      // unlocked — the 5-attempt PIN throttle is this app's whole
      // brute-force defense for a 4-digit PIN (specs.md §5), so an
      // ambiguous read must not default to "stay open."
      console.error('lock: could not read background-expiry state, re-locking', e)
      expired = true
    }
    if (!expired) return
    forgetDek()
    set({ phase: 'locked' })
  },
  reset: async () => {
    await resetVault()
    useAuthStore.getState().logout()
    set({ phase: 'unlocked', enabled: false, error: null })
  },
  clearError: () => set({ error: null }),
}))

// A same-tab logout() must not leave this tab showing a stale lock state
// (specs.md §12 backlog, 2026-08-19, superseded by §10.20). authStore.ts
// can't import this module back to react directly — lockStore.ts already
// imports authStore.ts, and a reverse import would be a genuine circular
// dependency (docs/wave-3-plan.md §2.1(2) forbids exactly this shape for
// networkStore/main.tsx, same reasoning applies here) — so this module
// listens for the one transition only an explicit logout() produces
// instead: `status` settling on 'idle' with `session` newly cleared, where
// it previously held a real session.
//
// specs.md §10.20: authStore.logout() now invalidates the PIN-lock vault
// itself (resetVault(), fire-and-forget) — the vault exists to cache *this
// account's* token, and with no account left there is nothing left for a
// re-lock to guard. Re-locking (the old behavior) would strand this tab on
// a PIN screen backed by a vault that is being deleted, which can only ever
// fail. Reset directly to the same end state reset() reaches after wiping
// the vault on purpose: phase 'unlocked', disabled. forgetDek() runs here
// synchronously and unconditionally (even if the lock was never enabled,
// where it's a no-op) because the vault's own invalidation is
// fire-and-forget and may not have landed yet — this is the one guarantee
// this tab can make immediately, independent of that promise's outcome.
useAuthStore.subscribe((state, prevState) => {
  if (state.status === 'idle' && state.session === null && prevState.session !== null) {
    forgetDek()
    useLockStore.setState({ phase: 'unlocked', enabled: false, error: null })
  }
})
