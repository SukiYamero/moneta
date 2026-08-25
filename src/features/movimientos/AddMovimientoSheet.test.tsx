import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/dataStore', () => ({ useDataStore: vi.fn() }))

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Config } from '@/lib/schema'
import { CONFIG_SEMILLA } from '@/lib/schema'
import { useDataStore } from '@/lib/dataStore'
import { AddMovimientoSheet } from '@/features/movimientos/AddMovimientoSheet'
import { useMovimientoSheetStore } from '@/features/movimientos/movimientoSheetStore'

const mCreateMovimiento = vi.fn()

interface FakeDataState {
  config: Config | null
  createMovimiento: typeof mCreateMovimiento
}

let state: FakeDataState

// Cast at the boundary: this test double narrows `useDataStore`'s selector
// to only the slice `AddMovimientoSheet`/`useMovimientoForm` actually read,
// which is intentionally not the full `DataState` shape.
vi.mocked(useDataStore).mockImplementation(((selector: (state: FakeDataState) => unknown) =>
  selector(state)) as typeof useDataStore)

beforeEach(() => {
  mCreateMovimiento.mockReset()
  mCreateMovimiento.mockResolvedValue(true)
  state = { config: CONFIG_SEMILLA, createMovimiento: mCreateMovimiento }
  useMovimientoSheetStore.setState({ addOpen: false, viewId: null })
})

describe('AddMovimientoSheet', () => {
  it('renders nothing while closed', () => {
    render(<AddMovimientoSheet />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens with gasto selected, an empty amount, and categories ordered gasto-first', () => {
    useMovimientoSheetStore.setState({ addOpen: true })
    render(<AddMovimientoSheet />)

    expect(screen.getByRole('dialog', { name: /agregar movimiento/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /gasto/i })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('textbox', { name: /monto/i })).toHaveValue('')
    // Servicios (gasto) is a real category — visible without typing anything.
    expect(screen.getByRole('button', { name: 'Servicios' })).toBeInTheDocument()
  })

  it('shows a distinct inline error for an empty amount and never calls createMovimiento', async () => {
    const user = userEvent.setup()
    useMovimientoSheetStore.setState({ addOpen: true })
    render(<AddMovimientoSheet />)

    await user.click(screen.getByRole('button', { name: /guardar/i }))

    // No category is selected either at this point, so both the amount
    // and the category error show — distinct messages, not one shared alert.
    expect(await screen.findByText(/ingresa un monto/i)).toBeInTheDocument()
    expect(screen.getByText(/elige una categoría/i)).toBeInTheDocument()
    expect(mCreateMovimiento).not.toHaveBeenCalled()
  })

  it('saves a movement with the picked category, amount and note, then closes the sheet', async () => {
    const user = userEvent.setup()
    useMovimientoSheetStore.setState({ addOpen: true })
    render(<AddMovimientoSheet />)

    await user.type(screen.getByRole('textbox', { name: /monto/i }), '18000')
    await user.click(screen.getByRole('button', { name: 'Servicios' }))
    // The note field is behind the "ver más" disclosure (docs/ui/
    // design-export-add-sheet.md §2, specs.md §10.41).
    await user.click(screen.getByRole('button', { name: /más detalles/i }))
    await user.type(screen.getByRole('textbox', { name: /descripción/i }), 'Internet')
    await user.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => expect(mCreateMovimiento).toHaveBeenCalledTimes(1))
    expect(mCreateMovimiento).toHaveBeenCalledWith(
      expect.objectContaining({
        monto: 18000,
        tipo: 'gasto',
        categoria: 'cat_servicios',
        seccion: 'sec_personal',
        moneda: 'COP',
        nota: 'Internet',
      }),
    )
    await waitFor(() => expect(useMovimientoSheetStore.getState().addOpen).toBe(false))
  })

  // The design (docs/ui/design-export-add-sheet.md §2, specs.md §10.41) has
  // no Cancel button in the create sheet's action row — only the sheet's
  // existing backdrop-tap/Escape/drag-to-dismiss, all routed through
  // `handleClose`. Simulated here via Escape, the keyboard-reachable path.
  it('dismissing without saving discards the draft — reopening starts blank again', async () => {
    const user = userEvent.setup()
    useMovimientoSheetStore.setState({ addOpen: true })
    const { rerender } = render(<AddMovimientoSheet />)

    await user.type(screen.getByRole('textbox', { name: /monto/i }), '5000')
    await user.keyboard('{Escape}')

    expect(useMovimientoSheetStore.getState().addOpen).toBe(false)
    expect(mCreateMovimiento).not.toHaveBeenCalled()

    useMovimientoSheetStore.setState({ addOpen: true })
    rerender(<AddMovimientoSheet />)
    expect(screen.getByRole('textbox', { name: /monto/i })).toHaveValue('')
  })

  it('disables Guardar while a submit is already in flight (double-tap guard)', async () => {
    const user = userEvent.setup()
    let resolveCreate!: (value: boolean) => void
    mCreateMovimiento.mockImplementation(() => new Promise((resolve) => (resolveCreate = resolve)))
    useMovimientoSheetStore.setState({ addOpen: true })
    render(<AddMovimientoSheet />)

    await user.type(screen.getByRole('textbox', { name: /monto/i }), '5000')
    await user.click(screen.getByRole('button', { name: 'Servicios' }))
    const saveButton = screen.getByRole('button', { name: /guardar/i })
    await user.click(saveButton)

    await waitFor(() => expect(saveButton).toBeDisabled())
    await user.click(saveButton)
    expect(mCreateMovimiento).toHaveBeenCalledTimes(1)

    resolveCreate(true)
    await waitFor(() => expect(useMovimientoSheetStore.getState().addOpen).toBe(false))
  })
})
