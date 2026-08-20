import { describe, it, expect } from 'vitest'
import { buildSeedConfig } from '@/lib/seedConfig'
import { CONFIG_SEMILLA } from '@/lib/schema'

describe('buildSeedConfig', () => {
  it('derives monedaPrincipal from the given region, keeping the rest of CONFIG_SEMILLA', () => {
    const seed = buildSeedConfig('MX')
    expect(seed.preferencias.monedaPrincipal).toBe('MXN')
    expect(seed.secciones).toEqual(CONFIG_SEMILLA.secciones)
    expect(seed.categorias).toEqual(CONFIG_SEMILLA.categorias)
    expect(seed.preferencias.tema).toBe(CONFIG_SEMILLA.preferencias.tema)
    expect(seed.preferencias.primerDiaSemana).toBe(CONFIG_SEMILLA.preferencias.primerDiaSemana)
  })

  it('is unchanged from CONFIG_SEMILLA for the CO region (today’s baseline)', () => {
    expect(buildSeedConfig('CO')).toEqual(CONFIG_SEMILLA)
  })

  it('never mutates CONFIG_SEMILLA itself — it stays a static constant', () => {
    const before = structuredClone(CONFIG_SEMILLA)
    buildSeedConfig('MX')
    expect(CONFIG_SEMILLA).toEqual(before)
  })

  it('falls back to COP for an unmapped region', () => {
    expect(buildSeedConfig('ZZ').preferencias.monedaPrincipal).toBe('COP')
  })

  it('detects the region from the device when called with no argument', () => {
    // Test-env navigator is stubbed to es-CO (src/test/setup.ts) — the
    // region axis has no persisted state, so calling with no args must
    // resolve through detectRegion() the same way the seeding paths do.
    expect(buildSeedConfig().preferencias.monedaPrincipal).toBe('COP')
  })
})

// specs.md §10.22 Decision 6 / §10.25 addendum, §11 2026-08-20: the seed
// taxonomy's names are chosen once, at seed time, off the active i18next
// language — not the device region, which stays monedaPrincipal's own axis
// (§10.7). Ids never change across locales; a Movimiento references a
// category by id, never by name.
describe('buildSeedConfig — seed taxonomy localization', () => {
  it('keeps ids stable and only localizes nombre, regardless of locale', () => {
    const seed = buildSeedConfig('CO', 'pt-BR')
    expect(seed.secciones.map((s) => s.id)).toEqual(CONFIG_SEMILLA.secciones.map((s) => s.id))
    expect(seed.categorias.map((c) => c.id)).toEqual(CONFIG_SEMILLA.categorias.map((c) => c.id))
    // Every other field on a categoria (icono, color, tipo, seccionId)
    // carries over untouched — only nombre varies by locale.
    expect(seed.categorias.map((c) => ({ ...c, nombre: undefined }))).toEqual(
      CONFIG_SEMILLA.categorias.map((c) => ({ ...c, nombre: undefined })),
    )
  })

  it('defaults to CONFIG_SEMILLA’s Spanish names for the es locale (today’s baseline)', () => {
    const seed = buildSeedConfig('CO', 'es')
    expect(seed).toEqual(CONFIG_SEMILLA)
  })

  it('translates section and category names to English for the en locale', () => {
    const seed = buildSeedConfig('US', 'en')
    expect(seed.secciones.map((s) => s.nombre)).toEqual(['Personal', 'Work', 'Business'])
    expect(seed.categorias.map((c) => c.nombre)).toEqual([
      'Salary',
      'Bills',
      'Sales',
      'Taxes',
      'Petty cash',
    ])
  })

  it('translates section and category names to Portuguese for the pt-BR locale', () => {
    const seed = buildSeedConfig('BR', 'pt-BR')
    expect(seed.secciones.map((s) => s.nombre)).toEqual(['Pessoal', 'Trabalho', 'Negócio'])
    expect(seed.categorias.map((c) => c.nombre)).toEqual([
      'Salário',
      'Contas',
      'Vendas',
      'Impostos',
      'Fundo de caixa',
    ])
  })

  it('uses Argentine regionalisms for es-AR, distinct from neutral es', () => {
    const seed = buildSeedConfig('AR', 'es-AR')
    expect(seed.secciones.map((s) => s.nombre)).toEqual(['Personal', 'Trabajo', 'Emprendimiento'])
    expect(seed.categorias.map((c) => c.nombre)).toEqual([
      'Sueldo',
      'Servicios',
      'Ventas',
      'Impuestos',
      'Caja chica',
    ])
  })

  it('the currency (region) and taxonomy (locale) axes vary independently', () => {
    // A pt-BR reader in Mexico: taxonomy follows the language, currency
    // follows the region — specs.md §10.7's independence, not coupled by
    // default the way monedaForRegion's own wiring is.
    const seed = buildSeedConfig('MX', 'pt-BR')
    expect(seed.preferencias.monedaPrincipal).toBe('MXN')
    expect(seed.secciones.map((s) => s.nombre)).toEqual(['Pessoal', 'Trabalho', 'Negócio'])
  })

  it('detects the active locale from the device when called with no second argument', () => {
    // Test-env navigator is stubbed to es-CO (src/test/setup.ts).
    expect(buildSeedConfig().secciones).toEqual(CONFIG_SEMILLA.secciones)
  })
})
