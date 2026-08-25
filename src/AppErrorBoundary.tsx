import { Component, type ErrorInfo, type ReactNode } from 'react'
import { APP_NAME } from '@/lib/branding'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

// The only way to catch a render-time throw in React is a class component
// (no hook does this) — wraps AppLock + RouterProvider in main.tsx, so a
// throw *outside* the router's own tree (e.g. AppLock/LockScreen itself)
// still gets a fallback instead of a white screen. RouteErrorFallback
// (react-router's own `errorElement`) covers everything *inside* the router;
// the two are complementary, not redundant (docs/error-handling.md §7).
export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[AppErrorBoundary]', error, info.componentStack)
  }

  override render() {
    if (this.state.hasError) {
      return (
        // `min-h-full`, not `min-h-dvh`: overflows body's safe-area padding (specs.md §10.39).
        <main className="flex min-h-full flex-col items-center justify-center gap-3 bg-background px-7 text-center text-foreground">
          <p role="alert" className="text-base font-bold">
            {APP_NAME} tuvo un problema inesperado.
          </p>
          <p className="text-sm text-muted-foreground">Intenta recargar la página.</p>
        </main>
      )
    }
    return this.props.children
  }
}
