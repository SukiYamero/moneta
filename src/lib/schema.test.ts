import { describe, it, expect } from 'vitest'
import { CATEGORY_ICON_KEYS } from '@/lib/categoryIconKeys'
import { CONFIG_SEMILLA, SCHEMA_VERSION } from '@/lib/schema'

describe('schema seed config', () => {
  it('tags the seed config with the current schema version', () => {
    expect(CONFIG_SEMILLA.schemaVersion).toBe(SCHEMA_VERSION)
  })
})

describe('CONFIG_SEMILLA.categorias — seed catalog shape', () => {
  const categorias = CONFIG_SEMILLA.categorias
  const byId = new Map(categorias.map((c) => [c.id, c]))
  const topLevel = categorias.filter((c) => c.padreId === undefined)

  it('has no duplicate ids', () => {
    const ids = categorias.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('resolves every padreId to a top-level category in the same array', () => {
    for (const categoria of categorias) {
      if (categoria.padreId === undefined) continue
      const parent = byId.get(categoria.padreId)
      expect(
        parent,
        `padreId ${categoria.padreId} on ${categoria.id} does not resolve`,
      ).toBeDefined()
      expect(
        parent?.padreId,
        `${categoria.padreId} is itself a child — only one level of nesting is allowed`,
      ).toBeUndefined()
    }
  })

  it('gives every category an icono from the allowlist and a color', () => {
    for (const categoria of categorias) {
      expect(categoria.icono, `${categoria.id} has no icono`).toBeDefined()
      expect(CATEGORY_ICON_KEYS as readonly string[]).toContain(categoria.icono)
      expect(categoria.color, `${categoria.id} has no color`).toBeDefined()
    }
  })

  it('gives every child the same color as its parent', () => {
    for (const categoria of categorias) {
      if (categoria.padreId === undefined) continue
      const parent = byId.get(categoria.padreId)
      expect(categoria.color).toBe(parent?.color)
    }
  })

  it('has more than 9 top-level categories, so the picker paginates by default', () => {
    expect(topLevel.length).toBeGreaterThan(9)
  })

  it('gives every top-level category 3 to 5 children', () => {
    for (const parent of topLevel) {
      const children = categorias.filter((c) => c.padreId === parent.id)
      expect(
        children.length,
        `${parent.id} has ${children.length} children`,
      ).toBeGreaterThanOrEqual(3)
      expect(children.length).toBeLessThanOrEqual(5)
    }
  })

  it('reuses the five pre-existing ids instead of minting parallel ones', () => {
    const preexisting = [
      'cat_sueldo',
      'cat_ventas',
      'cat_impuestos',
      'cat_servicios',
      'cat_caja_menor',
    ]
    for (const id of preexisting) {
      expect(byId.has(id), `${id} was dropped from the seed catalog`).toBe(true)
    }
  })
})
