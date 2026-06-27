import { create } from 'zustand'
import { useAuthStore } from '@/lib/authStore'
import {
  enableLock,
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
  biometricAvailable: boolean
  error: string | null
  init: () => Promise<void>
  enable: (pin: string, biometric: boolean) => Promise<void>
  unlockPin: (pin: string) => Promise<void>
  unlockBiometric: () => Promise<void>
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
      set({ phase: 'locked', error: 'locked out' })
      return
    }
    set({ error: e instanceof Error ? e.message : 'unlock failed' })
  }
}

export const useLockStore = create<LockState>((set, get) => ({
  phase: 'unknown',
  biometricAvailable: false,
  error: null,
  init: async () => {
    const [locked, biometricAvailable] = await Promise.all([hasVault(), isBiometricAvailable()])
    set({ phase: locked ? 'locked' : 'unlocked', biometricAvailable })
  },
  enable: async (pin, biometric) => {
    const session = useAuthStore.getState().session
    if (!session) throw new Error('lock: no session to protect')
    await enableLock({ pin, session, biometric })
    set({ phase: 'unlocked' })
  },
  unlockPin: (pin) => resume(set, () => unlockWithPin(pin)),
  unlockBiometric: () => resume(set, () => unlockWithBiometric()),
  onHidden: () => {
    if (get().phase === 'unlocked') void markActive()
  },
  onVisible: async () => {
    if (get().phase === 'unlocked' && (await isBackgroundExpired())) set({ phase: 'locked' })
  },
  reset: async () => {
    await resetVault()
    useAuthStore.getState().logout()
    set({ phase: 'locked', error: null })
  },
}))
