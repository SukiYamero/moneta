import { describe, it, expect } from 'vitest'
import es from '@/lib/i18n/locales/es.json'
import en from '@/lib/i18n/locales/en.json'
import esAR from '@/lib/i18n/locales/es-AR.json'
import ptBR from '@/lib/i18n/locales/pt-BR.json'

type JsonRecord = Record<string, unknown>

const isPlainObject = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// Flattens a locale resource to a sorted list of dotted leaf paths — e.g.
// `{ auth: { welcome: { googleCta: '...' } } }` → `['auth.welcome.googleCta']`.
// `es` is the base/fallback locale (`resources.ts`) and the shape every
// other locale file must match; nothing else in the toolchain (not `tsc`,
// not `oxlint`) notices a key present in `es` and silently missing from
// `en`/`es-AR`/`pt-BR` — that only degrades to `fallbackLng: 'es'` at
// runtime, i.e. a mixed-language screen nobody gets an error for.
const flattenKeys = (value: JsonRecord, prefix = ''): string[] =>
  Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return isPlainObject(child) ? flattenKeys(child, path) : [path]
  })

describe('locale files stay key-identical to es (base/fallback)', () => {
  const esKeys = flattenKeys(es).toSorted()

  it.each([
    ['en', en],
    ['es-AR', esAR],
    ['pt-BR', ptBR],
  ] as const)('%s has exactly the same key paths as es', (_locale, resource) => {
    expect(flattenKeys(resource).toSorted()).toEqual(esKeys)
  })
})
