import { useTranslation } from 'react-i18next'
import type { Moneda, Preferencias } from '@/lib/schema'
import type { SupportedLocale } from '@/lib/i18n/resources'
import { LOCALE_LABEL } from '@/lib/i18n/localeLabels'
import type { Theme } from '@/lib/theme'
import { WEEK_START_KEY, WEEK_START_VALUE } from '@/lib/weekStart'
import { SegmentedControl, type SegmentedControlOption } from '@/components/shared/SegmentedControl'
import { OptionList } from '@/features/settings/OptionList'
import { ProfileSectionHeading } from '@/features/profile/ProfileSectionHeading'

export interface PreferencesEditorProps {
  preferencias: Preferencias
  onChange: (patch: Partial<Preferencias>) => void
}

const MONEDAS: Moneda[] = ['COP', 'USD', 'MXN', 'ARS', 'BRL', 'PEN']

const THEMES: Theme[] = ['claro', 'oscuro', 'sistema']

type LocaleChoice = SupportedLocale | 'device'

export const PreferencesEditor = ({ preferencias, onChange }: PreferencesEditorProps) => {
  const { t } = useTranslation(['settings', 'profile'])

  const weekStartOptions: SegmentedControlOption<'sunday' | 'monday'>[] = [
    { value: 'sunday', label: t('profile:preferences.weekStart.sunday') },
    { value: 'monday', label: t('profile:preferences.weekStart.monday') },
  ]
  const weekStartValue = WEEK_START_KEY[preferencias.primerDiaSemana]

  const localeItems: { value: LocaleChoice; label: string }[] = [
    { value: 'device', label: t('settings:preferences.language.device') },
    ...(Object.keys(LOCALE_LABEL) as SupportedLocale[]).map((locale) => ({
      value: locale as LocaleChoice,
      label: LOCALE_LABEL[locale],
    })),
  ]
  const localeValue: LocaleChoice = preferencias.idioma ?? 'device'

  const monedaItems = MONEDAS.map((moneda) => ({ value: moneda, label: moneda }))

  const themeItems = THEMES.map((tema) => ({
    value: tema,
    label: t(`profile:preferences.theme.${tema}`),
  }))

  return (
    <section>
      <ProfileSectionHeading>{t('settings:preferences.heading')}</ProfileSectionHeading>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-fg-tertiary">
            {t('profile:preferences.theme.label')}
          </span>
          <OptionList
            items={themeItems}
            value={preferencias.tema}
            onChange={(tema) => onChange({ tema })}
            aria-label={t('profile:preferences.theme.label')}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-fg-tertiary">
            {t('profile:preferences.weekStart.label')}
          </span>
          <SegmentedControl
            options={weekStartOptions}
            value={weekStartValue}
            onChange={(next) => onChange({ primerDiaSemana: WEEK_START_VALUE[next] })}
            aria-label={t('profile:preferences.weekStart.label')}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-fg-tertiary">
            {t('profile:preferences.language.label')}
          </span>
          <OptionList
            items={localeItems}
            value={localeValue}
            onChange={(next) => onChange({ idioma: next === 'device' ? undefined : next })}
            aria-label={t('profile:preferences.language.label')}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-fg-tertiary">
            {t('profile:preferences.currency.label')}
          </span>
          <OptionList
            items={monedaItems}
            value={preferencias.monedaPrincipal}
            onChange={(monedaPrincipal) => onChange({ monedaPrincipal })}
            aria-label={t('profile:preferences.currency.label')}
          />
        </div>
      </div>
    </section>
  )
}
