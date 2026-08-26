import { describe, it, expect } from 'vitest'
import { I18N_NAMESPACES } from '@/lib/i18n'
import es from '@/lib/i18n/locales/es.json'
import en from '@/lib/i18n/locales/en.json'
import esAR from '@/lib/i18n/locales/es-AR.json'
import ptBR from '@/lib/i18n/locales/pt-BR.json'

type JsonRecord = Record<string, unknown>

const isPlainObject = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const flattenKeys = (value: JsonRecord, prefix = ''): string[] =>
  Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return isPlainObject(child) && Object.keys(child).length > 0 ? flattenKeys(child, path) : [path]
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

describe('flattenKeys distinguishes an empty-object namespace from an absent one', () => {
  it('does not silently equate `{ common: {} }` with a resource missing `common` entirely', () => {
    const withEmptyNamespace = flattenKeys({ common: {}, auth: { a: '1' } }).toSorted()
    const missingNamespace = flattenKeys({ auth: { a: '1' } }).toSorted()
    expect(missingNamespace).not.toEqual(withEmptyNamespace)
  })
})

describe('I18N_NAMESPACES matches the locale files it declares', () => {
  it('lists exactly the top-level namespaces present in es', () => {
    expect([...I18N_NAMESPACES].toSorted()).toEqual(Object.keys(es).toSorted())
  })
})
