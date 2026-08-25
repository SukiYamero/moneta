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
 *
 * The `BottomNav` is real chrome, but `inert` here: its Home/History/Search
 * tabs are genuine `NavLink`s and would otherwise navigate the router while
 * this span is still up (the layout route's `RequireAuth`/`BootGate` don't
 * remount on that navigation, so the tap would silently redirect where the
 * app lands once it finishes booting, without changing anything on screen
 * in the meantime) — and the Add/Profile buttons are wired to `noop` since
 * their sheets need feature state this span doesn't have. `inert` keeps
 * both non-interactive without a different visual treatment.
 *
 * `h-full`, not `min-h-dvh` (specs.md §10.34) and not `min-h-full` (specs.md
 * §10.43): a `min-h-dvh` root would demand the full raw viewport from
 * inside `body`'s safe-area padding and overflow the page by the inset
 * amount (§10.34's bug, already fixed here). A `min-h-full` root is only a
 * floor, which leaves the `flex-1 overflow-y-auto` pane below with a
 * content-driven, not definite, height — so real long content grows the
 * whole document instead of scrolling inside the pane, masked only by
 * `BottomNav`'s own `fixed` positioning. `AppShell.tsx` had exactly this
 * shape and was moved to `h-full` for exactly this reason (§10.43); this
 * file mirrors `AppShell`'s geometry deliberately (see above) and shares
 * the same fix, `overscroll-y-contain` included, even though its skeleton
 * content is short enough that the floor rarely engages in practice.
 */
export const PreContentSkeleton = () => (
  <div className="relative flex h-full flex-col bg-background text-foreground">
    <div className="flex-1 overflow-y-auto overscroll-y-contain pb-(--bottom-nav-clearance)">
      <main className="min-h-full px-5 pt-(--screen-inset-top) pb-1">
        <HomeLoadingState />
      </main>
    </div>
    <div inert>
      <BottomNav profileOpen={false} onOpenProfile={noop} addOpen={false} onOpenAdd={noop} />
    </div>
  </div>
)
