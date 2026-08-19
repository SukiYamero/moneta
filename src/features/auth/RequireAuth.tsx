import { useEffect, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/lib/authStore'
import { WelcomeScreen } from '@/features/auth/WelcomeScreen'
import { DrivePermissionScreen } from '@/features/auth/DrivePermissionScreen'

// SEAM(track-p): stand-in for the shared `ScreenLoading` component (specs.md
// §10.9, Track P) — deliberately minimal so it's a one-line swap once that
// merges, not a second loading design to reconcile with it.
const BootScreen = () => {
  const { t } = useTranslation('auth')
  return (
    <main aria-busy="true" className="flex min-h-dvh items-center justify-center bg-background">
      <span className="sr-only" role="status">
        {t('boot.loading')}
      </span>
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
    </main>
  )
}

// RequireAuth only ever mounts with status 'idle' on a cold boot with no PIN
// lock enabled — AppLock withholds it behind LockScreen while a vault exists,
// and lockStore.resume() already settles status (authenticated/error) before
// handing off. So a single idle-gated restore attempt here can't race that path.
export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const status = useAuthStore((s) => s.status)
  const driveOptIn = useAuthStore((s) => s.driveOptIn)

  useEffect(() => {
    if (useAuthStore.getState().status === 'idle') void useAuthStore.getState().restore()
  }, [])

  // Guest is a distinct status, checked first: it must never fall through
  // to the driveOptIn check below (specs.md §10.10 — a guest has no Drive
  // opt-in to answer, and never did).
  if (status === 'guest') return <>{children}</>
  // 'authenticating' covers the whole span of restore()'s network calls, not
  // just an instant — rendering WelcomeScreen here is the boot-flash bug
  // this track fixes (specs.md §10.9).
  if (status === 'authenticating') return <BootScreen />
  if (status !== 'authenticated') return <WelcomeScreen />
  if (driveOptIn === 'pending') return <DrivePermissionScreen />
  return <>{children}</>
}
