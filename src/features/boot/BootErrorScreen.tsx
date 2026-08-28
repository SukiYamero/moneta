import { CircleAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RepoErrorCode } from '@/lib/repo'
import { repoErrorCopyKey } from '@/lib/errorCopy'
import { clearLocalDatabaseAndReload } from '@/lib/bootRecovery'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'

export interface BootErrorScreenProps {
  code: RepoErrorCode
  onRetry: () => void
}

export const BootErrorScreen = ({ code, onRetry }: BootErrorScreenProps) => {
  const { t } = useTranslation('common')
  const [confirmOpen, setConfirmOpen] = useState(false)

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
      {code === 'schema_mismatch' && (
        <>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="h-11 rounded-2xl px-6 text-sm font-bold text-danger"
          >
            {t('error.recover.cta')}
          </button>
          <ConfirmDialog
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            onConfirm={() => {
              setConfirmOpen(false)
              void clearLocalDatabaseAndReload()
            }}
            title={t('error.recover.confirmTitle')}
            description={t('error.recover.confirmDescription')}
            cancelLabel={t('error.recover.cancelCta')}
            confirmLabel={t('error.recover.confirmCta')}
            destructive
          />
        </>
      )}
    </div>
  )
}
