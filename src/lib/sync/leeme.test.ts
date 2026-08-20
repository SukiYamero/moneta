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

    // 1. what these files are, and that they are theirs — the app name and
    // "yours"/"tuyos"/"seus" appear together up front.
    expect(content).toContain('TestApp')

    // 2. the .csv files are the easy path
    const csvIdx = content.indexOf('.csv')
    expect(csvIdx).toBeGreaterThan(-1)

    // 3. the .json files are the complete record, current year has none yet
    const jsonIdx = content.indexOf('.json')
    expect(jsonIdx).toBeGreaterThan(csvIdx)

    // 4. the one-sentence rule for turning JSON into a table
    const delIdx = content.indexOf('del')
    expect(delIdx).toBeGreaterThan(jsonIdx)

    // 5. nothing here is encrypted or locked — comes after the rule
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
