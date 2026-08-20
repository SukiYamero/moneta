import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useDataStore } from '@/lib/dataStore'
import type { SupportedLocale } from '@/lib/i18n/resources'
import { LOCALE_LABEL } from '@/lib/i18n/localeLabels'
import { ProfileSectionHeading } from '@/features/profile/ProfileSectionHeading'

const WEEK_START_KEY: Record<0 | 1, 'sunday' | 'monday'> = { 0: 'sunday', 1: 'monday' }

const asSupportedLocale = (tag: string | undefined): SupportedLocale =>
  tag !== undefined && tag in LOCALE_LABEL ? (tag as SupportedLocale) : 'es'

/** The theme row: never a Link — there is nowhere to send it (Prerequisite 3). */
const InertRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-card px-4 py-3.25">
    <span className="text-sm font-semibold text-fg-disabled">{label}</span>
    <span className="text-sm font-medium text-fg-disabled">{value}</span>
  </div>
)

/** A row that is the way into `/settings` — real link semantics, not a dead tap target. */
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

/**
 * The entry point into `/settings` (specs.md §10.24): the three writable
 * preferences (`primerDiaSemana`, `idioma`, `monedaPrincipal`) are now real
 * `Link`s carrying the current value, replacing the inert `<div>`s Wave 3
 * shipped honestly (each had its own `STUB(wave3)` reason). `Tema` is the
 * one row that stays inert — Prerequisite 3: `index.html` hardcodes dark,
 * so there is still nowhere to send this tap, and the row states plainly
 * that the app is dark-only for now rather than repeating a stored
 * `tema` that has no effect.
 */
export const PreferencesSection = () => {
  // `settings` too — only for the theme note (§10.24 Prerequisite 3's
  // honesty copy lives in `settings`'s own namespace, not `profile`'s: this
  // track edits only `settings`/`lock` in the locale files, per
  // `docs/wave-4-plan.md` §5's contended-file resolution with Track F).
  const { t, i18n } = useTranslation(['profile', 'settings'])
  const preferencias = useDataStore((s) => s.config?.preferencias)

  return (
    <section>
      <ProfileSectionHeading>{t('preferences.heading')}</ProfileSectionHeading>
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          {/* STUB(wave3): `tema` has no control until a light design exists
              (specs.md §10.24 Prerequisite 3, docs/pendientes-usuario.md
              item 7 — a design deliverable, not a code one). The value
              shown is fixed ("Oscuro"), never `preferencias.tema` — a
              stored 'claro'/'sistema' would misdescribe a dark-only app. */}
          <InertRow label={t('preferences.theme.label')} value={t('preferences.theme.oscuro')} />
          <p className="px-1 text-xs font-medium text-fg-tertiary">
            {t('settings:preferences.theme.note')}
          </p>
        </div>
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
          value={
            LOCALE_LABEL[
              preferencias?.idioma ?? asSupportedLocale(i18n.resolvedLanguage ?? i18n.language)
            ]
          }
        />
      </div>
    </section>
  )
}
