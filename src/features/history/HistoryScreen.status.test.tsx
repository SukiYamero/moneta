import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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

  it('shows an error message when status is error', () => {
    mockStore({ status: 'error', error: 'unknown' })
    render(<HistoryScreen />)
    expect(screen.getByRole('status')).toHaveTextContent('No pudimos cargar')
  })

  it('calls load() on mount', () => {
    const load = vi.fn()
    mockStore({ status: 'idle', load })
    render(<HistoryScreen />)
    expect(load).toHaveBeenCalled()
  })
})
