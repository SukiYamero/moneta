import { Cloud, Coins, FileText, KeyRound, Loader2, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '@/lib/authStore'
import { APP_NAME } from '@/lib/branding'
import { driveErrorCopy } from '@/features/auth/errorCopy'

export const DrivePermissionScreen = () => {
  const connecting = useAuthStore((s) => s.driveConnecting)
  const error = useAuthStore((s) => s.driveError)
  const connectDrive = useAuthStore((s) => s.connectDrive)
  const dismissDrive = useAuthStore((s) => s.dismissDrive)

  return (
    <main className="relative flex min-h-dvh flex-col bg-background text-foreground">
      <div className="flex flex-1 flex-col overflow-y-auto px-7 pt-16">
        <div className="my-5 flex items-center justify-center gap-3.5">
          <div className="flex size-15 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary),black_18%))] text-primary-foreground">
            <Coins className="size-8" strokeWidth={2.25} />
          </div>
          <div className="flex gap-1.5" aria-hidden="true">
            <span className="size-1.5 rounded-full bg-fg-disabled" />
            <span className="size-1.5 rounded-full bg-fg-faint" />
            <span className="size-1.5 rounded-full bg-fg-disabled" />
          </div>
          <div className="flex size-15 items-center justify-center rounded-2xl bg-info/15 text-info">
            <Cloud className="size-7" strokeWidth={2.25} />
          </div>
        </div>

        <h1 className="text-center text-2xl leading-snug font-extrabold tracking-tight text-balance">
          {APP_NAME} quiere guardar en tu Google Drive
        </h1>
        <p className="mt-3 text-center text-base leading-relaxed font-medium text-muted-foreground">
          Como no usamos servidores, tus gastos e ingresos se guardan en un archivo privado dentro
          de tu propio Drive.
        </p>

        <div className="mt-6 overflow-hidden rounded-3xl border border-border-subtle bg-card">
          <div className="flex gap-3.5 border-b border-border-subtle p-4">
            <div className="flex size-9.5 shrink-0 items-center justify-center rounded-md bg-success/15 text-success">
              <FileText className="size-4.5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold">Crear y editar sus propios archivos</p>
              <p className="mt-0.5 text-sm leading-snug font-medium text-muted-foreground">
                {APP_NAME} solo verá y modificará los archivos que ella misma crea.
              </p>
            </div>
          </div>
          <div className="flex gap-3.5 p-4">
            <div className="flex size-9.5 shrink-0 items-center justify-center rounded-md bg-info/15 text-info">
              <KeyRound className="size-4.5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold">No accede a tus otros archivos</p>
              <p className="mt-0.5 text-sm leading-snug font-medium text-muted-foreground">
                Tus fotos, documentos y demás contenido siguen siendo privados.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-fg-disabled">
          <ShieldCheck className="size-3.5" />
          Puedes revocar el acceso cuando quieras
        </div>
      </div>

      <div className="flex flex-col gap-2.5 px-7 pb-10">
        {error ? (
          <p role="alert" className="text-center text-sm font-medium text-destructive">
            {driveErrorCopy(error)}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void connectDrive()}
          disabled={connecting}
          className="h-13.5 rounded-2xl bg-[linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary),black_18%))] text-base font-extrabold text-primary-foreground transition-opacity disabled:opacity-60"
        >
          Permitir y continuar
        </button>
        <button
          type="button"
          onClick={dismissDrive}
          disabled={connecting}
          className="h-12.5 rounded-2xl bg-transparent text-md font-bold text-muted-foreground disabled:opacity-60"
        >
          Ahora no
        </button>
      </div>

      {connecting ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-background/75">
          <Loader2 className="size-10 animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm font-semibold text-fg-secondary">Conectando con tu Drive…</p>
        </div>
      ) : null}
    </main>
  )
}
