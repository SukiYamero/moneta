import { useEffect, type ReactNode } from 'react'
import { useBootStore } from '@/lib/boot'
import { PreContentSkeleton } from '@/features/boot/PreContentSkeleton'
import { BootErrorScreen } from '@/features/boot/BootErrorScreen'

export const BootGate = ({ children }: { children: ReactNode }) => {
  const status = useBootStore((s) => s.status)
  const error = useBootStore((s) => s.error)
  const run = useBootStore((s) => s.run)

  useEffect(() => {
    void run()
  }, [run])

  if (status === 'error')
    return <BootErrorScreen code={error ?? 'unknown'} onRetry={() => void run()} />
  if (status !== 'ready') return <PreContentSkeleton />
  return <>{children}</>
}
