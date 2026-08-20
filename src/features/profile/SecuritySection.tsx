import { useTranslation } from 'react-i18next'
import { LockSettings } from '@/features/lock/LockSettings'
import { ProfileSectionHeading } from '@/features/profile/ProfileSectionHeading'

/**
 * The real production home for `LockSettings` (specs.md §10.18) — moved
 * off the dev-only `/kit` route, where it was the only way to enable,
 * disable or manually re-lock the PIN vault in a shipped build. Only the
 * call site moved; `LockSettings` itself stays in `src/features/lock/`
 * (its owning feature), which Track G2 retrofitted through i18n in the
 * same wave (specs.md §10.24 Prerequisite 4).
 */
export const SecuritySection = () => {
  const { t } = useTranslation('profile')

  return (
    <section>
      <ProfileSectionHeading>{t('security.heading')}</ProfileSectionHeading>
      <div className="rounded-3xl border border-border-subtle bg-card px-4 py-3.75">
        <LockSettings />
      </div>
    </section>
  )
}
