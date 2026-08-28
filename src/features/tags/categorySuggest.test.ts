import { describe, expect, it } from 'vitest'
import type { Categoria } from '@/lib/schema'
import { CATEGORY_ICON_KEYS } from '@/lib/categoryIconKeys'
import { ICON_AVATAR_TINTS } from '@/components/shared/tintClasses'
import {
  CATEGORY_CONCEPTS,
  leastUsedTint,
  suggestCategoryVisual,
} from '@/features/tags/categorySuggest'

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
    const result = suggestCategoryVisual('regalote', [])
    expect(result.icono).not.toBe('gift')
  })

  it('falls back to the least-used tint and no icono when nothing matches', () => {
    const result = suggestCategoryVisual('Etiqueta completamente inventada', [])
    expect(result.icono).toBeUndefined()
    expect(result.color).toBeDefined()
  })

  it('a matched concept keeps its own tint even when a category already uses it, ignoring least-used-tint diversion', () => {
    const existing: Pick<Categoria, 'color'>[] = [{ color: 'amber' }, { color: 'amber' }]
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

describe('CATEGORY_CONCEPTS', () => {
  it('every icon key is reachable through at least one keyword concept', () => {
    const covered = new Set(CATEGORY_CONCEPTS.map((c) => c.icon))
    expect(CATEGORY_ICON_KEYS.filter((k) => !covered.has(k))).toEqual([])
  })

  it('every concept icon is a member of CATEGORY_ICON_KEYS', () => {
    const invalid = CATEGORY_CONCEPTS.filter(
      (c) => !(CATEGORY_ICON_KEYS as readonly string[]).includes(c.icon),
    )
    expect(invalid).toEqual([])
  })

  it('every concept tint is a member of ICON_AVATAR_TINTS', () => {
    const invalid = CATEGORY_CONCEPTS.filter(
      (c) => !(ICON_AVATAR_TINTS as readonly string[]).includes(c.tint),
    )
    expect(invalid).toEqual([])
  })
})

describe('suggestCategoryVisual resolves new keywords in Spanish and English', () => {
  it.each([
    ['prestamo', 'hand-coins'],
    ['loan', 'hand-coins'],
    ['comision', 'percent'],
    ['fees', 'percent'],
    ['contador', 'calculator'],
    ['accounting', 'calculator'],
    ['donacion', 'handshake'],
    ['charity', 'handshake'],
    ['seguro', 'shield'],
    ['insurance', 'shield'],
    ['expensas', 'building-2'],
    ['hoa', 'building-2'],
    ['lavanderia', 'washing-machine'],
    ['laundry', 'washing-machine'],
    ['limpieza', 'spray-can'],
    ['cleaning', 'spray-can'],
    ['herramientas', 'hammer'],
    ['tools', 'hammer'],
    ['muebles', 'sofa'],
    ['furniture', 'sofa'],
    ['domicilio', 'truck'],
    ['delivery', 'truck'],
    ['paquete', 'package'],
    ['shipping', 'package'],
    ['estacionamiento', 'parking'],
    ['parking', 'parking'],
    ['tren', 'train'],
    ['train', 'train'],
    ['hotel', 'hotel'],
    ['lodging', 'hotel'],
    ['equipaje', 'luggage'],
    ['luggage', 'luggage'],
    ['television', 'tv'],
    ['electronics', 'tv'],
    ['camisa', 'shirt'],
    ['pantalon', 'shirt'],
    ['joyeria', 'gem'],
    ['jewelry', 'gem'],
    ['chequeo', 'stethoscope'],
    ['checkup', 'stethoscope'],
    ['lentes', 'glasses'],
    ['glasses', 'glasses'],
    ['urgencia', 'bandage'],
    ['emergency', 'bandage'],
    ['colegio', 'school'],
    ['school', 'school'],
    ['pelicula', 'film'],
    ['movie', 'film'],
    ['suscripcion', 'ticket'],
    ['subscription', 'ticket'],
    ['deporte', 'trophy'],
    ['sport', 'trophy'],
    ['manualidades', 'palette'],
    ['hobby', 'palette'],
    ['pizza', 'pizza'],
    ['cerveza', 'beer'],
    ['drinks', 'beer'],
    ['panaderia', 'cake'],
    ['bakery', 'cake'],
    ['chef', 'chef-hat'],
    ['catering', 'chef-hat'],
    ['frutas', 'apple'],
    ['feria', 'apple'],
    ['oficina', 'briefcase-business'],
    ['office', 'briefcase-business'],
    ['tramite', 'file-text'],
    ['legal', 'file-text'],
    ['jardineria', 'flower-2'],
    ['gardening', 'flower-2'],
    ['varios', 'sparkles'],
    ['misc', 'sparkles'],
  ] as const)('resolves "%s" to the "%s" icon', (word, expectedIcon) => {
    expect(suggestCategoryVisual(word, []).icono).toBe(expectedIcon)
  })
})
