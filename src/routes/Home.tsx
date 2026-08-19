import { APP_NAME } from '@/lib/branding'

// The bottom nav / FAB / dashboard shell (Track L, docs/wave-2/track-l.md)
// is blocked on a DesignSync pull that was unavailable this session — this
// placeholder keeps '/' rendering until that lands. LockSettings moved to
// /kit (src/routes/Kit.tsx): see that file and docs/wave-2/track-l.md for
// why and how it was verified.
export const Home = () => {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-bold">{APP_NAME}</h1>
      <p className="text-muted-foreground">Personal finance, local-first.</p>
    </main>
  )
}
