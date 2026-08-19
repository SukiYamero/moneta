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
