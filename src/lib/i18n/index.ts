import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { resources } from '@/lib/i18n/resources'
import { detectLocale } from '@/lib/i18n/detectLocale'

// Reserved up front for the whole wave (docs/wave-2-plan.md §1.6) so later
// tracks add keys inside an existing namespace object instead of all
// appending to the end of the same locale file.
export const I18N_NAMESPACES = [
  'common',
  'auth',
  'driveConsent',
  'toast',
  'nav',
  'home',
  'search',
  'history',
  'update',
  'errors',
  'profile',
  'tags',
  'settings',
  'lock',
  'sync',
  'movimientos',
  'dateChipPicker',
] as const

// i18next initializes synchronously whenever `resources` are passed inline
// (no backend/CDN, AGENTS.md's no-CDN rule) — see i18next's own `init()`:
// it calls `load()` immediately rather than deferring via `setTimeout` when
// `options.resources` is set. That is what keeps `t()` usable on first
// render despite `useSuspense: false`, with no flash of empty text.
void i18next.use(initReactI18next).init({
  resources,
  lng: detectLocale(),
  fallbackLng: 'es',
  ns: I18N_NAMESPACES,
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React already escapes.
  react: { useSuspense: false },
})

const applyDocumentLang = (lng: string): void => {
  document.documentElement.lang = lng
}

applyDocumentLang(i18next.resolvedLanguage ?? i18next.language)
i18next.on('languageChanged', applyDocumentLang)

export { i18next }
