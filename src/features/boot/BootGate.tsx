import { useEffect, type ReactNode } from 'react'
import { useBootStore } from '@/lib/boot'
import { PreContentSkeleton } from '@/features/boot/PreContentSkeleton'
import { BootErrorScreen } from '@/features/boot/BootErrorScreen'

/**
 * Wraps the protected app content (`src/router.tsx`, inside `RequireAuth`)
 * and runs the boot sequence: resolve the active profile, bind it, load its
 * data, then render — never beneath the lock screen (`AppLock` already
 * gates everything above `RequireAuth`, which is what mounts this).
 *
 * No brand floor (specs.md §10.29 — withdrawn the same day it was decided,
 * §10.28): `BootGate` is only ever reached once `RequireAuth` has already
 * let a device through (returning, freshly authenticated, or guest), so
 * there is always real content on the way — the same `PreContentSkeleton`
 * `RequireAuth` shows during its own span covers this one too, with no
 * change of treatment between them. A remount that finds the boot store
 * already `'ready'` (e.g. navigating from `/` to `/settings`, separate
 * top-level routes) renders `children` instantly — falls out of the status
 * check below with no extra state needed, unlike the old floor.
 */
export const BootGate = ({ children }: { children: ReactNode }) => {
  const status = useBootStore((s) => s.status)
  const error = useBootStore((s) => s.error)
  const run = useBootStore((s) => s.run)

  useEffect(() => {
    void run()
  }, [run])

  // An error is terminal, not "work continuing" (docs/error-handling.md:
  // never dress up a failure as still-loading).
  if (status === 'error')
    return <BootErrorScreen code={error ?? 'unknown'} onRetry={() => void run()} />
  if (status !== 'ready') return <PreContentSkeleton />
  return <>{children}</>
}
