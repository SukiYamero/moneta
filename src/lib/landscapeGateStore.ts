import { create } from 'zustand'

interface LandscapeGateSessionState {
  skippedThisSession: boolean
}

export const useLandscapeGateStore = create<LandscapeGateSessionState>(() => ({
  skippedThisSession: false,
}))

export const skipLandscapeGateForSession = (): void => {
  useLandscapeGateStore.setState({ skippedThisSession: true })
}
