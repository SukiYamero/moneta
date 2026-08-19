import { useTranslation } from 'react-i18next'
import { Skeleton, SkeletonGroup } from '@/components/shared'

const SKELETON_ROW_KEYS = ['row-1', 'row-2', 'row-3'] as const

export const HomeLoadingState = () => {
  const { t } = useTranslation('home')

  return (
    <SkeletonGroup label={t('loading')} className="flex flex-col gap-4.5">
      <Skeleton className="h-50 rounded-4xl" />
      <Skeleton className="h-38 rounded-4xl" />
      <Skeleton className="h-17 rounded-3xl" />
      <div className="flex flex-col gap-2.5">
        {SKELETON_ROW_KEYS.map((key) => (
          <Skeleton key={key} className="h-16.5 rounded-xl" />
        ))}
      </div>
    </SkeletonGroup>
  )
}
