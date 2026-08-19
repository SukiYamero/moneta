import { APP_NAME } from '@/lib/branding'

// Placeholder body only: the dashboard content is Track E2's (docs/
// wave-2-plan.md §4). The shell around it — persistent bottom nav, layout
// route — is already live via AppShell. LockSettings moved to the dev-only
// /kit route so rebuilding this file cannot delete the PIN lock's only UI.
export const Home = () => {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-bold">{APP_NAME}</h1>
      <p className="text-muted-foreground">Personal finance, local-first.</p>
    </main>
  )
}
