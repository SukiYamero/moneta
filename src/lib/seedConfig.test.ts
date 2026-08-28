import { describe, it, expect } from 'vitest'
import { buildSeedConfig } from '@/lib/seedConfig'
import { CONFIG_SEMILLA } from '@/lib/schema'

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
  it('keeps ids stable and only localizes nombre, regardless of locale', () => {
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

  it.each([
    ['US', 'en', ['Salary', 'Bills', 'Sales', 'Taxes', 'Petty cash']],
    ['BR', 'pt-BR', ['Salário', 'Contas', 'Vendas', 'Impostos', 'Fundo de caixa']],
    ['AR', 'es-AR', ['Sueldo', 'Servicios', 'Ventas', 'Impuestos', 'Caja chica']],
  ] as const)(
    'translates category names for region %s, locale %s',
    (region, locale, categoryNames) => {
      const seed = buildSeedConfig(region, locale)
      expect(seed.categorias.map((c) => c.nombre)).toEqual(categoryNames)
    },
  )

  it('the currency (region) and taxonomy (locale) axes vary independently', () => {
    const seed = buildSeedConfig('MX', 'pt-BR')
    expect(seed.preferencias.monedaPrincipal).toBe('MXN')
    expect(seed.categorias.map((c) => c.nombre)).toEqual([
      'Salário',
      'Contas',
      'Vendas',
      'Impostos',
      'Fundo de caixa',
    ])
  })

  it('detects the active locale from the device when called with no second argument', () => {
    expect(buildSeedConfig().categorias).toEqual(CONFIG_SEMILLA.categorias)
  })
})
