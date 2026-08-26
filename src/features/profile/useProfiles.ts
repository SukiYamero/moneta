import { useEffect, useState } from 'react'
import { getActiveProfile, listProfiles, removeProfile, type ProfileRecord } from '@/lib/profiles'
import { switchToProfile } from '@/lib/profiles/switchProfile'
import { toast } from '@/lib/toastStore'

export interface UseProfilesResult {
  status: 'loading' | 'ready'
  profiles: ProfileRecord[]
  activeProfileId: string | null
  switchingId: string | null
  goneProfile: ProfileRecord | null
  switchTo: (profile: ProfileRecord) => Promise<void>
  dismissGoneProfile: () => void
  removeGoneProfile: () => Promise<void>
}

const INITIAL_STATE: Omit<
  UseProfilesResult,
  'switchTo' | 'dismissGoneProfile' | 'removeGoneProfile'
> = {
  status: 'loading',
  profiles: [],
  activeProfileId: null,
  switchingId: null,
  goneProfile: null,
}

export const useProfiles = (): UseProfilesResult => {
  const [state, setState] = useState(INITIAL_STATE)

  const reload = async (): Promise<void> => {
    const active = await getActiveProfile()
    const all = await listProfiles()
    setState((prev) => ({ ...prev, status: 'ready', profiles: all, activeProfileId: active.id }))
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const active = await getActiveProfile()
      const all = await listProfiles()
      if (cancelled) return
      setState((prev) => ({ ...prev, status: 'ready', profiles: all, activeProfileId: active.id }))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const switchTo = async (profile: ProfileRecord): Promise<void> => {
    setState((prev) => ({ ...prev, switchingId: profile.id }))
    const result = await switchToProfile(profile)
    if (result.outcome === 'profile-database-gone') {
      setState((prev) => ({ ...prev, switchingId: null, goneProfile: profile }))
      return
    }
    setState((prev) => ({ ...prev, switchingId: null }))
    if (result.outcome === 'switched') await reload()
    if (result.outcome === 'switch-failed' || result.outcome === 'switch-check-failed')
      toast.error('profile:profiles.switchError')
  }

  const dismissGoneProfile = (): void => setState((prev) => ({ ...prev, goneProfile: null }))

  const removeGoneProfile = async (): Promise<void> => {
    const target = state.goneProfile
    if (!target) return
    await removeProfile(target.id)
    setState((prev) => ({ ...prev, goneProfile: null }))
    await reload()
  }

  return { ...state, switchTo, dismissGoneProfile, removeGoneProfile }
}
