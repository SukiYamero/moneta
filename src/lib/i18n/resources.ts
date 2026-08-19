import es from '@/lib/i18n/locales/es.json'
import en from '@/lib/i18n/locales/en.json'
import esAR from '@/lib/i18n/locales/es-AR.json'
import ptBR from '@/lib/i18n/locales/pt-BR.json'

// `es` is the base/fallback locale and the shape every other locale file
// must match (docs/wave-2/track-i.md). It also drives the compile-time key
// typing in `i18next.d.ts`.
export const resources = {
  es,
  en,
  'es-AR': esAR,
  'pt-BR': ptBR,
} as const

export type SupportedLocale = keyof typeof resources
