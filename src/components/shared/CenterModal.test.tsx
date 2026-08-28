import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CenterModal } from '@/components/shared/CenterModal'
import { OVERLAY_FIXED_LAYER_OPACITY_CLASS } from '@/components/shared/useOverlay'

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
    // A layout shift between pointerup and the browser's click dispatch can land the click on a different element than either.
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

  it('focuses the panel instead of a search input when autoFocus is false', async () => {
    render(
      <CenterModal open onClose={() => {}} ariaLabel="Modal sin autofoco" autoFocus={false}>
        <input aria-label="Buscar" />
      </CenterModal>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Modal sin autofoco' })

    await vi.waitFor(() => {
      expect(dialog).toHaveFocus()
    })
    expect(screen.getByRole('textbox', { name: 'Buscar' })).not.toHaveFocus()
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

  describe('sizing is CSS-only', () => {
    it('bounds and scrolls the panel from its classes, with no inline viewport geometry', () => {
      render(<Harness open onClose={() => {}} />)
      const dialog = screen.getByRole('dialog')
      const wrapper = dialog.parentElement as HTMLElement

      expect(dialog).toHaveClass('max-h-[88dvh]', 'overflow-y-auto')
      expect(dialog.style.maxHeight).toBe('')
      expect(wrapper.style.top).toBe('')
      expect(wrapper.style.height).toBe('')
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
