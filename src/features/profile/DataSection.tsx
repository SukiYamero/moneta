import { useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { exportMovimientosToCsv } from '@/lib/export'
import { useLocaleFormatting } from '@/lib/i18n/localeFormatting'
import { RepoError } from '@/lib/repo'
import { repoErrorCopyKey } from '@/lib/errorCopy'
import { toast } from '@/lib/toastStore'
import { ProfileSectionHeading } from '@/features/profile/ProfileSectionHeading'

export const DataSection = () => {
  const { t } = useTranslation('profile')
  const { locale } = useLocaleFormatting()
  const [exporting, setExporting] = useState(false)

  const onExport = async () => {
    setExporting(true)
    try {
      await exportMovimientosToCsv({ locale })
    } catch (e) {
      toast.error(
        e instanceof RepoError ? `home:${repoErrorCopyKey(e.code)}` : 'profile:data.exportFailed',
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <section>
      <ProfileSectionHeading>{t('data.heading')}</ProfileSectionHeading>
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          size="touch"
          disabled={exporting}
          onClick={() => void onExport()}
          className="w-full justify-center gap-2"
        >
          <Download aria-hidden="true" />
          {exporting ? t('data.exporting') : t('data.exportCta')}
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="touch"
          disabled
          aria-disabled="true"
          className="w-full justify-center gap-2"
        >
          <Trash2 aria-hidden="true" />
          {t('data.deleteStored.cta')}
        </Button>
        <p className="text-xs font-medium text-fg-tertiary">{t('data.deleteStored.note')}</p>
      </div>
    </section>
  )
}
