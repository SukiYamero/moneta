import { useState } from 'react'
import { useAuthStore } from '@/lib/authStore'
import { listPendingOperations } from '@/lib/outbox'

export interface UseSignOutConfirmResult {
  confirmOpen: boolean
  pendingCount: number
  checking: boolean
  requestSignOut: () => Promise<void>
  confirmSignOut: () => void
  cancelSignOut: () => void
}

const countUnsyncedMovimientos = async (): Promise<number> => {
  const pending = await listPendingOperations()
  const ids = new Set(
    pending.filter((entry) => entry.entity === 'movimiento').map((entry) => entry.entityId),
  )
  return ids.size
}

export const useSignOutConfirm = (): UseSignOutConfirmResult => {
  const driveOptIn = useAuthStore((s) => s.driveOptIn)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [checking, setChecking] = useState(false)

  const requestSignOut = async (): Promise<void> => {
    if (driveOptIn === 'connected') {
      useAuthStore.getState().logout()
      return
    }
    setChecking(true)
    const count = await countUnsyncedMovimientos()
    setChecking(false)
    if (count > 0) {
      setPendingCount(count)
      setConfirmOpen(true)
    } else {
      useAuthStore.getState().logout()
    }
  }

  const confirmSignOut = (): void => {
    setConfirmOpen(false)
    useAuthStore.getState().logout()
  }

  const cancelSignOut = (): void => setConfirmOpen(false)

  return { confirmOpen, pendingCount, checking, requestSignOut, confirmSignOut, cancelSignOut }
}
