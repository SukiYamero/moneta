import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { useDataStore } from '@/lib/dataStore'
import { CONFIG_SEMILLA } from '@/lib/schema'

// A dedicated mock, same shape HistoryScreen.status.test.tsx uses — this
// file is about SettingsScreen's own orchestration (loading/error/back),
// not CategoriesSection's/PreferencesEditor's own behavior, which each
// have their own test file.
vi.mock('@/lib/dataStore', () => ({ useDataStore: vi.fn() }))
vi.mock('@/features/settings/CategoriesSection', () => ({
  CategoriesSection: () => <div>categories section</div>,
}))
vi.mock('@/features/settings/PreferencesEditor', () => ({
  PreferencesEditor: () => <div>preferences editor</div>,
}))

const mockNavigate = vi.fn()
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => mockNavigate,
}))

import { SettingsScreen } from '@/features/settings/SettingsScreen'

const mockStore = (overrides: Partial<ReturnType<typeof useDataStore>>) => {
  vi.mocked(useDataStore).mockReturnValue({
    movimientos: [],
    activos: [],
    config: null,
    status: 'idle',
    error: null,
    load: vi.fn(),
    updateConfig: vi.fn(),
    ...overrides,
  })
}

const renderScreen = () => render(<SettingsScreen />, { wrapper: MemoryRouter })

describe('SettingsScreen', () => {
  it('shows nothing yet immediately while status is loading, before the anti-flash delay elapses', () => {
    vi.useFakeTimers()
    mockStore({ status: 'loading' })
    renderScreen()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('shows a loading skeleton once the anti-flash delay elapses', () => {
    vi.useFakeTimers()
    mockStore({ status: 'loading' })
    renderScreen()
    act(() => vi.advanceTimersByTime(150))
    expect(screen.getByRole('status')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('shows an actionable error with a retry that calls load() again', async () => {
    const load = vi.fn()
    mockStore({ status: 'error', error: 'network', load })
    const user = userEvent.setup()
    renderScreen()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /reintentar/i }))
    expect(load).toHaveBeenCalled()
  })

  it('renders both sections once Config is ready', () => {
    mockStore({ status: 'ready', config: CONFIG_SEMILLA })
    renderScreen()
    expect(screen.getByText('categories section')).toBeInTheDocument()
    expect(screen.getByText('preferences editor')).toBeInTheDocument()
  })

  it('the back button navigates away', async () => {
    mockStore({ status: 'ready', config: CONFIG_SEMILLA })
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByRole('button', { name: /volver/i }))
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  // specs.md §12, 2026-08-20: `CategoriesSection`/`PreferencesEditor` reuse
  // `ProfileSectionHeading` — a hardcoded `<h3>` built for `ProfileSheet.tsx`,
  // where its own `<h2>` sits above it. Reused directly under this screen's
  // `<h1>`, that skips a level. Each section gets its own `<h2>` here
  // instead, so a real `<h3>` inside it (this file mocks both sections away,
  // so it can't see that `<h3>` — `CategoriesSection.test.tsx`/
  // `PreferencesEditor.test.tsx` own that) nests correctly.
  it('supplies an <h2> for each section, so the real heading below never skips a level', () => {
    mockStore({ status: 'ready', config: CONFIG_SEMILLA })
    renderScreen()
    const h1 = screen.getByRole('heading', { level: 1 })
    const h2s = screen.getAllByRole('heading', { level: 2 })
    expect(h1).toBeInTheDocument()
    expect(h2s).toHaveLength(2)
  })
})
