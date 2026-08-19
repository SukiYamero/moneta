import { useState } from 'react'
import { useLockStore } from '@/lib/lockStore'
import { unlockErrorCopy } from '@/features/lock/errorCopy'

const LockScreen = () => {
  const phase = useLockStore((s) => s.phase)
  // Gated on whether *this vault* enrolled biometrics, not just whether the
  // platform supports it — a user who declined biometrics at enrollment
  // must not see a button that always fails (specs.md §11, 2026-08-19,
  // finding 9).
  const biometricEnrolled = useLockStore((s) => s.biometricEnrolled)
  const unlockPin = useLockStore((s) => s.unlockPin)
  const unlockBiometric = useLockStore((s) => s.unlockBiometric)
  const error = useLockStore((s) => s.error)
  const [pin, setPin] = useState('')

  if (phase !== 'locked') return null

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      {biometricEnrolled && (
        <button
          type="button"
          className="min-h-11 rounded-md border px-4"
          onClick={() => void unlockBiometric()}
        >
          Unlock with biometrics
        </button>
      )}
      <label className="flex flex-col gap-1">
        <span>PIN</span>
        <input
          inputMode="numeric"
          pattern="\d*"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replaceAll(/\D/g, '').slice(0, 4))}
          className="min-h-11 rounded-md border px-3 text-center tracking-widest"
        />
      </label>
      <button
        type="button"
        className="min-h-11 rounded-md border px-4"
        disabled={pin.length !== 4}
        onClick={() => void unlockPin(pin)}
      >
        Unlock
      </button>
      {error && <p role="alert">{unlockErrorCopy(error)}</p>}
    </div>
  )
}

export default LockScreen
