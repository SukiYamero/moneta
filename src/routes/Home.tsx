import { Button } from '@/components/ui/button'

export function Home() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-bold">Moneta</h1>
      <p className="text-muted-foreground">Personal finance, stored in your own Google Drive.</p>
      <Button>Get started</Button>
    </main>
  )
}
