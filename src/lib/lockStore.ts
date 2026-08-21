import { create } from 'zustand'
import { useAuthStore } from '@/lib/authStore'
import {
  biometricEnabled,
  disableGuestLock as disableGuestLockCredential,
  enableGuestLock as enableGuestLockCredential,
  enableLock,
  forgetDek,
  hasGuestLock,
  hasLoggedInBefore,
  hasUsedGuestBefore,
  hasVault,
  isBackgroundExpired,
  isBiometricAvailable,
  isGuestLockBackgroundExpired,
  LockedOutError,
  markActive,
  markGuestLockActive,
  resetVault,
  unlockWithBiometric,
  unlockWithPin,
  verifyGuestLock,
  type VaultSession,
} from '@/lib/pinLock'
import { startSyncSession, stopSyncSession } from '@/lib/sync/syncSession'

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
// Which credential is gating the *current* locked phase (specs.md §10.33).
// Not derivable from `authStore.status === 'guest'` alone: the cold-start
// guest gate (`init()`, below) can lock the app before RequireAuth has
// even mounted, let alone resolved `status` — AppLock renders nothing but
// LockScreen while `phase === 'locked'`, so authStore's own guest
// restoration never gets the chance to run first. `onVisible()`'s
// background re-lock, by contrast, always fires after `status` is already
// known and sets this explicitly too, for one consistent signal
// LockScreen can read regardless of which path locked it. `null` while
// unlocked/unknown.
type LockKind = 'account' | 'guest'

type LockState = {
  phase: LockPhase
  lockKind: LockKind | null
  enabled: boolean
  biometricAvailable: boolean
  // Whether *this vault* enrolled biometrics — distinct from
  // `biometricAvailable` (platform capability, relevant while enrolling in
  // LockSettings). LockScreen must gate its button on this one: offering
  // biometrics to a PIN-only user always fails, even though the device
  // itself supports it (specs.md §11, 2026-08-19, finding 9).
  biometricEnrolled: boolean
  // Whether *this device* has a guest biometric credential enrolled
  // (specs.md §10.2.1) — the guest equivalent of `enabled`, but never set by
  // `init()`: guest status isn't known at boot (it's only chosen from
  // WelcomeScreen, after `init()` already settled), so callers refresh it
  // explicitly via `initGuestLock()` once `authStore.status === 'guest'`.
  guestLockEnabled: boolean
  error: string | null
  init: () => Promise<void>
  initGuestLock: () => Promise<void>
  enable: (pin: string, biometric: boolean) => Promise<void>
  enableGuestLock: () => Promise<void>
  disableGuestLock: () => Promise<void>
  unlockPin: (pin: string) => Promise<void>
  unlockBiometric: () => Promise<void>
  unlockGuest: () => Promise<void>
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
      set({ phase: 'unlocked', lockKind: null, error: SESSION_RESTORE_ERROR })
      return
    }
    set({ phase: 'unlocked', lockKind: null, error: null })
    // lock()'s explicit stopSyncSession() call needs an equally explicit
    // counterpart here, not the authStore subscription: hydrate() re-sets
    // `status`/`drive` to the exact values they already held before this
    // lock (locking never clears them), so that subscription's edge
    // detection never fires across a lock/unlock cycle — traced and
    // reproduced (`sync/syncSession.test.ts`), the trigger was staying dead
    // for the rest of the session after the very first lock. Safe to call
    // unconditionally, same as every other `startSyncSession()` call site:
    // idempotent, and a no-Drive/guest session's triggers simply no-op via
    // `getSyncContext()`.
    startSyncSession()
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
      set({ phase: 'unlocked', lockKind: null, enabled: false, error: LOCKED_OUT_ERROR })
      return
    }
    set({ error: e instanceof Error ? e.message : 'unlock failed' })
  }
}

export const useLockStore = create<LockState>((set, get) => ({
  phase: 'unknown',
  lockKind: null,
  enabled: false,
  biometricAvailable: false,
  biometricEnrolled: false,
  guestLockEnabled: false,
  error: null,
  init: async () => {
    let locked = false
    let available = false
    let enrolled = false
    // Cold-start guest gate (specs.md §10.33): only ever considered when
    // there's no account vault to protect first — "account wins on
    // restore" means a device that also carries the account marker will
    // have authStore.restore() try that path, never guest, so a guest
    // credential must not gate a cold start it isn't the answer to.
    let guestGate = false
    try {
      // The whole boot-time read, including the vault-level enrollment check
      // that only makes sense once we know a vault exists, is one operation:
      // "figure out what phase to land on." Any part of it failing must
      // still leave the app renderable, never stuck on 'unknown' forever
      // (docs/error-handling.md §3; specs.md §11, 2026-08-19, finding 1).
      ;[locked, available] = await Promise.all([hasVault(), isBiometricAvailable()])
      if (locked) {
        enrolled = await biometricEnabled()
      } else {
        const [loggedInBefore, usedGuestBefore] = await Promise.all([
          hasLoggedInBefore(),
          hasUsedGuestBefore(),
        ])
        if (!loggedInBefore && usedGuestBefore && (await hasGuestLock())) {
          // Live capability, not just past enrollment: a sensor disabled or
          // reset since enrollment must degrade to unlocked, never gate a
          // cold start behind a credential that can no longer succeed — a
          // guest has no PIN fallback by design (specs.md §10.2.1), so a
          // dead credential here is a dead end, not an inconvenience.
          if (available) {
            guestGate = true
          } else {
            // Self-heals the stale enrollment (docs/error-handling.md §4:
            // never leave persisted state inconsistent with what the UI
            // believes) — otherwise Settings keeps claiming a lock that can
            // never fire again.
            await disableGuestLockCredential()
          }
        }
      }
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
    if (locked || guestGate) forgetDek()
    set({
      phase: locked || guestGate ? 'locked' : 'unlocked',
      lockKind: locked ? 'account' : guestGate ? 'guest' : null,
      enabled: locked,
      biometricAvailable: available,
      biometricEnrolled: enrolled,
      guestLockEnabled: guestGate,
    })
  },
  enable: async (pin, biometric) => {
    const { session, user } = useAuthStore.getState()
    if (!session) throw new Error(NO_SESSION_ERROR)
    await enableLock({ pin, session, user, biometric })
    set({ phase: 'unlocked', enabled: true })
  },
  // Reads `hasGuestLock()` fresh rather than trusting `guestLockEnabled`'s
  // current value: unlike `init()`'s vault check, this is called on demand
  // (SecuritySection mounting into 'guest' status, after `init()` already
  // settled with no way to have known that at the time), so there's no
  // earlier boot-time read to fall back on.
  initGuestLock: async () => {
    let enrolled = false
    try {
      enrolled = await hasGuestLock()
    } catch (e) {
      // Same fail-open posture as init()'s hasVault() read: a guest's lock
      // is a UI convenience, not a security boundary (specs.md §11,
      // 2026-08-20), so an unreadable device signal must not block the
      // section from rendering — it just means "nothing enrolled yet."
      console.error('lock: could not read guest lock state, treating as not enrolled', e)
    }
    set({ guestLockEnabled: enrolled })
  },
  enableGuestLock: async () => {
    await enableGuestLockCredential()
    set({ guestLockEnabled: true })
  },
  // Re-reads hasGuestLock() after clearing rather than assuming success:
  // deviceStore.ts's clearGuestLock() self-catches (the file's established
  // posture for every device signal, specs.md §10.2.1), so a storage
  // failure there resolves silently instead of throwing here. Setting
  // `guestLockEnabled: false` unconditionally would then lie about what's
  // actually in the row — docs/error-handling.md §4's "never leave
  // persisted state inconsistent with what the UI believes" — and the
  // toggle would spring back to "on" the next time initGuestLock() reads
  // the truth. Reading fresh, the same idiom initGuestLock() already uses,
  // makes the two impossible to disagree.
  disableGuestLock: async () => {
    await disableGuestLockCredential()
    set({ guestLockEnabled: await hasGuestLock() })
  },
  unlockPin: (pin) => resume(set, () => unlockWithPin(pin)),
  unlockBiometric: () => resume(set, () => unlockWithBiometric()),
  // No lockout/reset counterpart to resume()'s: a guest credential gates
  // the UI only, never a cryptographic boundary (specs.md §11,
  // 2026-08-20), so there is nothing to brute-force and nothing a failed
  // attempt needs to throttle — a failure just means "try the OS prompt
  // again," which LockScreen's own retry button offers.
  unlockGuest: async () => {
    try {
      await verifyGuestLock()
      set({ phase: 'unlocked', lockKind: null, error: null })
    } catch (e) {
      // A guest credential is never a cryptographic boundary (specs.md §11,
      // 2026-08-20) and has no PIN fallback by design (§10.2.1) — so if the
      // platform capability itself is gone (sensor disabled, credential
      // store wiped), the ceremony failing is proof there is nothing left
      // to unlock with, not a wrong attempt to retry. WebAuthn deliberately
      // can't distinguish "no matching credential" from "user cancelled"
      // (privacy: an attacker must not learn which), so the platform
      // capability check is the only signal safe to act on automatically —
      // checked live here, not just at the cold-start gate in init(), so a
      // sensor lost mid-session degrades the same way instead of leaving a
      // guest stuck behind a broken credential with only a retry that can
      // never succeed (specs.md §10.33 edge cases).
      if (!(await isBiometricAvailable())) {
        await disableGuestLockCredential()
        set({ phase: 'unlocked', lockKind: null, guestLockEnabled: false, error: null })
        return
      }
      set({ error: e instanceof Error ? e.message : 'unlock failed' })
    }
  },
  lock: () => {
    if (!get().enabled) return
    forgetDek()
    set({ phase: 'locked', lockKind: 'account' })
    // specs.md §10.26 §2: the one transition `syncSession.ts`'s own
    // authStore subscription structurally cannot see — locking never
    // touches `authStore`'s `status`/`drive` (it's a lockStore-only state
    // flip), so nothing there would ever stop the triggers on its own. An
    // in-flight push still completes (this only removes listeners, it
    // can't abort a fetch already sent) — restarted by `hydrate()`'s own
    // `set()` the next time `resume()` unlocks successfully.
    stopSyncSession()
  },
  // Identity-branched (specs.md §10.2.1): an account's background timeout
  // guards the PIN vault's `lastActiveAt`; a guest's guards the session-less
  // guest-lock row instead — the two never coexist for one tab (status is
  // either 'authenticated' or 'guest'), so this only ever takes one branch.
  onHidden: () => {
    if (get().phase !== 'unlocked') return
    if (useAuthStore.getState().status === 'guest') {
      if (get().guestLockEnabled) void markGuestLockActive()
      return
    }
    void markActive()
  },
  onVisible: async () => {
    if (get().phase !== 'unlocked') return
    const isGuest = useAuthStore.getState().status === 'guest'
    if (isGuest && !get().guestLockEnabled) return

    let expired: boolean
    try {
      expired = isGuest ? await isGuestLockBackgroundExpired() : await isBackgroundExpired()
    } catch (e) {
      // Fail closed: if we can't tell whether the background timeout
      // elapsed, treat it as elapsed rather than silently leaving the app
      // unlocked — the 5-attempt PIN throttle is this app's whole
      // brute-force defense for a 4-digit PIN (specs.md §5), so an
      // ambiguous read must not default to "stay open." The guest path
      // carries no throttle of its own, but the same "don't guess open"
      // instinct still applies to an unreadable read.
      console.error('lock: could not read background-expiry state, re-locking', e)
      expired = true
    }
    if (!expired) return
    forgetDek()
    set({ phase: 'locked', lockKind: isGuest ? 'guest' : 'account' })
  },
  reset: async () => {
    await resetVault()
    useAuthStore.getState().logout()
    set({ phase: 'unlocked', lockKind: null, enabled: false, error: null })
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
    useLockStore.setState({ phase: 'unlocked', lockKind: null, enabled: false, error: null })
  }
})
