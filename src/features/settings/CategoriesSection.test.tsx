import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Categoria, Movimiento } from '@/lib/schema'

const mArchiveCategoria = vi.fn()
const mUpsertCategoria = vi.fn()
const mDeleteCategoria = vi.fn()

const categoria = (overrides: Partial<Categoria> = {}): Categoria => ({
  id: crypto.randomUUID(),
  nombre: 'Comida',
  icono: 'utensils',
  color: 'amber',
  ...overrides,
})

const movimiento = (overrides: Partial<Movimiento> = {}): Movimiento => ({
  id: crypto.randomUUID(),
  fecha: '2026-08-15',
  categoria: 'cat_comida',
  tipo: 'gasto',
  monto: 1000,
  moneda: 'COP',
  createdAt: '2026-08-15T00:00:00.000Z',
  ...overrides,
})

let state: {
  config: { categorias: Categoria[] }
  movimientos: Movimiento[]
}

vi.mock('@/lib/dataStore', () => ({
  useDataStore: (selector: (s: typeof state & Record<string, unknown>) => unknown) =>
    selector({
      ...state,
      archiveCategoria: mArchiveCategoria,
      upsertCategoria: mUpsertCategoria,
      deleteCategoria: mDeleteCategoria,
    }),
}))

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CategoriesSection } from '@/features/settings/CategoriesSection'

describe('CategoriesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state = {
      config: {
        categorias: [
          categoria({ id: 'cat_comida', nombre: 'Comida' }),
          categoria({ id: 'cat_sueldo', nombre: 'Sueldo' }),
          categoria({
            id: 'cat_vieja',
            nombre: 'Categoría vieja',
            archivado: true,
          }),
        ],
      },
      movimientos: [],
    }
  })

  it('renders a flat list of active categories', () => {
    render(<CategoriesSection />)
    expect(screen.getByText('Comida')).toBeInTheDocument()
    expect(screen.getByText('Sueldo')).toBeInTheDocument()
  })

  it('keeps archived categories collapsed by default, reachable by expanding', async () => {
    const user = userEvent.setup()
    render(<CategoriesSection />)
    expect(screen.queryByText('Categoría vieja')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /archivadas/i }))
    expect(screen.getByText('Categoría vieja')).toBeInTheDocument()
  })

  it('tapping an active row opens CategoryFormModal in edit mode', async () => {
    const user = userEvent.setup()
    render(<CategoriesSection />)
    await user.click(screen.getByText('Comida'))
    expect(screen.getByRole('heading', { name: /editar categoría/i })).toBeInTheDocument()
  })

  it('tapping "Nueva categoría" opens CategoryFormModal in create mode', async () => {
    const user = userEvent.setup()
    render(<CategoriesSection />)
    await user.click(screen.getByRole('button', { name: /nueva categoría/i }))
    expect(screen.getByRole('heading', { name: /nueva categoría/i })).toBeInTheDocument()
  })

  it('archives an active category in one tap — no confirmation needed', async () => {
    const user = userEvent.setup()
    render(<CategoriesSection />)
    await user.click(screen.getAllByRole('button', { name: /^archivar$/i })[0]!)
    expect(mArchiveCategoria).toHaveBeenCalledWith('cat_comida')
  })

  it('restores an archived category via upsertCategoria with archivado: false', async () => {
    const user = userEvent.setup()
    render(<CategoriesSection />)
    await user.click(screen.getByRole('button', { name: /archivadas/i }))
    await user.click(screen.getByRole('button', { name: /^restaurar$/i }))
    expect(mUpsertCategoria).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cat_vieja', archivado: false }),
    )
  })

  it('deletes an unused archived category after confirming', async () => {
    const user = userEvent.setup()
    render(<CategoriesSection />)
    await user.click(screen.getByRole('button', { name: /archivadas/i }))
    await user.click(screen.getByRole('button', { name: /^eliminar$/i }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^eliminar$/i }))
    expect(mDeleteCategoria).toHaveBeenCalledWith('cat_vieja')
  })

  it('never offers Delete for an archived category still referenced by a movimiento — an honest note instead', async () => {
    state.movimientos = [movimiento({ categoria: 'cat_vieja' })]
    const user = userEvent.setup()
    render(<CategoriesSection />)
    await user.click(screen.getByRole('button', { name: /archivadas/i }))
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument()
    expect(screen.getByText(/tiene movimientos/i)).toBeInTheDocument()
  })

  it('shows the empty state when there are no categories at all', () => {
    state.config.categorias = []
    render(<CategoriesSection />)
    expect(screen.getByText(/todavía no hay categorías/i)).toBeInTheDocument()
  })

  it('renders a child indented under its parent, and an orphan (missing or archived parent) at top level', () => {
    state.config.categorias = [
      categoria({ id: 'cat_ocio', nombre: 'Ocio' }),
      categoria({ id: 'cat_cine', nombre: 'Cine', padreId: 'cat_ocio' }),
      categoria({ id: 'cat_huerfana', nombre: 'Huérfana', padreId: 'cat_no_existe' }),
    ]
    render(<CategoriesSection />)

    const childGroup = screen.getByText('Cine').closest<HTMLElement>('.border-l')
    expect(childGroup).not.toBeNull()
    expect(within(childGroup!).getByText('Cine')).toBeInTheDocument()

    expect(screen.getByText('Ocio').closest('.border-l')).toBeNull()
    expect(screen.getByText('Huérfana').closest('.border-l')).toBeNull()
  })
})
