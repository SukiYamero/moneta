import { useEffect, type ReactNode } from 'react'
import { useLockStore } from '@/lib/lockStore'
import LockScreen from '@/features/lock/LockScreen'

export function AppLock({ children }: { children: ReactNode }) {
  const phase = useLockStore((s) => s.phase)

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
  if (phase === 'locked') return <LockScreen />
  return <>{children}</>
}
