import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/dataStore', () => ({ useDataStore: vi.fn() }))

import { render, screen, waitFor, within } from '@testing-library/react'
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

const pickCategory = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  const dialog = screen.getByRole('dialog', { name: 'Categoría' })
  await user.type(within(dialog).getByRole('textbox', { name: /buscar categoría/i }), name)
  await user.click(within(dialog).getByRole('button', { name }))
}

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

  it('opens with gasto selected, an empty amount, and no category picked', () => {
    useMovimientoSheetStore.setState({ addOpen: true })
    render(<AddMovimientoSheet />)

    expect(screen.getByRole('dialog', { name: /agregar movimiento/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /gasto/i })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('textbox', { name: /monto/i })).toHaveValue('')
    expect(screen.getByRole('button', { name: /elegir categoría/i })).toBeInTheDocument()
  })

  it('shows a distinct inline error for an empty amount and never calls createMovimiento', async () => {
    const user = userEvent.setup()
    useMovimientoSheetStore.setState({ addOpen: true })
    render(<AddMovimientoSheet />)

    await user.click(screen.getByRole('button', { name: /agregar gasto/i }))

    expect(await screen.findByText(/ingresa un monto/i)).toBeInTheDocument()
    expect(screen.getByText(/elige una categoría/i)).toBeInTheDocument()
    expect(mCreateMovimiento).not.toHaveBeenCalled()
  })

  it('moves focus to the category picker and scrolls its section into view when a submit is blocked by a missing category', async () => {
    const user = userEvent.setup()
    // jsdom's scrollIntoView is unimplemented, hence the stub.
    const scrollIntoView = vi.fn()
    HTMLElement.prototype.scrollIntoView = scrollIntoView
    useMovimientoSheetStore.setState({ addOpen: true })
    render(<AddMovimientoSheet />)

    const amountInput = screen.getByRole('textbox', { name: /monto/i })
    await user.type(amountInput, '18000')
    expect(amountInput).toHaveFocus()

    await user.click(screen.getByRole('button', { name: /agregar gasto/i }))

    const categoryError = await screen.findByText(/elige una categoría/i)
    expect(screen.getByRole('button', { name: /elegir categoría/i })).toHaveFocus()
    expect(amountInput).not.toHaveFocus()
    expect(scrollIntoView).toHaveBeenCalledOnce()
    const scrolledTo = scrollIntoView.mock.contexts[0] as HTMLElement
    expect(scrolledTo.contains(categoryError)).toBe(true)
    expect(scrolledTo.contains(amountInput)).toBe(false)
  })

  it('saves a movement with the picked category, amount and note, then closes the sheet', async () => {
    const user = userEvent.setup()
    useMovimientoSheetStore.setState({ addOpen: true })
    render(<AddMovimientoSheet />)

    await user.type(screen.getByRole('textbox', { name: /monto/i }), '18000')
    await user.click(screen.getByRole('button', { name: /elegir categoría/i }))
    await pickCategory(user, 'Servicios')
    await user.click(screen.getByRole('button', { name: /más detalles/i }))
    await user.type(screen.getByRole('textbox', { name: /descripción/i }), 'Internet')
    await user.click(screen.getByRole('button', { name: /agregar gasto/i }))

    await waitFor(() => expect(mCreateMovimiento).toHaveBeenCalledTimes(1))
    expect(mCreateMovimiento).toHaveBeenCalledWith(
      expect.objectContaining({
        monto: 18000,
        tipo: 'gasto',
        categoria: 'cat_servicios',
        moneda: 'COP',
        nota: 'Internet',
      }),
    )
    await waitFor(() => expect(useMovimientoSheetStore.getState().addOpen).toBe(false))
  })

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
    await user.click(screen.getByRole('button', { name: /elegir categoría/i }))
    await pickCategory(user, 'Servicios')
    const saveButton = screen.getByRole('button', { name: /agregar gasto/i })
    await user.click(saveButton)

    await waitFor(() => expect(saveButton).toBeDisabled())
    await user.click(saveButton)
    expect(mCreateMovimiento).toHaveBeenCalledTimes(1)

    resolveCreate(true)
    await waitFor(() => expect(useMovimientoSheetStore.getState().addOpen).toBe(false))
  })

  it('the primary action names what it creates, following the type toggle', async () => {
    const user = userEvent.setup()
    useMovimientoSheetStore.setState({ addOpen: true })
    render(<AddMovimientoSheet />)

    expect(screen.getByRole('button', { name: /agregar gasto/i })).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /ingreso/i }))

    expect(screen.getByRole('button', { name: /agregar ingreso/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /agregar gasto/i })).not.toBeInTheDocument()
  })

  it('sizes the primary action to the design export, not the bare touch-target size', () => {
    useMovimientoSheetStore.setState({ addOpen: true })
    render(<AddMovimientoSheet />)

    const cta = screen.getByRole('button', { name: /agregar gasto/i })
    expect(cta).toHaveClass('h-13.5', 'rounded-2xl', 'text-md', 'font-extrabold')
  })

  describe('the nested CategorySheet stacks correctly above this sheet', () => {
    const openBoth = async (user: ReturnType<typeof userEvent.setup>) => {
      useMovimientoSheetStore.setState({ addOpen: true })
      render(<AddMovimientoSheet />)
      await user.type(screen.getByRole('textbox', { name: /monto/i }), '5000')
      await user.click(screen.getByRole('button', { name: /elegir categoría/i }))
      expect(screen.getAllByRole('dialog')).toHaveLength(2)
    }

    it('Escape closes only the nested picker, leaving the Add sheet open with its draft intact', async () => {
      const user = userEvent.setup()
      await openBoth(user)

      await user.keyboard('{Escape}')

      await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1))
      expect(useMovimientoSheetStore.getState().addOpen).toBe(true)
      expect(screen.getByRole('textbox', { name: /monto/i })).toHaveValue('5.000')
    })

    it('a second Escape, once the picker is gone, dismisses the Add sheet itself', async () => {
      const user = userEvent.setup()
      await openBoth(user)

      await user.keyboard('{Escape}')
      await user.keyboard('{Escape}')

      expect(useMovimientoSheetStore.getState().addOpen).toBe(false)
    })

    it('selecting a category closes only the CategorySheet, leaving the Add sheet mounted with its draft intact', async () => {
      const user = userEvent.setup()
      await openBoth(user)

      await pickCategory(user, 'Servicios')

      await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1))
      expect(useMovimientoSheetStore.getState().addOpen).toBe(true)
      expect(screen.getByRole('textbox', { name: /monto/i })).toHaveValue('5.000')
      expect(screen.getByRole('button', { name: 'Servicios' })).toBeInTheDocument()
    })
  })
})
