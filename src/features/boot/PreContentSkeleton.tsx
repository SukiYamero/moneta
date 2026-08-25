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
 * `min-h-full`, not `min-h-dvh` (specs.md §10.34): `body` already pads by
 * `env(safe-area-inset-top/bottom)`, so a `min-h-dvh` root here would be
 * forced to at least the full viewport height while sitting inside a
 * `body` content box already shrunk by that same inset — overflowing it
 * by exactly the inset amount on any real notched/home-indicator device
 * (invisible in browser chrome, where the inset is `0`, which is why nobody
 * had seen it). `min-h-full` resolves against the real ancestor chain
 * (`html`/`body`/`#root` are all `height: 100%`) instead of the raw
 * viewport, so it can never demand more room than `body`'s own padded
 * content box actually has. `AppShell.tsx` has the identical `min-h-dvh`
 * root and is very likely subject to the same bug — flagged for the
 * operator, not fixed here (outside this track's file ownership).
 */
export const PreContentSkeleton = () => (
  <div className="relative flex min-h-full flex-col bg-background text-foreground">
    <div className="flex-1 overflow-y-auto pb-(--bottom-nav-clearance)">
      <main className="min-h-full px-5 pt-(--screen-inset-top) pb-1">
        <HomeLoadingState />
      </main>
    </div>
    <div inert>
      <BottomNav profileOpen={false} onOpenProfile={noop} addOpen={false} onOpenAdd={noop} />
    </div>
  </div>
)
