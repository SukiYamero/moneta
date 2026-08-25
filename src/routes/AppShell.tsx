import { useState } from 'react'
import { Outlet } from 'react-router'
import { BottomNav } from '@/components/shared/BottomNav'
import { ProfileSheet } from '@/features/profile'
import {
  AddMovimientoSheet,
  MovimientoSheet,
  useMovimientoSheetStore,
} from '@/features/movimientos'

// Layout route for '/', '/search' and '/history' (src/router.tsx): BottomNav
// is designed as persistent chrome above all three tabs (z-index 19 over
// the 18 of the pushed/faded screens in the design source), so it lives
// here — mounted once — rather than inside each screen, or it would
// unmount/remount on every tab change and lose the native feel the
// push/fade transitions exist to create. The profile sheet's `open` state
// lives here too, not inside `BottomNav`: `ProfileSheet` is a
// `src/features/profile` concern, and `BottomNav` is a feature-agnostic
// shared component (`src/components/shared/**`) that only takes the
// callback, so the shell — not the shared chrome — owns the feature it
// opens (specs.md §10.18). `AddMovimientoSheet`/`MovimientoSheet` are
// mounted the same way, but their own open state lives in
// `movimientoSheetStore` (specs.md §10.23 Decision 2) rather than local
// `useState` here — Home/History/Search open `MovimientoSheet` directly
// through that store, so the shell only needs to forward the FAB's
// open/close through it, not own the state itself.
export const AppShell = () => {
  const [profileOpen, setProfileOpen] = useState(false)
  const addOpen = useMovimientoSheetStore((s) => s.addOpen)
  const openAdd = useMovimientoSheetStore((s) => s.openAdd)

  return (
    // `h-full`, not `min-h-full`: a floor leaves the flex-1 pane's own height
    // content-driven rather than definite, so a percentage-height descendant
    // (e.g. RouteErrorFallback nested as a leaf-route error) collapses to
    // content size instead of filling it (specs.md §12, §10.43). `h-full`
    // resolves against the real html/body/#root chain, same as `min-h-full`
    // (specs.md §10.39) — not `min-h-dvh`, still banned in flow (guard).
    <div className="relative flex h-full flex-col bg-background text-foreground">
      {/* overscroll-y-contain: with a definite shell height, this pane is
          the app's real (and only) scroll container — an at-boundary drag
          shouldn't chain into the shell root or the document behind it,
          same reasoning as BottomSheet/FullScreenPanel (specs.md §10.35.1). */}
      <div className="flex-1 overflow-y-auto overscroll-y-contain pb-(--bottom-nav-clearance)">
        <Outlet />
      </div>
      <BottomNav
        profileOpen={profileOpen}
        onOpenProfile={() => setProfileOpen(true)}
        addOpen={addOpen}
        onOpenAdd={openAdd}
      />
      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
      <AddMovimientoSheet />
      <MovimientoSheet />
    </div>
  )
}
