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

// Distinct movements, not raw outbox entries — two queued edits to the same
// movement must read as "1 movement", matching the modal's copy (specs.md
// §10.20). listPendingOperations() already self-catches down to `[]` on a
// storage failure (outbox.ts), so a broken read here just resolves to "no
// unsynced data" rather than needing its own try/catch.
const countUnsyncedMovimientos = async (): Promise<number> => {
  const pending = await listPendingOperations()
  const ids = new Set(
    pending.filter((entry) => entry.entity === 'movimiento').map((entry) => entry.entityId),
  )
  return ids.size
}

/**
 * specs.md §10.20: the sign-out confirmation is a warning about data at
 * risk of feeling lost, not a generic "are you sure" — it only shows when
 * there is unsynced local data *and* nowhere else (Drive) that data is
 * headed. With Drive connected there's nothing to warn about, so sign out
 * runs directly; with nothing unsynced, same thing. `logout()` itself
 * already keeps the local copy (§10.15's "nothing is ever replaced") —
 * this hook only decides whether to say so before it happens.
 */
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
