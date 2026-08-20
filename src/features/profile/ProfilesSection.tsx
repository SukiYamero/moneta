import { Check, Cloud, Smartphone, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ProfileKind } from '@/lib/profiles'
import { IconAvatar, Skeleton, SkeletonGroup, usePendingDelay } from '@/components/shared'
import { ProfileSectionHeading } from '@/features/profile/ProfileSectionHeading'
import { useProfiles } from '@/features/profile/useProfiles'

const KIND_ICON: Record<ProfileKind, LucideIcon> = {
  local: Smartphone,
  google: Cloud,
}

/**
 * Read-only list from `src/lib/profiles`'s device-scoped registry
 * (specs.md §10.15/§10.18) — switching, renaming and consolidating are
 * Wave 5+. Renders even for a single profile: this is how the user learns
 * the concept exists at all, per the spec's explicit "done when."
 */
export const ProfilesSection = () => {
  const { t } = useTranslation('profile')
  const { status, profiles, activeProfileId } = useProfiles()
  // Tier 2, gated by the same anti-flash rule every other section's loading
  // state uses (specs.md §10.9) — `status` was already read from the
  // registry but nothing consumed it, so a slow read (a cold IndexedDB open
  // on a throttled device) rendered a bare, item-less list instead of the
  // shared Skeleton treatment `HomeLoadingState` already models.
  const showSkeleton = usePendingDelay(status === 'loading')

  return (
    <section>
      <ProfileSectionHeading>{t('profiles.heading')}</ProfileSectionHeading>
      {showSkeleton ? (
        <SkeletonGroup label={t('profiles.loading')}>
          <Skeleton className="h-17 rounded-3xl" />
        </SkeletonGroup>
      ) : (
        <ul className="flex flex-col gap-2">
          {profiles.map((profile) => {
            const isActive = profile.id === activeProfileId
            const Icon = KIND_ICON[profile.kind]
            return (
              <li
                key={profile.id}
                className="flex items-center gap-3.25 rounded-3xl border border-border-subtle bg-card px-4 py-3.25"
              >
                <IconAvatar icon={Icon} tint={profile.kind === 'google' ? 'blue' : 'neutral'} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{profile.label}</p>
                  <p className="truncate text-ms font-medium text-fg-tertiary">
                    {t(`profiles.kind.${profile.kind}`)}
                  </p>
                </div>
                {isActive ? (
                  <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary">
                    <Check className="size-3.5" aria-hidden="true" />
                    {t('profiles.activeBadge')}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
