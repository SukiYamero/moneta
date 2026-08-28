import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Categoria } from '@/lib/schema'
import { CategoryField } from '@/features/tags/CategoryField'

const categoria = (overrides: Partial<Categoria> = {}): Categoria => ({
  id: 'cat_x',
  nombre: 'Comida',
  icono: 'utensils',
  color: 'amber',
  ...overrides,
})

describe('CategoryField', () => {
  it('shows the placeholder in muted text when nothing is picked', () => {
    render(<CategoryField tipo="gasto" onOpen={vi.fn()} />)

    const button = screen.getByRole('button', { name: /elegir categoría/i })
    expect(button).toBeInTheDocument()
  })

  it("shows the category's name once one is picked", () => {
    render(
      <CategoryField
        categoria={categoria({ nombre: 'Transporte' })}
        tipo="gasto"
        onOpen={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Transporte' })).toBeInTheDocument()
  })

  it('truncates the name instead of wrapping', () => {
    render(
      <CategoryField
        categoria={categoria({ nombre: 'Un nombre de categoría muy largo' })}
        tipo="gasto"
        onOpen={vi.fn()}
      />,
    )

    const label = screen.getByText('Un nombre de categoría muy largo')
    expect(label).toHaveClass('truncate')
  })

  it('calls onOpen when tapped', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<CategoryField tipo="gasto" onOpen={onOpen} />)

    await user.click(screen.getByRole('button'))

    expect(onOpen).toHaveBeenCalledOnce()
  })
})
