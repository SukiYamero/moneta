import { useEffect, useRef, useState } from 'react'
import {
  adoptGuestMovements,
  countUnadoptedGuestMovements,
  getActiveProfile,
  getProfileDatabase,
  type ProfileRecord,
} from '@/lib/profiles'

export type GuestAdoptionEntryPhase = 'idle' | 'busy' | 'success'

export interface UseGuestAdoptionEntryResult {
  visible: boolean
  phase: GuestAdoptionEntryPhase
  count: number
  adoptedCount: number
  error: string | null
  adopt: () => Promise<void>
}

interface AdoptionEntryState {
  visible: boolean
  phase: GuestAdoptionEntryPhase
  count: number
  adoptedCount: number
  error: string | null
}

const HIDDEN_STATE: AdoptionEntryState = {
  visible: false,
  phase: 'idle',
  count: 0,
  adoptedCount: 0,
  error: null,
}

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : 'unknown error')

export const useGuestAdoptionEntry = (): UseGuestAdoptionEntryResult => {
  const [state, setState] = useState<AdoptionEntryState>(HIDDEN_STATE)
  const targetRef = useRef<ProfileRecord | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const active = await getActiveProfile()
      if (cancelled) return
      if (active.kind !== 'google') {
        targetRef.current = null
        setState(HIDDEN_STATE)
        return
      }
      targetRef.current = active
      const count = await countUnadoptedGuestMovements(getProfileDatabase(active.databaseName))
      if (cancelled) return
      setState({ visible: count > 0, phase: 'idle', count, adoptedCount: 0, error: null })
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const adopt = async (): Promise<void> => {
    const target = targetRef.current
    if (!target || state.phase === 'busy') return
    setState((prev) => ({ ...prev, phase: 'busy', error: null }))
    try {
      const result = await adoptGuestMovements(target)
      const nextCount = await countUnadoptedGuestMovements(getProfileDatabase(target.databaseName))
      if (result.adoptedCount > 0) {
        setState({
          visible: true,
          phase: 'success',
          count: nextCount,
          adoptedCount: result.adoptedCount,
          error: null,
        })
      } else {
        setState({ visible: nextCount > 0, phase: 'idle', count: nextCount, adoptedCount: 0, error: null })
      }
    } catch (e) {
      setState((prev) => ({ ...prev, phase: 'idle', error: errorMessage(e) }))
    }
  }

  return { ...state, adopt }
}
