import { CircleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { RepoErrorCode } from '@/lib/repo'
import { repoErrorCopyKey } from '@/lib/errorCopy'

export interface HomeErrorStateProps {
  code: RepoErrorCode
  onRetry: () => void
}

/** Inline, on this screen — dataStore.load() owns Home's data, so its
 * failure lands here, not a toast (docs/error-handling.md §7). */
export const HomeErrorState = ({ code, onRetry }: HomeErrorStateProps) => {
  const { t } = useTranslation('home')

  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3.5 rounded-4xl border border-border-subtle bg-card px-6 py-12 text-center"
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-danger/15 text-danger">
        <CircleAlert className="size-6" aria-hidden="true" />
      </div>
      <div>
        <p className="text-base font-bold">{t('error.title')}</p>
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
