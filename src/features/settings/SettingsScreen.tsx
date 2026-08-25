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

/**
 * `/settings` — a route, not an overlay (specs.md §10.24), reached from
 * `PreferencesSection`'s writable rows. Two sections: `CategoriesSection`
 * (reuses `CategoryFormModal`, §10.22) and `PreferencesEditor`
 * (`tema`/`primerDiaSemana`/`idioma`/`monedaPrincipal`, all writing through
 * `dataStore.updateConfig`, §10.13's one write path). `dataStore.load()` is
 * once-per-session
 * and usually already resolved by the time this route is reached (Home is
 * the index route), but this screen doesn't assume that — a direct/deep
 * link still gets Tier 2 skeletons while `status` is pending, matching
 * every other screen's own loading contract (specs.md §10.9).
 */
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
            {/* `CategoriesSection`/`PreferencesEditor` each render a
                `ProfileSectionHeading` (`<h3>`) built for `ProfileSheet.tsx`,
                where that sheet's own `<h2>` sits above it. This screen has
                only the `<h1>` above, so each section gets a visually
                hidden `<h2>` here — the visible heading stays the `<h3>`
                inside each section; this one exists purely so the document
                heading order never skips a level (specs.md §12,
                2026-08-20). */}
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
