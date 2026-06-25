import { describe, it, expect } from 'vitest'
import { CONFIG_SEMILLA, SCHEMA_VERSION } from '@/lib/schema'

describe('schema seed config', () => {
  it('tags the seed config with the current schema version', () => {
    expect(CONFIG_SEMILLA.schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('points every seed category at an existing section', () => {
    const sectionIds = new Set(CONFIG_SEMILLA.secciones.map((s) => s.id))
    for (const category of CONFIG_SEMILLA.categorias) {
      expect(sectionIds.has(category.seccionId)).toBe(true)
    }
  })
})
