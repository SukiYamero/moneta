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

// Matches `PreferencesSection.tsx`'s own row order (Tema first) — its
// `claro`/`oscuro`/`sistema` labels already existed in `profile`'s locale
// block, unused until now (Prerequisite 3, specs.md §10.24/§10.30).
const THEMES: Theme[] = ['claro', 'oscuro', 'sistema']

// "Seguir el dispositivo" isn't a `SupportedLocale` — it's the choice that
// writes `idioma` back to `undefined` (specs.md §10.24's "absence means
// follow the device"). Modeled as its own member of the picker's value
// type rather than overloading `undefined` as an `OptionList` value, which
// `OptionList<T extends string>` can't represent anyway.
type LocaleChoice = SupportedLocale | 'device'

/**
 * The four writable preferences: `tema` (specs.md §10.30 — the picker
 * Prerequisite 3 withheld until a real light theme existed),
 * `primerDiaSemana` as a two-option `SegmentedControl` (matches the
 * design's ask exactly — this is the one preference that genuinely fits a
 * pill toggle), `idioma` and `monedaPrincipal` as `OptionList`s. Purely
 * controlled: `SettingsScreen` owns the write (`dataStore.updateConfig`),
 * this component only ever calls `onChange` with the patch — no store
 * import here, so it stays testable with a plain prop in/callback out
 * contract. Applying `tema` to the document is `syncStoredTheme.ts`'s job
 * (a `dataStore` subscription), not this component's — same division as
 * `idioma`/`syncStoredLocale.ts`.
 */
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
