import { useCallback, useEffect, useState } from 'react'
import { CircleAlert, WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { APP_NAME } from '@/lib/branding'
import { useNetworkStore } from '@/lib/networkStore'
import { getSyncContext } from '@/lib/sync/syncSession'
import { pull, useSyncStore } from '@/lib/sync/engine'

export interface DriveDownloadScreenProps {
  onDone: () => void
}

export const DriveDownloadScreen = ({ onDone }: DriveDownloadScreenProps) => {
  const { t } = useTranslation(['sync', 'common'])
  const online = useNetworkStore((s) => s.online)
  const progress = useSyncStore((s) => s.pullProgress)
  const [failed, setFailed] = useState(false)

  const attempt = useCallback(async () => {
    setFailed(false)
    const ctx = await getSyncContext()
    if (!ctx) {
      setFailed(true)
      return
    }
    try {
      await pull(ctx.token, ctx.profile, ctx.locale)
      onDone()
    } catch {
      setFailed(true)
    }
  }, [onDone])

  useEffect(() => {
    if (!online) return
    void attempt()
  }, [attempt, online])

  const progressLabel =
    progress !== null
      ? t(progress.total === 1 ? 'download.progress_one' : 'download.progress_other', {
          done: progress.done,
          total: progress.total,
        })
      : null

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-5 bg-background px-8 text-center text-foreground">
      <div
        aria-hidden="true"
        className="flex size-[5.25rem] items-center justify-center rounded-4xl bg-[linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary),black_18%))] text-3xl font-extrabold text-primary-foreground"
      >
        {APP_NAME.charAt(0)}
      </div>

      {!online ? (
        <div role="alert" className="flex flex-col items-center gap-2">
          <WifiOff className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-base font-bold">{t('download.offlineTitle')}</p>
          <p className="max-w-xs text-ms leading-relaxed font-medium text-muted-foreground">
            {t('download.offlineBody')}
          </p>
        </div>
      ) : failed ? (
        <div role="alert" className="flex flex-col items-center gap-3.5">
          <div className="flex size-14 items-center justify-center rounded-full bg-danger/15 text-danger">
            <CircleAlert className="size-6" aria-hidden="true" />
          </div>
          <p className="text-base font-bold">{t('download.failedTitle')}</p>
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => void attempt()}
              className="h-11 rounded-2xl bg-primary px-6 text-sm font-bold text-primary-foreground"
            >
              {t('download.retry')}
            </button>
            <button
              type="button"
              onClick={onDone}
              className="h-11 rounded-2xl px-6 text-sm font-bold text-fg-secondary underline underline-offset-4"
            >
              {t('download.continueLocal')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xl font-extrabold tracking-tight">{t('download.title')}</p>
          <p className="text-sm font-medium text-fg-secondary">{t('download.subtitle')}</p>
          <div role="status" className="text-sm font-semibold text-fg-secondary">
            {progressLabel ?? t('common:loading')}
          </div>
        </>
      )}
    </div>
  )
}
