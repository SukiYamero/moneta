import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Categoria } from '@/lib/schema'
import { TagPickerSheet } from '@/features/tags/TagPickerSheet'

const categoria = (overrides: Partial<Categoria> = {}): Categoria => ({
  id: crypto.randomUUID(),
  nombre: 'Comida',
  icono: 'utensils',
  color: 'amber',
  ...overrides,
})

describe('TagPickerSheet', () => {
  it('renders nothing while closed', () => {
    render(
      <TagPickerSheet
        open={false}
        onClose={vi.fn()}
        categorias={[categoria()]}
        onSelect={vi.fn()}
        onCreateRequested={vi.fn()}
      />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows every non-archived category, excluding archived ones', () => {
    const categorias = [
      categoria({ id: 'a', nombre: 'Comida' }),
      categoria({ id: 'b', nombre: 'Viejo', archivado: true }),
    ]
    render(
      <TagPickerSheet
        open
        onClose={vi.fn()}
        categorias={categorias}
        onSelect={vi.fn()}
        onCreateRequested={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Comida' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Viejo' })).not.toBeInTheDocument()
  })

  it('search filters by name, accent- and case-insensitively', async () => {
    const user = userEvent.setup()
    const categorias = [
      categoria({ id: 'a', nombre: 'Café' }),
      categoria({ id: 'b', nombre: 'Transporte' }),
    ]
    render(
      <TagPickerSheet
        open
        onClose={vi.fn()}
        categorias={categorias}
        onSelect={vi.fn()}
        onCreateRequested={vi.fn()}
      />,
    )

    await user.type(screen.getByRole('textbox'), 'CAFE')

    expect(screen.getByRole('button', { name: 'Café' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Transporte' })).not.toBeInTheDocument()
  })

  it('shows a "create" affordance only when the query matches nothing, and calls onCreateRequested with the trimmed query', async () => {
    const user = userEvent.setup()
    const onCreateRequested = vi.fn()
    render(
      <TagPickerSheet
        open
        onClose={vi.fn()}
        categorias={[categoria({ nombre: 'Comida' })]}
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

  it('does not show a "create" affordance when the query matches an existing category', async () => {
    const user = userEvent.setup()
    render(
      <TagPickerSheet
        open
        onClose={vi.fn()}
        categorias={[categoria({ nombre: 'Comida' })]}
        onSelect={vi.fn()}
        onCreateRequested={vi.fn()}
      />,
    )

    await user.type(screen.getByRole('textbox'), 'comi')

    expect(screen.queryByText(/crear/i)).not.toBeInTheDocument()
  })

  it('selecting a category calls onSelect then onClose', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onClose = vi.fn()
    const target = categoria({ id: 'cat_x', nombre: 'Comida' })
    render(
      <TagPickerSheet
        open
        onClose={onClose}
        categorias={[target]}
        onSelect={onSelect}
        onCreateRequested={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Comida' }))

    expect(onSelect).toHaveBeenCalledWith(target)
    expect(onClose).toHaveBeenCalled()
  })

  it('marks the currently selected category as pressed', () => {
    const target = categoria({ id: 'cat_x', nombre: 'Comida' })
    render(
      <TagPickerSheet
        open
        onClose={vi.fn()}
        categorias={[target]}
        selectedId="cat_x"
        onSelect={vi.fn()}
        onCreateRequested={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Comida' })).toHaveAttribute('aria-pressed', 'true')
  })
})
