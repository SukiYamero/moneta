import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLockStore } from '@/lib/lockStore'
import { Button } from '@/components/ui/button'
import { enableLockErrorCopy } from '@/features/lock/errorCopy'

export const LockSettings = () => {
  const { t } = useTranslation('lock')
  const enabled = useLockStore((s) => s.enabled)
  const biometricAvailable = useLockStore((s) => s.biometricAvailable)
  const enable = useLockStore((s) => s.enable)
  const lock = useLockStore((s) => s.lock)
  const reset = useLockStore((s) => s.reset)
  const [pin, setPin] = useState('')
  const [biometric, setBiometric] = useState(false)
  // `true` triggers the fallback key (errors.disableDefault) — resetVault()
  // only ever fails with an opaque storage error (no named class, no
  // lookup-worthy taxonomy — unlike enable()'s NO_SESSION_ERROR), so the
  // fallback is the whole mapping this path needs.
  const [disableFailed, setDisableFailed] = useState(false)
  const [enableError, setEnableError] = useState<string | null>(null)

  const onReset = async () => {
    setDisableFailed(false)
    try {
      await reset()
    } catch {
      setDisableFailed(true)
    }
  }

  if (enabled) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-muted-foreground text-sm">{t('settings.activeNote')}</p>
        <div className="flex gap-2">
          <Button type="button" size="touch" onClick={() => lock()}>
            {t('settings.lockNowCta')}
          </Button>
          <Button type="button" variant="destructive" size="touch" onClick={() => void onReset()}>
            {t('settings.disableCta')}
          </Button>
        </div>
        {disableFailed && (
          <p role="alert" className="text-destructive text-sm">
            {t('errors.disableDefault')}
          </p>
        )}
      </div>
    )
  }

  const onEnable = async () => {
    setEnableError(null)
    try {
      await enable(pin, biometric && biometricAvailable)
      setPin('')
    } catch (e) {
      setEnableError(e instanceof Error ? e.message : '')
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm">{t('settings.pinLabel')}</span>
        <input
          inputMode="numeric"
          pattern="\d*"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replaceAll(/\D/g, '').slice(0, 4))}
          className="min-h-11 rounded-md border px-3 text-center tracking-widest"
        />
      </label>
      {biometricAvailable && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={biometric}
            onChange={(e) => setBiometric(e.target.checked)}
          />
          {t('settings.biometricToggleLabel')}
        </label>
      )}
      <Button
        type="button"
        size="touch"
        disabled={pin.length !== 4}
        onClick={() => void onEnable()}
      >
        {t('settings.enableCta')}
      </Button>
      {enableError !== null && (
        <p role="alert" className="text-destructive text-sm">
          {t(enableLockErrorCopy(enableError))}
        </p>
      )}
    </div>
  )
}
