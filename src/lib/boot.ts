import { create } from 'zustand'
import { RepoError, type RepoErrorCode } from '@/lib/repo'
import {
  bindActiveProfile,
  getActiveProfileBinding,
  resolveActiveProfileBinding,
} from '@/lib/repoProvider'
import { setOutboxDatabase } from '@/lib/outbox'
import { useDataStore } from '@/lib/dataStore'
import { resumePendingAdoption } from '@/lib/profiles'

export type BootStatus = 'idle' | 'running' | 'ready' | 'error'

interface BootState {
  status: BootStatus
  error: RepoErrorCode | null
  run: () => Promise<void>
}

let inFlight: Promise<void> | null = null

const runOnce = async (
  set: (partial: Partial<BootState>) => void,
  get: () => BootState,
): Promise<void> => {
  const previous = getActiveProfileBinding()
  const binding = await resolveActiveProfileBinding()
  const isRebind = binding.profile.id !== previous?.profile.id
  bindActiveProfile(binding)
  setOutboxDatabase(binding.database)

  if (!isRebind && get().status === 'ready') return

  void resumePendingAdoption(binding.profile)

  set({ status: 'running', error: null })
  if (isRebind) useDataStore.getState().reset()
  await useDataStore.getState().load()

  const dataState = useDataStore.getState()
  set({
    status: dataState.status === 'error' ? 'error' : 'ready',
    error: dataState.status === 'error' ? dataState.error : null,
  })
}

export const useBootStore = create<BootState>((set, get) => ({
  status: 'idle',
  error: null,
  run: () => {
    if (inFlight) return inFlight
    inFlight = runOnce(set, get)
      .catch((e) => {
        set({ status: 'error', error: e instanceof RepoError ? e.code : 'unknown' })
      })
      .finally(() => {
        inFlight = null
      })
    return inFlight
  },
}))

export const invalidateBootForSignOut = (): void => {
  useBootStore.setState({ status: 'idle', error: null })
}

export const __resetBootStoreForTests = (): void => {
  inFlight = null
  useBootStore.setState({ status: 'idle', error: null })
}
