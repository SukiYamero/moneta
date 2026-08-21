import { useEffect, useState } from 'react'
import { getActiveProfile, listProfiles, removeProfile, type ProfileRecord } from '@/lib/profiles'
// Imported directly, not through the `@/lib/profiles` barrel — that barrel
// deliberately omits it to avoid a circular import (see its own comment).
import { switchToProfile } from '@/lib/profiles/switchProfile'
import { toast } from '@/lib/toastStore'

export interface UseProfilesResult {
  status: 'loading' | 'ready'
  profiles: ProfileRecord[]
  activeProfileId: string | null
  /** The profile currently mid-switch, so the row can show a busy state instead of feeling unresponsive. */
  switchingId: string | null
  /** Set when `switchTo` finds the target's database gone (specs.md §10.31 edge case) — the UI offers removal rather than failing opaquely. */
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

/**
 * The device-scoped profile registry (specs.md §10.15/§10.31), plus the
 * switcher itself. `getActiveProfile()` is awaited first so a fresh
 * device's lazy adoption of the frozen `kurobello` database as its first
 * profile has already landed before `listProfiles()` reads the table,
 * matching how `profileRegistry.test.ts` itself orders the two calls.
 */
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
    // `switchToProfile` already reverted the pointer to whatever was
    // active before the attempt (docs/error-handling.md §4 — never a
    // success-shaped value for a failure), so there is nothing to reload
    // here; the person just needs to know the tap didn't do anything.
    if (result.outcome === 'switch-failed') toast.error('profile:profiles.switchError')
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
