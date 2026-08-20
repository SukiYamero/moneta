import { useTranslation } from 'react-i18next'
import { BottomSheet } from '@/components/shared/BottomSheet'
import { IdentitySection } from '@/features/profile/IdentitySection'
import { ProfilesSection } from '@/features/profile/ProfilesSection'
import { SecuritySection } from '@/features/profile/SecuritySection'
import { SyncSection } from '@/features/profile/SyncSection'
import { DataSection } from '@/features/profile/DataSection'
import { PreferencesSection } from '@/features/profile/PreferencesSection'

export interface ProfileSheetProps {
  open: boolean
  onClose: () => void
}

/**
 * The access point (specs.md §10.18) — a door, not its features. Identity/
 * Profiles/Security/Data are real; Preferences is deliberately inert (see
 * that section's own comment). `BottomSheet` already caps itself at
 * `max-h-[88dvh]` with `overflow-y-auto`, so this sheet growing to carry
 * five sections instead of the original design's two still scrolls inside
 * its own bounds and never pushes `BottomNav` off-screen — no extra height
 * handling needed here.
 */
export const ProfileSheet = ({ open, onClose }: ProfileSheetProps) => {
  const { t } = useTranslation('profile')

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel={t('sheet.heading')}>
      <div className="flex flex-col gap-6 pb-1">
        <h2 className="text-lg font-extrabold">{t('sheet.heading')}</h2>
        <IdentitySection />
        <ProfilesSection />
        <SyncSection />
        <SecuritySection />
        <DataSection />
        <PreferencesSection />
      </div>
    </BottomSheet>
  )
}
