import { Smartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useIsLandscape } from '@/components/shared/useIsLandscape'
import { skipLandscapeGateForSession, useLandscapeGateStore } from '@/lib/landscapeGateStore'

export const LandscapeGuard = () => {
  const isLandscape = useIsLandscape()
  const { t } = useTranslation('common')
  const skipped = useLandscapeGateStore((state) => state.skippedThisSession)

  if (!isLandscape || skipped) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="dark fixed inset-0 z-[100] flex items-center justify-center bg-black/72 px-6 py-[5dvh]"
    >
      <div className="flex h-[80dvh] max-h-[35rem] w-full max-w-[22.5rem] flex-col items-center justify-center gap-5.5 rounded-4xl border border-border-subtle bg-card px-8 py-10 text-center">
        <Smartphone
          aria-hidden="true"
          className="size-17 shrink-0 animate-landscape-rotate-hint text-fg-faint"
        />
        <div>
          <p className="mb-2 text-3xl font-extrabold tracking-tight text-card-foreground">
            {t('landscapeGuard.title')}
          </p>
          <p className="text-md leading-normal font-medium text-fg-tertiary">
            {t('landscapeGuard.body')}
          </p>
        </div>
        <button
          type="button"
          onClick={skipLandscapeGateForSession}
          className="mt-1 min-h-11 rounded-2xl border border-border-subtle px-5.5 py-3.5 text-base font-bold text-fg-tertiary"
        >
          {t('landscapeGuard.skip')}
        </button>
      </div>
    </div>
  )
}
