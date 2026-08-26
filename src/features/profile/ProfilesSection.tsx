import { Check, Cloud, Loader2, Smartphone, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ProfileKind, ProfileRecord } from '@/lib/profiles'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { IconAvatar, Skeleton, SkeletonGroup, usePendingDelay } from '@/components/shared'
import { ProfileSectionHeading } from '@/features/profile/ProfileSectionHeading'
import { useProfiles } from '@/features/profile/useProfiles'

const KIND_ICON: Record<ProfileKind, LucideIcon> = {
  local: Smartphone,
  google: Cloud,
}

export const ProfilesSection = () => {
  const { t } = useTranslation('profile')
  const {
    status,
    profiles,
    activeProfileId,
    switchingId,
    goneProfile,
    switchTo,
    dismissGoneProfile,
    removeGoneProfile,
  } = useProfiles()
  const showSkeleton = usePendingDelay(status === 'loading')

  const ownerLabel = (profile: ProfileRecord): string =>
    profile.kind === 'local' ? t('profiles.localLabel') : profile.label

  const ownerSubtitle = (profile: ProfileRecord): string =>
    profile.kind === 'google' && profile.accountKey
      ? profile.accountKey
      : t(`profiles.kind.${profile.kind}`)

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
            const isSwitching = profile.id === switchingId
            const Icon = KIND_ICON[profile.kind]
            return (
              <li key={profile.id}>
                <button
                  type="button"
                  disabled={isActive || switchingId !== null}
                  onClick={() => void switchTo(profile)}
                  className="flex w-full items-center gap-3.25 rounded-3xl border border-border-subtle bg-card px-4 py-3.25 text-left disabled:opacity-100"
                >
                  <IconAvatar icon={Icon} tint={profile.kind === 'google' ? 'blue' : 'neutral'} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{ownerLabel(profile)}</p>
                    <p className="truncate text-ms font-medium text-fg-tertiary">
                      {ownerSubtitle(profile)}
                    </p>
                  </div>
                  {isSwitching ? (
                    <Loader2 className="size-4 animate-spin text-fg-tertiary" aria-hidden="true" />
                  ) : isActive ? (
                    <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary">
                      <Check className="size-3.5" aria-hidden="true" />
                      {t('profiles.activeBadge')}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <ConfirmDialog
        open={goneProfile !== null}
        onClose={dismissGoneProfile}
        onConfirm={() => void removeGoneProfile()}
        title={t('profiles.goneDialog.title')}
        description={t('profiles.goneDialog.description')}
        confirmLabel={t('profiles.goneDialog.removeCta')}
        cancelLabel={t('profiles.goneDialog.cancelCta')}
        destructive={false}
      />
    </section>
  )
}
