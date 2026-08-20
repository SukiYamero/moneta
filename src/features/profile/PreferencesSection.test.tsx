import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { useDataStore } from '@/lib/dataStore'
import type { Config } from '@/lib/schema'
import { PreferencesSection } from '@/features/profile/PreferencesSection'

const config = (overrides: Partial<Config['preferencias']> = {}): Config => ({
  schemaVersion: 1,
  secciones: [],
  categorias: [],
  preferencias: {
    tema: 'sistema',
    monedaPrincipal: 'COP',
    primerDiaSemana: 1,
    ...overrides,
  },
})

const renderSection = () => render(<PreferencesSection />, { wrapper: MemoryRouter })

describe('PreferencesSection', () => {
  it('shows an em dash for currency/weekStart until Config has loaded', () => {
    useDataStore.setState({ config: null })
    renderSection()
    expect(screen.getAllByText('—')).toHaveLength(2)
  })

  it('renders the current moneda/primer día values, translated', () => {
    useDataStore.setState({ config: config({ monedaPrincipal: 'USD', primerDiaSemana: 0 }) })
    renderSection()
    expect(screen.getByText('USD')).toBeInTheDocument()
    expect(screen.getByText('Domingo')).toBeInTheDocument()
  })

  it('shows the stored idioma label when one is set', () => {
    useDataStore.setState({ config: config({ idioma: 'en' }) })
    renderSection()
    expect(screen.getByText('English')).toBeInTheDocument()
  })

  it('falls back to the detected app language when idioma is not stored', () => {
    useDataStore.setState({ config: config() })
    renderSection()
    expect(screen.getByText('Español')).toBeInTheDocument()
  })

  // Prerequisite 3 (specs.md §10.24): `index.html` hardcodes dark, so the
  // row must never repeat a stored `tema` that has no effect — it always
  // reads "Oscuro", even for a config seeded with a different value.
  it('always shows the theme as Oscuro, regardless of the stored tema — the app has no light palette yet', () => {
    useDataStore.setState({ config: config({ tema: 'claro' }) })
    renderSection()
    expect(screen.getByText('Oscuro')).toBeInTheDocument()
  })

  it('makes currency/weekStart/idioma real links into /settings — the entry point', () => {
    useDataStore.setState({ config: config() })
    renderSection()
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(3)
    for (const link of links) expect(link).toHaveAttribute('href', '/settings')
  })

  it('keeps the theme row plain text — an honest stub, not a dead control', () => {
    useDataStore.setState({ config: config() })
    renderSection()
    expect(screen.getByText('Tema').closest('a, button')).toBeNull()
  })
})
