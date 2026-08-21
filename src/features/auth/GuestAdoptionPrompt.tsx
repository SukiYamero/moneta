import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/lib/authStore'
import { Button } from '@/components/ui/button'
import { CenterModal } from '@/components/shared/CenterModal'

/**
 * specs.md §10.32: a guest with local movements who signs in is asked,
 * once, whether to bring them into the account they just signed into.
 * There is no design for this screen (verified against the export — the
 * canvas's "Usar estos datos" belongs to the receipt-scan flow) — built
 * from `CenterModal` and the tokens, same posture as §10.2.1's biometric
 * row. Renders nothing when there is no pending offer; mounted alongside
 * `RequireAuth`'s normal children (a modal over the app, not a full-screen
 * gate that would block Home from settling underneath it) — `DrivePermissionScreen`
 * already owns the one full-screen "pending decision" treatment this app
 * has, and this isn't that: the person's data and the rest of the app are
 * already there and usable while they decide.
 */
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
