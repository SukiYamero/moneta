import { isRouteErrorResponse, useRouteError } from 'react-router'
import { APP_NAME } from '@/lib/branding'

// react-router's own error boundary mechanism (`errorElement` on a route in
// src/router.tsx) — catches a render/loader throw anywhere under that route
// without taking down the rest of the app. docs/error-handling.md §7: the
// technical detail goes to console only, the DOM only ever gets fixed,
// translated copy.
export const RouteErrorFallback = () => {
  const error = useRouteError()
  console.error('[RouteErrorFallback]', error)

  const detail = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : undefined

  return (
    // `min-h-full`, not `min-h-dvh`: `body` pads unconditionally by
    // `env(safe-area-inset-*)`, so an in-flow `min-h-dvh` root demands the raw
    // viewport on top of that and overflows by exactly the inset on a real
    // notch/home indicator (specs.md §10.34, §10.39). This component renders
    // as `errorElement` in two structurally different spots (src/router.tsx):
    // replacing the whole top-level layout route (RequireAuth/BootGate/
    // FirstSyncGate/AppShell throwing) — a direct descendant of the same
    // html/body/#root chain as the other eight files — or replacing just a
    // leaf route (Home/Search/History throwing) inside AppShell's own
    // `flex-1 overflow-y-auto` pane. Both fill and center correctly
    // (reproduced, specs.md §10.43): AppShell's root is `h-full` (a definite
    // value, not a floor — specs.md §12), so its one flex-1 child's height is
    // itself definite, and this file's own `min-h-full` resolves against
    // that instead of collapsing to content size the way it did against the
    // old `min-h-full` floor.
    <main className="flex min-h-full flex-col items-center justify-center gap-3 bg-background px-7 text-center text-foreground">
      <p role="alert" className="text-base font-bold">
        {APP_NAME} tuvo un problema inesperado.
      </p>
      <p className="text-sm text-muted-foreground">Intenta recargar la página.</p>
      {detail ? <p className="text-xs text-fg-disabled">{detail}</p> : null}
    </main>
  )
}
