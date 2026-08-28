import { describe, it, expect } from 'vitest'
import { buildSeedConfig, SEED_CATEGORY_NAMES } from '@/lib/seedConfig'
import { CATEGORIAS_SEMILLA, CONFIG_SEMILLA } from '@/lib/schema'
import { SUPPORTED_LOCALES } from '@/lib/i18n/resources'

describe('buildSeedConfig', () => {
  it('derives monedaPrincipal from the given region, keeping the rest of CONFIG_SEMILLA', () => {
    const seed = buildSeedConfig('MX')
    expect(seed.preferencias.monedaPrincipal).toBe('MXN')
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
    expect(buildSeedConfig().preferencias.monedaPrincipal).toBe('COP')
  })
})

describe('buildSeedConfig — seed taxonomy localization', () => {
  it('keeps ids and structure stable and only localizes nombre, regardless of locale', () => {
    const seed = buildSeedConfig('CO', 'pt-BR')
    expect(seed.categorias.map((c) => c.id)).toEqual(CONFIG_SEMILLA.categorias.map((c) => c.id))
    expect(seed.categorias.map((c) => ({ ...c, nombre: undefined }))).toEqual(
      CONFIG_SEMILLA.categorias.map((c) => ({ ...c, nombre: undefined })),
    )
  })

  it('defaults to CONFIG_SEMILLA’s Spanish names for the es locale (today’s baseline)', () => {
    const seed = buildSeedConfig('CO', 'es')
    expect(seed).toEqual(CONFIG_SEMILLA)
  })

  it('returns English names for buildSeedConfig("CO", "en")', () => {
    const seed = buildSeedConfig('CO', 'en')
    const byId = new Map(seed.categorias.map((c) => [c.id, c.nombre]))
    expect(byId.get('cat_comida')).toBe('Food')
    expect(byId.get('cat_hogar')).toBe('Home')
    expect(byId.get('cat_sueldo')).toBe('Salary')
    expect(byId.get('cat_impuestos')).toBe('Taxes')
  })

  it('returns the Argentine variants where they differ for buildSeedConfig("AR", "es-AR")', () => {
    const seed = buildSeedConfig('AR', 'es-AR')
    const byId = new Map(seed.categorias.map((c) => [c.id, c.nombre]))
    expect(byId.get('cat_arriendo')).toBe('Alquiler')
    expect(byId.get('cat_parqueadero')).toBe('Estacionamiento')
    expect(byId.get('cat_domicilios')).toBe('Delivery')
    expect(byId.get('cat_caja_menor')).toBe('Caja chica')
    expect(byId.get('cat_comida')).toBe('Comida')
  })

  it('es-AR is not a copy of es — at least one seeded name differs between them', () => {
    const es = buildSeedConfig('CO', 'es')
    const esAR = buildSeedConfig('CO', 'es-AR')
    const differing = es.categorias.filter((c, i) => c.nombre !== esAR.categorias[i]?.nombre)
    expect(differing.length).toBeGreaterThan(0)
  })

  it('the currency (region) and taxonomy (locale) axes vary independently', () => {
    const seed = buildSeedConfig('MX', 'pt-BR')
    expect(seed.preferencias.monedaPrincipal).toBe('MXN')
    expect(seed.categorias.find((c) => c.id === 'cat_ingresos')?.nombre).toBe('Receitas')
  })

  it('detects the active locale from the device when called with no second argument', () => {
    expect(buildSeedConfig().categorias).toEqual(CONFIG_SEMILLA.categorias)
  })
})

describe('SEED_CATEGORY_NAMES — locale map completeness', () => {
  const seedIds = CATEGORIAS_SEMILLA.map((c) => c.id)

  it('has an entry for every supported locale', () => {
    expect(Object.keys(SEED_CATEGORY_NAMES).toSorted()).toEqual(SUPPORTED_LOCALES.toSorted())
  })

  it('has an identical key set across all four locale maps, matching every seeded id', () => {
    const keySets = Object.values(SEED_CATEGORY_NAMES).map((names) => Object.keys(names).toSorted())
    const expected = seedIds.toSorted()
    for (const keys of keySets) {
      expect(keys).toEqual(expected)
    }
  })

  it('gives every id a non-empty name in every locale', () => {
    for (const names of Object.values(SEED_CATEGORY_NAMES)) {
      for (const id of seedIds) {
        expect(names[id], `${id} has no name`).toBeTruthy()
      }
    }
  })
})
