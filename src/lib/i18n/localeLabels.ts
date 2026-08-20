import type { SupportedLocale } from '@/lib/i18n/resources'

// Endonyms — a language's name in itself, e.g. "Português (Brasil)" stays
// "Português (Brasil)" whether the app copy around it is showing in
// Spanish or English — so this is a fixed lookup table, not routed through
// `i18next` the way surrounding UI copy is (same class of value as a
// currency code, not translatable prose). The one source both
// `src/features/profile/PreferencesSection.tsx` (the read-only summary)
// and `src/features/settings/PreferencesEditor.tsx` (the picker) read —
// moved here, not duplicated between the two (specs.md §10.24).
export const LOCALE_LABEL: Record<SupportedLocale, string> = {
  es: 'Español',
  'es-AR': 'Español (Argentina)',
  en: 'English',
  'pt-BR': 'Português (Brasil)',
}
