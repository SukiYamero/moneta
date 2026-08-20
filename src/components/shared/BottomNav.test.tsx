import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { BottomNav } from '@/components/shared/BottomNav'

const renderNav = (profileOpen = false) => {
  const onOpenProfile = vi.fn()
  render(
    <MemoryRouter initialEntries={['/']}>
      <BottomNav profileOpen={profileOpen} onOpenProfile={onOpenProfile} />
    </MemoryRouter>,
  )
  return { onOpenProfile }
}

describe('BottomNav', () => {
  it('marks the tab matching the current route active via aria-current', () => {
    render(
      <MemoryRouter initialEntries={['/history']}>
        <BottomNav profileOpen={false} onOpenProfile={() => {}} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /historial/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /inicio/i })).not.toHaveAttribute('aria-current')
  })

  it('renders the centre Add button as a disabled stub, not a dead-but-enabled control', () => {
    renderNav()
    expect(screen.getByRole('button', { name: /agregar/i })).toBeDisabled()
  })

  // The Profile slot opens the real profile sheet now (specs.md §10.18) —
  // it is no longer the disabled stub Wave 2 shipped.
  it('calls onOpenProfile when the Profile button is tapped', async () => {
    const user = userEvent.setup()
    const { onOpenProfile } = renderNav()
    const profileButton = screen.getByRole('button', { name: /perfil/i })
    expect(profileButton).not.toBeDisabled()
    await user.click(profileButton)
    expect(onOpenProfile).toHaveBeenCalledOnce()
  })

  it('reflects profileOpen in aria-expanded and the active tint', () => {
    renderNav(true)
    const profileButton = screen.getByRole('button', { name: /perfil/i })
    expect(profileButton).toHaveAttribute('aria-expanded', 'true')
    expect(profileButton.querySelector('svg')).toHaveClass('text-primary')
  })

  it('links Inicio/Historial/Buscar to their real routes', () => {
    renderNav()
    expect(screen.getByRole('link', { name: /inicio/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /historial/i })).toHaveAttribute('href', '/history')
    expect(screen.getByRole('link', { name: /buscar/i })).toHaveAttribute('href', '/search')
  })
})
