import { RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useIsLandscape } from '@/components/shared/useIsLandscape'

/**
 * The one context with no real orientation lock available: a bare mobile
 * browser tab (specs.md §10.53 — see `useIsLandscape`'s own comment for why
 * neither the manifest's `orientation` member nor the Screen Orientation
 * API's `lock()` reach this case). Self-contained and always mounted —
 * `useIsLandscape` is the "when" and this file is only the "what", so it
 * renders nothing itself in portrait and a full-screen block in landscape,
 * without either needing to know about the other.
 *
 * Deliberately minimal: existing tokens, existing `common` copy, no
 * illustration — the user is designing this screen themselves
 * (`docs/pendientes-usuario.md`), so this is the seam their design drops
 * into. Replace the body below; leave `useIsLandscape` and the mount site
 * alone.
 */
export const LandscapeGuard = () => {
  const isLandscape = useIsLandscape()
  const { t } = useTranslation('common')

  if (!isLandscape) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3.5 bg-background p-6 text-center text-foreground"
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <RotateCw className="size-6" aria-hidden="true" />
      </div>
      <div>
        <p className="text-base font-bold">{t('landscapeGuard.title')}</p>
        <p className="mt-1.5 text-ms leading-relaxed font-medium text-muted-foreground">
          {t('landscapeGuard.body')}
        </p>
      </div>
    </div>
  )
}
