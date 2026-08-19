import { useTranslation } from 'react-i18next'

const SKELETON_ROW_KEYS = ['row-1', 'row-2', 'row-3'] as const

/** Skeleton shape matching the loaded layout — `animate-pulse` already respects
 * `prefers-reduced-motion` via the global override in index.css. */
export const HomeLoadingState = () => {
  const { t } = useTranslation('home')

  return (
    <div aria-busy="true" className="flex flex-col gap-4.5">
      <span className="sr-only" role="status">
        {t('loading')}
      </span>
      <div aria-hidden="true" className="h-50 animate-pulse rounded-4xl bg-card" />
      <div aria-hidden="true" className="h-38 animate-pulse rounded-4xl bg-card" />
      <div aria-hidden="true" className="h-17 animate-pulse rounded-3xl bg-card" />
      <div aria-hidden="true" className="flex flex-col gap-2.5">
        {SKELETON_ROW_KEYS.map((key) => (
          <div key={key} className="h-16.5 animate-pulse rounded-xl bg-card" />
        ))}
      </div>
    </div>
  )
}
