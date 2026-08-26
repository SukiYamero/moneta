import type { Locale } from 'date-fns'
import { enUS, es, ptBR } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { detectRegion } from '@/lib/i18n/detectLocale'
import type { SupportedLocale } from '@/lib/i18n/resources'

export interface LocaleFormatting {
  locale: string
  dateFnsLocale: Locale
}

const FORMATTING: Record<SupportedLocale, LocaleFormatting> = {
  es: { locale: 'es-CO', dateFnsLocale: es },
  'es-AR': { locale: 'es-AR', dateFnsLocale: es },
  en: { locale: 'en-US', dateFnsLocale: enUS },
  'pt-BR': { locale: 'pt-BR', dateFnsLocale: ptBR },
}

const languageSubtag = (locale: SupportedLocale): string => FORMATTING[locale].locale.split('-')[0]!

const asSupportedLocale = (tag: string | undefined): SupportedLocale =>
  tag !== undefined && tag in FORMATTING ? (tag as SupportedLocale) : 'es'

export const localeFormatting = (tag: string | undefined, region: string): LocaleFormatting => {
  const copyLocale = asSupportedLocale(tag)
  return {
    locale: `${languageSubtag(copyLocale)}-${region}`,
    dateFnsLocale: FORMATTING[copyLocale].dateFnsLocale,
  }
}

export const useLocaleFormatting = (): LocaleFormatting => {
  const { i18n } = useTranslation()
  return localeFormatting(i18n.resolvedLanguage ?? i18n.language, detectRegion())
}
