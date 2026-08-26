import es from '@/lib/i18n/locales/es.json'
import en from '@/lib/i18n/locales/en.json'
import esAR from '@/lib/i18n/locales/es-AR.json'
import ptBR from '@/lib/i18n/locales/pt-BR.json'

export const resources = {
  es,
  en,
  'es-AR': esAR,
  'pt-BR': ptBR,
} as const

export type SupportedLocale = keyof typeof resources

export const SUPPORTED_LOCALES = Object.keys(resources) as SupportedLocale[]

export const isSupportedLocale = (value: unknown): value is SupportedLocale =>
  typeof value === 'string' && (SUPPORTED_LOCALES as string[]).includes(value)
