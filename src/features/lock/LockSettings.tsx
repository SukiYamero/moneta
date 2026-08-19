import { useState } from 'react'
import { useLockStore } from '@/lib/lockStore'
import { Button } from '@/components/ui/button'
import { enableLockErrorCopy } from '@/features/lock/errorCopy'

// resetVault() only ever fails with an opaque storage error (no named class,
// no lookup-worthy taxonomy — unlike enable()'s NO_SESSION_ERROR) so a
// single fixed fallback line is the whole mapping needed here.
const DISABLE_ERROR_COPY = 'No se pudo desactivar el bloqueo. Intenta de nuevo.'

export const LockSettings = () => {
  const enabled = useLockStore((s) => s.enabled)
  const biometricAvailable = useLockStore((s) => s.biometricAvailable)
  const enable = useLockStore((s) => s.enable)
  const lock = useLockStore((s) => s.lock)
  const reset = useLockStore((s) => s.reset)
  const [pin, setPin] = useState('')
  const [biometric, setBiometric] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onReset = async () => {
    setError(null)
    try {
      await reset()
    } catch {
      setError(DISABLE_ERROR_COPY)
    }
  }

  if (enabled) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-muted-foreground text-sm">Lock activo</p>
        <div className="flex gap-2">
          <Button type="button" className="min-h-11" onClick={() => lock()}>
            Lock now
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="min-h-11"
            onClick={() => void onReset()}
          >
            Desactivar
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </div>
    )
  }

  const onEnable = async () => {
    setError(null)
    try {
      await enable(pin, biometric && biometricAvailable)
      setPin('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'no se pudo activar')
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm">PIN (4 dígitos)</span>
        <input
          inputMode="numeric"
          pattern="\d*"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
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
          Usar biometría
        </label>
      )}
      <Button
        type="button"
        className="min-h-11"
        disabled={pin.length !== 4}
        onClick={() => void onEnable()}
      >
        Activar lock
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {enableLockErrorCopy(error)}
        </p>
      )}
    </div>
  )
}
