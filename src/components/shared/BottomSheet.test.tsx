import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BottomSheet } from '@/components/shared/BottomSheet'

function Harness({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Panel de prueba">
      <button type="button">Primero</button>
      <button type="button">Segundo</button>
    </BottomSheet>
  )
}

describe('BottomSheet', () => {
  it('renders nothing when closed', () => {
    render(<Harness open={false} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders as a modal dialog when open', () => {
    render(<Harness open onClose={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: 'Panel de prueba' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('never draws a focus ring on the panel itself, even when it has no focusable children', async () => {
    // With no focusable content, useOverlay's fallback focuses the panel
    // (tabIndex={-1}) directly — that's the exact case that showed a bright
    // ring around the whole sheet (the global outline-ring/50 base style
    // painting :focus-visible on it), reading as a web modal instead of a
    // native sheet.
    render(
      <BottomSheet open onClose={() => {}} ariaLabel="Sheet sin contenido enfocable">
        <p>Solo texto, sin controles.</p>
      </BottomSheet>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Sheet sin contenido enfocable' })

    await vi.waitFor(() => {
      expect(dialog).toHaveFocus()
    })
    expect(dialog).toHaveClass('outline-hidden')
  })

  it('calls onClose when the backdrop is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness open onClose={onClose} />)

    // the backdrop is the sibling before the dialog panel, marked aria-hidden
    const backdrop = document.querySelector('[aria-hidden="true"]')
    expect(backdrop).not.toBeNull()
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

  it('moves initial focus inside the panel', async () => {
    render(<Harness open onClose={() => {}} />)

    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: 'Primero' })).toHaveFocus()
    })
  })

  it('restores focus to the trigger element on close', async () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'Abrir'
    document.body.appendChild(trigger)
    trigger.focus()

    const { rerender } = render(<Harness open onClose={() => {}} />)
    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: 'Primero' })).toHaveFocus()
    })

    rerender(<Harness open={false} onClose={() => {}} />)

    expect(trigger).toHaveFocus()
    trigger.remove()
  })
})
