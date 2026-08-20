import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { BottomNav } from '@/components/shared/BottomNav'

const renderNav = (profileOpen = false, addOpen = false) => {
  const onOpenProfile = vi.fn()
  const onOpenAdd = vi.fn()
  render(
    <MemoryRouter initialEntries={['/']}>
      <BottomNav
        profileOpen={profileOpen}
        onOpenProfile={onOpenProfile}
        addOpen={addOpen}
        onOpenAdd={onOpenAdd}
      />
    </MemoryRouter>,
  )
  return { onOpenProfile, onOpenAdd }
}

describe('BottomNav', () => {
  it('marks the tab matching the current route active via aria-current', () => {
    render(
      <MemoryRouter initialEntries={['/history']}>
        <BottomNav
          profileOpen={false}
          onOpenProfile={() => {}}
          addOpen={false}
          onOpenAdd={() => {}}
        />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /historial/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /inicio/i })).not.toHaveAttribute('aria-current')
  })

  // The Add slot opens the real Add-movimiento sheet now (specs.md
  // §10.23) — it is no longer the disabled stub Wave 3 shipped.
  it('calls onOpenAdd when the Add button is tapped', async () => {
    const user = userEvent.setup()
    const { onOpenAdd } = renderNav()
    const addButton = screen.getByRole('button', { name: /agregar/i })
    expect(addButton).not.toBeDisabled()
    await user.click(addButton)
    expect(onOpenAdd).toHaveBeenCalledOnce()
  })

  it('reflects addOpen in aria-expanded', () => {
    renderNav(false, true)
    expect(screen.getByRole('button', { name: /agregar/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
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
