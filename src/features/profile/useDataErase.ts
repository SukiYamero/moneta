import { useState } from 'react'
import { useAuthStore } from '@/lib/authStore'
import { useDataStore } from '@/lib/dataStore'
import { EraseError, eraseProfileData, type EraseStage } from '@/lib/sync/erase'
import { getSyncContext } from '@/lib/sync/syncSession'
import { toast, type ToastMessageKey } from '@/lib/toastStore'

export interface UseDataEraseResult {
  driveAvailable: boolean
  confirmOpen: boolean
  erasing: boolean
  requestErase: () => void
  confirmErase: () => Promise<void>
  cancelErase: () => void
}

const FAILURE_TOAST_KEY: Record<EraseStage, ToastMessageKey> = {
  drive: 'profile:data.deleteStored.failedDrive',
  local: 'profile:data.deleteStored.failedLocal',
}

export const useDataErase = (): UseDataEraseResult => {
  const status = useAuthStore((s) => s.status)
  const drive = useAuthStore((s) => s.drive)
  const driveAvailable = status === 'authenticated' && drive !== null
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [erasing, setErasing] = useState(false)

  const requestErase = (): void => {
    if (!driveAvailable) return
    setConfirmOpen(true)
  }

  const cancelErase = (): void => setConfirmOpen(false)

  const confirmErase = async (): Promise<void> => {
    setConfirmOpen(false)
    setErasing(true)
    try {
      const ctx = await getSyncContext()
      if (!ctx) {
        toast.error('profile:data.deleteStored.failedDrive')
        return
      }
      await eraseProfileData(ctx.token, ctx.profile)
      useDataStore.getState().reset()
      await useDataStore.getState().load()
      toast.success('profile:data.deleteStored.success')
    } catch (e) {
      toast.error(
        e instanceof EraseError ? FAILURE_TOAST_KEY[e.stage] : 'profile:data.deleteStored.failed',
      )
    } finally {
      setErasing(false)
    }
  }

  return { driveAvailable, confirmOpen, erasing, requestErase, confirmErase, cancelErase }
}
