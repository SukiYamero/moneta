import { useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { exportMovimientosToCsv } from '@/lib/export'
import { useLocaleFormatting } from '@/lib/i18n/localeFormatting'
import { RepoError } from '@/lib/repo'
import { repoErrorCopyKey } from '@/lib/errorCopy'
import { toast } from '@/lib/toastStore'
import { ProfileSectionHeading } from '@/features/profile/ProfileSectionHeading'
import { useDataErase } from '@/features/profile/useDataErase'

export const DataSection = () => {
  const { t } = useTranslation('profile')
  const { locale } = useLocaleFormatting()
  const [exporting, setExporting] = useState(false)
  const { driveAvailable, confirmOpen, erasing, requestErase, confirmErase, cancelErase } =
    useDataErase()

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
          disabled={!driveAvailable || erasing}
          onClick={requestErase}
          className="w-full justify-center gap-2"
        >
          <Trash2 aria-hidden="true" />
          {erasing ? t('data.deleteStored.deleting') : t('data.deleteStored.cta')}
        </Button>
        {driveAvailable ? null : (
          <p className="text-sm font-medium text-fg-tertiary">
            {t('data.deleteStored.unavailableNote')}
          </p>
        )}
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onClose={cancelErase}
        onConfirm={() => void confirmErase()}
        title={t('data.deleteStored.confirm.title')}
        description={t('data.deleteStored.confirm.description')}
        confirmLabel={t('data.deleteStored.confirm.confirmCta')}
        cancelLabel={t('data.deleteStored.confirm.cancelCta')}
        destructive
      />
    </section>
  )
}
