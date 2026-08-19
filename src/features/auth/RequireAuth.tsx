import { useEffect, type ReactNode } from 'react'
import { useAuthStore } from '@/lib/authStore'
import { WelcomeScreen } from '@/features/auth/WelcomeScreen'
import { DrivePermissionScreen } from '@/features/auth/DrivePermissionScreen'

// RequireAuth only ever mounts with status 'idle' on a cold boot with no PIN
// lock enabled — AppLock withholds it behind LockScreen while a vault exists,
// and lockStore.resume() already settles status (authenticated/error) before
// handing off. So a single idle-gated restore attempt here can't race that path.
export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const driveOptIn = useAuthStore((s) => s.driveOptIn)

  useEffect(() => {
    if (useAuthStore.getState().status === 'idle') void useAuthStore.getState().restore()
  }, [])

  if (status !== 'authenticated') return <WelcomeScreen />
  if (driveOptIn === 'pending') return <DrivePermissionScreen />
  return <>{children}</>
}
