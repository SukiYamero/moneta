import type { ReactNode } from 'react'
import { useAuthStore } from '@/lib/authStore'
import { LoginScreen } from '@/features/auth/LoginScreen'

export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  return status === 'authenticated' ? <>{children}</> : <LoginScreen />
}
