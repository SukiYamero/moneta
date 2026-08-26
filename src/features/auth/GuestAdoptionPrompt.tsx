import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/lib/authStore'
import { Button } from '@/components/ui/button'
import { CenterModal } from '@/components/shared/CenterModal'

export const GuestAdoptionPrompt = () => {
  const { t } = useTranslation('auth')
  const pending = useAuthStore((s) => s.pendingAdoption)
  const busy = useAuthStore((s) => s.adoptionBusy)
  const error = useAuthStore((s) => s.adoptionError)
  const accept = useAuthStore((s) => s.acceptGuestAdoption)
  const decline = useAuthStore((s) => s.declineGuestAdoption)
  const titleId = useId()

  if (!pending) return null

  return (
    <CenterModal open onClose={decline} labelledBy={titleId}>
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 id={titleId} className="text-base font-extrabold">
          {t('adoption.title')}
        </h2>
        <p className="text-sm text-fg-secondary">
          {t('adoption.description', { count: pending.count })}
        </p>
        <p className="text-ms text-fg-tertiary">{t('adoption.declineNote')}</p>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {t('adoption.error')}
          </p>
        ) : null}
        <div className="flex w-full gap-2">
          <Button
            type="button"
            variant="secondary"
            size="touch"
            className="flex-1"
            disabled={busy}
            onClick={decline}
          >
            {t('adoption.declineCta')}
          </Button>
          <Button
            type="button"
            size="touch"
            className="flex-1"
            disabled={busy}
            onClick={() => void accept()}
          >
            {busy ? t('adoption.moving') : t('adoption.acceptCta')}
          </Button>
        </div>
      </div>
    </CenterModal>
  )
}
