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
} from '@/lib/pinLock'
import type { AuthSession } from '@/lib/auth'

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
  unlock: () => Promise<AuthSession>,
): Promise<void> => {
  try {
    const session = await unlock()
    await useAuthStore.getState().hydrate(session)
    // hydrate() owns its own error handling and resolves into
    // `status: 'error'` rather than throwing (docs/error-handling.md §2) —
    // check the actual outcome instead of inferring success from "didn't
    // throw". The PIN itself was correct, so there's no reason to re-lock;
    // WelcomeScreen/RequireAuth already render authStore's own error once
    // status leaves 'authenticated', but resume() must still admit it
    // didn't get a clean success (docs/error-handling.md §4).
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
    const session = useAuthStore.getState().session
    if (!session) throw new Error(NO_SESSION_ERROR)
    await enableLock({ pin, session, biometric })
    set({ phase: 'unlocked', enabled: true })
  },
  unlockPin: (pin) => resume(set, () => unlockWithPin(pin)),
  unlockBiometric: () => resume(set, () => unlockWithBiometric()),
  lock: () => {
    if (!get().enabled) return
    forgetDek()
    set({ phase: 'locked' })
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
