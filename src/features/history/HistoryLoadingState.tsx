import { useTranslation } from 'react-i18next'
import { Skeleton, SkeletonGroup } from '@/components/shared'

const SKELETON_ROW_KEYS = ['row-1', 'row-2', 'row-3'] as const

/** Tier 2 (specs.md §10.9): only the breakdown card + movements list fill
 * in — the period nav, scope tabs and picker strip above it stay mounted
 * and interactive regardless of status (they resolve against defaults). */
export const HistoryLoadingState = () => {
  const { t } = useTranslation('history')

  return (
    <SkeletonGroup label={t('loading')} className="flex flex-col gap-4">
      <Skeleton className="h-45 rounded-4xl" />
      <div className="flex flex-col gap-2.5">
        {SKELETON_ROW_KEYS.map((key) => (
          <Skeleton key={key} className="h-16.5 rounded-xl" />
        ))}
      </div>
    </SkeletonGroup>
  )
}
