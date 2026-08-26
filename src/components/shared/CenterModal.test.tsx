import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CenterModal } from '@/components/shared/CenterModal'
import { OVERLAY_FIXED_LAYER_OPACITY_CLASS } from '@/components/shared/useVisualViewportInset'

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
    // With no focusable content, useOverlay's fallback focuses the panel
    // (tabIndex={-1}) itself, which would otherwise paint the global
    // :focus-visible ring around the whole modal.
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

  it('does not close when a click retargets onto the backdrop after the gesture began on the panel', () => {
    // A layout shift between pointerup and the browser's click dispatch can
    // land the click on the backdrop even though the gesture began on the
    // panel; dismissal must key off where the gesture began.
    const onClose = vi.fn()
    render(<Harness open onClose={onClose} />)
    const panelButton = screen.getByRole('button', { name: 'Cancelar' })
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement

    panelButton.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    panelButton.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on a click retargeted onto the backdrop when the gesture itself began on the backdrop', () => {
    const onClose = vi.fn()
    render(<Harness open onClose={onClose} />)
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement

    backdrop.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    backdrop.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }))

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
      // The backdrop must stay outside the wrapper's subtree, or it shrinks
      // along with it and lets whatever sits behind (BottomNav included)
      // show through the uncovered strip.
      const viewport = new FakeVisualViewport()
      vi.stubGlobal('visualViewport', viewport)
      render(<Harness open onClose={() => {}} />)

      const dialog = screen.getByRole('dialog')
      const wrapper = dialog.parentElement as HTMLElement
      const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement
      const backdropTopBeforeResize = backdrop.style.top

      act(() => {
        viewport.offsetTop = 80
        viewport.height = 350
        viewport.dispatchEvent(new Event('resize'))
      })

      // The backdrop's own inline `top` (its static overscan) is never
      // touched by the viewport-inset hook.
      expect(wrapper.contains(backdrop)).toBe(false)
      expect(backdrop.style.top).toBe(backdropTopBeforeResize)
      expect(backdrop.style.height).toBe('')
    })
  })

  describe('backdrop overscan — uncoverable regardless of pan/shrink', () => {
    it('extends the backdrop past every edge of the layout viewport, not just inset-0', () => {
      render(<Harness open onClose={() => {}} />)
      const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement

      expect(backdrop.className).toMatch(/(^|\s)fixed(\s|$)/)
      expect(backdrop.className).not.toMatch(/inset-0/)
      expect(backdrop.style.top).toBe('-50dvh')
      expect(backdrop.style.bottom).toBe('-50dvh')
      expect(backdrop.style.left).toBe('-50dvw')
      expect(backdrop.style.right).toBe('-50dvw')
    })
  })

  describe('fixed-layer opacity escape hatch (real iOS Safari 26 compositing bug)', () => {
    it('gives the backdrop, wrapper and panel a real opacity below 1, not just an alpha-blended fill', () => {
      render(<Harness open onClose={() => {}} />)
      const dialog = screen.getByRole('dialog')
      const wrapper = dialog.parentElement as HTMLElement
      const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement

      expect(backdrop.className).toMatch(
        new RegExp(`(^|\\s)${OVERLAY_FIXED_LAYER_OPACITY_CLASS}(\\s|$)`),
      )
      expect(wrapper.className).toMatch(
        new RegExp(`(^|\\s)${OVERLAY_FIXED_LAYER_OPACITY_CLASS}(\\s|$)`),
      )
      expect(dialog.className).toMatch(
        new RegExp(`(^|\\s)${OVERLAY_FIXED_LAYER_OPACITY_CLASS}(\\s|$)`),
      )
    })
  })
})
