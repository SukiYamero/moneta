import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { endOfWeek, format, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { useDataStore } from '@/lib/dataStore'
import { CONFIG_SEMILLA } from '@/lib/schema'
import { HistoryScreen } from '@/features/history/HistoryScreen'

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

  it('shows an error message with role="alert" when status is error', () => {
    mockStore({ status: 'error', error: 'unknown' })
    render(<HistoryScreen />)
    expect(screen.getByRole('alert')).toHaveTextContent('Ocurrió un error inesperado')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

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

    expect(screen.getByRole('radio', { name: 'Día' })).toBeChecked()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
