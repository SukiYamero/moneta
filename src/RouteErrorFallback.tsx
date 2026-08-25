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
    // html/body/#root chain as the other eight files, where `min-h-full`
    // fills and centers correctly (reproduced) — or replacing just a leaf
    // route (Home/Search/History throwing) inside AppShell's own
    // `flex-1 overflow-y-auto` pane. In that second, nested case `min-h-full`
    // does NOT fill: AppShell's root is `min-h-full` too (a floor, not a
    // fixed height), so its flex-1 child's own height is content-driven, not
    // definite, and a percentage-based min-height on a descendant collapses
    // to content size instead of filling the pane (reproduced — the message
    // still renders in full, just top-aligned instead of centered; no
    // overflow, no clipped/unreadable content). `min-h-dvh` isn't a fix
    // either: reverting to it here would refill the nested case (dvh is
    // viewport-relative, immune to the ancestor's indefinite height) but
    // reintroduce the original bug for the far more common top-level case,
    // and would fail the lint guard for this shape. Fixing the nested case
    // for real needs a change outside this file (see specs.md §10.39.1) —
    // flagged there rather than patched speculatively.
    <main className="flex min-h-full flex-col items-center justify-center gap-3 bg-background px-7 text-center text-foreground">
      <p role="alert" className="text-base font-bold">
        {APP_NAME} tuvo un problema inesperado.
      </p>
      <p className="text-sm text-muted-foreground">Intenta recargar la página.</p>
      {detail ? <p className="text-xs text-fg-disabled">{detail}</p> : null}
    </main>
  )
}
