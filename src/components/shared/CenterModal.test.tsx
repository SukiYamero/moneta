import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
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

  describe('viewport-safe positioning', () => {
    // A minimal, real `EventTarget` — close enough to `VisualViewport` for
    // `addEventListener`/`dispatchEvent` to behave like the browser API
    // `useVisualViewportInset` subscribes to.
    class FakeVisualViewport extends EventTarget {
      offsetTop = 0
      height = document.documentElement.clientHeight
    }

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('leaves the wrapper/panel unstyled and unbounded-by-inline-style when the visual viewport matches the layout viewport', () => {
      vi.stubGlobal('visualViewport', new FakeVisualViewport())
      render(<Harness open onClose={() => {}} />)

      const dialog = screen.getByRole('dialog')
      const wrapper = dialog.parentElement as HTMLElement

      expect(wrapper.style.top).toBe('')
      expect(wrapper.style.height).toBe('')
      expect(dialog.style.maxHeight).toBe('')
      // Still bounded/scrollable by its own static class even with no
      // keyboard involved — previously unbounded at any height
      // (specs.md §10.49).
      expect(dialog).toHaveClass('max-h-[88dvh]', 'overflow-y-auto')
    })

    it('pins the wrapper to the real visible area (re-centering the modal) and clamps the panel once the keyboard shrinks it', () => {
      const viewport = new FakeVisualViewport()
      vi.stubGlobal('visualViewport', viewport)
      render(<Harness open onClose={() => {}} />)

      const dialog = screen.getByRole('dialog')
      const wrapper = dialog.parentElement as HTMLElement

      act(() => {
        viewport.offsetTop = 80
        viewport.height = 350
        viewport.dispatchEvent(new Event('resize'))
      })

      expect(wrapper.style.top).toBe('80px')
      expect(wrapper.style.height).toBe('350px')
      expect(dialog.style.maxHeight).toBe(`${350 * 0.88}px`)
    })

    it('never shrinks the backdrop along with the keyboard-safe wrapper', () => {
      // Same shared bug as BottomSheet's own regression test: the backdrop
      // used to be nested inside the wrapper it now sits beside, so it
      // shrank along with the keyboard-safe correction and let whatever
      // sits behind (BottomNav included) show through the strip the
      // wrapper no longer covers (cross-track review, specs.md §10.49).
      const viewport = new FakeVisualViewport()
      vi.stubGlobal('visualViewport', viewport)
      render(<Harness open onClose={() => {}} />)

      const dialog = screen.getByRole('dialog')
      const wrapper = dialog.parentElement as HTMLElement
      const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement

      act(() => {
        viewport.offsetTop = 80
        viewport.height = 350
        viewport.dispatchEvent(new Event('resize'))
      })

      expect(wrapper.contains(backdrop)).toBe(false)
      expect(backdrop.style.top).toBe('')
      expect(backdrop.style.height).toBe('')
    })
  })
})
