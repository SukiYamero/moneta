import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { endOfWeek, format, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { useDataStore } from '@/lib/dataStore'
import { CONFIG_SEMILLA } from '@/lib/schema'
import { HistoryScreen } from '@/features/history/HistoryScreen'

// A dedicated file so `vi.mock` (file-scoped) doesn't leak into
// HistoryScreen.test.tsx's real-repo integration tests — status rendering
// is the only thing under test here, decoupled from real load timing.
vi.mock('@/lib/dataStore', () => ({ useDataStore: vi.fn() }))

const mockStore = (overrides: Partial<ReturnType<typeof useDataStore>>) => {
  vi.mocked(useDataStore).mockReturnValue({
    movimientos: [],
    activos: [],
    config: null,
    status: 'idle',
    error: null,
    load: vi.fn(),
    ...overrides,
  })
}

describe('HistoryScreen status handling', () => {
  // Anti-flash gate (specs.md §10.9): a load fast enough to beat the
  // ~150ms show-delay must render nothing, not the skeleton immediately.
  it('shows nothing yet immediately while status is idle or loading, before the anti-flash delay elapses', () => {
    vi.useFakeTimers()
    mockStore({ status: 'loading' })
    render(<HistoryScreen />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('shows a loading message once the anti-flash delay elapses while status is still loading', () => {
    vi.useFakeTimers()
    mockStore({ status: 'loading' })
    render(<HistoryScreen />)
    act(() => vi.advanceTimersByTime(150))
    expect(screen.getByRole('status')).toHaveTextContent('Cargando')
    vi.useRealTimers()
  })

  it('shows an error message with role="alert" when status is error, per docs/error-handling.md §7', () => {
    mockStore({ status: 'error', error: 'unknown' })
    render(<HistoryScreen />)
    // specs.md §10.11: History now names the actual failure via the shared
    // repoErrorCopyKey table, not a generic per-screen string.
    expect(screen.getByRole('alert')).toHaveTextContent('Ocurrió un error inesperado')
    // A polite `role="status"` node must not exist alongside — Home/Search
    // don't render one for the error path either, and having both would
    // announce the same failure twice.
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  // The actual point of the move to a shared errorCopy table (specs.md
  // §10.11): a user with no connection is told that specifically, not the
  // same generic line every other failure shows.
  it('names a network failure specifically, not the generic fallback', () => {
    mockStore({ status: 'error', error: 'network' })
    render(<HistoryScreen />)
    expect(screen.getByRole('alert')).toHaveTextContent('No hay conexión')
  })

  it('offers a retry action on the error state that calls load() again', async () => {
    const user = userEvent.setup()
    const load = vi.fn()
    mockStore({ status: 'error', error: 'unknown', load })
    render(<HistoryScreen />)

    // load() already fired once on mount (the effect below); the retry
    // button must trigger a second call.
    load.mockClear()
    await user.click(screen.getByRole('button', { name: /reintentar/i }))
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('calls load() on mount', () => {
    const load = vi.fn()
    mockStore({ status: 'idle', load })
    render(<HistoryScreen />)
    expect(load).toHaveBeenCalled()
  })

  // Reproduces the risk named in the review brief: the always-mounted chrome
  // (period nav, picker strip) falls back to CONFIG_SEMILLA.preferencias
  // before `config` loads. `primerDiaSemana` only feeds the rendered header
  // in `semana` scope (movimientoStats.ts's `periodRange` ignores it for
  // `dia`/`mes`/`anio`), so switching to `semana` while `config` is still
  // `null` renders the week boundary CONFIG_SEMILLA assumes (Monday-start);
  // once the real config resolves with a different `primerDiaSemana`, the
  // header recomputes and the visible date range changes with no user
  // action beyond having loaded. `toFake: ['Date']` pins "today" without
  // faking `setTimeout` — the pairing that hangs with `user-event`
  // (specs.md §11, 2026-08-19) — mirroring HistoryScreen.test.tsx's own
  // pattern.
  it('recomputes the semana header once config resolves with a different primerDiaSemana than the CONFIG_SEMILLA fallback', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-19T12:00:00'))
    const user = userEvent.setup()
    const today = new Date()

    mockStore({ status: 'loading', config: null })
    const { rerender } = render(<HistoryScreen />)

    await user.click(screen.getByRole('radio', { name: 'Semana' }))

    const seedFrom = startOfWeek(today, {
      weekStartsOn: CONFIG_SEMILLA.preferencias.primerDiaSemana,
    })
    const seedTo = endOfWeek(today, { weekStartsOn: CONFIG_SEMILLA.preferencias.primerDiaSemana })
    // The header title and the picker strip's own selected chip both render
    // the range in the same "d–d MMM" shape — either match proves the chrome
    // used the seed default before config resolved.
    expect(
      screen.getAllByText(`${format(seedFrom, 'd')}–${format(seedTo, 'd MMM', { locale: es })}`),
    ).not.toHaveLength(0)

    mockStore({
      status: 'ready',
      config: {
        ...CONFIG_SEMILLA,
        preferencias: { ...CONFIG_SEMILLA.preferencias, primerDiaSemana: 0 },
      },
    })
    rerender(<HistoryScreen />)

    const realFrom = startOfWeek(today, { weekStartsOn: 0 })
    const realTo = endOfWeek(today, { weekStartsOn: 0 })
    expect(
      screen.getAllByText(`${format(realFrom, 'd')}–${format(realTo, 'd MMM', { locale: es })}`),
    ).not.toHaveLength(0)

    vi.useRealTimers()
  })
})
