import type { Categoria, TipoMovimiento } from '@/lib/schema'

/**
 * Non-archived categories, matching `tipo` first — a stable partition
 * (`Array#filter` preserves relative order), never a resort that could
 * reshuffle categories sharing a type. `Categoria.tipo` is a default, not a
 * constraint (specs.md §10.22 Decision 3): nothing is hidden, a category
 * legitimately used both ways stays reachable.
 *
 * Shared by `CategoryPicker`'s inline carousel and `TagPickerSheet`'s full
 * grid — both must agree on the same ordering rule rather than each
 * re-deriving it.
 */
export const orderForPicker = (categorias: Categoria[], tipo: TipoMovimiento): Categoria[] => {
  const active = categorias.filter((c) => !c.archivado)
  const matching = active.filter((c) => c.tipo === tipo)
  const rest = active.filter((c) => c.tipo !== tipo)
  return [...matching, ...rest]
}
