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
import type { Categoria, Seccion } from '@/lib/schema'
import { CategoryFormModal } from '@/features/tags/CategoryFormModal'

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

describe('CategoryFormModal', () => {
  beforeEach(() => {
    mUpsertCategoria.mockClear()
  })

  it('shows the create title with no categoria prop, and the edit title with one', () => {
    const { rerender } = render(
      <CategoryFormModal
        open
        onClose={vi.fn()}
        tipo="gasto"
        secciones={SECCIONES}
        categorias={[]}
      />,
    )
    expect(screen.getByRole('heading', { name: /nueva categoría/i })).toBeInTheDocument()

    rerender(
      <CategoryFormModal
        open
        onClose={vi.fn()}
        tipo="gasto"
        secciones={SECCIONES}
        categorias={[]}
        categoria={categoria()}
      />,
    )
    expect(screen.getByRole('heading', { name: /editar categoría/i })).toBeInTheDocument()
  })

  it('pre-fills the name from initialName when creating (Decision 4: "create from query")', () => {
    render(
      <CategoryFormModal
        open
        onClose={vi.fn()}
        tipo="gasto"
        secciones={SECCIONES}
        categorias={[]}
        initialName="Gimnasio"
      />,
    )
    expect(screen.getByRole('textbox', { name: /nombre/i })).toHaveValue('Gimnasio')
  })

  it('pre-fills the name/section/icon/color from the category being edited', () => {
    render(
      <CategoryFormModal
        open
        onClose={vi.fn()}
        tipo="gasto"
        secciones={SECCIONES}
        categorias={[]}
        categoria={categoria({ nombre: 'Comida', seccionId: 'sec_trabajo' })}
      />,
    )
    expect(screen.getByRole('textbox', { name: /nombre/i })).toHaveValue('Comida')
    expect(screen.getByRole('radio', { name: 'Trabajo' })).toHaveAttribute('aria-checked', 'true')
  })

  it('suggests an icon/color from the pre-filled name via the multilingual concept table', () => {
    render(
      <CategoryFormModal
        open
        onClose={vi.fn()}
        tipo="gasto"
        secciones={SECCIONES}
        categorias={[]}
        initialName="gym"
      />,
    )
    // "gym" -> dumbbell/rose (categorySuggest.test.ts pins the mapping) —
    // the preview chip renders with that visible pre-selection.
    expect(screen.getByRole('button', { name: /dumbbell/i, pressed: true })).toBeInTheDocument()
  })

  it('hides the section control when only one section exists', () => {
    render(
      <CategoryFormModal
        open
        onClose={vi.fn()}
        tipo="gasto"
        secciones={[SECCIONES[0]!]}
        categorias={[]}
      />,
    )
    expect(screen.queryByRole('radiogroup', { name: /sección/i })).not.toBeInTheDocument()
  })

  it('defaults the section to the lowest orden when creating, with more than one section', () => {
    render(
      <CategoryFormModal
        open
        onClose={vi.fn()}
        tipo="gasto"
        secciones={SECCIONES}
        categorias={[]}
      />,
    )
    expect(screen.getByRole('radio', { name: 'Personal' })).toHaveAttribute('aria-checked', 'true')
  })

  it('disables Save while the name is empty', async () => {
    const user = userEvent.setup()
    render(
      <CategoryFormModal
        open
        onClose={vi.fn()}
        tipo="gasto"
        secciones={SECCIONES}
        categorias={[]}
        initialName="Gimnasio"
      />,
    )
    const nameField = screen.getByRole('textbox', { name: /nombre/i })
    await user.clear(nameField)

    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled()
  })

  it('blocks a duplicate name inline (scoped to the section), never as a toast', async () => {
    const user = userEvent.setup()
    const existing = categoria({ nombre: 'Comida', seccionId: 'sec_personal' })
    render(
      <CategoryFormModal
        open
        onClose={vi.fn()}
        tipo="gasto"
        secciones={SECCIONES}
        categorias={[existing]}
      />,
    )

    await user.type(screen.getByRole('textbox', { name: /nombre/i }), 'comida')

    expect(screen.getByRole('alert')).toHaveTextContent(/ya existe una categoría/i)
    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled()
  })

  it('does not block the same name in a different section', async () => {
    const user = userEvent.setup()
    const existing = categoria({ nombre: 'Comida', seccionId: 'sec_trabajo' })
    render(
      <CategoryFormModal
        open
        onClose={vi.fn()}
        tipo="gasto"
        secciones={SECCIONES}
        categorias={[existing]}
      />,
    )

    // Default section is sec_personal (lowest orden) — "Comida" only
    // collides in sec_trabajo, so this must be allowed.
    await user.type(screen.getByRole('textbox', { name: /nombre/i }), 'Comida')

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /guardar/i })).toBeEnabled()
  })

  it('caps the name length on the value itself, not only the input maxlength', async () => {
    const user = userEvent.setup()
    render(
      <CategoryFormModal
        open
        onClose={vi.fn()}
        tipo="gasto"
        secciones={SECCIONES}
        categorias={[]}
      />,
    )
    const nameField = screen.getByRole('textbox', { name: /nombre/i })
    await user.type(nameField, 'x'.repeat(60))

    expect((nameField as HTMLInputElement).value.length).toBeLessThanOrEqual(30)
  })

  it('saves via dataStore.upsertCategoria with categoria/seccionId/tipo/icono/color set, and closes', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <CategoryFormModal
        open
        onClose={onClose}
        tipo="gasto"
        secciones={SECCIONES}
        categorias={[]}
        initialName="Gimnasio"
      />,
    )

    await user.click(screen.getByRole('button', { name: /guardar/i }))

    expect(mUpsertCategoria).toHaveBeenCalledOnce()
    const saved = mUpsertCategoria.mock.calls[0]![0] as Categoria
    expect(saved.nombre).toBe('Gimnasio')
    expect(saved.seccionId).toBe('sec_personal')
    expect(saved.tipo).toBe('gasto')
    expect(saved.icono).toBe('dumbbell')
    expect(saved.color).toBe('rose')
    expect(typeof saved.id).toBe('string')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not close when the write is refused or fails, so the user still sees the toast and can retry', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    mUpsertCategoria.mockResolvedValueOnce(false)
    render(
      <CategoryFormModal
        open
        onClose={onClose}
        tipo="gasto"
        secciones={SECCIONES}
        categorias={[]}
        initialName="Gimnasio"
      />,
    )

    await user.click(screen.getByRole('button', { name: /guardar/i }))

    expect(mUpsertCategoria).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('editing keeps the existing id and preserves the tipo the category was created with, ignoring the sheet toggle', async () => {
    const user = userEvent.setup()
    const existing = categoria({ id: 'cat_x', nombre: 'Sueldo', tipo: 'ingreso' })
    render(
      <CategoryFormModal
        open
        onClose={vi.fn()}
        tipo="gasto"
        secciones={SECCIONES}
        categorias={[]}
        categoria={existing}
      />,
    )

    await user.click(screen.getByRole('button', { name: /guardar/i }))

    const saved = mUpsertCategoria.mock.calls[0]![0] as Categoria
    expect(saved.id).toBe('cat_x')
    expect(saved.tipo).toBe('ingreso')
  })

  it('changing the icon/color grid selection changes what gets saved', async () => {
    const user = userEvent.setup()
    render(
      <CategoryFormModal
        open
        onClose={vi.fn()}
        tipo="gasto"
        secciones={SECCIONES}
        categorias={[]}
        initialName="Sin sugerencia posible zzz"
      />,
    )

    await user.click(screen.getByRole('button', { name: /^gift$/i }))
    await user.click(screen.getByRole('button', { name: /^purple$|^morado$/i }))
    await user.click(screen.getByRole('button', { name: /guardar/i }))

    const saved = mUpsertCategoria.mock.calls[0]![0] as Categoria
    expect(saved.icono).toBe('gift')
    expect(saved.color).toBe('purple')
  })
})
