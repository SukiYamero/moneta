import type { Categoria, TipoMovimiento } from '@/lib/schema'

// `Array#filter` preserves relative order — a stable partition, never a resort.
export const orderForPicker = (categorias: Categoria[], tipo: TipoMovimiento): Categoria[] => {
  const active = categorias.filter((c) => !c.archivado)
  const matching = active.filter((c) => c.tipo === tipo)
  const rest = active.filter((c) => c.tipo !== tipo)
  return [...matching, ...rest]
}
