import { useEffect } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useDataStore } from '@/lib/dataStore'
import { repoErrorCopyKey } from '@/lib/errorCopy'
import { InlineErrorState, Skeleton, SkeletonGroup, usePendingDelay } from '@/components/shared'
import { CategoriesSection } from '@/features/settings/CategoriesSection'
import { PreferencesEditor } from '@/features/settings/PreferencesEditor'

const SKELETON_ROW_KEYS = ['row-1', 'row-2', 'row-3'] as const

/**
 * `/settings` — a route, not an overlay (specs.md §10.24), reached from
 * `PreferencesSection`'s three writable rows. Two sections:
 * `CategoriesSection` (reuses `CategoryFormModal`, §10.22) and
 * `PreferencesEditor` (`primerDiaSemana`/`idioma`/`monedaPrincipal`, all
 * writing through `dataStore.updateConfig`, §10.13's one write path — no
 * theme control, Prerequisite 3). `dataStore.load()` is once-per-session
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
    <main className="flex min-h-full animate-push-in flex-col pt-14">
      <div className="flex items-center gap-2.5 px-5 pb-3.5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label={t('settings:back')}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-xl font-extrabold tracking-tight">
          {t('settings:title')}
        </h1>
      </div>

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
            <CategoriesSection />
            {config && (
              <PreferencesEditor
                preferencias={config.preferencias}
                onChange={(patch) =>
                  void updateConfig({ preferencias: { ...config.preferencias, ...patch } })
                }
              />
            )}
          </>
        )}
      </div>
    </main>
  )
}
