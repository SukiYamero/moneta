import { useEffect, useState } from 'react'
import { Fingerprint, LockKeyhole } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/lib/authStore'
import { useLockStore } from '@/lib/lockStore'
import { Toggle } from '@/components/shared/Toggle'
import { enableLockErrorCopy } from '@/features/lock/errorCopy'
import { LockSettings } from '@/features/lock/LockSettings'
import { ProfileSectionHeading } from '@/features/profile/ProfileSectionHeading'

/**
 * A guest's biometric lock (specs.md §10.2.1) — session-less, so there is
 * no full settings panel to open (no PIN to change, no vault to manually
 * lock): a single row with a toggle is the whole surface. Absent entirely
 * when `!biometricAvailable` (checked by the caller) — never a disabled
 * control, per §10.2.1's "no lock option at all."
 */
const GuestLockRow = () => {
  const { t } = useTranslation('lock')
  const guestLockEnabled = useLockStore((s) => s.guestLockEnabled)
  const enableGuestLock = useLockStore((s) => s.enableGuestLock)
  const disableGuestLock = useLockStore((s) => s.disableGuestLock)
  const [error, setError] = useState<string | null>(null)

  const onToggle = async (next: boolean) => {
    setError(null)
    try {
      if (next) await enableGuestLock()
      else await disableGuestLock()
    } catch (e) {
      setError(e instanceof Error ? e.message : '')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 rounded-3xl border border-border-subtle bg-card px-4 py-3.75">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Fingerprint aria-hidden="true" className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{t('settings.guestRowLabel')}</p>
          <p className="text-ms font-medium text-fg-tertiary">{t('settings.guestRowSubcopy')}</p>
        </div>
        <Toggle
          checked={guestLockEnabled}
          onCheckedChange={(next) => void onToggle(next)}
          aria-label={t('settings.guestRowLabel')}
        />
      </div>
      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {t(enableLockErrorCopy(error))}
        </p>
      )}
    </div>
  )
}

/**
 * The real production home for the PIN lock's entry point (specs.md
 * §10.18) — moved off the dev-only `/kit` route. Tapping the row opens
 * `LockSettings`, the full-screen panel from the design export (§4); the
 * row itself only carries the label and the `lockStateLabel` status chip
 * the export's own JS resolves as "Activado"/"Desactivado".
 *
 * §10.2.1 (user, 2026-08-20): a signed-in account gets the PIN (with
 * biometrics as the fast path). A guest gets biometrics or nothing — never
 * a PIN. Where the device has no biometric capability, a guest sees no
 * lock option at all — not a disabled control, absent — and this section
 * renders nothing for `idle`/`authenticating`/`error` either (there is no
 * session yet to protect). This closes the backlog item where a guest was
 * shown a lock control that could only fail (specs.md §12, §11 2026-08-20).
 */
export const SecuritySection = () => {
  const { t } = useTranslation('profile')
  const { t: tLock } = useTranslation('lock')
  const status = useAuthStore((s) => s.status)
  const enabled = useLockStore((s) => s.enabled)
  const biometricAvailable = useLockStore((s) => s.biometricAvailable)
  const initGuestLock = useLockStore((s) => s.initGuestLock)
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => {
    if (status === 'guest') void initGuestLock()
  }, [status, initGuestLock])

  if (status === 'guest') {
    if (!biometricAvailable) return null
    return (
      <section>
        <ProfileSectionHeading>{t('security.heading')}</ProfileSectionHeading>
        <GuestLockRow />
      </section>
    )
  }

  if (status !== 'authenticated') return null

  return (
    <section>
      <ProfileSectionHeading>{t('security.heading')}</ProfileSectionHeading>
      <button
        type="button"
        onClick={() => setPanelOpen(true)}
        className="flex w-full items-center gap-3 rounded-3xl border border-border-subtle bg-card px-4 py-3.75 text-left"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <LockKeyhole aria-hidden="true" className="size-5" />
        </div>
        <span className="min-w-0 flex-1 text-sm font-bold">{tLock('settings.panelTitle')}</span>
        <span className="text-ms font-semibold text-fg-tertiary">
          {tLock(enabled ? 'settings.statusActive' : 'settings.statusInactive')}
        </span>
      </button>
      <LockSettings open={panelOpen} onClose={() => setPanelOpen(false)} />
    </section>
  )
}
