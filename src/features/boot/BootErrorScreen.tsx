import { CircleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { RepoErrorCode } from '@/lib/repo'
import { repoErrorCopyKey } from '@/lib/errorCopy'

export interface BootErrorScreenProps {
  code: RepoErrorCode
  onRetry: () => void
}

export const BootErrorScreen = ({ code, onRetry }: BootErrorScreenProps) => {
  const { t } = useTranslation('common')

  return (
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
