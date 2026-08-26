import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useLockStore } from '@/lib/lockStore'
import LockScreen from '@/features/lock/LockScreen'
import { unlockErrorCopy } from '@/features/lock/errorCopy'
import { Toaster } from '@/components/shared'
import { setToastsSuppressed } from '@/lib/toastStore'

export const AppLock = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation('lock')
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

  useEffect(() => {
    setToastsSuppressed(phase !== 'unlocked')
  }, [phase])

  if (phase === 'unknown') return null

  return (
    <>
      {phase !== 'locked' && error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive"
        >
          <span>{t(unlockErrorCopy(error))}</span>
          <button
            type="button"
            onClick={clearError}
            aria-label={t('dismiss')}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-base leading-none"
          >
            ×
          </button>
        </div>
      )}
      {phase === 'locked' ? <LockScreen /> : children}
      {phase !== 'locked' && <Toaster />}
    </>
  )
}
