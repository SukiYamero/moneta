import type { Locale } from 'date-fns'
import { enUS, es, ptBR } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import type { SupportedLocale } from '@/lib/i18n/resources'

export interface LocaleFormatting {
  /** BCP-47 tag for `Intl` (currency/number formatting). */
  locale: string
  dateFnsLocale: Locale
}

// A supported locale is a *copy* locale, not a formatting one: `es` is the
// neutral Spanish of Colombia/Mexico/Ecuador/Venezuela/Peru and has no
// number formatting of its own, so it resolves to the es-CO tag every amount
// was already formatted with before any locale was wired (specs.md §11,
// 2026-08-19). date-fns ships no Argentine or neutral Spanish either — both
// map to `es`, whose only difference from the regional variants is month
// names, which they share.
const FORMATTING: Record<SupportedLocale, LocaleFormatting> = {
  es: { locale: 'es-CO', dateFnsLocale: es },
  'es-AR': { locale: 'es-AR', dateFnsLocale: es },
  en: { locale: 'en-US', dateFnsLocale: enUS },
  'pt-BR': { locale: 'pt-BR', dateFnsLocale: ptBR },
}

const BY_TAG: Record<string, LocaleFormatting | undefined> = FORMATTING

export const localeFormatting = (tag: string | undefined): LocaleFormatting =>
  (tag === undefined ? undefined : BY_TAG[tag]) ?? FORMATTING.es

/**
 * The active locale's formatting, for screens that render money or dates.
 * `movimientoView`/`MovimientoRow` stay i18n-agnostic and take these as
 * parameters (docs/wave-2/review-k.md) — this hook is the one place that
 * reads the locale off i18next, so the mapping can't drift per screen.
 */
export const useLocaleFormatting = (): LocaleFormatting => {
  const { i18n } = useTranslation()
  return localeFormatting(i18n.resolvedLanguage ?? i18n.language)
}
