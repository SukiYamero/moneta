import { Check, Loader2, Smartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { ProfileSectionHeading } from '@/features/profile/ProfileSectionHeading'
import { useGuestAdoptionEntry } from '@/features/profile/useGuestAdoptionEntry'

export const GuestAdoptionSection = () => {
  const { t } = useTranslation('auth')
  const { visible, phase, count, adoptedCount, error, adopt } = useGuestAdoptionEntry()

  if (!visible) return null

  return (
    <section>
      <ProfileSectionHeading>{t('adoption.entry.heading')}</ProfileSectionHeading>
      <div className="flex flex-col gap-3 rounded-3xl border border-border-subtle bg-card px-4 py-3.75">
        {phase === 'success' ? (
          <p className="flex items-center gap-2 text-sm font-medium text-fg-secondary">
            <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {t('adoption.entry.success', { count: adoptedCount })}
          </p>
        ) : (
          <>
            <p className="text-sm font-medium text-fg-secondary">
              {t('adoption.entry.description', { count })}
            </p>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {t('adoption.entry.error')}
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="touch"
              disabled={phase === 'busy'}
              onClick={() => void adopt()}
              className="w-full justify-center gap-2"
            >
              {phase === 'busy' ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Smartphone aria-hidden="true" />
              )}
              {phase === 'busy' ? t('adoption.entry.adding') : t('adoption.entry.cta')}
            </Button>
          </>
        )}
      </div>
    </section>
  )
}
