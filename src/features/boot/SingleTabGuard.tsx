import { useEffect, type ReactNode } from 'react'
import { AppWindow } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { APP_NAME } from '@/lib/branding'
import { useSingleTabGuardStore } from '@/lib/singleTabGuard'

export const SingleTabGuard = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation('common')
  const phase = useSingleTabGuardStore((state) => state.phase)
  const init = useSingleTabGuardStore((state) => state.init)
  const retry = useSingleTabGuardStore((state) => state.retry)

  useEffect(() => {
    void init()
  }, [init])

  if (phase === 'checking') return null
  if (phase !== 'blocked') return <>{children}</>

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3.5 bg-background px-8 text-center text-foreground">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
        <AppWindow className="size-6" aria-hidden="true" />
      </div>
      <div>
        <p role="alert" className="text-base font-bold">
          {t('singleTabGuard.title')}
        </p>
        <p className="mt-1.5 text-ms leading-relaxed font-medium text-muted-foreground">
          {t('singleTabGuard.body', { appName: APP_NAME })}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void retry()}
        className="mt-1 h-11 rounded-2xl bg-primary px-6 text-sm font-bold text-primary-foreground"
      >
        {t('singleTabGuard.retry')}
      </button>
    </div>
  )
}
