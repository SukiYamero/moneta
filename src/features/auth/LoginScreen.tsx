import { useAuthStore } from '@/lib/authStore'
import { Button } from '@/components/ui/button'

export function LoginScreen() {
  const status = useAuthStore((s) => s.status)
  const error = useAuthStore((s) => s.error)
  const login = useAuthStore((s) => s.login)
  const busy = status === 'authenticating'

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Moneta</h1>
        <p className="text-muted-foreground text-sm">Tus finanzas, en tu propio Google Drive.</p>
      </div>
      <Button type="button" onClick={() => void login()} disabled={busy} className="min-h-11 px-6">
        {busy ? 'Conectando…' : 'Entrar con Google'}
      </Button>
      {status === 'error' && error ? (
        <p role="alert" className="text-destructive text-sm">
          No se pudo iniciar sesión: {error}
        </p>
      ) : null}
    </main>
  )
}
