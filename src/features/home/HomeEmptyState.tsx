import { Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export const HomeEmptyState = () => {
  const { t } = useTranslation('home')

  return (
    <div className="flex flex-col items-center gap-3.5 rounded-4xl border border-border-subtle bg-card px-6 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Wallet className="size-6" aria-hidden="true" />
      </div>
      <div>
        <p className="text-base font-bold">{t('empty.title')}</p>
        <p className="mt-1.5 text-ms leading-relaxed font-medium text-muted-foreground">
          {t('empty.body')}
        </p>
      </div>
    </div>
  )
}
