import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useDataStore } from '@/lib/dataStore'
import { LOCALE_LABEL } from '@/lib/i18n/localeLabels'
import { resolveActiveLocale } from '@/lib/i18n/localeResolution'
import { WEEK_START_KEY } from '@/lib/weekStart'
import { ProfileSectionHeading } from '@/features/profile/ProfileSectionHeading'

const LinkedRow = ({ label, value }: { label: string; value: string }) => (
  <Link
    to="/settings"
    className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-card px-4 py-3.25 transition-colors hover:border-border-hover"
  >
    <span className="text-sm font-semibold text-foreground">{label}</span>
    <span className="flex items-center gap-1.5 text-sm font-medium text-fg-secondary">
      {value}
      <ChevronRight className="size-3.5 text-fg-tertiary" aria-hidden="true" />
    </span>
  </Link>
)

export const PreferencesSection = () => {
  const { t } = useTranslation('profile')
  const preferencias = useDataStore((s) => s.config?.preferencias)

  return (
    <section>
      <ProfileSectionHeading>{t('preferences.heading')}</ProfileSectionHeading>
      <div className="flex flex-col gap-2">
        <LinkedRow
          label={t('preferences.theme.label')}
          value={preferencias ? t(`preferences.theme.${preferencias.tema}`) : '—'}
        />
        <LinkedRow
          label={t('preferences.currency.label')}
          value={preferencias?.monedaPrincipal ?? '—'}
        />
        <LinkedRow
          label={t('preferences.weekStart.label')}
          value={
            preferencias
              ? t(`preferences.weekStart.${WEEK_START_KEY[preferencias.primerDiaSemana]}`)
              : '—'
          }
        />
        <LinkedRow
          label={t('preferences.language.label')}
          value={LOCALE_LABEL[resolveActiveLocale(preferencias?.idioma)]}
        />
      </div>
    </section>
  )
}
