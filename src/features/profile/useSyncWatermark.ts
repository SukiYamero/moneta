import { useEffect, useState } from 'react'
import { getActiveProfileBinding } from '@/lib/repoProvider'
import { getProfile, type ProfileRecord } from '@/lib/profiles'
import { useSyncStore } from '@/lib/sync/engine'

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
