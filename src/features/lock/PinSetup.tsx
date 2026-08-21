import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLockStore } from '@/lib/lockStore'
import { Toggle } from '@/components/shared/Toggle'
import { enableLockErrorCopy } from '@/features/lock/errorCopy'
import { FullScreenPanel } from '@/features/lock/FullScreenPanel'
import { PinDots } from '@/features/lock/PinDots'
import { PIN_LENGTH, PinPad } from '@/features/lock/PinPad'

export interface PinSetupProps {
  open: boolean
  onClose: () => void
  /** Resolves `setup.kickerNew`/`setup.kickerChange` — the export's own `pinSetupKicker` (specs.md §10.2). */
  mode: 'new' | 'change'
}

type Step = 'create' | 'confirm'

/**
 * Full-screen create/confirm PIN flow (design export §4) — same shell as
 * `LockScreen`, push-in animated, X-close. "Change PIN" reuses the same
 * `enable()` call as first-time setup: it always writes a brand-new vault
 * (fresh DEK, re-wrapped envelopes), which is already the correct behavior
 * for changing a PIN, not a distinct code path.
 */
export const PinSetup = ({ open, onClose, mode }: PinSetupProps) => {
  const { t } = useTranslation('lock')
  const enable = useLockStore((s) => s.enable)
  const biometricAvailable = useLockStore((s) => s.biometricAvailable)
  const [step, setStep] = useState<Step>('create')
  const [firstPin, setFirstPin] = useState('')
  const [pin, setPin] = useState('')
  const [biometric, setBiometric] = useState(false)
  const [mismatch, setMismatch] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // `useOverlay`'s default initial focus is the panel's first focusable
  // descendant (the X-close button, which sits before the hidden PIN
  // input in DOM order) — steered here instead, at the actual PIN input,
  // so the one-rAF-later focus programmatically lands where PIN entry
  // (keyboard/screen-reader) is expected, not one tab stop away from it.
  const inputRef = useRef<HTMLInputElement>(null)

  const resetLocal = () => {
    setStep('create')
    setFirstPin('')
    setPin('')
    setBiometric(false)
    setMismatch(false)
    setSubmitError(null)
  }

  const handleClose = () => {
    resetLocal()
    onClose()
  }

  const handleChange = (next: string) => {
    setMismatch(false)
    setSubmitError(null)
    setPin(next)
  }

  useEffect(() => {
    if (pin.length !== PIN_LENGTH) return
    if (step === 'create') {
      setFirstPin(pin)
      setPin('')
      setStep('confirm')
      return
    }
    if (pin !== firstPin) {
      setMismatch(true)
      setPin('')
      return
    }
    setSubmitting(true)
    void enable(firstPin, biometric)
      .then(() => {
        resetLocal()
        onClose()
      })
      .catch((e: unknown) => {
        setSubmitError(e instanceof Error ? e.message : '')
        setPin('')
      })
      .finally(() => setSubmitting(false))
    // resetLocal/onClose/enable are stable across a single setup session's
    // re-renders in practice; re-running this effect only on the values that
    // actually change (pin, step, firstPin, biometric) keeps a stray parent
    // re-render from re-firing an already-submitted attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, step, firstPin, biometric])

  if (!open) return null

  const kickerKey = mode === 'new' ? 'setup.kickerNew' : 'setup.kickerChange'
  const titleKey = step === 'create' ? 'setup.titleCreate' : 'setup.titleConfirm'
  const hintKey = step === 'create' ? 'setup.hintCreate' : 'setup.hintConfirm'
  const hasError = mismatch || submitError !== null

  return (
    <FullScreenPanel
      open={open}
      onClose={handleClose}
      ariaLabel={t(kickerKey)}
      initialFocus={inputRef}
    >
      <div className="flex items-center justify-between px-5">
        <span className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          {t(kickerKey)}
        </span>
        <button
          type="button"
          onClick={handleClose}
          aria-label={t('setup.close')}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-foreground"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="space-y-2">
          <h1 className="text-xl font-extrabold tracking-tight">{t(titleKey)}</h1>
          <p className="text-sm font-medium text-muted-foreground">{t(hintKey)}</p>
        </div>
        <label className="flex flex-col items-center gap-2">
          <span className="sr-only">{t('screen.pinLabel')}</span>
          <PinDots length={PIN_LENGTH} filled={pin.length} error={hasError} />
          <input
            ref={inputRef}
            inputMode="numeric"
            pattern="\d*"
            maxLength={PIN_LENGTH}
            value={pin}
            disabled={submitting}
            onChange={(e) =>
              handleChange(e.target.value.replaceAll(/\D/g, '').slice(0, PIN_LENGTH))
            }
            className="sr-only"
            aria-label={t('screen.pinLabel')}
          />
        </label>
        <div className="flex h-5 items-center" aria-hidden={!hasError}>
          {mismatch && (
            <p role="alert" className="text-sm text-destructive">
              {t('setup.mismatch')}
            </p>
          )}
          {submitError !== null && (
            <p role="alert" className="text-sm text-destructive">
              {t(enableLockErrorCopy(submitError))}
            </p>
          )}
        </div>
        {step === 'confirm' && biometricAvailable && (
          <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border-subtle px-4 py-3">
            <span className="text-left text-sm font-semibold">
              {t('settings.biometricRowLabel')}
            </span>
            <Toggle
              checked={biometric}
              onCheckedChange={setBiometric}
              aria-label={t('settings.biometricRowLabel')}
            />
          </div>
        )}
        <PinPad value={pin} onChange={handleChange} disabled={submitting} />
      </div>
    </FullScreenPanel>
  )
}
