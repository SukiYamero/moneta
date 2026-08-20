import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
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

describe('PreferencesSection', () => {
  it('shows an em dash for every row until Config has loaded', () => {
    useDataStore.setState({ config: null })
    render(<PreferencesSection />)
    expect(screen.getAllByText('—')).toHaveLength(3)
  })

  it('renders the current tema/moneda/primer día values, translated', () => {
    useDataStore.setState({
      config: config({ tema: 'oscuro', monedaPrincipal: 'USD', primerDiaSemana: 0 }),
    })
    render(<PreferencesSection />)
    expect(screen.getByText('Oscuro')).toBeInTheDocument()
    expect(screen.getByText('USD')).toBeInTheDocument()
    expect(screen.getByText('Domingo')).toBeInTheDocument()
  })

  it('shows the detected app language, not a Config field (idioma is not on Preferencias yet)', () => {
    useDataStore.setState({ config: config() })
    render(<PreferencesSection />)
    expect(screen.getByText('Español')).toBeInTheDocument()
  })

  it('renders every row as plain text, never as a tappable button — an honest stub, not a dead control', () => {
    useDataStore.setState({ config: config() })
    render(<PreferencesSection />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
