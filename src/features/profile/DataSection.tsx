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

/**
 * The one real trigger for `exportMovimientosToCsv()` (specs.md §10.12) —
 * the module existed for a whole stage with no caller. `exportMovimientosToCsv`
 * doesn't self-catch (it's a pure port-reading function, not a store
 * action), so this event handler owns catching it and routing the failure
 * to a toast (`docs/error-handling.md` §7) — noted as a gap in `specs.md`
 * §12 before this track landed. A `RepoError` (the likely failure —
 * `repo.ready()`/`list()`) reuses the exact copy Home/Search/History
 * already show for the same `RepoErrorCode`, rather than minting a second,
 * possibly-inconsistent message for the same underlying failure; anything
 * else (e.g. `delivery.ts`'s share/download step) falls back to one
 * generic key — a full parallel `error.codes` tree for a failure this rare
 * would be exactly the "more surface than the blast radius allows" this
 * wave's plan warns against.
 */
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
        {/* STUB(wave5): the answer to the borrowed-device case (specs.md
            §10.20) — shipped visibly inert on purpose, never wired to an
            onClick, so it cannot be mistaken for armed. The real control
            needs: a second confirm step naming the exact profile being
            wiped (this is destructive and irreversible, unlike sign-out);
            actually deleting that profile's IndexedDB database
            (`profileDb.ts`'s `getProfileDatabase` + a delete call) and its
            `profileRegistry.ts` row; and it must stay reachable only as an
            explicit, secondary action here — never a side effect of
            signing out (§10.15's "nothing is ever replaced"). */}
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
