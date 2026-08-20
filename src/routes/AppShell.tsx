import { useState } from 'react'
import { Outlet } from 'react-router'
import { BottomNav } from '@/components/shared/BottomNav'
import { ProfileSheet } from '@/features/profile'

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
// opens (specs.md §10.18).
export const AppShell = () => {
  const [profileOpen, setProfileOpen] = useState(false)

  return (
    <div className="relative flex min-h-dvh flex-col bg-background text-foreground">
      <div className="flex-1 overflow-y-auto pb-(--bottom-nav-clearance)">
        <Outlet />
      </div>
      <BottomNav profileOpen={profileOpen} onOpenProfile={() => setProfileOpen(true)} />
      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  )
}
