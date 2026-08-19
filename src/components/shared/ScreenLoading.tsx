import { Coins, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export interface ScreenLoadingProps {
  /** Overrides the default `min-h-dvh` — used by the `/kit` gallery to preview this at a bounded height. */
  className?: string
}

/**
 * Tier 1 (specs.md §10.9): full-screen, brand-consistent loading for boot
 * and lazy-route `Suspense` fallbacks — never for a tab change, which has
 * no data wait (`dataStore.load()` is once-per-session). No props required
 * for its real callers (boot's `RequireAuth`, `router.tsx`'s lazy `/kit`
 * `Suspense` boundary), so it drops in unchanged wherever Tier 1 is needed.
 */
export const ScreenLoading = ({ className }: ScreenLoadingProps = {}) => {
  const { t } = useTranslation('common')

  return (
    <div
      className={cn(
        'flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-8 text-center text-foreground',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="flex size-[5.25rem] items-center justify-center rounded-4xl bg-[linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary),black_18%))]"
      >
        <Coins className="size-10 text-primary-foreground" strokeWidth={2.25} />
      </div>
      <div
        role="status"
        className="flex items-center gap-2.5 text-sm font-semibold text-fg-secondary"
      >
        <Loader2 className="size-4.5 animate-spin" aria-hidden="true" />
        <span>{t('loading')}</span>
      </div>
    </div>
  )
}
