import { useEffect, useState } from 'react'
import { Smartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useIsLandscape } from '@/components/shared/useIsLandscape'
import { hasSkippedLandscapeGate, markLandscapeGateSkipped } from '@/lib/deviceStore'

/**
 * The one context with no real orientation lock available: a bare mobile
 * browser tab (specs.md §10.53 — see `useIsLandscape`'s own comment for why
 * neither the manifest's `orientation` member nor the Screen Orientation
 * API's `lock()` reach this case). `useIsLandscape` is the "when" (touch
 * device, landscape); this is only the "what" — the user's own design
 * (`docs/ui/landscape-gate.html`).
 *
 * The skip is a per-device preference (`deviceStore.ts`), not a per-render
 * one: `skipped` starts `null` ("not resolved yet") so a device that
 * already dismissed it never flashes the gate open on mount, and a tap
 * updates state immediately (no round trip to IndexedDB) while the write
 * persists in the background.
 */
export const LandscapeGuard = () => {
  const isLandscape = useIsLandscape()
  const { t } = useTranslation('common')
  const [skipped, setSkipped] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    void hasSkippedLandscapeGate().then((value) => {
      if (!cancelled) setSkipped(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!isLandscape || skipped !== false) return null

  const handleSkip = () => {
    setSkipped(true)
    void markLandscapeGateSkipped()
  }

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
          onClick={handleSkip}
          className="mt-1 min-h-11 rounded-2xl border border-border-subtle px-5.5 py-3.5 text-base font-bold text-fg-tertiary"
        >
          {t('landscapeGuard.skip')}
        </button>
      </div>
    </div>
  )
}
