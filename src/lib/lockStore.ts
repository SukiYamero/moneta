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

export const LOCKED_OUT_ERROR = 'locked out'
export const NO_SESSION_ERROR = 'lock: no session to protect'
export const SESSION_RESTORE_ERROR = 'lock: could not restore the session after unlock'

type LockPhase = 'unknown' | 'unlocked' | 'locked'
type LockKind = 'account' | 'guest'

type LockState = {
  phase: LockPhase
  lockKind: LockKind | null
  enabled: boolean
  biometricAvailable: boolean
  biometricEnrolled: boolean
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
    if (useAuthStore.getState().status !== 'authenticated') {
      set({ phase: 'unlocked', lockKind: null, error: SESSION_RESTORE_ERROR })
      return
    }
    set({ phase: 'unlocked', lockKind: null, error: null })
    startSyncSession()
  } catch (e) {
    if (e instanceof LockedOutError) {
      try {
        await resetVault()
      } catch (resetError) {
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
    let guestGate = false
    try {
      ;[locked, available] = await Promise.all([hasVault(), isBiometricAvailable()])
      if (locked) {
        enrolled = await biometricEnabled()
      } else {
        const [loggedInBefore, usedGuestBefore] = await Promise.all([
          hasLoggedInBefore(),
          hasUsedGuestBefore(),
        ])
        if (!loggedInBefore && usedGuestBefore && (await hasGuestLock())) {
          if (available) {
            guestGate = true
          } else {
            await disableGuestLockCredential()
          }
        }
      }
    } catch (e) {
      console.error('lock: could not read vault state at boot, continuing unlocked', e)
    }
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
  initGuestLock: async () => {
    let enrolled = false
    try {
      enrolled = await hasGuestLock()
    } catch (e) {
      console.error('lock: could not read guest lock state, treating as not enrolled', e)
    }
    set({ guestLockEnabled: enrolled })
  },
  enableGuestLock: async () => {
    await enableGuestLockCredential()
    set({ guestLockEnabled: true })
  },
  disableGuestLock: async () => {
    await disableGuestLockCredential()
    set({ guestLockEnabled: await hasGuestLock() })
  },
  unlockPin: (pin) => resume(set, () => unlockWithPin(pin)),
  unlockBiometric: () => resume(set, () => unlockWithBiometric()),
  unlockGuest: async () => {
    try {
      await verifyGuestLock()
      set({ phase: 'unlocked', lockKind: null, error: null })
    } catch (e) {
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
    stopSyncSession()
  },
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

useAuthStore.subscribe((state, prevState) => {
  if (state.status === 'idle' && state.session === null && prevState.session !== null) {
    forgetDek()
    useLockStore.setState({ phase: 'unlocked', lockKind: null, enabled: false, error: null })
  }
})
