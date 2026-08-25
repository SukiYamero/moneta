import { useCallback, useEffect, useState } from 'react'
import { CircleAlert, WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { APP_NAME } from '@/lib/branding'
import { useNetworkStore } from '@/lib/networkStore'
import { getSyncContext } from '@/lib/sync/syncSession'
import { pull, useSyncStore } from '@/lib/sync/engine'

export interface DriveDownloadScreenProps {
  /** Called once the pull that gates this screen has actually succeeded. */
  onDone: () => void
}

/**
 * The first-run download view (specs.md §10.19/§10.26 §3): the one
 * legitimate full-screen gate §10.9 allows, because a fresh Drive-linked
 * profile genuinely has nothing truthful to render behind it — a dashboard
 * of zeros here reads as data loss, not as "nothing yet." Built from
 * existing primitives per the user's 2026-08-20 decision (`specs.md`
 * §10.26 §3) rather than blocked on a canvas design; replaceable in place
 * if one lands later.
 */
export const DriveDownloadScreen = ({ onDone }: DriveDownloadScreenProps) => {
  const { t } = useTranslation(['sync', 'common'])
  const online = useNetworkStore((s) => s.online)
  const progress = useSyncStore((s) => s.pullProgress)
  const [failed, setFailed] = useState(false)

  const attempt = useCallback(async () => {
    setFailed(false)
    const ctx = await getSyncContext()
    if (!ctx) {
      // Not expected on the real path (FirstSyncGate only renders this
      // screen once it has already confirmed eligibility) — degrades
      // honestly rather than hanging on a spinner forever if it somehow
      // does happen (a token reacquire failing at the worst moment).
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
    if (!online) return // offline: say so, don't attempt and fail generically (specs.md §10.11)
    void attempt()
    // Retried automatically the moment the connection returns — `online`
    // flipping false→true is exactly the "reconnect" trigger `attempt`
    // itself has no other way to observe.
  }, [attempt, online])

  const progressLabel =
    progress !== null
      ? t(progress.total === 1 ? 'download.progress_one' : 'download.progress_other', {
          done: progress.done,
          total: progress.total,
        })
      : null

  return (
    // `min-h-full`, not `min-h-dvh`: `body` pads unconditionally by
    // `env(safe-area-inset-*)`, so an in-flow `min-h-dvh` root demands the raw
    // viewport on top of that and overflows by exactly the inset on a real
    // notch/home indicator (specs.md §10.34, §10.39).
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
