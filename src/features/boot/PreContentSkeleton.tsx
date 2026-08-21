import { BottomNav } from '@/components/shared'
import { HomeLoadingState } from '@/features/home/HomeLoadingState'

const noop = () => {}

/**
 * What covers the pre-content span (specs.md §10.29) for a device that has
 * logged in before — never a full-screen loading treatment, so it reuses
 * the real chrome (`BottomNav`) and the real Home skeleton
 * (`HomeLoadingState`) rather than a distinct screen, and mirrors `AppShell`/
 * `Home`'s own layout classes so the transition into the real thing reads as
 * a fill, not a swap. Deliberately not `AppShell` relocated (§10.29's own
 * blast radius rules that out): no `Outlet`, no profile/add sheets, no
 * routing state — those all need data this span doesn't have yet.
 *
 * Used identically by `RequireAuth` (while a returning device's `restore()`
 * is still resolving) and `BootGate` (while the profile/data bind is still
 * running), so the two spans render the same output and the handoff between
 * them is never itself a visual change.
 */
export const PreContentSkeleton = () => (
  <div className="relative flex min-h-dvh flex-col bg-background text-foreground">
    <div className="flex-1 overflow-y-auto pb-(--bottom-nav-clearance)">
      <main className="min-h-full px-5 pt-2 pb-1">
        <HomeLoadingState />
      </main>
    </div>
    <BottomNav profileOpen={false} onOpenProfile={noop} addOpen={false} onOpenAdd={noop} />
  </div>
)
