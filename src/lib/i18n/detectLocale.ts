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

// navigator.languages is an ordered preference list — a lower-priority
// candidate must never win over a higher-priority one we can also serve.
// So each candidate tries exact-then-subtag before moving to the next one
// (not a two-pass "exact anywhere, then subtag anywhere" scan, which would
// let a later, lower-priority exact match beat an earlier subtag match).
// Any unmatched Spanish variant collapses to `es` via the subtag map, any
// unmatched Portuguese variant to `pt-BR`, and a candidate with no exact or
// subtag match at all is skipped in favor of the next preference; if none
// of them match anything, default to `en`.
export const detectLocale = (
  // `navigator.languages` is undefined on some browsers/webviews (only the
  // singular `navigator.language` is guaranteed) — default to `[]` so this
  // still returns the `en` fallback instead of throwing on `for...of`.
  languages: readonly string[] = navigator.languages ?? [],
): SupportedLocale => {
  for (const tag of languages) {
    const lower = tag.toLowerCase()
    const match = EXACT_LOCALE[lower] ?? SUBTAG_LOCALE[lower.split('-')[0] ?? '']
    if (match) return match
  }
  return 'en'
}
