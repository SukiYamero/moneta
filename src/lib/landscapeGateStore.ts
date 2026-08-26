import { create } from 'zustand'

// specs.md §10.53: the landscape gate's "Omitir y continuar" is a
// per-session dismissal, not a per-device one. In-memory, deliberately
// unpersisted state is the whole mechanism — a reload or a fresh app launch
// starts a new module graph, so the flag is back at `false` by construction,
// with no explicit "reset" code path to keep correct.
interface LandscapeGateSessionState {
  skippedThisSession: boolean
}

export const useLandscapeGateStore = create<LandscapeGateSessionState>(() => ({
  skippedThisSession: false,
}))

export const skipLandscapeGateForSession = (): void => {
  useLandscapeGateStore.setState({ skippedThisSession: true })
}
