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
