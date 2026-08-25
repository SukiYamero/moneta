import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FullScreenPanel } from '@/features/lock/FullScreenPanel'

describe('FullScreenPanel', () => {
  it('renders nothing when closed', () => {
    render(
      <FullScreenPanel open={false} onClose={() => {}} ariaLabel="Panel de prueba">
        <p>Contenido</p>
      </FullScreenPanel>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders as a modal dialog when open', () => {
    render(
      <FullScreenPanel open onClose={() => {}} ariaLabel="Panel de prueba">
        <p>Contenido</p>
      </FullScreenPanel>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Panel de prueba' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('keeps a header outside the scrollable body', () => {
    // Mirrors BottomSheet.test.tsx's grab-handle assertion (specs.md
    // §10.35.1): `header` must be fixed chrome — a sibling of the
    // `overflow-y-auto` body, never inside it — or scrolling long body
    // content would carry the header away with it, the exact bug
    // LockSettings/PinSetup reproduced before the split.
    render(
      <FullScreenPanel
        open
        onClose={() => {}}
        ariaLabel="Panel de prueba"
        header={<button type="button">Volver</button>}
      >
        <p>Contenido</p>
      </FullScreenPanel>,
    )
    const dialog = screen.getByRole('dialog')
    const header = screen.getByRole('button', { name: 'Volver' })
    const scrollBox = dialog.querySelector('.overflow-y-auto') as HTMLElement

    expect(scrollBox).not.toBeNull()
    expect(scrollBox).not.toBe(dialog)
    expect(scrollBox.contains(header)).toBe(false)
    expect(dialog.contains(header)).toBe(true)
  })

  it('calls onClose on Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <FullScreenPanel open onClose={onClose} ariaLabel="Panel de prueba">
        <p>Contenido</p>
      </FullScreenPanel>,
    )
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledOnce()
  })
})
