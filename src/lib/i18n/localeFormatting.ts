import type { Locale } from 'date-fns'
import { enUS, es, ptBR } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { detectRegion } from '@/lib/i18n/detectLocale'
import type { SupportedLocale } from '@/lib/i18n/resources'

export interface LocaleFormatting {
  /** BCP-47 tag for `Intl` (currency/number formatting). */
  locale: string
  dateFnsLocale: Locale
}

// A supported locale is a *copy* locale, not a formatting one: `es` is the
// neutral Spanish of Colombia/Mexico/Ecuador/Venezuela/Peru and has no
// number formatting of its own. `dateFnsLocale` (and the copy locale's own
// default region, used only when no device region is available) come from
// this table; the actual Intl tag is built per call from the copy
// language plus the *device* region (specs.md §10.7) — the two axes are
// independent, so a Mexican user reading neutral `es` copy gets es-MX
// formatting, not the es-CO this table alone would imply. date-fns ships
// no Argentine or neutral Spanish either — both map to `es`, whose only
// difference from the regional variants is month names, which they share.
const FORMATTING: Record<SupportedLocale, LocaleFormatting> = {
  es: { locale: 'es-CO', dateFnsLocale: es },
  'es-AR': { locale: 'es-AR', dateFnsLocale: es },
  en: { locale: 'en-US', dateFnsLocale: enUS },
  'pt-BR': { locale: 'pt-BR', dateFnsLocale: ptBR },
}

const languageSubtag = (locale: SupportedLocale): string => FORMATTING[locale].locale.split('-')[0]!

const asSupportedLocale = (tag: string | undefined): SupportedLocale =>
  tag !== undefined && tag in FORMATTING ? (tag as SupportedLocale) : 'es'

/**
 * `tag` is the copy locale (`i18next`'s resolved language); `region` is
 * the device region (`detectRegion()`, an independent axis). Region has no
 * default here — callers own detecting it, the same "no default locale
 * parameter" rule `formatMonto`/`getMovimientoAmountView` already follow
 * (specs.md §11, 2026-08-19), so a call site that forgets to pass it is a
 * compile error instead of a silent es-CO fallback.
 */
export const localeFormatting = (tag: string | undefined, region: string): LocaleFormatting => {
  const copyLocale = asSupportedLocale(tag)
  return {
    locale: `${languageSubtag(copyLocale)}-${region}`,
    dateFnsLocale: FORMATTING[copyLocale].dateFnsLocale,
  }
}

/**
 * The active locale's formatting, for screens that render money or dates.
 * `movimientoView`/`MovimientoRow` stay i18n-agnostic and take these as
 * parameters (docs/wave-2/review-k.md) — this hook is the one place that
 * reads the copy locale off i18next and the region off the device, so
 * neither mapping can drift per screen.
 */
export const useLocaleFormatting = (): LocaleFormatting => {
  const { i18n } = useTranslation()
  return localeFormatting(i18n.resolvedLanguage ?? i18n.language, detectRegion())
}
