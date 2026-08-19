import { LockSettings } from '@/features/lock/LockSettings'
import { APP_NAME } from '@/lib/branding'

export const Home = () => {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-bold">{APP_NAME}</h1>
      <p className="text-muted-foreground">Personal finance, local-first.</p>
      <LockSettings />
    </main>
  )
}
