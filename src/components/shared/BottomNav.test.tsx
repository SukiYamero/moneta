import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { BottomNav } from '@/components/shared/BottomNav'
import { BottomSheet } from '@/components/shared/BottomSheet'

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

// BottomNav must not paint while *any* overlay is open — read from the
// shared `useOverlay` stack (`useHasOpenOverlay`), not a local
// `addOpen || profileOpen` check that would miss every other sheet (filter,
// tag picker, category modal, anything future).
describe('BottomNav — hides while any overlay is open, without unmounting', () => {
  it('applies opacity-0/pointer-events-none while an unrelated BottomSheet elsewhere is open, and stays interactive again once it closes — never unmounting', async () => {
    const user = userEvent.setup()

    const Wrapper = () => {
      const [open, setOpen] = useState(false)
      return (
        <MemoryRouter initialEntries={['/']}>
          <BottomNav
            profileOpen={false}
            onOpenProfile={() => {}}
            addOpen={false}
            onOpenAdd={() => {}}
          />
          <button type="button" onClick={() => setOpen(true)}>
            Abrir otro sheet
          </button>
          <BottomSheet open={open} onClose={() => setOpen(false)} ariaLabel="Otro sheet">
            <button type="button" onClick={() => setOpen(false)}>
              Cerrar
            </button>
          </BottomSheet>
        </MemoryRouter>
      )
    }

    render(<Wrapper />)
    const nav = screen.getByRole('navigation')
    expect(nav.className).not.toMatch(/opacity-0/)

    await user.click(screen.getByRole('button', { name: 'Abrir otro sheet' }))
    await vi.waitFor(() => expect(nav.className).toMatch(/opacity-0/))
    expect(nav.className).toMatch(/pointer-events-none/)
    // Still mounted — not conditionally rendered away — so it can still
    // receive focus back once the overlay that hid it closes.
    expect(screen.getByRole('button', { name: /agregar/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    await vi.waitFor(() => expect(nav.className).not.toMatch(/opacity-0/))
    expect(nav.className).not.toMatch(/pointer-events-none/)
  })

  it('restores focus to the FAB that opened the sheet, even though BottomNav was hidden the whole time it was open', async () => {
    const user = userEvent.setup()

    const Wrapper = () => {
      const [open, setOpen] = useState(false)
      return (
        <MemoryRouter initialEntries={['/']}>
          <BottomNav
            profileOpen={false}
            onOpenProfile={() => {}}
            addOpen={open}
            onOpenAdd={() => setOpen(true)}
          />
          <BottomSheet open={open} onClose={() => setOpen(false)} ariaLabel="Agregar movimiento">
            <button type="button" onClick={() => setOpen(false)}>
              Cerrar
            </button>
          </BottomSheet>
        </MemoryRouter>
      )
    }

    render(<Wrapper />)
    const fab = screen.getByRole('button', { name: /agregar/i })

    await user.click(fab)
    await vi.waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    await vi.waitFor(() => expect(fab).toHaveFocus())
  })
})
