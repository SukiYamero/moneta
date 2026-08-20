import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { APP_NAME } from '@/lib/branding'

/**
 * The brand moment (specs.md §10.28): a fixed ~800ms floor on every cold
 * open, held by `BootGate` — this component only ever renders what's on
 * screen, not the timing. There is no logo yet (`docs/pendientes-usuario.md`
 * item 8): the mark is `APP_NAME`'s initial inside the same gradient square
 * `ScreenLoading` uses for Tier 1 loading, so a real mark drops in later by
 * replacing this one square's content, not by restructuring the screen.
 */
export const BootScreen = () => {
  const { t } = useTranslation('common')

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-8 text-center text-foreground">
      <div
        aria-hidden="true"
        className="flex size-[5.25rem] items-center justify-center rounded-4xl bg-[linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary),black_18%))] text-3xl font-extrabold text-primary-foreground"
      >
        {APP_NAME.charAt(0)}
      </div>
      <p className="text-xl font-extrabold tracking-tight">{APP_NAME}</p>
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
