import { isRouteErrorResponse, useRouteError } from 'react-router'
import { APP_NAME } from '@/lib/branding'

export const RouteErrorFallback = () => {
  const error = useRouteError()
  console.error('[RouteErrorFallback]', error)

  const detail = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : undefined

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-3 bg-background px-7 text-center text-foreground">
      <p role="alert" className="text-base font-bold">
        {APP_NAME} tuvo un problema inesperado.
      </p>
      <p className="text-sm text-muted-foreground">Intenta recargar la página.</p>
      {detail ? <p className="text-sm text-fg-disabled">{detail}</p> : null}
    </main>
  )
}
