import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CenterModal } from '@/components/shared/CenterModal'

const Harness = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  return (
    <CenterModal open={open} onClose={onClose} ariaLabel="Confirmación de prueba">
      <button type="button">Cancelar</button>
      <button type="button">Confirmar</button>
    </CenterModal>
  )
}

describe('CenterModal', () => {
  it('renders nothing when closed', () => {
    render(<Harness open={false} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders as a modal dialog when open', () => {
    render(<Harness open onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Confirmación de prueba' })).toHaveAttribute(
      'aria-modal',
      'true',
    )
  })

  it('never draws a focus ring on the panel itself, even when it has no focusable children', async () => {
    // Same fix as BottomSheet, applied at the shared useOverlay seam: with no
    // focusable content the fallback focuses the panel (tabIndex={-1})
    // directly, and the global outline-ring/50 base style must not paint a
    // ring on it.
    render(
      <CenterModal open onClose={() => {}} ariaLabel="Modal sin contenido enfocable">
        <p>Solo texto, sin controles.</p>
      </CenterModal>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Modal sin contenido enfocable' })

    await vi.waitFor(() => {
      expect(dialog).toHaveFocus()
    })
    expect(dialog).toHaveClass('outline-hidden')
  })

  it('calls onClose when the backdrop is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness open onClose={onClose} />)

    const backdrop = document.querySelector('[aria-hidden="true"]')
    await user.click(backdrop as Element)

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose on Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness open onClose={onClose} />)

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('traps Tab focus within the panel', async () => {
    const user = userEvent.setup()
    render(<Harness open onClose={() => {}} />)

    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    })

    await user.tab()
    expect(screen.getByRole('button', { name: 'Confirmar' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  })
})
