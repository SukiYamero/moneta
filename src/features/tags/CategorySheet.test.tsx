import { describe, expect, it, vi } from 'vitest'

const mUpsertCategoria = vi.fn().mockResolvedValue(true)
vi.mock('@/lib/dataStore', () => ({
  useDataStore: vi.fn(
    (selector: (state: { upsertCategoria: typeof mUpsertCategoria }) => unknown) =>
      selector({ upsertCategoria: mUpsertCategoria }),
  ),
}))

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Categoria } from '@/lib/schema'
import { CategorySheet } from '@/features/tags/CategorySheet'

const categoria = (overrides: Partial<Categoria> = {}): Categoria => ({
  id: crypto.randomUUID(),
  nombre: 'Comida',
  icono: 'utensils',
  color: 'amber',
  ...overrides,
})

const manyTopLevel = (count: number): Categoria[] =>
  Array.from({ length: count }, (_, i) =>
    categoria({ id: `cat_${i}`, nombre: `Categoría ${String(i).padStart(2, '0')}` }),
  )

const getDialog = () => screen.getByRole('dialog')

describe('CategorySheet', () => {
  it('renders nothing while closed', () => {
    render(<CategorySheet open={false} onClose={vi.fn()} categorias={[]} onSelect={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('leaves the search input unfocused when it opens', () => {
    render(<CategorySheet open onClose={vi.fn()} categorias={[categoria()]} onSelect={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: /buscar categoría/i })).not.toHaveFocus()
  })

  it('renders Custom plus 8 categories on page 0, with dots for 2 pages, given 12 top-level categories', () => {
    render(
      <CategorySheet open onClose={vi.fn()} categorias={manyTopLevel(12)} onSelect={vi.fn()} />,
    )

    const grid = within(getDialog()).getByRole('group', { name: /categorías/i })
    const tiles = within(grid).getAllByRole('button')
    expect(tiles).toHaveLength(9)
    expect(within(grid).getByRole('button', { name: /custom/i })).toBeInTheDocument()

    expect(within(getDialog()).getByRole('button', { name: 'Page 1 of 2' })).toBeInTheDocument()
    expect(within(getDialog()).getByRole('button', { name: 'Page 2 of 2' })).toBeInTheDocument()
  })

  it('drilling into a parent with children shows the parent as the first tile of level 2, and back returns to level 1 on the page it came from', async () => {
    const user = userEvent.setup()
    const parent = categoria({ id: 'cat_parent', nombre: 'Transporte' })
    const child = categoria({ id: 'cat_child', nombre: 'Gasolina', padreId: 'cat_parent' })
    render(<CategorySheet open onClose={vi.fn()} categorias={[parent, child]} onSelect={vi.fn()} />)

    await user.click(within(getDialog()).getByRole('button', { name: 'Transporte' }))

    expect(screen.getByRole('heading', { level: 2, name: 'Transporte' })).toBeInTheDocument()
    const level2Grid = within(getDialog()).getByRole('group', { name: /categorías/i })
    const level2Tiles = within(level2Grid).getAllByRole('button')
    expect(level2Tiles[0]).toHaveTextContent('Transporte')
    expect(level2Tiles[1]).toHaveTextContent(/custom/i)
    expect(within(level2Grid).getByRole('button', { name: 'Gasolina' })).toBeInTheDocument()

    await user.click(within(getDialog()).getByRole('button', { name: /volver/i }))

    expect(screen.getByRole('heading', { level: 2, name: 'Categoría' })).toBeInTheDocument()
  })

  it('drilling in from page 1 returns to page 1 on back, not page 0', async () => {
    const user = userEvent.setup()
    const topLevel = manyTopLevel(12).map((c, i) => (i === 8 ? { ...c, nombre: 'Transporte' } : c))
    const child = categoria({ id: 'cat_child', nombre: 'Gasolina', padreId: 'cat_8' })
    render(
      <CategorySheet open onClose={vi.fn()} categorias={[...topLevel, child]} onSelect={vi.fn()} />,
    )

    await user.click(within(getDialog()).getByRole('button', { name: 'Page 2 of 2' }))
    await user.click(within(getDialog()).getByRole('button', { name: 'Transporte' }))
    await user.click(within(getDialog()).getByRole('button', { name: /volver/i }))

    expect(within(getDialog()).getByRole('button', { name: 'Page 2 of 2' })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(within(getDialog()).getByRole('button', { name: 'Transporte' })).toBeInTheDocument()
  })

  it('tapping a parent with no children selects it directly and closes the sheet', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onClose = vi.fn()
    const leaf = categoria({ id: 'cat_leaf', nombre: 'Comida' })
    render(<CategorySheet open onClose={onClose} categorias={[leaf]} onSelect={onSelect} />)

    await user.click(within(getDialog()).getByRole('button', { name: 'Comida' }))

    expect(onSelect).toHaveBeenCalledWith(leaf)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('tapping the general tile at level 2 selects the parent itself', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const parent = categoria({ id: 'cat_parent', nombre: 'Transporte' })
    const child = categoria({ id: 'cat_child', nombre: 'Gasolina', padreId: 'cat_parent' })
    render(
      <CategorySheet open onClose={vi.fn()} categorias={[parent, child]} onSelect={onSelect} />,
    )

    await user.click(within(getDialog()).getByRole('button', { name: 'Transporte' }))
    const level2Grid = within(getDialog()).getByRole('group', { name: /categorías/i })
    const [generalTile] = within(level2Grid).getAllByRole('button')
    await user.click(generalTile!)

    expect(onSelect).toHaveBeenCalledWith(parent)
  })

  it("finds a child's name from level 1 through search, and selecting it closes the sheet", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onClose = vi.fn()
    const parent = categoria({ id: 'cat_parent', nombre: 'Transporte' })
    const child = categoria({ id: 'cat_child', nombre: 'Gasolina', padreId: 'cat_parent' })
    render(
      <CategorySheet open onClose={onClose} categorias={[parent, child]} onSelect={onSelect} />,
    )

    await user.type(screen.getByRole('textbox', { name: /buscar categoría/i }), 'gasol')

    const result = within(getDialog()).getByRole('button', { name: 'Gasolina' })
    await user.click(result)

    expect(onSelect).toHaveBeenCalledWith(child)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('resets to page 0 when typing while on page 1', async () => {
    const user = userEvent.setup()
    render(
      <CategorySheet open onClose={vi.fn()} categorias={manyTopLevel(12)} onSelect={vi.fn()} />,
    )

    await user.click(within(getDialog()).getByRole('button', { name: 'Page 2 of 2' }))
    expect(within(getDialog()).getByRole('button', { name: 'Categoría 08' })).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: /buscar categoría/i }), 'Categoría 00')

    expect(within(getDialog()).getByRole('button', { name: 'Categoría 00' })).toBeInTheDocument()
  })

  it('clearing the query returns to level 1', async () => {
    const user = userEvent.setup()
    const parent = categoria({ id: 'cat_parent', nombre: 'Transporte' })
    const child = categoria({ id: 'cat_child', nombre: 'Gasolina', padreId: 'cat_parent' })
    render(<CategorySheet open onClose={vi.fn()} categorias={[parent, child]} onSelect={vi.fn()} />)

    const search = screen.getByRole('textbox', { name: /buscar categoría/i })
    await user.type(search, 'gasol')
    await user.clear(search)

    expect(screen.getByRole('heading', { level: 2, name: 'Categoría' })).toBeInTheDocument()
    expect(within(getDialog()).getByRole('button', { name: 'Transporte' })).toBeInTheDocument()
  })

  it('shows a category as top-level when its parent is archived', () => {
    const archivedParent = categoria({ id: 'cat_parent', nombre: 'Viejo', archivado: true })
    const orphan = categoria({ id: 'cat_orphan', nombre: 'Huérfana', padreId: 'cat_parent' })
    render(
      <CategorySheet
        open
        onClose={vi.fn()}
        categorias={[archivedParent, orphan]}
        onSelect={vi.fn()}
      />,
    )

    expect(within(getDialog()).getByRole('button', { name: 'Huérfana' })).toBeInTheDocument()
  })

  it('never shows an archived category, at level 1, level 2 or in search', async () => {
    const user = userEvent.setup()
    const parent = categoria({ id: 'cat_parent', nombre: 'Transporte' })
    const liveChild = categoria({ id: 'cat_child', nombre: 'Gasolina', padreId: 'cat_parent' })
    const archivedChild = categoria({
      id: 'cat_archived_child',
      nombre: 'Viejo',
      padreId: 'cat_parent',
      archivado: true,
    })
    render(
      <CategorySheet
        open
        onClose={vi.fn()}
        categorias={[parent, liveChild, archivedChild]}
        onSelect={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Viejo' })).not.toBeInTheDocument()

    await user.click(within(getDialog()).getByRole('button', { name: 'Transporte' }))
    expect(screen.queryByRole('button', { name: 'Viejo' })).not.toBeInTheDocument()

    await user.click(within(getDialog()).getByRole('button', { name: /volver/i }))
    await user.type(screen.getByRole('textbox', { name: /buscar categoría/i }), 'viejo')
    expect(screen.queryByRole('button', { name: 'Viejo' })).not.toBeInTheDocument()
  })

  it('marks the currently selected category wherever it appears', () => {
    const target = categoria({ id: 'cat_x', nombre: 'Comida' })
    render(
      <CategorySheet
        open
        onClose={vi.fn()}
        categorias={[target]}
        selectedId="cat_x"
        onSelect={vi.fn()}
      />,
    )

    expect(within(getDialog()).getByRole('button', { name: 'Comida' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('the close button dismisses without changing the selection', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onSelect = vi.fn()
    render(<CategorySheet open onClose={onClose} categorias={[categoria()]} onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: /cerrar/i }))

    expect(onClose).toHaveBeenCalledOnce()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('zero search results shows a "create «query»" affordance opening the create modal pre-filled with the query', async () => {
    const user = userEvent.setup()
    render(<CategorySheet open onClose={vi.fn()} categorias={[categoria()]} onSelect={vi.fn()} />)

    await user.type(screen.getByRole('textbox', { name: /buscar categoría/i }), 'Gimnasio')

    await user.click(screen.getByRole('button', { name: /crear.*gimnasio/i }))

    expect(screen.getByRole('textbox', { name: /nombre/i })).toHaveValue('Gimnasio')
  })

  it('the Custom tile opens the create modal pre-filled with the current query', async () => {
    const user = userEvent.setup()
    render(<CategorySheet open onClose={vi.fn()} categorias={[categoria()]} onSelect={vi.fn()} />)

    const grid = within(getDialog()).getByRole('group', { name: /categorías/i })
    await user.click(within(grid).getByRole('button', { name: /custom/i }))

    expect(screen.getByRole('heading', { name: /nueva categoría/i })).toBeInTheDocument()
  })

  it("creating from the Custom tile at level 2 passes that parent's id to the modal", async () => {
    const user = userEvent.setup()
    const parent = categoria({ id: 'cat_parent', nombre: 'Transporte' })
    const child = categoria({ id: 'cat_child', nombre: 'Gasolina', padreId: 'cat_parent' })
    render(<CategorySheet open onClose={vi.fn()} categorias={[parent, child]} onSelect={vi.fn()} />)

    await user.click(within(getDialog()).getByRole('button', { name: 'Transporte' }))
    const level2Grid = within(getDialog()).getByRole('group', { name: /categorías/i })
    await user.click(within(level2Grid).getByRole('button', { name: /custom/i }))

    const createDialog = screen.getByRole('dialog', { name: 'Nueva categoría' })
    expect(within(createDialog).getByText('Transporte')).toBeInTheDocument()
  })

  it('creating a category from the sheet selects it and closes the sheet', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(<CategorySheet open onClose={onClose} categorias={[categoria()]} onSelect={onSelect} />)

    const grid = within(getDialog()).getByRole('group', { name: /categorías/i })
    await user.click(within(grid).getByRole('button', { name: /custom/i }))

    const createDialog = screen.getByRole('dialog', { name: 'Nueva categoría' })
    await user.type(within(createDialog).getByRole('textbox', { name: /nombre/i }), 'Gimnasio')
    await user.click(within(createDialog).getByRole('button', { name: /guardar/i }))

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Gimnasio' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
