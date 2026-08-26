import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuthStore } from '@/lib/authStore'
import { hasLoggedInBefore, hasUsedGuestBefore } from '@/lib/deviceStore'
import { WelcomeScreen } from '@/features/auth/WelcomeScreen'
import { DrivePermissionScreen } from '@/features/auth/DrivePermissionScreen'
import { GuestAdoptionPrompt } from '@/features/auth/GuestAdoptionPrompt'
import { ReturningUserScreen } from '@/features/auth/ReturningUserScreen'
import { PreContentSkeleton } from '@/features/boot/PreContentSkeleton'

export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const status = useAuthStore((s) => s.status)
  const driveOptIn = useAuthStore((s) => s.driveOptIn)

  const [returning, setReturning] = useState<boolean | null>(null)
  const [restoreSettled, setRestoreSettled] = useState(false)
  // StrictMode double-invokes effects on mount; this ref (which survives
  // across the pair) guards against a duplicate restore() attempt.
  const attemptedBoot = useRef(false)

  useEffect(() => {
    if (attemptedBoot.current) return
    attemptedBoot.current = true
    void (async () => {
      const [loggedInBefore, usedGuestBefore] = await Promise.all([
        hasLoggedInBefore(),
        hasUsedGuestBefore(),
      ])
      const before = loggedInBefore || usedGuestBefore
      if (useAuthStore.getState().status === 'idle') {
        void useAuthStore
          .getState()
          .restore()
          .finally(() => setRestoreSettled(true))
      } else {
        setRestoreSettled(true)
      }
      setReturning(before)
    })()
  }, [])

  if (status === 'guest') return <>{children}</>
  if (status === 'authenticated') {
    if (driveOptIn === 'pending') return <DrivePermissionScreen />
    return (
      <>
        {children}
        <GuestAdoptionPrompt />
      </>
    )
  }

  if (returning === null) return null
  if (returning && !restoreSettled) return <PreContentSkeleton />
  return returning ? <ReturningUserScreen /> : <WelcomeScreen />
}
