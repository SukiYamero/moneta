import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useAuthStore } from '@/lib/authStore'
import { useDataStore } from '@/lib/dataStore'
import { getActiveProfileBinding } from '@/lib/repoProvider'
import { hasEverSynced } from '@/lib/sync/status'
import { runInitialSync } from '@/lib/sync/syncSession'
import { DriveDownloadScreen } from '@/features/sync/DriveDownloadScreen'

const dismissedProfileIds = new Set<string>()

export const FirstSyncGate = ({ children }: { children: ReactNode }) => {
  const status = useAuthStore((s) => s.status)
  const drive = useAuthStore((s) => s.drive)

  const [showGate, setShowGate] = useState(() => {
    if (status !== 'authenticated' || drive === null) return false
    const binding = getActiveProfileBinding()
    if (binding === null || dismissedProfileIds.has(binding.profile.id)) return false
    return !hasEverSynced(binding.profile)
  })

  useEffect(() => {
    if (showGate) return
    void runInitialSync()
  }, [showGate])

  const onDone = useCallback(() => {
    const binding = getActiveProfileBinding()
    if (binding) dismissedProfileIds.add(binding.profile.id)
    useDataStore.getState().reset()
    void useDataStore.getState().load()
    setShowGate(false)
  }, [])

  if (showGate) return <DriveDownloadScreen onDone={onDone} />
  return <>{children}</>
}

export const __resetFirstSyncGateForTests = (): void => {
  dismissedProfileIds.clear()
}
