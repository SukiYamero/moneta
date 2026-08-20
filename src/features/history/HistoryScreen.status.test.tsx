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

  // Was a characterization of the specs.md §12 bug: with `config` still
  // null, the `semana` header rendered the week boundary CONFIG_SEMILLA
  // assumes and then visibly jumped once the real `primerDiaSemana`
  // resolved. Wave 4 stage-2 groundwork closed it (specs.md §10.24
  // Prerequisite 1) — the week-derived chrome now waits for `ready` instead
  // of guessing, so this asserts the fix rather than documenting the defect.
  // `toFake: ['Date']` pins "today" without faking `setTimeout` — the
  // pairing that hangs with `user-event` (specs.md §11, 2026-08-19).
  it('never renders a guessed week boundary before config resolves — it waits, then shows the real one', async () => {
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
    const seedRange = `${format(seedFrom, 'd')}–${format(seedTo, 'd MMM', { locale: es })}`

    // The seed's Monday-start week must never reach the screen: showing it and
    // then changing it is the defect, and a user cannot tell a guess from a fact.
    expect(screen.queryAllByText(seedRange)).toHaveLength(0)

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

  it('leaves the other scopes alone — only `semana` depends on primerDiaSemana', () => {
    mockStore({ status: 'loading', config: null })
    render(<HistoryScreen />)

    // `dia` is the default scope and `periodRange` ignores primerDiaSemana for
    // it, so its header renders immediately with no placeholder. The gate is
    // scoped to the one thing that can actually be wrong, not to the whole
    // screen (specs.md §10.9: no loader in front of work that finishes in ms).
    expect(screen.getByRole('radio', { name: 'Día' })).toBeChecked()
    // No placeholder in the header: `dia` does not depend on primerDiaSemana,
    // so its label is a fact from the moment it renders.
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
