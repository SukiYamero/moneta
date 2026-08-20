import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useBootStore } from '@/lib/boot'
import { BootScreen } from '@/features/boot/BootScreen'
import { BootErrorScreen } from '@/features/boot/BootErrorScreen'

// A floor, not a duration (specs.md §10.28): a slow boot holds this screen
// until the work is genuinely done, so this is only ever a *minimum*.
const BRAND_FLOOR_MS = 800

/**
 * Wraps the protected app content (`src/router.tsx`, inside `RequireAuth`)
 * and runs the boot sequence: resolve the active profile, bind it, load its
 * data, then render — never beneath the lock screen (`AppLock` already
 * gates everything above `RequireAuth`, which is what mounts this).
 *
 * The floor only applies to a genuine first boot (or a rebind after an
 * account switch). `RequireAuth` mounts a fresh `BootGate` per top-level
 * route (`/` vs `/settings` are siblings, not nested — navigating between
 * them remounts whichever one is active), so a remount that finds the boot
 * store already 'ready' must render `children` instantly — re-showing the
 * brand screen on every such navigation would violate specs.md §10.9's "no
 * per-navigation loader".
 */
export const BootGate = ({ children }: { children: ReactNode }) => {
  const status = useBootStore((s) => s.status)
  const error = useBootStore((s) => s.error)
  const run = useBootStore((s) => s.run)

  const [alreadyReadyAtMount] = useState(() => status === 'ready')
  const floorStartedAtRef = useRef(Date.now())
  const [floorDone, setFloorDone] = useState(alreadyReadyAtMount)

  useEffect(() => {
    void run()
  }, [run])

  useEffect(() => {
    if (alreadyReadyAtMount) return
    if (status !== 'ready' && status !== 'error') return
    const remaining = Math.max(0, BRAND_FLOOR_MS - (Date.now() - floorStartedAtRef.current))
    if (remaining === 0) {
      setFloorDone(true)
      return
    }
    const timer = setTimeout(() => setFloorDone(true), remaining)
    return () => clearTimeout(timer)
  }, [status, alreadyReadyAtMount])

  // An error is terminal, not "work continuing" — showing it immediately
  // rather than waiting out the floor is the honest choice (docs/error-
  // handling.md: never let an error land nowhere, never dress it up as
  // still-loading).
  if (status === 'error')
    return <BootErrorScreen code={error ?? 'unknown'} onRetry={() => void run()} />
  if (!floorDone) return <BootScreen />
  return <>{children}</>
}
