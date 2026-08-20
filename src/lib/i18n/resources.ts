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

// The runtime list and its guard live here, beside the table they describe,
// so a locale added to `resources` above is the only edit needed — a second
// hand-written array would be free to drift from it. `sync/validate.ts` is
// the caller that needs this at runtime: `Preferencias.idioma` arrives from
// a file the user is allowed to hand-edit, so it is untrusted input like any
// other Drive value (specs.md §10.19).
export const SUPPORTED_LOCALES = Object.keys(resources) as SupportedLocale[]

export const isSupportedLocale = (value: unknown): value is SupportedLocale =>
  typeof value === 'string' && (SUPPORTED_LOCALES as string[]).includes(value)
