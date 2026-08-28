import type { Categoria } from '@/lib/schema'

export const orderForPicker = (categorias: Categoria[]): Categoria[] => {
  return categorias.filter((c) => !c.archivado)
}
