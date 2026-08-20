import { useTranslation } from 'react-i18next'
import { useDataStore } from '@/lib/dataStore'
import type { SupportedLocale } from '@/lib/i18n/resources'
import { ProfileSectionHeading } from '@/features/profile/ProfileSectionHeading'

const WEEK_START_KEY: Record<0 | 1, 'sunday' | 'monday'> = { 0: 'sunday', 1: 'monday' }

// Endonyms — a language's name in itself, e.g. "Português (Brasil)" stays
// "Português (Brasil)" whether the app copy around it is showing in
// Spanish or English — so this is a fixed lookup table, not routed through
// `i18next` the way the row's own label is (same class of value as a
// currency code, not user-facing prose that translates).
const LOCALE_LABEL: Record<SupportedLocale, string> = {
  es: 'Español',
  'es-AR': 'Español (Argentina)',
  en: 'English',
  'pt-BR': 'Português (Brasil)',
}

const asSupportedLocale = (tag: string | undefined): SupportedLocale =>
  tag !== undefined && tag in LOCALE_LABEL ? (tag as SupportedLocale) : 'es'

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-card px-4 py-3.25">
    <span className="text-sm font-semibold text-fg-disabled">{label}</span>
    <span className="text-sm font-medium text-fg-disabled">{value}</span>
  </div>
)

/**
 * Read-only current values, deliberately inert this wave (specs.md §10.18,
 * "Preferences render their current values and stay inert this wave" —
 * carried over from `docs/wave-3-plan.md`'s scoping). None of these four
 * rows is a stub for lack of time; each is inert for its own, different,
 * already-decided reason — see the `STUB(wave3)` comment above each one.
 * No `SectionHeading`/chevron/button semantics here on purpose: an inert
 * `<div>` reads as "informational," not as a dead tap target the way a
 * disabled button with a chevron would (the exact "row that looks tappable
 * and does nothing" defect `specs.md` §11 already ruled out once, for the
 * Home notification dot).
 */
export const PreferencesSection = () => {
  const { t, i18n } = useTranslation('profile')
  const preferencias = useDataStore((s) => s.config?.preferencias)

  return (
    <section>
      <ProfileSectionHeading>{t('preferences.heading')}</ProfileSectionHeading>
      <p className="mb-2.5 text-xs font-medium text-fg-tertiary">{t('preferences.readOnlyNote')}</p>
      <div className="flex flex-col gap-2">
        {/* STUB(wave3): `tema` has no runtime effect — the light palette is
            unreviewed shadcn scaffold (specs.md §11, 2026-08-18 +
            docs/wave-3-audit-surface.md §2). A working toggle would ship a
            screen that visibly lies the moment it's tapped. */}
        <Row
          label={t('preferences.theme.label')}
          value={preferencias ? t(`preferences.theme.${preferencias.tema}`) : '—'}
        />
        {/* STUB(wave3): `monedaPrincipal` has no picker UI yet — it needs a
            currency-selection control before there's anything to write to
            (Wave 4+). */}
        <Row label={t('preferences.currency.label')} value={preferencias?.monedaPrincipal ?? '—'} />
        {/* STUB(wave3): `primerDiaSemana` is gated on the specs.md §12 bug a
            working picker would make immediately reachable — History's
            `semana` scope can render the seed default and then visibly
            flip once this is live. */}
        <Row
          label={t('preferences.weekStart.label')}
          value={
            preferencias
              ? t(`preferences.weekStart.${WEEK_START_KEY[preferencias.primerDiaSemana]}`)
              : '—'
          }
        />
        {/* STUB(wave3): `idioma` is not a field on `Preferencias` yet — it
            needs a schema addition (specs.md §12) before a real picker can
            write it. This shows the currently *detected* app language, not
            a stored preference. */}
        <Row
          label={t('preferences.language.label')}
          value={LOCALE_LABEL[asSupportedLocale(i18n.resolvedLanguage ?? i18n.language)]}
        />
      </div>
    </section>
  )
}
