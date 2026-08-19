import { create } from 'zustand'
import { useAuthStore } from '@/lib/authStore'
import {
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

type LockPhase = 'unknown' | 'unlocked' | 'locked'

type LockState = {
  phase: LockPhase
  enabled: boolean
  biometricAvailable: boolean
  error: string | null
  init: () => Promise<void>
  enable: (pin: string, biometric: boolean) => Promise<void>
  unlockPin: (pin: string) => Promise<void>
  unlockBiometric: () => Promise<void>
  lock: () => void
  onHidden: () => void
  onVisible: () => Promise<void>
  reset: () => Promise<void>
}

async function resume(
  set: (partial: Partial<LockState>) => void,
  unlock: () => Promise<AuthSession>,
): Promise<void> {
  try {
    const session = await unlock()
    await useAuthStore.getState().hydrate(session)
    set({ phase: 'unlocked', error: null })
  } catch (e) {
    if (e instanceof LockedOutError) {
      await resetVault()
      useAuthStore.getState().logout()
      set({ phase: 'unlocked', enabled: false, error: 'locked out' })
      return
    }
    set({ error: e instanceof Error ? e.message : 'unlock failed' })
  }
}

export const useLockStore = create<LockState>((set, get) => ({
  phase: 'unknown',
  enabled: false,
  biometricAvailable: false,
  error: null,
  init: async () => {
    const [locked, biometricAvailable] = await Promise.all([hasVault(), isBiometricAvailable()])
    // Guards the invariant "phase locked ⇒ no DEK resident" even on cold start,
    // where activeDek is normally already null — cheap, and keeps every route
    // into 'locked' provably equivalent rather than relying on module-load order.
    if (locked) forgetDek()
    set({ phase: locked ? 'locked' : 'unlocked', enabled: locked, biometricAvailable })
  },
  enable: async (pin, biometric) => {
    const session = useAuthStore.getState().session
    if (!session) throw new Error('lock: no session to protect')
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
    if (get().phase !== 'unlocked' || !(await isBackgroundExpired())) return
    forgetDek()
    set({ phase: 'locked' })
  },
  reset: async () => {
    await resetVault()
    useAuthStore.getState().logout()
    set({ phase: 'unlocked', enabled: false, error: null })
  },
}))
