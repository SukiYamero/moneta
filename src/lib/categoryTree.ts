import type { Categoria } from '@/lib/schema'

type TreeNode = Pick<Categoria, 'id' | 'padreId'>

export const isTopLevelCategoria = (categoria: TreeNode, liveIds: ReadonlySet<string>): boolean =>
  categoria.padreId === undefined || !liveIds.has(categoria.padreId)

export interface CategoriaTree<T extends TreeNode> {
  topLevel: T[]
  childrenByParent: Map<string, T[]>
}

export const groupCategoriasByParent = <T extends TreeNode>(
  categorias: readonly T[],
): CategoriaTree<T> => {
  const liveIds = new Set(categorias.map((c) => c.id))
  const topLevel: T[] = []
  const childrenByParent = new Map<string, T[]>()

  for (const categoria of categorias) {
    if (isTopLevelCategoria(categoria, liveIds)) {
      topLevel.push(categoria)
      continue
    }
    const parentId = categoria.padreId!
    const siblings = childrenByParent.get(parentId) ?? []
    siblings.push(categoria)
    childrenByParent.set(parentId, siblings)
  }

  return { topLevel, childrenByParent }
}
