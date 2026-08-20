import { describe, expect, it } from 'vitest'
import type { Categoria } from '@/lib/schema'
import { leastUsedTint, suggestCategoryVisual } from '@/features/tags/categorySuggest'

describe('suggestCategoryVisual', () => {
  it('resolves "gimnasio", "gym" and "academia" to the same icon/color, with no locale awareness needed', () => {
    const a = suggestCategoryVisual('Gimnasio', [])
    const b = suggestCategoryVisual('gym', [])
    const c = suggestCategoryVisual('academia', [])
    expect(a).toEqual({ icono: 'dumbbell', color: 'rose' })
    expect(b).toEqual(a)
    expect(c).toEqual(a)
  })

  it('is accent- and case-insensitive (reuses searchMatch.normalizeForSearch)', () => {
    expect(suggestCategoryVisual('CAFÉ', [])).toEqual({ icono: 'coffee', color: 'amber' })
    expect(suggestCategoryVisual('cafe', [])).toEqual({ icono: 'coffee', color: 'amber' })
  })

  it('matches on a whole word inside a longer typed phrase', () => {
    expect(suggestCategoryVisual('Pago de gimnasio mensual', [])).toEqual({
      icono: 'dumbbell',
      color: 'rose',
    })
  })

  it('does not match a keyword as a bare substring of an unrelated word', () => {
    // "regalo" must not match inside "regalote" or similar — whole-word only.
    const result = suggestCategoryVisual('regalote', [])
    expect(result.icono).not.toBe('gift')
  })

  it('falls back to the least-used tint and no icono when nothing matches', () => {
    const result = suggestCategoryVisual('Etiqueta completamente inventada', [])
    expect(result.icono).toBeUndefined()
    expect(result.color).toBeDefined()
  })

  it('a matched concept keeps its own semantic color even when a category already uses it (specs.md §10.22 Decision 7)', () => {
    const existing: Pick<Categoria, 'color'>[] = [{ color: 'amber' }, { color: 'amber' }]
    // "comida" is amber — must stay amber, not divert to a less-used tint.
    expect(suggestCategoryVisual('comida', existing).color).toBe('amber')
  })
})

describe('leastUsedTint', () => {
  it('picks a tint with zero uses when the user has no categories yet', () => {
    expect(leastUsedTint([])).toBeDefined()
  })

  it('picks the tint used the fewest times among the current categories', () => {
    const categorias: Pick<Categoria, 'color'>[] = [
      { color: 'emerald' },
      { color: 'emerald' },
      { color: 'blue' },
    ]
    const result = leastUsedTint(categorias)
    expect(result).not.toBe('emerald')
    expect(result).not.toBe('blue')
  })

  it('is deterministic for the same input', () => {
    const categorias: Pick<Categoria, 'color'>[] = [{ color: 'emerald' }]
    expect(leastUsedTint(categorias)).toBe(leastUsedTint(categorias))
  })

  it('ignores categories with no color set', () => {
    const categorias: Pick<Categoria, 'color'>[] = [{ color: undefined }, { color: undefined }]
    expect(leastUsedTint(categorias)).toBeDefined()
  })
})
