import { format, subDays } from 'date-fns'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/repoProvider', () => ({ getRepo: vi.fn() }))

import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Config, Movimiento } from '@/lib/schema'
import { CONFIG_SEMILLA } from '@/lib/schema'
import { RepoError, type Repo } from '@/lib/repo'
import { useDataStore } from '@/lib/dataStore'
import { getRepo } from '@/lib/repoProvider'
import { i18next } from '@/lib/i18n'
import { SearchScreen } from '@/features/search/SearchScreen'
import { useMovimientoSheetStore } from '@/features/movimientos'

const mGetRepo = vi.mocked(getRepo)

const movimiento = (overrides: Partial<Movimiento> = {}): Movimiento => ({
  id: crypto.randomUUID(),
  fecha: '2026-08-15',
  categoria: 'cat_comida',
  tipo: 'gasto',
  monto: 18_000,
  moneda: 'COP',
  createdAt: '2026-08-15T00:00:00.000Z',
  ...overrides,
})

const CONFIG: Config = {
  ...CONFIG_SEMILLA,
  categorias: [
    ...CONFIG_SEMILLA.categorias,
    { id: 'cat_comida', nombre: 'Comida' },
    { id: 'cat_transporte', nombre: 'Transporte' },
  ],
}

const today = () => format(new Date(), 'yyyy-MM-dd')
const daysAgo = (n: number) => format(subDays(new Date(), n), 'yyyy-MM-dd')

const setReady = (movimientos: Movimiento[], config: Config = CONFIG) => {
  useDataStore.setState({ movimientos, activos: [], config, status: 'ready', error: null })
}

const makeRepo = ({ readyError }: { readyError?: unknown } = {}): Repo => ({
  ready: vi
    .fn()
    .mockImplementation(() => (readyError ? Promise.reject(readyError) : Promise.resolve())),
  movimientos: {
    list: vi.fn().mockResolvedValue({ items: [] }),
    get: vi.fn(),
    add: vi.fn(),
    addMany: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    removeMany: vi.fn(),
  },
  activos: {
    list: vi.fn().mockResolvedValue({ items: [] }),
    get: vi.fn(),
    add: vi.fn(),
    addMany: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    removeMany: vi.fn(),
  },
  getConfig: vi.fn().mockResolvedValue(CONFIG),
  updateConfig: vi.fn(),
})

beforeEach(() => {
  vi.clearAllMocks()
  useDataStore.setState({
    movimientos: [],
    activos: [],
    config: null,
    status: 'idle',
    error: null,
  })
})

describe('SearchScreen', () => {
  it('renders the title', () => {
    setReady([])
    render(<SearchScreen />)
    expect(screen.getByRole('heading', { name: /buscar/i })).toBeInTheDocument()
  })

  it("does not duplicate the shell's --bottom-nav-clearance padding on its own <main>", () => {
    setReady([])
    const { container } = render(<SearchScreen />)
    expect(container.querySelector('main')?.className).not.toMatch(/bottom-nav-clearance/)
  })

  it('shows nothing yet immediately while the data store is not ready, before the anti-flash delay elapses', () => {
    vi.useFakeTimers()
    useDataStore.setState({ status: 'loading' })
    render(<SearchScreen />)
    expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('shows a loading state once the anti-flash delay elapses while the data store is still not ready', () => {
    vi.useFakeTimers()
    useDataStore.setState({ status: 'loading' })
    render(<SearchScreen />)
    act(() => vi.advanceTimersByTime(150))
    expect(screen.getByText(/cargando/i)).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('shows an inline error with a retry action when the load failed', async () => {
    const user = userEvent.setup()
    mGetRepo.mockReturnValue(makeRepo({ readyError: new Error('boom') }))
    render(<SearchScreen />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/error inesperado/i)
    })

    mGetRepo.mockReturnValue(makeRepo())
    await user.click(screen.getByRole('button', { name: /reintentar/i }))

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('names a network failure specifically, not the generic fallback', async () => {
    mGetRepo.mockReturnValue(makeRepo({ readyError: new RepoError('offline', 'network') }))
    render(<SearchScreen />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/no hay conexión/i)
    })
  })

  it('shows the "no data at all" empty state for a brand-new user, not "no results"', () => {
    setReady([])
    render(<SearchScreen />)
    expect(screen.getByText(/aún no tienes movimientos/i)).toBeInTheDocument()
    expect(screen.queryByText(/sin resultados/i)).not.toBeInTheDocument()
  })

  it('lists every movement with no query or filters', () => {
    setReady([
      movimiento({ nota: 'Café de la mañana' }),
      movimiento({ nota: 'Uber al trabajo', categoria: 'cat_transporte' }),
    ])
    render(<SearchScreen />)
    expect(screen.getByText('Café de la mañana')).toBeInTheDocument()
    expect(screen.getByText('Uber al trabajo')).toBeInTheDocument()
  })

  it('tapping a result opens the movement sheet for that id', async () => {
    const user = userEvent.setup()
    useMovimientoSheetStore.setState({ addOpen: false, viewId: null })
    const target = movimiento({ nota: 'Café de la mañana' })
    setReady([target, movimiento({ nota: 'Uber al trabajo', categoria: 'cat_transporte' })])
    render(<SearchScreen />)

    await user.click(screen.getByRole('button', { name: /café de la mañana/i }))

    expect(useMovimientoSheetStore.getState().viewId).toBe(target.id)
  })

  it('typing narrows results to matching movements (debounced)', async () => {
    const user = userEvent.setup()
    setReady([
      movimiento({ nota: 'Café de la mañana' }),
      movimiento({ nota: 'Uber al trabajo', categoria: 'cat_transporte' }),
    ])
    render(<SearchScreen />)

    await user.type(screen.getByRole('textbox', { name: /descripción o etiqueta/i }), 'uber')

    await waitFor(() => {
      expect(screen.queryByText('Café de la mañana')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Uber al trabajo')).toBeInTheDocument()
  })

  it('search is accent- and case-insensitive', async () => {
    const user = userEvent.setup()
    setReady([
      movimiento({ nota: 'Viaje en camión', categoria: 'cat_transporte' }),
      movimiento({ nota: 'Café de la mañana' }),
    ])
    render(<SearchScreen />)

    await user.type(screen.getByRole('textbox', { name: /descripción o etiqueta/i }), 'CAMION')

    await waitFor(() => {
      expect(screen.queryByText('Café de la mañana')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Viaje en camión')).toBeInTheDocument()
  })

  it('matches a movement by its resolved category name, not the raw category id', async () => {
    const user = userEvent.setup()
    setReady([
      movimiento({ nota: 'Almuerzo', categoria: 'cat_comida' }),
      movimiento({ nota: 'Uber al trabajo', categoria: 'cat_transporte' }),
    ])
    render(<SearchScreen />)

    await user.type(screen.getByRole('textbox', { name: /descripción o etiqueta/i }), 'comida')

    await waitFor(() => {
      expect(screen.queryByText('Uber al trabajo')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Almuerzo')).toBeInTheDocument()
  })

  it('the "no results" message names the query that actually produced zero results, not one still pending debounce', async () => {
    const user = userEvent.setup()
    setReady([movimiento({ nota: 'Café de la mañana' })])
    render(<SearchScreen />)

    const input = screen.getByRole('textbox', { name: /descripción o etiqueta/i })
    await user.type(input, 'zzz')
    await waitFor(() => {
      expect(screen.getByText('No encontramos "zzz"')).toBeInTheDocument()
    })

    await user.type(input, 'q')
    expect(screen.getByText('No encontramos "zzz"')).toBeInTheDocument()
    expect(screen.queryByText('No encontramos "zzzq"')).not.toBeInTheDocument()
  })

  it('shows "no results" (not "no data") when a query matches nothing, and clearing restores the list', async () => {
    const user = userEvent.setup()
    setReady([movimiento({ nota: 'Café de la mañana' })])
    render(<SearchScreen />)

    const input = screen.getByRole('textbox', { name: /descripción o etiqueta/i })
    await user.type(input, 'xyz-no-match')

    await waitFor(() => {
      expect(screen.getByText(/sin resultados/i)).toBeInTheDocument()
    })
    expect(screen.queryByText(/aún no tienes movimientos/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /borrar búsqueda/i }))

    expect(screen.getByText('Café de la mañana')).toBeInTheDocument()
  })

  it('the type filter narrows to one tipo and combines with the tag filter', async () => {
    const user = userEvent.setup()
    setReady([
      movimiento({ nota: 'Café de la mañana', categoria: 'cat_comida', tipo: 'gasto' }),
      movimiento({ nota: 'Uber al trabajo', categoria: 'cat_transporte', tipo: 'gasto' }),
      movimiento({ nota: 'Sueldo de agosto', categoria: 'cat_sueldo', tipo: 'ingreso' }),
    ])
    render(<SearchScreen />)

    await user.click(screen.getByRole('button', { name: /^filtros$/i }))
    const dialog = screen.getByRole('dialog')

    await user.click(within(dialog).getByRole('radio', { name: /gastos/i }))
    await user.click(within(dialog).getByRole('button', { name: 'Comida' }))
    await user.click(within(dialog).getByRole('button', { name: /^ver \d+ resultados?$/i }))

    expect(screen.getByText('Café de la mañana')).toBeInTheDocument()
    expect(screen.queryByText('Uber al trabajo')).not.toBeInTheDocument()
    expect(screen.queryByText('Sueldo de agosto')).not.toBeInTheDocument()
  })

  it('the active tag chip shows the category name, never the raw category id', async () => {
    const user = userEvent.setup()
    setReady([movimiento({ nota: 'Café de la mañana', categoria: 'cat_comida' })])
    render(<SearchScreen />)

    await user.click(screen.getByRole('button', { name: /^filtros$/i }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Comida' }))
    await user.click(within(dialog).getByRole('button', { name: /^ver \d+ resultados?$/i }))

    expect(screen.getByRole('button', { name: 'Comida' })).toBeInTheDocument()
    expect(screen.queryByText('cat_comida')).not.toBeInTheDocument()
  })

  it('the date range preset narrows to movements inside the range', async () => {
    const user = userEvent.setup()
    setReady([
      movimiento({ nota: 'Compra reciente', fecha: today() }),
      movimiento({ nota: 'Compra vieja', fecha: daysAgo(40) }),
    ])
    render(<SearchScreen />)

    await user.click(screen.getByRole('button', { name: /^filtros$/i }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /últimos 7 días/i }))
    await user.click(within(dialog).getByRole('button', { name: /^ver \d+ resultados?$/i }))

    expect(screen.getByText('Compra reciente')).toBeInTheDocument()
    expect(screen.queryByText('Compra vieja')).not.toBeInTheDocument()
  })

  it('shows an active filter chip that removes that one filter when tapped', async () => {
    const user = userEvent.setup()
    setReady([
      movimiento({ nota: 'Café de la mañana', tipo: 'gasto' }),
      movimiento({ nota: 'Sueldo de agosto', categoria: 'cat_sueldo', tipo: 'ingreso' }),
    ])
    render(<SearchScreen />)

    await user.click(screen.getByRole('button', { name: /^filtros$/i }))
    await user.click(within(screen.getByRole('dialog')).getByRole('radio', { name: /ingresos/i }))
    await user.keyboard('{Escape}')

    expect(screen.queryByText('Café de la mañana')).not.toBeInTheDocument()
    const chip = screen.getByRole('button', { name: /ingresos/i })

    await user.click(chip)

    expect(screen.getByText('Café de la mañana')).toBeInTheDocument()
  })

  it('the clear-search button meets the 44px touch-target floor without inflating the visible circle', async () => {
    const user = userEvent.setup()
    setReady([movimiento({ nota: 'Café de la mañana' })])
    render(<SearchScreen />)

    await user.type(screen.getByRole('textbox', { name: /descripción o etiqueta/i }), 'c')

    const button = screen.getByRole('button', { name: /borrar búsqueda/i })
    expect(button).toHaveClass('min-h-11')
    expect(button).toHaveClass('min-w-11')
    expect(button.firstElementChild).toHaveClass('size-6')
  })

  it('an active filter chip meets the 44px touch-target floor without inflating the visible pill', async () => {
    const user = userEvent.setup()
    setReady([movimiento({ nota: 'Café de la mañana', tipo: 'gasto' })])
    render(<SearchScreen />)

    await user.click(screen.getByRole('button', { name: /^filtros$/i }))
    await user.click(within(screen.getByRole('dialog')).getByRole('radio', { name: /gastos/i }))
    await user.keyboard('{Escape}')

    const chip = screen.getByRole('button', { name: /gastos/i })
    expect(chip).toHaveClass('min-h-11')
    expect(chip.firstElementChild).toHaveClass('h-9')
  })

  it('"Limpiar" in the filter sheet clears every filter and restores the full list', async () => {
    const user = userEvent.setup()
    setReady([
      movimiento({ nota: 'Café de la mañana', tipo: 'gasto' }),
      movimiento({ nota: 'Sueldo de agosto', categoria: 'cat_sueldo', tipo: 'ingreso' }),
    ])
    render(<SearchScreen />)

    await user.click(screen.getByRole('button', { name: /^filtros$/i }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('radio', { name: /ingresos/i }))
    expect(screen.queryByText('Café de la mañana')).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /^limpiar$/i }))

    expect(screen.getByText('Café de la mañana')).toBeInTheDocument()
    expect(screen.getByText('Sueldo de agosto')).toBeInTheDocument()
  })

  it('renders money and date labels together in the locale passed by the caller', async () => {
    await i18next.changeLanguage('en')
    setReady([movimiento({ nota: 'Coffee', monto: 1999, moneda: 'USD', fecha: '2026-08-10' })])
    render(<SearchScreen />)

    expect(screen.getByText('10 Aug')).toBeInTheDocument()
    expect(screen.getByText('$-1,999.00')).toBeInTheDocument()

    await i18next.changeLanguage('es')
  })
})
