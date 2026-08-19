import type { SupportedLocale } from '@/lib/i18n/resources'

// Pure value → value mappings, per AGENTS.md — never a switch/if-else ladder.
// Keyed lowercase so browser tag casing (es-AR vs es-ar) can't cause a miss.
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

// Exact tag match wins over any candidate; then language-subtag match; any
// unmatched Spanish variant collapses to `es` via the subtag map, and
// anything else unmatched (no es/en/pt subtag at all) falls back to `en`.
export const detectLocale = (
  languages: readonly string[] = navigator.languages,
): SupportedLocale => {
  for (const tag of languages) {
    const exact = EXACT_LOCALE[tag.toLowerCase()]
    if (exact) return exact
  }
  for (const tag of languages) {
    const subtag = SUBTAG_LOCALE[tag.split('-')[0]?.toLowerCase() ?? '']
    if (subtag) return subtag
  }
  return 'en'
}
