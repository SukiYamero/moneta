import type { ReactNode } from 'react'
import { useAuthStore } from '@/lib/authStore'
import { WelcomeScreen } from '@/features/auth/WelcomeScreen'
import { DrivePermissionScreen } from '@/features/auth/DrivePermissionScreen'

export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const driveOptIn = useAuthStore((s) => s.driveOptIn)

  if (status !== 'authenticated') return <WelcomeScreen />
  if (driveOptIn === 'pending') return <DrivePermissionScreen />
  return <>{children}</>
}
