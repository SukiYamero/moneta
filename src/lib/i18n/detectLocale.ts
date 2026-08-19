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
const navigatorLanguages = (): readonly string[] =>
  navigator.languages ?? (navigator.language ? [navigator.language] : [])

export const detectLocale = (
  // `navigator.languages` is undefined on some browsers/webviews — only the
  // singular `navigator.language` is guaranteed there. Degrade one step at a
  // time (languages -> single language -> []) rather than jumping straight
  // to `en`: a webview whose `navigator.language` is `es-AR` should still
  // resolve to `es-AR`, not lose that information to the `en` last resort.
  languages: readonly string[] = navigatorLanguages(),
): SupportedLocale => {
  for (const tag of languages) {
    const lower = tag.toLowerCase()
    const match = EXACT_LOCALE[lower] ?? SUBTAG_LOCALE[lower.split('-')[0] ?? '']
    if (match) return match
  }
  return 'en'
}

// Region — an axis independent of the copy locale `detectLocale` resolves
// above (specs.md §10.7): `es` is neutral Spanish for five countries whose
// number/currency formatting disagree with each other. Only used as a
// fallback for `detectRegion` below: it is not part of `detectLocale`'s own
// contract and must never change what that function resolves to.
const CANONICAL_REGION: Record<SupportedLocale, string> = {
  es: 'CO',
  'es-AR': 'AR',
  en: 'US',
  'pt-BR': 'BR',
}

// A BCP-47 region subtag is exactly 2 alphabetic characters (ISO 3166-1
// alpha-2), bounded by a dash or the end of the tag — this excludes a UN
// M49 numeric region ("es-419", Latin America) and a script subtag
// ("zh-Hans-CN"'s "Hans"), neither of which this app's target locales use
// but which must not be misread as a country region.
const REGION_SUBTAG = /-([a-z]{2})(?:-|$)/i

/**
 * Device region, read from the region subtag of the first
 * `navigator.languages`/`navigator.language` candidate that has one —
 * independent of, and never changing, the copy locale `detectLocale`
 * resolves. Falls back to the copy locale's canonical region when no
 * candidate carries a subtag at all (e.g. a bare "es"), so a device with no
 * region info renders exactly as it did before this axis existed
 * (`es`/`CO`). Defaulted the same way `detectLocale` is — evaluated per
 * call, not at import time (specs.md §11, 2026-08-19: the blank-page
 * defect `detectLocale`'s own default parameter caused once already).
 */
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
