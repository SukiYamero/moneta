import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Fingerprint, LockKeyhole } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/lib/authStore'
import { useLockStore } from '@/lib/lockStore'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { PinDots } from '@/features/lock/PinDots'
import { PIN_LENGTH, PinPad } from '@/features/lock/PinPad'
import { unlockErrorCopy } from '@/features/lock/errorCopy'

export const IconTile = ({ children }: { children: ReactNode }) => (
  <div className="relative flex items-center justify-center">
    <div
      aria-hidden="true"
      className="absolute size-32 rounded-full bg-[radial-gradient(circle,_color-mix(in_oklch,var(--primary)_32%,transparent),_transparent_70%)]"
    />
    <div className="relative flex size-16 items-center justify-center rounded-3xl bg-[linear-gradient(135deg,var(--primary),color-mix(in_oklch,var(--primary),black_18%))] shadow-[0_14px_32px_-8px_color-mix(in_oklch,var(--primary)_55%,transparent)]">
      {children}
    </div>
  </div>
)

/**
 * A guest never has a PIN vault (specs.md §10.2.1) — this branch only ever
 * mounts when an already-active guest session's own background timeout
 * re-locks it (`lockStore.onVisible`); a guest is never gated at cold start,
 * since guest status itself isn't persisted across a reload. No PIN
 * keypad, no "Olvidé mi PIN": the credential gates the UI, not a
 * cryptographic boundary, so a guest's only recovery is retrying the OS
 * prompt — there is nothing to wipe that would help.
 */
const GuestLockScreen = () => {
  const { t } = useTranslation('lock')
  const unlockGuest = useLockStore((s) => s.unlockGuest)
  const error = useLockStore((s) => s.error)
  const triedRef = useRef(false)

  useEffect(() => {
    if (triedRef.current) return
    triedRef.current = true
    void unlockGuest()
  }, [unlockGuest])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6 text-center">
      <IconTile>
        <Fingerprint aria-hidden="true" className="size-8 text-primary-foreground" />
      </IconTile>
      <div className="space-y-2">
        <h1 className="text-xl font-extrabold tracking-tight">{t('screen.guestTitle')}</h1>
        <p className="text-sm font-medium text-muted-foreground">{t('screen.guestSubtitle')}</p>
      </div>
      <div className="flex h-5 items-center" aria-hidden={!error}>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t(unlockErrorCopy(error))}
          </p>
        )}
      </div>
      <button
        type="button"
        className="flex min-h-11 items-center justify-center rounded-full border border-border-subtle px-6 text-sm font-bold"
        onClick={() => void unlockGuest()}
      >
        {t('screen.guestRetryCta')}
      </button>
    </div>
  )
}

const AccountLockScreen = () => {
  const { t } = useTranslation('lock')
  const biometricEnrolled = useLockStore((s) => s.biometricEnrolled)
  const unlockPin = useLockStore((s) => s.unlockPin)
  const unlockBiometric = useLockStore((s) => s.unlockBiometric)
  const error = useLockStore((s) => s.error)
  const clearError = useLockStore((s) => s.clearError)
  const reset = useLockStore((s) => s.reset)
  const [pin, setPin] = useState('')
  const [forgotOpen, setForgotOpen] = useState(false)
  const submittingRef = useRef(false)

  const handleChange = (next: string) => {
    if (error) clearError()
    setPin(next)
  }

  useEffect(() => {
    if (pin.length !== PIN_LENGTH || submittingRef.current) return
    submittingRef.current = true
    void unlockPin(pin).finally(() => {
      submittingRef.current = false
      setPin('')
    })
  }, [pin, unlockPin])

  const confirmForgot = () => {
    setForgotOpen(false)
    void reset()
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <IconTile>
        <LockKeyhole aria-hidden="true" className="size-8 text-primary-foreground" />
      </IconTile>
      <div className="space-y-2">
        <h1 className="text-xl font-extrabold tracking-tight">{t('screen.title')}</h1>
        <p className="text-sm font-medium text-muted-foreground">
          {biometricEnrolled ? t('screen.subtitleBiometric') : t('screen.subtitlePin')}
        </p>
      </div>
      {biometricEnrolled && (
        <button
          type="button"
          className="flex min-h-11 items-center gap-2 rounded-full border border-border-subtle px-5 text-sm font-bold"
          onClick={() => void unlockBiometric()}
        >
          <Fingerprint aria-hidden="true" className="size-4" />
          {t('screen.biometricCta')}
        </button>
      )}
      <label className="flex flex-col items-center gap-4">
        <span className="sr-only">{t('screen.pinLabel')}</span>
        <PinDots length={PIN_LENGTH} filled={pin.length} error={!!error} />
        <input
          inputMode="numeric"
          pattern="\d*"
          maxLength={PIN_LENGTH}
          value={pin}
          onChange={(e) => handleChange(e.target.value.replaceAll(/\D/g, '').slice(0, PIN_LENGTH))}
          className="sr-only"
          aria-label={t('screen.pinLabel')}
        />
      </label>
      {/* Reserved height (design export: 20px) so an error appearing never
          shifts the keypad below it. */}
      <div className="flex h-5 items-center" aria-hidden={!error}>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t(unlockErrorCopy(error))}
          </p>
        )}
      </div>
      <PinPad value={pin} onChange={handleChange} maxLength={PIN_LENGTH} />
      <button
        type="button"
        className="min-h-11 text-sm font-bold text-muted-foreground underline underline-offset-4"
        onClick={() => setForgotOpen(true)}
      >
        {t('screen.forgotCta')}
      </button>
      <ConfirmDialog
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        onConfirm={confirmForgot}
        title={t('forgotConfirm.title')}
        description={t('forgotConfirm.description')}
        confirmLabel={t('forgotConfirm.confirmCta')}
        cancelLabel={t('forgotConfirm.cancelCta')}
      />
    </div>
  )
}

const LockScreen = () => {
  const phase = useLockStore((s) => s.phase)
  const isGuest = useAuthStore((s) => s.status === 'guest')

  if (phase !== 'locked') return null
  return isGuest ? <GuestLockScreen /> : <AccountLockScreen />
}

export default LockScreen
