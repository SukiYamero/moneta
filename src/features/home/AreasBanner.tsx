import { ChevronRight, LayoutGrid } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { IconAvatar } from '@/components/shared/IconAvatar'

export const AreasBanner = () => {
  const { t } = useTranslation('home')

  return (
    <button
      type="button"
      disabled
      aria-label={t('areas.title')}
      className="flex w-full items-center gap-3.25 rounded-3xl border border-border-subtle bg-card px-4 py-3.75 text-left disabled:opacity-100"
    >
      <IconAvatar icon={LayoutGrid} tint="neutral" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-fg-disabled">{t('areas.title')}</div>
        <div className="mt-0.5 truncate text-ms font-medium text-fg-disabled">
          {t('areas.meta')}
        </div>
      </div>
      <ChevronRight className="size-3.5 text-fg-disabled" aria-hidden="true" />
    </button>
  )
}
