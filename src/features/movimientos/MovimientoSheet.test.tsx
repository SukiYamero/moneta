import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/dataStore', () => ({ useDataStore: vi.fn() }))
vi.mock('@/lib/toastStore', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CONFIG_SEMILLA, type Config, type Movimiento } from '@/lib/schema'
import { useDataStore } from '@/lib/dataStore'
import { toast } from '@/lib/toastStore'
import { MovimientoSheet } from '@/features/movimientos/MovimientoSheet'
import { useMovimientoSheetStore } from '@/features/movimientos/movimientoSheetStore'

const mUpdateMovimiento = vi.fn()
const mDeleteMovimiento = vi.fn()
const mToastError = vi.mocked(toast.error)

interface FakeDataState {
  config: Config | null
  movimientos: Movimiento[]
  updateMovimiento: typeof mUpdateMovimiento
  deleteMovimiento: typeof mDeleteMovimiento
}

let state: FakeDataState

// Cast at the boundary: this test double narrows `useDataStore`'s selector
// to only the slice `MovimientoSheet`/`useMovimientoForm` actually read,
// which is intentionally not the full `DataState` shape.
vi.mocked(useDataStore).mockImplementation(((selector: (state: FakeDataState) => unknown) =>
  selector(state)) as typeof useDataStore)

const movimiento = (overrides: Partial<Movimiento> = {}): Movimiento => ({
  id: 'mov_1',
  fecha: '2026-08-10',
  seccion: 'sec_personal',
  categoria: 'cat_servicios',
  tipo: 'gasto',
  monto: 18000,
  moneda: 'COP',
  createdAt: '2026-08-10T00:00:00.000Z',
  ...overrides,
})

beforeEach(() => {
  mUpdateMovimiento.mockReset()
  mDeleteMovimiento.mockReset()
  mToastError.mockReset()
  state = {
    config: CONFIG_SEMILLA,
    movimientos: [],
    updateMovimiento: mUpdateMovimiento,
    deleteMovimiento: mDeleteMovimiento,
  }
  useMovimientoSheetStore.setState({ addOpen: false, viewId: null })
})

describe('MovimientoSheet — view mode', () => {
  it('renders nothing while no id is open', () => {
    render(<MovimientoSheet />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the amount, category, date and note for the movement', () => {
    state.movimientos = [movimiento({ nota: 'Factura de internet' })]
    useMovimientoSheetStore.setState({ viewId: 'mov_1' })
    render(<MovimientoSheet />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Servicios')).toBeInTheDocument()
    expect(screen.getByText('Factura de internet')).toBeInTheDocument()
    expect(screen.getByText(/\$\s*-?18[.,]000/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /eliminar/i })).toBeInTheDocument()
  })

  it('resolves an unknown category id to the fallback label instead of a raw id', () => {
    state.movimientos = [movimiento({ categoria: 'cat_does_not_exist' })]
    useMovimientoSheetStore.setState({ viewId: 'mov_1' })
    render(<MovimientoSheet />)
    expect(screen.getByText('Sin categoría')).toBeInTheDocument()
    expect(screen.queryByText('cat_does_not_exist')).not.toBeInTheDocument()
  })
})

describe('MovimientoSheet — edit mode', () => {
  it('Editar switches to a pre-filled form; Cancelar returns to view without writing', async () => {
    const user = userEvent.setup()
    state.movimientos = [movimiento()]
    useMovimientoSheetStore.setState({ viewId: 'mov_1' })
    render(<MovimientoSheet />)

    await user.click(screen.getByRole('button', { name: /editar/i }))
    expect(screen.getByRole('textbox', { name: /monto/i })).toHaveValue('18.000')

    await user.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(mUpdateMovimiento).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument()
  })

  it('saving from edit mode calls updateMovimiento with the changed amount and returns to view', async () => {
    const user = userEvent.setup()
    mUpdateMovimiento.mockResolvedValue(true)
    state.movimientos = [movimiento()]
    useMovimientoSheetStore.setState({ viewId: 'mov_1' })
    render(<MovimientoSheet />)

    await user.click(screen.getByRole('button', { name: /editar/i }))
    const amountInput = screen.getByRole('textbox', { name: /monto/i })
    await user.clear(amountInput)
    await user.type(amountInput, '20000')
    await user.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() =>
      expect(mUpdateMovimiento).toHaveBeenCalledWith(
        'mov_1',
        expect.objectContaining({
          monto: 20000,
          categoria: 'cat_servicios',
          seccion: 'sec_personal',
        }),
      ),
    )
    await waitFor(() => expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument())
  })
})

describe('MovimientoSheet — delete', () => {
  it('Eliminar opens a confirm dialog; confirming deletes and closes the sheet', async () => {
    const user = userEvent.setup()
    mDeleteMovimiento.mockResolvedValue(true)
    state.movimientos = [movimiento()]
    useMovimientoSheetStore.setState({ viewId: 'mov_1' })
    render(<MovimientoSheet />)

    await user.click(screen.getByRole('button', { name: /eliminar/i }))
    expect(screen.getByRole('heading', { name: /eliminar este movimiento/i })).toBeInTheDocument()

    // Two "Eliminar" buttons are on screen at once — the view's own trigger
    // (behind the modal) and the confirm dialog's own confirm button, which
    // renders after it in the tree.
    const confirmButtons = screen.getAllByRole('button', { name: /^eliminar$/i })
    await user.click(confirmButtons.at(-1)!)

    await waitFor(() => expect(mDeleteMovimiento).toHaveBeenCalledWith('mov_1'))
    await waitFor(() => expect(useMovimientoSheetStore.getState().viewId).toBeNull())
  })

  it('a refused delete keeps the sheet open on the same movement', async () => {
    const user = userEvent.setup()
    mDeleteMovimiento.mockResolvedValue(false)
    state.movimientos = [movimiento()]
    useMovimientoSheetStore.setState({ viewId: 'mov_1' })
    render(<MovimientoSheet />)

    await user.click(screen.getByRole('button', { name: /eliminar/i }))
    const confirmButtons = screen.getAllByRole('button', { name: /^eliminar$/i })
    await user.click(confirmButtons.at(-1)!)

    await waitFor(() => expect(mDeleteMovimiento).toHaveBeenCalledWith('mov_1'))
    expect(useMovimientoSheetStore.getState().viewId).toBe('mov_1')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('cancelling the confirm dialog never calls deleteMovimiento', async () => {
    const user = userEvent.setup()
    state.movimientos = [movimiento()]
    useMovimientoSheetStore.setState({ viewId: 'mov_1' })
    render(<MovimientoSheet />)

    await user.click(screen.getByRole('button', { name: /eliminar/i }))
    await user.click(screen.getByRole('button', { name: /cancelar/i }))

    expect(mDeleteMovimiento).not.toHaveBeenCalled()
    expect(useMovimientoSheetStore.getState().viewId).toBe('mov_1')
  })
})

describe('MovimientoSheet — the movement vanishing underneath an open sheet (specs.md §10.23 Decision 2)', () => {
  it('closes the sheet and raises a toast instead of rendering blank', () => {
    state.movimientos = [movimiento()]
    useMovimientoSheetStore.setState({ viewId: 'mov_1' })
    const { rerender } = render(<MovimientoSheet />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    state.movimientos = []
    rerender(<MovimientoSheet />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(useMovimientoSheetStore.getState().viewId).toBeNull()
    expect(mToastError).toHaveBeenCalledWith('movimientos:vanished')
  })
})
