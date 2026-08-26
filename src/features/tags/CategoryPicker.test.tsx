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

// The inline picker is a fixed column (count button + dashed "Custom" chip)
// beside a horizontally-scrolling carousel — no inline search box, that
// lives in `TagPickerSheet` (its own test file).
describe('CategoryPicker', () => {
  it('renders every non-archived category as a selectable chip in the carousel', () => {
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

  it('excludes archived categories from the carousel and the count', () => {
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
    expect(screen.getByRole('button', { name: /1/ })).toBeInTheDocument()
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

  it('the carousel scrolls horizontally rather than wrapping', () => {
    const { container } = render(
      <CategoryPicker
        categorias={[categoria()]}
        tipo="gasto"
        onSelect={vi.fn()}
        onCreateRequested={vi.fn()}
      />,
    )

    const scroller = container.querySelector('.overflow-x-auto')
    expect(scroller).toBeTruthy()
    expect(within(scroller as HTMLElement).getByRole('button', { name: 'Comida' })).toBeTruthy()
  })

  it('the dashed "Custom" chip calls onCreateRequested with an empty query, without opening the full picker', async () => {
    const user = userEvent.setup()
    const onCreateRequested = vi.fn()
    render(
      <CategoryPicker
        categorias={[categoria()]}
        tipo="gasto"
        onSelect={vi.fn()}
        onCreateRequested={onCreateRequested}
      />,
    )

    await user.click(screen.getByRole('button', { name: /nueva/i }))

    expect(onCreateRequested).toHaveBeenCalledWith('')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('the count button opens the full TagPickerSheet, showing every category and a search box', async () => {
    const user = userEvent.setup()
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

    await user.click(screen.getByRole('button', { name: /ver todas/i }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    // Two "Transporte" buttons now on screen — the carousel's own chip
    // (behind the picker) and the picker's grid row.
    expect(screen.getAllByRole('button', { name: /transporte/i }).length).toBeGreaterThan(0)
  })

  it('selecting a category from the full picker calls onSelect and closes the picker', async () => {
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

    await user.click(screen.getByRole('button', { name: /ver todas/i }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Comida' }))

    expect(onSelect).toHaveBeenCalledWith(target)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('typing a query with no match in the full picker offers "crear «query»", which calls onCreateRequested and closes the picker', async () => {
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

    await user.click(screen.getByRole('button', { name: /ver todas/i }))
    await user.type(screen.getByRole('textbox'), '  Gimnasio  ')

    const createChip = screen.getByRole('button', { name: /gimnasio/i })
    await user.click(createChip)

    expect(onCreateRequested).toHaveBeenCalledWith('Gimnasio')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
