import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Categoria } from '@/lib/schema'
import { CategoryPicker } from '@/features/tags/CategoryPicker'

const categoria = (overrides: Partial<Categoria> = {}): Categoria => ({
  id: crypto.randomUUID(),
  nombre: 'Comida',
  seccionId: 'sec_personal',
  tipo: 'gasto',
  icono: 'utensils',
  color: 'amber',
  ...overrides,
})

describe('CategoryPicker', () => {
  it('renders every non-archived category as a selectable chip', () => {
    const categorias = [
      categoria({ id: 'a', nombre: 'Comida' }),
      categoria({ id: 'b', nombre: 'Transporte' }),
    ]
    render(
      <CategoryPicker
        categorias={categorias}
        tipo="gasto"
        onSelect={vi.fn()}
        onCreateRequested={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Comida' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Transporte' })).toBeInTheDocument()
  })

  it('excludes archived categories from the picker', () => {
    const categorias = [
      categoria({ id: 'a', nombre: 'Comida' }),
      categoria({ id: 'b', nombre: 'Viejo', archivado: true }),
    ]
    render(
      <CategoryPicker
        categorias={categorias}
        tipo="gasto"
        onSelect={vi.fn()}
        onCreateRequested={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Viejo' })).not.toBeInTheDocument()
  })

  it("orders categories matching the sheet's tipo first, without hiding the others", () => {
    const categorias = [
      categoria({ id: 'a', nombre: 'Sueldo', tipo: 'ingreso' }),
      categoria({ id: 'b', nombre: 'Comida', tipo: 'gasto' }),
    ]
    render(
      <CategoryPicker
        categorias={categorias}
        tipo="gasto"
        onSelect={vi.fn()}
        onCreateRequested={vi.fn()}
      />,
    )

    const buttons = screen.getAllByRole('button').map((b) => b.textContent)
    expect(buttons.indexOf('Comida')).toBeLessThan(buttons.indexOf('Sueldo'))
  })

  it('search filters by name, accent- and case-insensitively', async () => {
    const user = userEvent.setup()
    const categorias = [
      categoria({ id: 'a', nombre: 'Café' }),
      categoria({ id: 'b', nombre: 'Transporte' }),
    ]
    render(
      <CategoryPicker
        categorias={categorias}
        tipo="gasto"
        onSelect={vi.fn()}
        onCreateRequested={vi.fn()}
      />,
    )

    await user.type(screen.getByRole('textbox'), 'CAFE')

    expect(screen.getByRole('button', { name: 'Café' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Transporte' })).not.toBeInTheDocument()
  })

  it('shows a "create" chip only when the query matches nothing, and calls onCreateRequested with the trimmed query', async () => {
    const user = userEvent.setup()
    const onCreateRequested = vi.fn()
    render(
      <CategoryPicker
        categorias={[categoria({ nombre: 'Comida' })]}
        tipo="gasto"
        onSelect={vi.fn()}
        onCreateRequested={onCreateRequested}
      />,
    )

    expect(screen.queryByText(/crear/i)).not.toBeInTheDocument()

    await user.type(screen.getByRole('textbox'), '  Gimnasio  ')

    const createChip = screen.getByRole('button', { name: /gimnasio/i })
    await user.click(createChip)

    expect(onCreateRequested).toHaveBeenCalledWith('Gimnasio')
  })

  it('does not show a "create" chip when the query matches an existing category', async () => {
    const user = userEvent.setup()
    render(
      <CategoryPicker
        categorias={[categoria({ nombre: 'Comida' })]}
        tipo="gasto"
        onSelect={vi.fn()}
        onCreateRequested={vi.fn()}
      />,
    )

    await user.type(screen.getByRole('textbox'), 'comi')

    expect(screen.queryByText(/crear/i)).not.toBeInTheDocument()
  })

  it('calls onSelect with the tapped category, single-select', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const target = categoria({ id: 'cat_x', nombre: 'Comida' })
    render(
      <CategoryPicker
        categorias={[target]}
        tipo="gasto"
        onSelect={onSelect}
        onCreateRequested={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Comida' }))

    expect(onSelect).toHaveBeenCalledWith(target)
  })

  it('marks the currently selected category as pressed', () => {
    const target = categoria({ id: 'cat_x', nombre: 'Comida' })
    render(
      <CategoryPicker
        categorias={[target]}
        tipo="gasto"
        selectedId="cat_x"
        onSelect={vi.fn()}
        onCreateRequested={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Comida' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('has no horizontally-scrolling container (wraps instead)', () => {
    const { container } = render(
      <CategoryPicker
        categorias={[categoria()]}
        tipo="gasto"
        onSelect={vi.fn()}
        onCreateRequested={vi.fn()}
      />,
    )

    expect(container.querySelector('.overflow-x-auto')).not.toBeInTheDocument()
    expect(
      within(container).getByRole('button', { name: 'Comida' }).closest('.flex-wrap'),
    ).toBeTruthy()
  })
})
