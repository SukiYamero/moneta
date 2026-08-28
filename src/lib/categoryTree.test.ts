import { describe, expect, it } from 'vitest'
import { groupCategoriasByParent, isTopLevelCategoria } from '@/lib/categoryTree'

interface Node {
  id: string
  padreId?: string
}

describe('isTopLevelCategoria', () => {
  it('treats a category with no padreId as top-level', () => {
    expect(isTopLevelCategoria({ id: 'a' }, new Set(['a']))).toBe(true)
  })

  it('treats a category whose padreId is not among the live ids as top-level (orphan)', () => {
    expect(isTopLevelCategoria({ id: 'a', padreId: 'missing' }, new Set(['a']))).toBe(true)
  })

  it('treats a category whose padreId is live as not top-level', () => {
    expect(isTopLevelCategoria({ id: 'b', padreId: 'a' }, new Set(['a', 'b']))).toBe(false)
  })
})

describe('groupCategoriasByParent', () => {
  it('groups direct children under their top-level parent', () => {
    const nodes: Node[] = [{ id: 'a' }, { id: 'b', padreId: 'a' }, { id: 'c', padreId: 'a' }]
    const { topLevel, childrenByParent } = groupCategoriasByParent(nodes)
    expect(topLevel.map((n) => n.id)).toEqual(['a'])
    expect(childrenByParent.get('a')?.map((n) => n.id)).toEqual(['b', 'c'])
  })

  it('promotes an orphan (padreId pointing at a missing/archived category) to top level', () => {
    const nodes: Node[] = [{ id: 'a' }, { id: 'b', padreId: 'gone' }]
    const { topLevel } = groupCategoriasByParent(nodes)
    expect(topLevel.map((n) => n.id)).toEqual(['a', 'b'])
  })

  it('keeps a grandchild nested under its real parent instead of promoting it to top level', () => {
    const nodes: Node[] = [
      { id: 'grandparent' },
      { id: 'parent', padreId: 'grandparent' },
      { id: 'child', padreId: 'parent' },
    ]
    const { topLevel, childrenByParent } = groupCategoriasByParent(nodes)

    expect(topLevel.map((n) => n.id)).toEqual(['grandparent'])
    expect(childrenByParent.get('grandparent')?.map((n) => n.id)).toEqual(['parent'])
    expect(childrenByParent.get('parent')?.map((n) => n.id)).toEqual(['child'])
  })
})
