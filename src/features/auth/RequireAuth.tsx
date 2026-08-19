import { useEffect, useRef, type ReactNode } from 'react'
import { useAuthStore } from '@/lib/authStore'
import { ScreenLoading } from '@/components/shared/ScreenLoading'
import { WelcomeScreen } from '@/features/auth/WelcomeScreen'
import { DrivePermissionScreen } from '@/features/auth/DrivePermissionScreen'

// RequireAuth only ever mounts with status 'idle' on a cold boot with no PIN
// lock enabled — AppLock withholds it behind LockScreen while a vault exists,
// and lockStore.resume() already settles status (authenticated/error) before
// handing off. So a single idle-gated restore attempt here can't race that path.
export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const status = useAuthStore((s) => s.status)
  const driveOptIn = useAuthStore((s) => s.driveOptIn)
  // 'authenticating' is ambiguous on its own: the mount-time restore() call
  // below sets it (the real boot-flash span, specs.md §10.9) but so does an
  // explicit, user-initiated login() from an already-visible WelcomeScreen
  // (same status, different cause). `booted` disambiguates them — it flips
  // true once the initial restore attempt settles (or immediately, if this
  // component never mounted with 'idle' to begin with), so the boot screen
  // is reserved for the genuine cold-boot span. After that, 'authenticating'
  // falls through to WelcomeScreen, which owns its own inline busy state
  // (§10.9 tier 3) — a full-screen swap mid-tap would be a regression the
  // boot fix introduced, not the fix itself.
  const booted = useRef(false)
  // Guards the effect body itself, not just its restore() call: StrictMode
  // (main.tsx) double-invokes this effect on every mount, same component
  // instance (refs survive the pair). Without this guard, the *second*
  // invocation would see `status` already flipped to 'authenticating' by
  // the first invocation's synchronous pre-await work, take the "wasn't
  // idle" branch below, and mark `booted` true immediately — ending the
  // boot window before the one real restore() call has actually settled.
  const attemptedBoot = useRef(false)

  useEffect(() => {
    if (attemptedBoot.current) return
    attemptedBoot.current = true
    if (useAuthStore.getState().status === 'idle') {
      void useAuthStore
        .getState()
        .restore()
        .finally(() => {
          booted.current = true
        })
    } else {
      booted.current = true
    }
  }, [])

  // Guest is a distinct status, checked first: it must never fall through
  // to the driveOptIn check below (specs.md §10.10 — a guest has no Drive
  // opt-in to answer, and never did).
  if (status === 'guest') return <>{children}</>
  if (status === 'authenticating' && !booted.current) return <ScreenLoading />
  if (status !== 'authenticated') return <WelcomeScreen />
  if (driveOptIn === 'pending') return <DrivePermissionScreen />
  return <>{children}</>
}
