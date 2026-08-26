import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useDataStore } from '@/lib/dataStore'
import { repoErrorCopyKey } from '@/lib/errorCopy'
import {
  InlineErrorState,
  ScreenHeader,
  Skeleton,
  SkeletonGroup,
  usePendingDelay,
} from '@/components/shared'
import { CategoriesSection } from '@/features/settings/CategoriesSection'
import { PreferencesEditor } from '@/features/settings/PreferencesEditor'

const SKELETON_ROW_KEYS = ['row-1', 'row-2', 'row-3'] as const

export const SettingsScreen = () => {
  const { t } = useTranslation(['settings', 'home', 'common'])
  const navigate = useNavigate()
  const { config, status, error, load } = useDataStore()
  const updateConfig = useDataStore((s) => s.updateConfig)

  useEffect(() => {
    void load()
  }, [load])

  const isPending = status === 'idle' || status === 'loading'
  const showLoading = usePendingDelay(isPending)

  return (
    <main className="flex min-h-full animate-push-in flex-col pt-(--screen-inset-top)">
      <ScreenHeader
        title={t('settings:title')}
        onBack={() => navigate(-1)}
        backLabel={t('settings:back')}
      />

      <div className="flex flex-1 flex-col gap-6 px-5 pb-8">
        {showLoading ? (
          <SkeletonGroup label={t('common:loading')} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2.5">
              {SKELETON_ROW_KEYS.map((key) => (
                <Skeleton key={key} className="h-14 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-40 rounded-2xl" />
          </SkeletonGroup>
        ) : status === 'error' ? (
          <InlineErrorState
            message={t(`home:${repoErrorCopyKey(error ?? 'unknown')}`)}
            retryLabel={t('settings:retry')}
            onRetry={() => void load()}
          />
        ) : isPending ? null : (
          <>
            <section aria-labelledby="settings-categories-heading">
              <h2 id="settings-categories-heading" className="sr-only">
                {t('settings:categories.heading')}
              </h2>
              <CategoriesSection />
            </section>
            {config && (
              <section aria-labelledby="settings-preferences-heading">
                <h2 id="settings-preferences-heading" className="sr-only">
                  {t('settings:preferences.heading')}
                </h2>
                <PreferencesEditor
                  preferencias={config.preferencias}
                  onChange={(patch) =>
                    void updateConfig({ preferencias: { ...config.preferencias, ...patch } })
                  }
                />
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}
