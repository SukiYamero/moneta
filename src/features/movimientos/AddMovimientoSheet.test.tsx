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

    await user.click(screen.getByRole('button', { name: /agregar gasto/i }))

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
    await user.click(screen.getByRole('button', { name: /agregar gasto/i }))

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

  it('disables the primary action while a submit is already in flight (double-tap guard)', async () => {
    const user = userEvent.setup()
    let resolveCreate!: (value: boolean) => void
    mCreateMovimiento.mockImplementation(() => new Promise((resolve) => (resolveCreate = resolve)))
    useMovimientoSheetStore.setState({ addOpen: true })
    render(<AddMovimientoSheet />)

    await user.type(screen.getByRole('textbox', { name: /monto/i }), '5000')
    await user.click(screen.getByRole('button', { name: 'Servicios' }))
    const saveButton = screen.getByRole('button', { name: /agregar gasto/i })
    await user.click(saveButton)

    await waitFor(() => expect(saveButton).toBeDisabled())
    await user.click(saveButton)
    expect(mCreateMovimiento).toHaveBeenCalledTimes(1)

    resolveCreate(true)
    await waitFor(() => expect(useMovimientoSheetStore.getState().addOpen).toBe(false))
  })

  // The artboard's action row binds `{{addLabel}}` to the sheet's own type
  // toggle — a generic "Guardar" is the old vertical form's copy. Edit mode
  // keeps the generic label (specs.md §10.41.1): only create names the
  // action being taken, because only create's toggle picks what gets made.
  it('the primary action names what it creates, following the type toggle', async () => {
    const user = userEvent.setup()
    useMovimientoSheetStore.setState({ addOpen: true })
    render(<AddMovimientoSheet />)

    expect(screen.getByRole('button', { name: /agregar gasto/i })).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /ingreso/i }))

    expect(screen.getByRole('button', { name: /agregar ingreso/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /agregar gasto/i })).not.toBeInTheDocument()
  })

  // docs/ui/design-export-add-sheet.md §2 draws the commit button at
  // height:54px/border-radius:18px/font-size:15.5px/font-weight:800 — this
  // pins the token classes rather than `size="touch"`'s 44px/12px/500
  // touch-target defaults, which is all the sheet rendered before this fix.
  it('sizes the primary action to the design export, not the bare touch-target size', () => {
    useMovimientoSheetStore.setState({ addOpen: true })
    render(<AddMovimientoSheet />)

    const cta = screen.getByRole('button', { name: /agregar gasto/i })
    expect(cta).toHaveClass('h-13.5', 'rounded-2xl', 'text-md', 'font-extrabold')
  })

  // The count button opens `TagPickerSheet` as a second `BottomSheet`
  // nested above this one — a real, reachable case `useOverlay`'s
  // render-order stack (specs.md §10.5.1) must handle, not just the two
  // sheets happening to both exist. Verified live in a real browser too
  // (Escape and a backdrop tap both closed only the nested picker); this
  // pins the same behavior at the component level.
  describe('the nested TagPickerSheet (count button) stacks correctly above this sheet', () => {
    const openBoth = async (user: ReturnType<typeof userEvent.setup>) => {
      useMovimientoSheetStore.setState({ addOpen: true })
      render(<AddMovimientoSheet />)
      await user.type(screen.getByRole('textbox', { name: /monto/i }), '5000')
      await user.click(screen.getByRole('button', { name: /ver todas/i }))
      expect(screen.getAllByRole('dialog')).toHaveLength(2)
    }

    it('Escape closes only the nested picker, leaving the Add sheet open with its draft intact', async () => {
      const user = userEvent.setup()
      await openBoth(user)

      await user.keyboard('{Escape}')

      expect(screen.getAllByRole('dialog')).toHaveLength(1)
      expect(useMovimientoSheetStore.getState().addOpen).toBe(true)
      expect(screen.getByRole('textbox', { name: /monto/i })).toHaveValue('5000')
    })

    it('a second Escape, once the picker is gone, dismisses the Add sheet itself', async () => {
      const user = userEvent.setup()
      await openBoth(user)

      await user.keyboard('{Escape}')
      await user.keyboard('{Escape}')

      expect(useMovimientoSheetStore.getState().addOpen).toBe(false)
    })
  })
})
