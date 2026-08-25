import { useId, useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLockStore } from '@/lib/lockStore'
import { Button } from '@/components/ui/button'
import { ScreenHeader } from '@/components/shared/ScreenHeader'
import { Toggle } from '@/components/shared/Toggle'
import { FullScreenPanel } from '@/features/lock/FullScreenPanel'
import { PinSetup } from '@/features/lock/PinSetup'

export interface LockSettingsProps {
  open: boolean
  onClose: () => void
}

/**
 * The account PIN lock's full-screen settings panel (design export §4),
 * reached by tapping the "Bloqueo con PIN" row in `SecuritySection`. Turning
 * the toggle off reuses `lockStore.reset()` — the same vault-wipe +
 * forced-relogin action "Olvidé mi PIN" offers on `LockScreen` — matching
 * the behavior the prior `/kit`-only harness already shipped and tested:
 * this is a PIN-lock feature, not a general app setting, so removing it
 * removes the one thing the vault exists to cache (specs.md §10.2).
 */
export const LockSettings = ({ open, onClose }: LockSettingsProps) => {
  const { t } = useTranslation('lock')
  const titleId = useId()
  const enabled = useLockStore((s) => s.enabled)
  const lock = useLockStore((s) => s.lock)
  const reset = useLockStore((s) => s.reset)
  const [setupMode, setSetupMode] = useState<'new' | 'change' | null>(null)
  const [disableFailed, setDisableFailed] = useState(false)

  const onToggle = async (next: boolean) => {
    setDisableFailed(false)
    if (next) {
      setSetupMode('new')
      return
    }
    try {
      await reset()
    } catch {
      setDisableFailed(true)
    }
  }

  return (
    <FullScreenPanel
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      header={
        <ScreenHeader
          titleId={titleId}
          title={t('settings.panelTitle')}
          subtitle={t('settings.panelSubtitle')}
          onBack={onClose}
          backLabel={t('settings.back')}
        />
      }
    >
      <div className="flex flex-1 flex-col gap-4 px-5 pb-8">
        <div className="flex flex-col gap-4 rounded-3xl border border-border-subtle bg-card px-4 py-3.75">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <LockKeyhole aria-hidden="true" className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{t('settings.pinRowLabel')}</p>
              <p className="text-ms font-medium text-fg-tertiary">{t('settings.pinRowSubcopy')}</p>
            </div>
            <Toggle
              checked={enabled}
              onCheckedChange={(next) => void onToggle(next)}
              aria-label={t('settings.pinRowLabel')}
            />
          </div>
          {enabled && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="touch"
                className="flex-1"
                onClick={() => setSetupMode('change')}
              >
                {t('settings.changePinCta')}
              </Button>
              <Button
                type="button"
                size="touch"
                className="flex-1 bg-primary/10 text-primary hover:bg-primary/20"
                onClick={() => lock()}
              >
                {t('settings.lockNowCta')}
              </Button>
            </div>
          )}
        </div>
        {disableFailed && (
          <p role="alert" className="text-sm text-destructive">
            {t('errors.disableDefault')}
          </p>
        )}
        <p className="text-ms font-medium text-fg-tertiary">{t('settings.footerPolicy')}</p>
      </div>

      <PinSetup
        open={setupMode !== null}
        onClose={() => setSetupMode(null)}
        mode={setupMode ?? 'new'}
      />
    </FullScreenPanel>
  )
}
