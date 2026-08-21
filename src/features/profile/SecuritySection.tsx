import { useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/lib/authStore'
import { useLockStore } from '@/lib/lockStore'
import { LockSettings } from '@/features/lock/LockSettings'
import { ProfileSectionHeading } from '@/features/profile/ProfileSectionHeading'

/**
 * The real production home for the PIN lock's entry point (specs.md
 * §10.18) — moved off the dev-only `/kit` route. Tapping the row opens
 * `LockSettings`, the full-screen panel from the design export (§4); the
 * row itself only carries the label and the `lockStateLabel` status chip
 * the export's own JS resolves as "Activado"/"Desactivado".
 *
 * §10.2.1 (user, 2026-08-20): a signed-in account gets the PIN. A guest
 * gets biometrics or nothing — never a PIN — so this section renders
 * nothing at all for a guest without platform biometric support, and
 * nothing for `idle`/`authenticating`/`error` (there is no session yet to
 * protect). This closes the backlog item where a guest was shown a lock
 * control that could only fail (specs.md §12, §11 2026-08-20).
 */
export const SecuritySection = () => {
  const { t } = useTranslation('profile')
  const { t: tLock } = useTranslation('lock')
  const status = useAuthStore((s) => s.status)
  const enabled = useLockStore((s) => s.enabled)
  const [panelOpen, setPanelOpen] = useState(false)

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
