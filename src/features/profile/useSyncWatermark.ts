import { useEffect, useState } from 'react'
import { getActiveProfileBinding } from '@/lib/repoProvider'
import { getProfile, type ProfileRecord } from '@/lib/profiles'
import { useSyncStore } from '@/lib/sync/engine'

/**
 * `ProfileRecord`'s watermark fields (`driveFolderId`/`lastPushAt`/
 * `lastPullAt`, specs.md §10.19) live in the device-scoped registry, not a
 * reactive store — so the Drive status row (specs.md §10.26 §4) needs its
 * own small poll instead of a plain `useAuthStore` selector. Re-reads the
 * active profile whenever `useSyncStore`'s `phase` cycles back to `'idle'`
 * (a pull/push just finished), which is the one moment the watermark could
 * actually have changed — a plain interval would either miss a fast sync or
 * poll needlessly between them.
 */
export const useSyncWatermark = (): ProfileRecord | null => {
  const phase = useSyncStore((s) => s.phase)
  const [watermark, setWatermark] = useState<ProfileRecord | null>(null)

  useEffect(() => {
    const binding = getActiveProfileBinding()
    if (!binding) return
    let cancelled = false
    void getProfile(binding.profile.id).then((record) => {
      if (!cancelled && record) setWatermark(record)
    })
    return () => {
      cancelled = true
    }
  }, [phase])

  return watermark
}
