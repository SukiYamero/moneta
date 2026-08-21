import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuthStore } from '@/lib/authStore'
import { hasLoggedInBefore, hasUsedGuestBefore } from '@/lib/deviceStore'
import { WelcomeScreen } from '@/features/auth/WelcomeScreen'
import { DrivePermissionScreen } from '@/features/auth/DrivePermissionScreen'
import { GuestAdoptionPrompt } from '@/features/auth/GuestAdoptionPrompt'
import { ReturningUserScreen } from '@/features/auth/ReturningUserScreen'
import { PreContentSkeleton } from '@/features/boot/PreContentSkeleton'

// RequireAuth only ever mounts with status 'idle' on a cold boot with no PIN
// lock enabled — AppLock withholds it behind LockScreen while a vault exists,
// and lockStore.resume() already settles status (authenticated/error) before
// handing off. So a single idle-gated restore attempt here can't race that path.
export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const status = useAuthStore((s) => s.status)
  const driveOptIn = useAuthStore((s) => s.driveOptIn)

  // Whether this device has been used before — by either path (specs.md
  // §10.33): a completed Google login, or a prior guest entry. The one
  // signal that decides what covers the pre-content span. `null` means
  // genuinely not known yet — two real IndexedDB reads, not a microtask, so
  // there is a real (if brief) window where no answer is safe to assume.
  // Read independently of `restore()`'s own internal checks of the same two
  // markers (authStore.ts, not owned by this track) rather than trusting
  // them to resolve in lockstep — see the effect below for why they are
  // sequenced, not run in parallel with restore() itself.
  const [returning, setReturning] = useState<boolean | null>(null)
  // Distinct from `status === 'authenticating'`: that value means both
  // "restore() is running" and, after a failed silent reattempt, briefly
  // "restore() is about to run" (both pass through the same synchronous
  // idle->authenticating flip). Only this flag disambiguates "restore has
  // concluded" from "hasn't started yet" — both of which can be `status ===
  // 'idle'`.
  const [restoreSettled, setRestoreSettled] = useState(false)
  // Guards the effect body itself, not just its restore() call: StrictMode
  // (main.tsx) double-invokes this effect on every mount, same component
  // instance (refs survive the pair).
  const attemptedBoot = useRef(false)

  useEffect(() => {
    if (attemptedBoot.current) return
    attemptedBoot.current = true
    void (async () => {
      // Sequenced (this Promise.all is between RequireAuth's own two marker
      // reads, not against restore() — restore() is still only started once
      // both have resolved), not run in parallel with restore()'s own
      // internal marker reads: if it were, a returning device could see
      // `returning` still `null` for a moment *after* `status` has already
      // left 'idle' — landing on the "not known yet" branch even though
      // restore() itself already proved a marker true, showing nothing (or
      // worse, the wrong screen) for a returning user. Reading both first,
      // then only starting restore() once the combined answer is known,
      // makes that race structurally impossible instead of merely unlikely.
      const [loggedInBefore, usedGuestBefore] = await Promise.all([
        hasLoggedInBefore(),
        hasUsedGuestBefore(),
      ])
      const before = loggedInBefore || usedGuestBefore
      if (useAuthStore.getState().status === 'idle') {
        // Kicked off before the state update below commits (both still
        // synchronous, no `await` between them) — restore() flips `status`
        // to 'authenticating' synchronously on its first line, so React 18's
        // automatic batching lands `returning` and that status flip in the
        // same render, never a frame with one but not the other.
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

  // Guest is a distinct status, checked first: it must never fall through
  // to the driveOptIn check below (specs.md §10.10 — a guest has no Drive
  // opt-in to answer, and never did).
  if (status === 'guest') return <>{children}</>
  if (status === 'authenticated') {
    if (driveOptIn === 'pending') return <DrivePermissionScreen />
    // specs.md §10.32: a modal over the settled app, not a second
    // full-screen gate — Home is already real and usable underneath while
    // the person decides. Renders nothing itself when there is no pending
    // offer (the overwhelmingly common case).
    return (
      <>
        {children}
        <GuestAdoptionPrompt />
      </>
    )
  }

  // Not authenticated, not guest: the pre-content span (specs.md §10.29).
  // Nothing is promised until the marker itself is known — a genuinely
  // blank frame is the honest choice here, since either assumption (Welcome
  // or the skeleton) risks the exact flash this section exists to prevent.
  if (returning === null) return null
  if (returning && !restoreSettled) return <PreContentSkeleton />
  // Once settled: a marked device whose restore didn't land on
  // 'authenticated' is the "uncomfortable case" §10.29 accepts deliberately
  // — the same person, recognised by name, not a stranger.
  return returning ? <ReturningUserScreen /> : <WelcomeScreen />
}
