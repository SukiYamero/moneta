import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/repoProvider', () => ({ getRepo: vi.fn() }))

import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import type { GoogleUser } from '@/lib/auth'
import type { Config, Movimiento } from '@/lib/schema'
import { CONFIG_SEMILLA } from '@/lib/schema'
import type { Repo } from '@/lib/repo'
import { RepoError } from '@/lib/repo'
import { getRepo } from '@/lib/repoProvider'
import { useDataStore } from '@/lib/dataStore'
import { useAuthStore } from '@/lib/authStore'
import { totals } from '@/lib/movimientoStats'
import { Home } from '@/routes/Home'

const mGetRepo = vi.mocked(getRepo)

const USER: GoogleUser = { email: 'alex@example.com', name: 'Alex Rivera' }

const movimiento = (overrides: Partial<Movimiento> = {}): Movimiento => ({
  id: crypto.randomUUID(),
  fecha: '2026-08-15',
  seccion: 'sec_personal',
  categoria: 'cat_sueldo',
  tipo: 'ingreso',
  monto: 1_000_000,
  moneda: 'COP',
  createdAt: '2026-08-15T00:00:00.000Z',
  ...overrides,
})

const makeRepo = (opts: {
  movimientos?: Movimiento[]
  config?: Config
  readyError?: unknown
}): Repo =>
  ({
    ready: vi.fn().mockImplementation(() => {
      if (opts.readyError) return Promise.reject(opts.readyError)
      return Promise.resolve()
    }),
    movimientos: { list: vi.fn().mockResolvedValue({ items: opts.movimientos ?? [] }) },
    activos: { list: vi.fn().mockResolvedValue({ items: [] }) },
    getConfig: vi.fn().mockResolvedValue(opts.config ?? CONFIG_SEMILLA),
    updateConfig: vi.fn(),
  }) as unknown as Repo

const renderHome = () => render(<Home />, { wrapper: MemoryRouter })

beforeEach(() => {
  vi.clearAllMocks()
  useDataStore.setState({ movimientos: [], activos: [], config: null, status: 'idle', error: null })
  useAuthStore.setState({ user: USER })
})

describe('Home', () => {
  it("renders the greeting as the screen's <h1>, naming the signed-in user", async () => {
    mGetRepo.mockReturnValue(makeRepo({}))
    renderHome()
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Alex Rivera')
  })

  // Anti-flash gate (specs.md §10.9): a load fast enough to beat the
  // ~150ms show-delay must render nothing, not the skeleton immediately.
  it('shows nothing yet immediately after mount, before the anti-flash delay elapses', () => {
    vi.useFakeTimers()
    mGetRepo.mockReturnValue(makeRepo({}))
    renderHome()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('shows a loading state once the anti-flash delay elapses while still loading', () => {
    vi.useFakeTimers()
    mGetRepo.mockReturnValue(makeRepo({}))
    renderHome()
    act(() => vi.advanceTimersByTime(150))
    expect(screen.getByRole('status')).toHaveTextContent(/cargando/i)
    vi.useRealTimers()
  })

  it('shows the empty state once ready with zero movimientos', async () => {
    mGetRepo.mockReturnValue(makeRepo({ movimientos: [] }))
    renderHome()
    expect(await screen.findByText('Aún no tienes movimientos')).toBeInTheDocument()
  })

  it('shows an inline, actionable error and lets the user retry', async () => {
    mGetRepo.mockReturnValue(makeRepo({ readyError: new RepoError('down', 'network') }))
    renderHome()

    expect(await screen.findByRole('alert')).toHaveTextContent(/no hay conexión/i)

    mGetRepo.mockReturnValue(makeRepo({ movimientos: [movimiento()] }))
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }))

    expect(await screen.findByText('Alex Rivera')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it("renders the balance card's total equal to movimientoStats.totals() for the same movimientos", async () => {
    const movimientos = [
      movimiento({ tipo: 'ingreso', monto: 2_000_000, fecha: '2026-01-05' }),
      movimiento({ tipo: 'gasto', monto: 350_000, fecha: '2026-03-10' }),
      movimiento({ tipo: 'gasto', monto: 12_345, fecha: '2020-01-01' }),
    ]
    mGetRepo.mockReturnValue(makeRepo({ movimientos }))
    renderHome()

    const expected = totals(movimientos)
    // Intl inserts a non-breaking space after the currency symbol; RTL's
    // default text normalizer collapses it to a regular one before
    // matching, so the expectation needs the same normalization.
    const balanceText = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' })
      .format(expected.balance)
      .replaceAll(' ', ' ')
    expect(await screen.findByText(balanceText)).toBeInTheDocument()
  })

  it('renders the recent movimientos list from real data, no hardcoded rows', async () => {
    mGetRepo.mockReturnValue(makeRepo({ movimientos: [movimiento({ nota: 'Café de prueba' })] }))
    renderHome()

    expect(await screen.findByText('Café de prueba')).toBeInTheDocument()
  })

  it('renders the Áreas banner as inert (disabled), not as a dead-looking link', async () => {
    mGetRepo.mockReturnValue(makeRepo({ movimientos: [movimiento()] }))
    renderHome()

    const areas = await screen.findByRole('button', { name: 'Áreas' })
    expect(areas).toBeDisabled()
  })
})
