import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { BottomNav } from '@/components/shared/BottomNav'

describe('BottomNav', () => {
  it('marks the tab matching the current route active via aria-current', () => {
    render(
      <MemoryRouter initialEntries={['/history']}>
        <BottomNav />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /historial/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /inicio/i })).not.toHaveAttribute('aria-current')
  })

  it('renders the centre Add button and the Profile slot as disabled stubs, not dead-but-enabled controls', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <BottomNav />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: /agregar/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /perfil/i })).toBeDisabled()
  })

  it('links Inicio/Historial/Buscar to their real routes', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <BottomNav />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /inicio/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /historial/i })).toHaveAttribute('href', '/history')
    expect(screen.getByRole('link', { name: /buscar/i })).toHaveAttribute('href', '/search')
  })
})
