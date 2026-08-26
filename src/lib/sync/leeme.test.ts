import { describe, expect, it } from 'vitest'
import type { SupportedLocale } from '@/lib/i18n/resources'
import { buildLeemeContent, leemeFilename } from '@/lib/sync/leeme'

const LOCALES: SupportedLocale[] = ['es', 'en', 'es-AR', 'pt-BR']

describe('leemeFilename', () => {
  it('is one fixed name so the app can find and rewrite it', () => {
    expect(leemeFilename()).toBe('LEEME.txt')
  })
})

describe('buildLeemeContent', () => {
  it.each(LOCALES)('covers every required point, in order, for %s', (locale) => {
    const content = buildLeemeContent(locale, 'TestApp')

    expect(content).toContain('TestApp')

    const csvIdx = content.indexOf('.csv')
    expect(csvIdx).toBeGreaterThan(-1)

    const jsonIdx = content.indexOf('.json')
    expect(jsonIdx).toBeGreaterThan(csvIdx)

    const delIdx = content.indexOf('del')
    expect(delIdx).toBeGreaterThan(jsonIdx)

    const encryptedMarkers = ['cifrado', 'encrypted', 'criptografado']
    const encryptedIdx = encryptedMarkers.map((m) => content.indexOf(m)).find((i) => i > -1)
    expect(encryptedIdx).toBeGreaterThan(delIdx)
  })

  it('carries no field-by-field schema dump — no raw field names leak into the prose', () => {
    const content = buildLeemeContent('en', 'TestApp')
    expect(content).not.toMatch(/\bmonto\b|\bfecha\b|\bschemaVersion\b|\bhlc\b|\bbasedOn\b/)
  })

  it('defaults to the real APP_NAME when none is passed', () => {
    expect(buildLeemeContent('en')).toContain('KuroBello')
  })

  it('embeds the format version, so a stale copy is identifiable', () => {
    expect(buildLeemeContent('en', 'TestApp')).toMatch(/Format version: \d+/)
  })
})
