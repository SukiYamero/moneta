import { useTranslation } from 'react-i18next'
import { Skeleton, SkeletonGroup } from '@/components/shared'

const SKELETON_ROW_KEYS = ['row-1', 'row-2', 'row-3', 'row-4'] as const

export const SearchLoadingState = () => {
  const { t } = useTranslation('search')

  return (
    <SkeletonGroup label={t('loading')} className="flex flex-col gap-2.5">
      {SKELETON_ROW_KEYS.map((key) => (
        <Skeleton key={key} className="h-16.5 rounded-xl" />
      ))}
    </SkeletonGroup>
  )
}
