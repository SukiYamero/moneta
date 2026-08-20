import { useEffect, useState } from 'react'
import { getActiveProfile, listProfiles, type ProfileRecord } from '@/lib/profiles'

export interface UseProfilesResult {
  status: 'loading' | 'ready'
  profiles: ProfileRecord[]
  activeProfileId: string | null
}

const INITIAL_STATE: UseProfilesResult = { status: 'loading', profiles: [], activeProfileId: null }

/**
 * The device-scoped profile registry, read-only (specs.md §10.15/§10.18 —
 * switching/renaming is Wave 5+). `getActiveProfile()` is awaited first so
 * a fresh device's lazy adoption of the frozen `kurobello` database as its
 * first profile has already landed before `listProfiles()` reads the
 * table, matching how `profileRegistry.test.ts` itself orders the two
 * calls. Both registry functions already self-catch and degrade to "no
 * signal recorded" (`profileRegistry.ts`), so there is nothing left here
 * for this hook to catch — a redundant try/catch around a call that cannot
 * reject would just be dead branch, not real defense.
 */
export const useProfiles = (): UseProfilesResult => {
  const [state, setState] = useState<UseProfilesResult>(INITIAL_STATE)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const active = await getActiveProfile()
      const all = await listProfiles()
      if (cancelled) return
      setState({ status: 'ready', profiles: all, activeProfileId: active.id })
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
