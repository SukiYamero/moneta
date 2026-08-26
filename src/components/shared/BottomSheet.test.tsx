import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BottomSheet } from '@/components/shared/BottomSheet'
import { OVERLAY_FIXED_LAYER_OPACITY_CLASS } from '@/components/shared/useVisualViewportInset'

const Harness = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
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

  it('keeps the grab handle outside the scrollable content box', () => {
    // The handle is fixed chrome, a sibling of the scrolling body — never
    // inside it, or scrolling the body drags the handle away with it.
    render(<Harness open onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    const handle = dialog.firstElementChild as HTMLElement
    const scrollBox = dialog.querySelector('.overflow-y-auto') as HTMLElement

    expect(scrollBox).not.toBeNull()
    expect(scrollBox).not.toBe(dialog)
    expect(scrollBox.contains(handle)).toBe(false)
  })

  it('never draws a focus ring on the panel itself, even when it has no focusable children', async () => {
    // With no focusable content, useOverlay's fallback focuses the panel
    // (tabIndex={-1}) itself, which would otherwise paint the global
    // :focus-visible ring around the whole sheet.
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

  it('does not close when a click retargets onto the backdrop after the gesture began on the panel', () => {
    // Content shrinking under a tap (e.g. the amount pad collapsing) can
    // move a `click` onto the backdrop even though pointerdown/pointerup
    // both hit the panel; dismissal must key off where the gesture began.
    const onClose = vi.fn()
    render(<Harness open onClose={onClose} />)
    const panelButton = screen.getByRole('button', { name: 'Primero' })
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

  it('moves initial focus inside the panel', async () => {
    render(<Harness open onClose={() => {}} />)

    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: 'Primero' })).toHaveFocus()
    })
  })

  it('restores focus to the trigger element on close', async () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'Abrir'
    document.body.append(trigger)
    trigger.focus()

    const { rerender } = render(<Harness open onClose={() => {}} />)
    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: 'Primero' })).toHaveFocus()
    })

    rerender(<Harness open={false} onClose={() => {}} />)

    expect(trigger).toHaveFocus()
    trigger.remove()
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

    it('leaves the wrapper/panel unstyled when the visual viewport matches the layout viewport', () => {
      vi.stubGlobal('visualViewport', new FakeVisualViewport())
      render(<Harness open onClose={() => {}} />)

      const dialog = screen.getByRole('dialog')
      const wrapper = dialog.parentElement as HTMLElement

      expect(wrapper.style.top).toBe('')
      expect(wrapper.style.height).toBe('')
      expect(dialog.style.maxHeight).toBe('')
    })

    it('pins the wrapper to the real visible area and clamps the panel once the keyboard shrinks it', () => {
      const viewport = new FakeVisualViewport()
      vi.stubGlobal('visualViewport', viewport)
      render(<Harness open onClose={() => {}} />)

      const dialog = screen.getByRole('dialog')
      const wrapper = dialog.parentElement as HTMLElement

      act(() => {
        viewport.offsetTop = 120
        viewport.height = 400
        viewport.dispatchEvent(new Event('resize'))
      })

      expect(wrapper.style.top).toBe('120px')
      expect(wrapper.style.height).toBe('400px')
      expect(dialog.style.maxHeight).toBe(`${400 * 0.88}px`)
    })

    it('never shrinks the backdrop along with the keyboard-safe wrapper', () => {
      // The backdrop must stay outside the wrapper's subtree, or it shrinks
      // along with it and lets BottomNav show through the uncovered strip.
      const viewport = new FakeVisualViewport()
      vi.stubGlobal('visualViewport', viewport)
      render(<Harness open onClose={() => {}} />)

      const dialog = screen.getByRole('dialog')
      const wrapper = dialog.parentElement as HTMLElement
      const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement
      const backdropTopBeforeResize = backdrop.style.top

      act(() => {
        viewport.offsetTop = 120
        viewport.height = 400
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

  describe('drag-to-dismiss', () => {
    // The handle has no accessible role (purely decorative for touch/mouse
    // drag) — it's the panel's first child, ahead of `children`.
    const getHandle = () => {
      const dialog = screen.getByRole('dialog')
      return dialog.firstElementChild as HTMLElement
    }

    it('closes when dragged past the dismiss threshold', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<Harness open onClose={onClose} />)
      const handle = getHandle()

      await user.pointer([
        { keys: '[MouseLeft>]', target: handle, coords: { clientY: 0 } },
        { coords: { clientY: 200 } },
        '[/MouseLeft]',
      ])

      expect(onClose).toHaveBeenCalledOnce()
    })

    it('does not close when dragged below the dismiss threshold', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<Harness open onClose={onClose} />)
      const handle = getHandle()

      await user.pointer([
        { keys: '[MouseLeft>]', target: handle, coords: { clientY: 0 } },
        { coords: { clientY: 40 } },
        '[/MouseLeft]',
      ])

      expect(onClose).not.toHaveBeenCalled()
    })

    it('never closes on pointercancel, regardless of drag distance', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<Harness open onClose={onClose} />)
      const handle = getHandle()

      // pointercancel is browser/OS-generated (a system gesture, multi-touch
      // conflict…); user-event's pointer API has no equivalent, so it's
      // dispatched as a raw native event.
      await user.pointer({ keys: '[MouseLeft>]', target: handle, coords: { clientY: 0 } })
      await user.pointer({ coords: { clientY: 300 } })
      handle.dispatchEvent(
        new PointerEvent('pointercancel', { bubbles: true, cancelable: true, pointerId: 1 }),
      )

      expect(onClose).not.toHaveBeenCalled()
    })
  })
})
