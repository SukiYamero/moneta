import { useEffect, type ReactNode } from 'react'
import { useLockStore } from '@/lib/lockStore'
import LockScreen from '@/features/lock/LockScreen'
import { unlockErrorCopy } from '@/features/lock/errorCopy'

export function AppLock({ children }: { children: ReactNode }) {
  const phase = useLockStore((s) => s.phase)
  const error = useLockStore((s) => s.error)
  const clearError = useLockStore((s) => s.clearError)

  useEffect(() => {
    void useLockStore.getState().init()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') useLockStore.getState().onHidden()
      else void useLockStore.getState().onVisible()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  if (phase === 'unknown') return null

  return (
    <>
      {/* A lockout or failed session-restore fires the same set() that
          leaves 'locked' — LockScreen (the only other error consumer)
          unmounts in that same instant, so its own alert never renders.
          One level up, AppLock stays mounted across the transition, so the
          message survives it instead of disappearing with the phase change
          (docs/error-handling.md §7; specs.md §11, 2026-08-19, finding 4). */}
      {phase !== 'locked' && error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive"
        >
          <span>{unlockErrorCopy(error)}</span>
          <button
            type="button"
            onClick={clearError}
            aria-label="Cerrar"
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-base leading-none"
          >
            ×
          </button>
        </div>
      )}
      {phase === 'locked' ? <LockScreen /> : children}
    </>
  )
}
