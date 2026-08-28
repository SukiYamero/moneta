import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { useDataStore } from '@/lib/dataStore'
import type { Config } from '@/lib/schema'
import { PreferencesSection } from '@/features/profile/PreferencesSection'

const config = (overrides: Partial<Config['preferencias']> = {}): Config => ({
  schemaVersion: 2,
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
  it('shows an em dash for theme/currency/weekStart until Config has loaded', () => {
    useDataStore.setState({ config: null })
    renderSection()
    expect(screen.getAllByText('—')).toHaveLength(3)
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

  it('shows the stored tema, translated', () => {
    useDataStore.setState({ config: config({ tema: 'claro' }) })
    renderSection()
    expect(screen.getByText('Claro')).toBeInTheDocument()
  })

  it('makes tema/currency/weekStart/idioma real links into /settings — the entry point', () => {
    useDataStore.setState({ config: config() })
    renderSection()
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(4)
    for (const link of links) expect(link).toHaveAttribute('href', '/settings')
  })
})
