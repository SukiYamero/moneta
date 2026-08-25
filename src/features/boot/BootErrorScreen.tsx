import { CircleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { RepoErrorCode } from '@/lib/repo'
import { repoErrorCopyKey } from '@/lib/errorCopy'

export interface BootErrorScreenProps {
  code: RepoErrorCode
  onRetry: () => void
}

/**
 * The honest failure §10.28 requires — never a white screen, never a silent
 * fallback to the fake repo. Full-screen because there is nothing else on
 * screen yet to render it inline next to (docs/error-handling.md §7: this
 * is the "screen IS the single decision" case, same reasoning as
 * `WelcomeScreen`/`DrivePermissionScreen`), styled after `HomeErrorState`'s
 * card treatment rather than inventing a fourth error surface.
 */
export const BootErrorScreen = ({ code, onRetry }: BootErrorScreenProps) => {
  const { t } = useTranslation('common')

  return (
    // `min-h-full`, not `min-h-dvh`: `body` pads unconditionally by
    // `env(safe-area-inset-*)`, so an in-flow `min-h-dvh` root demands the raw
    // viewport on top of that and overflows by exactly the inset on a real
    // notch/home indicator (specs.md §10.34, §10.39).
    <div className="flex min-h-full flex-col items-center justify-center gap-3.5 bg-background px-8 text-center text-foreground">
      <div className="flex size-14 items-center justify-center rounded-full bg-danger/15 text-danger">
        <CircleAlert className="size-6" aria-hidden="true" />
      </div>
      <div>
        <p role="alert" className="text-base font-bold">
          {t('error.title')}
        </p>
        <p className="mt-1.5 text-ms leading-relaxed font-medium text-muted-foreground">
          {t(repoErrorCopyKey(code))}
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 h-11 rounded-2xl bg-primary px-6 text-sm font-bold text-primary-foreground"
      >
        {t('error.retry')}
      </button>
    </div>
  )
}
