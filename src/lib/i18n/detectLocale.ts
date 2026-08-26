import type { SupportedLocale } from '@/lib/i18n/resources'

const EXACT_LOCALE: Record<string, SupportedLocale> = {
  es: 'es',
  en: 'en',
  'es-ar': 'es-AR',
  'pt-br': 'pt-BR',
}

const SUBTAG_LOCALE: Record<string, SupportedLocale> = {
  es: 'es',
  en: 'en',
  pt: 'pt-BR',
}

const navigatorLanguages = (): readonly string[] =>
  navigator.languages ?? (navigator.language ? [navigator.language] : [])

export const detectLocale = (
  languages: readonly string[] = navigatorLanguages(),
): SupportedLocale => {
  for (const tag of languages) {
    const lower = tag.toLowerCase()
    const match = EXACT_LOCALE[lower] ?? SUBTAG_LOCALE[lower.split('-')[0] ?? '']
    if (match) return match
  }
  return 'en'
}

const CANONICAL_REGION: Record<SupportedLocale, string> = {
  es: 'CO',
  'es-AR': 'AR',
  en: 'US',
  'pt-BR': 'BR',
}

const REGION_SUBTAG = /-([a-z]{2})(?:-|$)/i

export const detectRegion = (
  languages: readonly string[] = navigatorLanguages(),
  copyLocale: SupportedLocale = detectLocale(languages),
): string => {
  for (const tag of languages) {
    const region = REGION_SUBTAG.exec(tag)?.[1]
    if (region) return region.toUpperCase()
  }
  return CANONICAL_REGION[copyLocale]
}
