import { beforeEach, describe, expect, it, vi } from 'vitest'

const mUpsertCategoria = vi.fn().mockResolvedValue(true)
vi.mock('@/lib/dataStore', () => ({
  useDataStore: vi.fn(
    (selector: (state: { upsertCategoria: typeof mUpsertCategoria }) => unknown) =>
      selector({ upsertCategoria: mUpsertCategoria }),
  ),
}))

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Categoria } from '@/lib/schema'
import { CATEGORY_ICON_KEYS } from '@/lib/categoryIconKeys'
import { CategoryFormModal } from '@/features/tags/CategoryFormModal'

const ICON_GRID_PAGE_SIZE = 20
const iconGridPageCount = Math.ceil(CATEGORY_ICON_KEYS.length / ICON_GRID_PAGE_SIZE)

const categoria = (overrides: Partial<Categoria> = {}): Categoria => ({
  id: crypto.randomUUID(),
  nombre: 'Comida',
  icono: 'utensils',
  color: 'amber',
  ...overrides,
})

describe('CategoryFormModal', () => {
  beforeEach(() => {
    mUpsertCategoria.mockClear()
  })

  it('shows the create title with no categoria prop, and the edit title with one', () => {
    const { rerender } = render(<CategoryFormModal open onClose={vi.fn()} categorias={[]} />)
    expect(screen.getByRole('heading', { name: /nueva categoría/i })).toBeInTheDocument()

    rerender(<CategoryFormModal open onClose={vi.fn()} categorias={[]} categoria={categoria()} />)
    expect(screen.getByRole('heading', { name: /editar categoría/i })).toBeInTheDocument()
  })

  it('pre-fills the name from initialName when creating from a "create from query" flow', () => {
    render(<CategoryFormModal open onClose={vi.fn()} categorias={[]} initialName="Gimnasio" />)
    expect(screen.getByRole('textbox', { name: /nombre/i })).toHaveValue('Gimnasio')
  })

  it('pre-fills the name/icon/color from the category being edited', () => {
    render(
      <CategoryFormModal
        open
        onClose={vi.fn()}
        categorias={[]}
        categoria={categoria({ nombre: 'Comida' })}
      />,
    )
    expect(screen.getByRole('textbox', { name: /nombre/i })).toHaveValue('Comida')
  })

  it('suggests an icon/color from the pre-filled name via the multilingual concept table', () => {
    render(<CategoryFormModal open onClose={vi.fn()} categorias={[]} initialName="gym" />)
    expect(screen.getByRole('button', { name: /dumbbell/i, pressed: true })).toBeInTheDocument()
  })

  it('disables Save while the name is empty', async () => {
    const user = userEvent.setup()
    render(<CategoryFormModal open onClose={vi.fn()} categorias={[]} initialName="Gimnasio" />)
    const nameField = screen.getByRole('textbox', { name: /nombre/i })
    await user.clear(nameField)

    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled()
  })

  it('blocks a duplicate name inline (scoped to siblings), never as a toast', async () => {
    const user = userEvent.setup()
    const existing = categoria({ nombre: 'Comida' })
    render(<CategoryFormModal open onClose={vi.fn()} categorias={[existing]} />)

    await user.type(screen.getByRole('textbox', { name: /nombre/i }), 'comida')

    expect(screen.getByRole('alert')).toHaveTextContent(/ya existe una categoría/i)
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled()
  })

  it('does not block the same name among a different padreId (a different parent, or top-level)', async () => {
    const user = userEvent.setup()
    const existing = categoria({ nombre: 'Comida', padreId: 'cat_parent' })
    render(<CategoryFormModal open onClose={vi.fn()} categorias={[existing]} />)

    await user.type(screen.getByRole('textbox', { name: /nombre/i }), 'Comida')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /guardar/i })).toBeEnabled()
  })

  it('caps the name length on the value itself, not only the input maxlength', async () => {
    const user = userEvent.setup()
    render(<CategoryFormModal open onClose={vi.fn()} categorias={[]} />)
    const nameField = screen.getByRole('textbox', { name: /nombre/i })
    await user.type(nameField, 'x'.repeat(60))

    expect((nameField as HTMLInputElement).value.length).toBeLessThanOrEqual(30)
  })

  it('saves via dataStore.upsertCategoria with nombre/icono/color set, and closes', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<CategoryFormModal open onClose={onClose} categorias={[]} initialName="Gimnasio" />)

    await user.click(screen.getByRole('button', { name: /guardar/i }))

    expect(mUpsertCategoria).toHaveBeenCalledOnce()
    const saved = mUpsertCategoria.mock.calls[0]![0] as Categoria
    expect(saved.nombre).toBe('Gimnasio')
    expect(saved.padreId).toBeUndefined()
    expect(saved.icono).toBe('dumbbell')
    expect(saved.color).toBe('rose')
    expect(typeof saved.id).toBe('string')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not close when the write is refused or fails, so the user still sees the toast and can retry', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    mUpsertCategoria.mockResolvedValueOnce(false)
    render(<CategoryFormModal open onClose={onClose} categorias={[]} initialName="Gimnasio" />)

    await user.click(screen.getByRole('button', { name: /guardar/i }))

    expect(mUpsertCategoria).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('editing keeps the existing id and carries its padreId through', async () => {
    const user = userEvent.setup()
    const existing = categoria({ id: 'cat_x', nombre: 'Sueldo', padreId: 'cat_parent' })
    render(<CategoryFormModal open onClose={vi.fn()} categorias={[]} categoria={existing} />)

    await user.click(screen.getByRole('button', { name: /guardar/i }))

    const saved = mUpsertCategoria.mock.calls[0]![0] as Categoria
    expect(saved.id).toBe('cat_x')
    expect(saved.padreId).toBe('cat_parent')
  })

  it('changing the icon/color grid selection changes what gets saved', async () => {
    const user = userEvent.setup()
    render(
      <CategoryFormModal
        open
        onClose={vi.fn()}
        categorias={[]}
        initialName="Sin sugerencia posible zzz"
      />,
    )

    await user.click(screen.getByRole('button', { name: /^wrench$/i }))
    await user.click(screen.getByRole('button', { name: /^blue$|^azul$/i }))
    await user.click(screen.getByRole('button', { name: /guardar/i }))

    const saved = mUpsertCategoria.mock.calls[0]![0] as Categoria
    expect(saved.icono).toBe('wrench')
    expect(saved.color).toBe('blue')
  })

  it('opens with the panel focused, never the name input, so no keyboard rises on open', () => {
    render(<CategoryFormModal open onClose={vi.fn()} categorias={[]} />)
    expect(screen.getByRole('textbox', { name: /nombre/i })).not.toHaveFocus()
    expect(screen.getByRole('dialog')).toHaveFocus()
  })

  it('shows the parent line only when padreId is set, with the parent icon and name', () => {
    const parent = categoria({ id: 'cat_parent', nombre: 'Ocio', icono: 'gamepad', color: 'rose' })
    const { rerender } = render(<CategoryFormModal open onClose={vi.fn()} categorias={[parent]} />)
    expect(screen.queryByText('Ocio')).not.toBeInTheDocument()

    rerender(
      <CategoryFormModal open onClose={vi.fn()} categorias={[parent]} padreId="cat_parent" />,
    )
    expect(screen.getByText('Ocio')).toBeInTheDocument()
  })

  it('creating with padreId saves that padreId and defaults the color to the parent color, even when the typed name would otherwise suggest a different one', async () => {
    const user = userEvent.setup()
    const parent = categoria({ id: 'cat_parent', nombre: 'Ocio', icono: 'gamepad', color: 'blue' })
    render(
      <CategoryFormModal
        open
        onClose={vi.fn()}
        categorias={[parent]}
        padreId="cat_parent"
        initialName="Cine"
      />,
    )

    expect(screen.getByRole('button', { name: /^film$/i, pressed: true })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /guardar/i }))

    const saved = mUpsertCategoria.mock.calls[0]![0] as Categoria
    expect(saved.padreId).toBe('cat_parent')
    expect(saved.color).toBe('blue')
  })

  it('lets the user override the parent-defaulted color', async () => {
    const user = userEvent.setup()
    const parent = categoria({ id: 'cat_parent', nombre: 'Ocio', icono: 'gamepad', color: 'rose' })
    render(
      <CategoryFormModal
        open
        onClose={vi.fn()}
        categorias={[parent]}
        padreId="cat_parent"
        initialName="Cine"
      />,
    )

    await user.click(screen.getByRole('button', { name: /^blue$|^azul$/i }))
    await user.click(screen.getByRole('button', { name: /guardar/i }))

    const saved = mUpsertCategoria.mock.calls[0]![0] as Categoria
    expect(saved.color).toBe('blue')
  })

  it('editing an existing category never sets padreId from the prop', async () => {
    const user = userEvent.setup()
    const parent = categoria({ id: 'cat_parent', nombre: 'Ocio' })
    const existing = categoria({ id: 'cat_child', nombre: 'Cine', padreId: undefined })
    render(
      <CategoryFormModal
        open
        onClose={vi.fn()}
        categorias={[parent]}
        categoria={existing}
        padreId="cat_parent"
      />,
    )

    await user.click(screen.getByRole('button', { name: /guardar/i }))

    const saved = mUpsertCategoria.mock.calls[0]![0] as Categoria
    expect(saved.padreId).toBeUndefined()
  })

  it('resets the icon grid to page 0 when typing changes the ranking', async () => {
    const user = userEvent.setup()
    render(<CategoryFormModal open onClose={vi.fn()} categorias={[]} />)
    expect(iconGridPageCount).toBeGreaterThan(1)

    await user.click(screen.getByRole('button', { name: `Page 2 of ${iconGridPageCount}` }))
    expect(screen.getByRole('button', { name: `Page 2 of ${iconGridPageCount}` })).toHaveAttribute(
      'aria-current',
      'true',
    )

    await user.type(screen.getByRole('textbox', { name: /nombre/i }), 'gimnasio')

    expect(screen.getByRole('button', { name: `Page 1 of ${iconGridPageCount}` })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(
      screen.getByRole('button', { name: `Page 2 of ${iconGridPageCount}` }),
    ).not.toHaveAttribute('aria-current')
  })

  it('keeps the picked icon selected across further typing, wherever it lands in the reordered grid', async () => {
    const user = userEvent.setup()
    render(<CategoryFormModal open onClose={vi.fn()} categorias={[]} />)

    await user.click(screen.getByRole('button', { name: /^briefcase$/i }))
    expect(screen.getByRole('button', { name: /^briefcase$/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.type(screen.getByRole('textbox', { name: /nombre/i }), 'gimnasio')

    expect(screen.getByRole('button', { name: /^briefcase$/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /^dumbbell$/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})
