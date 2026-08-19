import { Outlet } from 'react-router'
import { BottomNav } from '@/components/shared/BottomNav'

// Layout route for '/', '/search' and '/history' (src/router.tsx): BottomNav
// is designed as persistent chrome above all three tabs (z-index 19 over
// the 18 of the pushed/faded screens in the design source), so it lives
// here — mounted once — rather than inside each screen, or it would
// unmount/remount on every tab change and lose the native feel the
// push/fade transitions exist to create.
export const AppShell = () => {
  return (
    <div className="relative flex min-h-dvh flex-col bg-background text-foreground">
      <div className="flex-1 overflow-y-auto pb-30">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  )
}
