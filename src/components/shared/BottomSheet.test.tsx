import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BottomSheet } from '@/components/shared/BottomSheet'

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
    // The handle must be fixed chrome — a sibling of the scrolling body,
    // never inside it — or scrolling the body's content drags the handle
    // away with it. On `main`, the panel itself was the `overflow-y-auto`
    // box and the handle was its first child, so `scrollBox` there is the
    // dialog itself and this assertion fails.
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

      // Pinning the wrapper to the visible area is what keeps the sheet's
      // own top (the gasto/ingreso toggle) from being dragged off-screen —
      // specs.md §10.49.
      expect(wrapper.style.top).toBe('120px')
      expect(wrapper.style.height).toBe('400px')
      expect(dialog.style.maxHeight).toBe(`${400 * 0.88}px`)
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
      // conflict…), not a user interaction — user-event's pointer API has no
      // equivalent, so this dispatches the native event directly rather than
      // reaching for the banned `fireEvent`.
      await user.pointer({ keys: '[MouseLeft>]', target: handle, coords: { clientY: 0 } })
      await user.pointer({ coords: { clientY: 300 } })
      handle.dispatchEvent(
        new PointerEvent('pointercancel', { bubbles: true, cancelable: true, pointerId: 1 }),
      )

      expect(onClose).not.toHaveBeenCalled()
    })
  })
})
