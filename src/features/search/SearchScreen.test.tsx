import { format, subDays } from 'date-fns'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/repoProvider', () => ({ getRepo: vi.fn() }))

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Config, Movimiento } from '@/lib/schema'
import { CONFIG_SEMILLA } from '@/lib/schema'
import type { Repo } from '@/lib/repo'
import { useDataStore } from '@/lib/dataStore'
import { getRepo } from '@/lib/repoProvider'
import { i18next } from '@/lib/i18n'
import { SearchScreen } from '@/features/search/SearchScreen'

const mGetRepo = vi.mocked(getRepo)

const movimiento = (overrides: Partial<Movimiento> = {}): Movimiento => ({
  id: crypto.randomUUID(),
  fecha: '2026-08-15',
  seccion: 'sec_personal',
  categoria: 'Comida',
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
    { id: 'cat_comida', nombre: 'Comida', seccionId: 'sec_personal', tipo: 'gasto' },
    { id: 'cat_transporte', nombre: 'Transporte', seccionId: 'sec_personal', tipo: 'gasto' },
  ],
}

const today = () => format(new Date(), 'yyyy-MM-dd')
const daysAgo = (n: number) => format(subDays(new Date(), n), 'yyyy-MM-dd')

const setReady = (movimientos: Movimiento[], config: Config = CONFIG) => {
  useDataStore.setState({ movimientos, activos: [], config, status: 'ready', error: null })
}

// Only needed by the "error" test — every other test presets status:'ready'
// (or a guard-blocking status), so the mount effect's own load() call never
// reaches getRepo() and this stub is irrelevant to them.
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

  // AppShell's scroll pane already reserves --bottom-nav-clearance for
  // every routed screen (docs/wave-2/review-l.md finding 1) — a second copy
  // here would double the clearance under the nav on this one screen.
  it("does not duplicate the shell's --bottom-nav-clearance padding on its own <main>", () => {
    setReady([])
    const { container } = render(<SearchScreen />)
    expect(container.querySelector('main')?.className).not.toMatch(/bottom-nav-clearance/)
  })

  it('shows a loading state while the data store is not ready', () => {
    useDataStore.setState({ status: 'loading' })
    render(<SearchScreen />)
    expect(screen.getByText(/cargando/i)).toBeInTheDocument()
  })

  it('shows an inline error with a retry action when the load failed', async () => {
    const user = userEvent.setup()
    // SearchScreen calls dataStore.load() unconditionally on mount, and the
    // store retries whenever status isn't already 'loading'/'ready' — so a
    // real (mocked) repo failure is what actually drives the error state,
    // not a directly-set 'error' status (which the mount effect would
    // immediately overwrite by retrying for real).
    mGetRepo.mockReturnValue(makeRepo({ readyError: new Error('boom') }))
    render(<SearchScreen />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/no pudimos cargar/i)
    })

    mGetRepo.mockReturnValue(makeRepo())
    await user.click(screen.getByRole('button', { name: /reintentar/i }))

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
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
      movimiento({ nota: 'Uber al trabajo', categoria: 'Transporte' }),
    ])
    render(<SearchScreen />)
    expect(screen.getByText('Café de la mañana')).toBeInTheDocument()
    expect(screen.getByText('Uber al trabajo')).toBeInTheDocument()
  })

  it('typing narrows results to matching movements (debounced)', async () => {
    const user = userEvent.setup()
    setReady([
      movimiento({ nota: 'Café de la mañana' }),
      movimiento({ nota: 'Uber al trabajo', categoria: 'Transporte' }),
    ])
    render(<SearchScreen />)

    await user.type(screen.getByRole('textbox', { name: /descripción o etiqueta/i }), 'uber')

    await waitFor(() => {
      expect(screen.queryByText('Café de la mañana')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Uber al trabajo')).toBeInTheDocument()
  })

  // The exact case the track brief calls out: a Spanish app where "camion"
  // doesn't find "camión" is broken.
  it('search is accent- and case-insensitive', async () => {
    const user = userEvent.setup()
    setReady([
      movimiento({ nota: 'Viaje en camión', categoria: 'Transporte' }),
      movimiento({ nota: 'Café de la mañana' }),
    ])
    render(<SearchScreen />)

    await user.type(screen.getByRole('textbox', { name: /descripción o etiqueta/i }), 'CAMION')

    await waitFor(() => {
      expect(screen.queryByText('Café de la mañana')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Viaje en camión')).toBeInTheDocument()
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

    // Typed further immediately after, with no await in between: the
    // committed (debounced) query driving the actual filter is still
    // "zzz" for at least this tick, so the message must keep naming "zzz"
    // — not "zzzq", which was never actually searched yet.
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

    // Clearing bypasses the debounce entirely (useDebouncedQuery) — no wait needed.
    expect(screen.getByText('Café de la mañana')).toBeInTheDocument()
  })

  it('the type filter narrows to one tipo and combines with the tag filter', async () => {
    const user = userEvent.setup()
    setReady([
      movimiento({ nota: 'Café de la mañana', categoria: 'Comida', tipo: 'gasto' }),
      movimiento({ nota: 'Uber al trabajo', categoria: 'Transporte', tipo: 'gasto' }),
      movimiento({ nota: 'Sueldo de agosto', categoria: 'Sueldo', tipo: 'ingreso' }),
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
      movimiento({ nota: 'Sueldo de agosto', categoria: 'Sueldo', tipo: 'ingreso' }),
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

  // AGENTS.md § UI: touch targets ≥ 44px. specs.md §10.5.1 fixed this exact
  // shape (a small visible icon/pill as the whole button, no invisible
  // 44px hit-area padding) on TagChip/SegmentedControl/DateChipPicker —
  // sweeping this track's own screen for the same shape.
  it('the clear-search button meets the 44px touch-target floor without inflating the visible circle', async () => {
    const user = userEvent.setup()
    setReady([movimiento({ nota: 'Café de la mañana' })])
    render(<SearchScreen />)

    await user.type(screen.getByRole('textbox', { name: /descripción o etiqueta/i }), 'c')

    const button = screen.getByRole('button', { name: /borrar búsqueda/i })
    expect(button).toHaveClass('min-h-11')
    expect(button).toHaveClass('min-w-11')
    // the visible circle (background) lives on an inner element at its
    // original, smaller designed size — only the button's hit area grows.
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
      movimiento({ nota: 'Sueldo de agosto', categoria: 'Sueldo', tipo: 'ingreso' }),
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

  // The Done-when guarantee (docs/wave-2/track-m.md): switching locale must
  // change the currency formatting AND the date labels together — a
  // translated screen still showing an es-CO amount next to a Spanish
  // month abbreviation would be a half-translated screen, worse than the
  // original all-Spanish bug.
  it('renders money and date labels together in the locale passed by the caller', async () => {
    await i18next.changeLanguage('en')
    setReady([movimiento({ nota: 'Coffee', monto: 1999, moneda: 'USD', fecha: '2026-08-10' })])
    render(<SearchScreen />)

    expect(screen.getByText('10 Aug')).toBeInTheDocument()
    // The sign attaches to the number, not the currency (specs.md §10.7):
    // "$-1,999.00", not "-$1,999.00".
    expect(screen.getByText('$-1,999.00')).toBeInTheDocument()

    await i18next.changeLanguage('es')
  })
})
