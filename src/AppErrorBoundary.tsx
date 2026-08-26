import { Component, type ErrorInfo, type ReactNode } from 'react'
import { APP_NAME } from '@/lib/branding'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

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
