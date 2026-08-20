import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Categoria, Movimiento, Seccion } from '@/lib/schema'

const mArchiveCategoria = vi.fn()
const mUpsertCategoria = vi.fn()
const mDeleteCategoria = vi.fn()

const SECCIONES: Seccion[] = [
  { id: 'sec_personal', nombre: 'Personal', orden: 0 },
  { id: 'sec_trabajo', nombre: 'Trabajo', orden: 1 },
]

const categoria = (overrides: Partial<Categoria> = {}): Categoria => ({
  id: crypto.randomUUID(),
  nombre: 'Comida',
  seccionId: 'sec_personal',
  tipo: 'gasto',
  icono: 'utensils',
  color: 'amber',
  ...overrides,
})

const movimiento = (overrides: Partial<Movimiento> = {}): Movimiento => ({
  id: crypto.randomUUID(),
  fecha: '2026-08-15',
  seccion: 'sec_personal',
  categoria: 'cat_comida',
  tipo: 'gasto',
  monto: 1000,
  moneda: 'COP',
  createdAt: '2026-08-15T00:00:00.000Z',
  ...overrides,
})

let state: {
  config: { secciones: Seccion[]; categorias: Categoria[] }
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
        secciones: SECCIONES,
        categorias: [
          categoria({ id: 'cat_comida', nombre: 'Comida', seccionId: 'sec_personal' }),
          categoria({ id: 'cat_sueldo', nombre: 'Sueldo', seccionId: 'sec_trabajo' }),
          categoria({
            id: 'cat_vieja',
            nombre: 'Categoría vieja',
            seccionId: 'sec_personal',
            archivado: true,
          }),
        ],
      },
      movimientos: [],
    }
  })

  it('groups active categories by section', () => {
    render(<CategoriesSection />)
    expect(screen.getByText('Personal')).toBeInTheDocument()
    expect(screen.getByText('Trabajo')).toBeInTheDocument()
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
    // Two active categories, one "Archivar" button each — Comida (Personal,
    // orden 0) renders first.
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
    // The dialog's own confirm button shares the "Eliminar" label with the
    // row's trigger — scope the click to the dialog, not the row underneath.
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
})
