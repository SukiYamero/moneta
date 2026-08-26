import { create } from 'zustand'
import { deviceDb } from '@/lib/deviceStore'

export const OFFLINE_WRITE_WINDOW_MS = 7 * 60 * 60_000

const ANCHOR_ID = 1 as const

const readAnchor = async (): Promise<number | null> => {
  try {
    return (await deviceDb.anchor.get(ANCHOR_ID))?.lastOnlineAt ?? null
  } catch (e) {
    console.warn('network: could not read the last-online anchor, offline window may misfire', e)
    return null
  }
}

const writeAnchor = async (at: number): Promise<void> => {
  try {
    await deviceDb.anchor.put({ id: ANCHOR_ID, lastOnlineAt: at })
  } catch (e) {
    console.warn('network: could not persist the last-online anchor', e)
  }
}

export type MutationKind = 'create' | 'edit' | 'delete' | 'settings'
export type WriteRefusalReason = 'offline_mutation_restricted' | 'offline_window_expired'
export type WriteDecision = { allowed: true } | { allowed: false; reason: WriteRefusalReason }

const MUTATION_ALLOWED_OFFLINE: Record<MutationKind, boolean> = {
  create: true,
  edit: false,
  delete: true,
  settings: false,
}

type NetworkState = {
  // navigator.onLine (and the online/offline events that mirror it) reports true
  // on a connected-but-dead network — a captive portal, a dead uplink.
  online: boolean
  lastOnlineAt: number | null
  setOnline: (online: boolean) => void
  reportOnlineSuccess: (at?: number) => void
  reportOnlineFailure: () => void
  canWrite: (kind: MutationKind, now?: number) => WriteDecision
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  lastOnlineAt: null,
  setOnline: (online) => set({ online }),
  reportOnlineSuccess: (at = Date.now()) => {
    set({ online: true, lastOnlineAt: at })
    void writeAnchor(at)
  },
  reportOnlineFailure: () => set({ online: false }),
  canWrite: (kind, now = Date.now()) => {
    const { online, lastOnlineAt } = get()
    if (online) return { allowed: true }
    if (!MUTATION_ALLOWED_OFFLINE[kind]) {
      return { allowed: false, reason: 'offline_mutation_restricted' }
    }
    if (lastOnlineAt !== null && now - lastOnlineAt > OFFLINE_WRITE_WINDOW_MS) {
      return { allowed: false, reason: 'offline_window_expired' }
    }
    return { allowed: true }
  },
}))

let listenersAttached = false

const initNetworkListeners = (): void => {
  if (listenersAttached || typeof window === 'undefined') return
  listenersAttached = true
  window.addEventListener('online', () => useNetworkStore.getState().setOnline(true))
  window.addEventListener('offline', () => useNetworkStore.getState().setOnline(false))
}

initNetworkListeners()

void readAnchor().then((lastOnlineAt) => {
  if (lastOnlineAt !== null) useNetworkStore.setState({ lastOnlineAt })
})

export const __resetNetworkStoreForTests = (): void => {
  listenersAttached = false
  useNetworkStore.setState({
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    lastOnlineAt: null,
  })
}
