import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useDataStore } from '@/lib/dataStore'
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
  it('shows a loading message while status is idle or loading', () => {
    mockStore({ status: 'loading' })
    render(<HistoryScreen />)
    expect(screen.getByRole('status')).toHaveTextContent('Cargando')
  })

  it('shows an error message with role="alert" when status is error, per docs/error-handling.md §7', () => {
    mockStore({ status: 'error', error: 'unknown' })
    render(<HistoryScreen />)
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar')
    // A polite `role="status"` node must not exist alongside — Home/Search
    // don't render one for the error path either, and having both would
    // announce the same failure twice.
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
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
})
