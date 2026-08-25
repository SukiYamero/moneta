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
    // `min-h-full`, not `min-h-dvh`: `body` pads unconditionally by
    // `env(safe-area-inset-*)`, so an in-flow `min-h-dvh` root demands the raw
    // viewport on top of that and overflows by exactly the inset on a real
    // notch/home indicator (specs.md §10.34, §10.39).
    <div className="relative flex min-h-full flex-col bg-background text-foreground">
      <div className="flex-1 overflow-y-auto pb-(--bottom-nav-clearance)">
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
