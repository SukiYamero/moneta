import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BottomSheet } from '@/components/shared/BottomSheet'
import { CenterModal } from '@/components/shared/CenterModal'
import { DateChipPicker } from '@/components/shared/DateChipPicker'

/**
 * These tests cover the interaction *between* two overlay instances — the
 * exact scenario absent from BottomSheet.test.tsx/CenterModal.test.tsx,
 * which only ever exercise one overlay at a time. The design genuinely
 * nests overlays (delete-confirm CenterModal opening from inside the
 * Movement BottomSheet), so this is a real, reachable flow.
 */

function Harness({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Panel de prueba">
      <button type="button">Primero</button>
      <button type="button">Segundo</button>
    </BottomSheet>
  )
}

function NestedOverlaysHarness({
  onSheetClose,
  onModalClose,
}: {
  onSheetClose: () => void
  onModalClose: () => void
}) {
  return (
    <BottomSheet open onClose={onSheetClose} ariaLabel="Sheet exterior">
      <button type="button">Eliminar</button>
      <CenterModal open onClose={onModalClose} ariaLabel="Confirmar eliminación">
        <button type="button">Cancelar</button>
        <button type="button">Confirmar</button>
      </CenterModal>
    </BottomSheet>
  )
}

describe('useOverlay — bug 1: inline onClose identity must not steal focus', () => {
  it('keeps focus where the user tabbed to when a parent re-render hands the sheet a brand-new onClose identity', async () => {
    const { rerender } = render(<Harness open onClose={() => {}} />)

    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: 'Primero' })).toHaveFocus()
    })

    screen.getByRole('button', { name: 'Segundo' }).focus()
    expect(screen.getByRole('button', { name: 'Segundo' })).toHaveFocus()

    // Simulates what every consumer naturally writes:
    // onClose={() => setOpen(false)} — a new function identity on every
    // parent re-render (a keystroke elsewhere, a toast auto-dismissing…)
    // even though `open` itself never changed.
    rerender(<Harness open onClose={() => {}} />)
    await new Promise((resolve) => requestAnimationFrame(resolve))

    expect(screen.getByRole('button', { name: 'Segundo' })).toHaveFocus()
  })
})

describe('useOverlay — nested overlays (bugs 2 & 3)', () => {
  it('bug 3: gives initial focus to the nested modal, not the outer sheet, when both mount already open', async () => {
    render(<NestedOverlaysHarness onSheetClose={() => {}} onModalClose={() => {}} />)

    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    })

    // give any stray RAF from the outer sheet a chance to run and steal focus back
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  })

  it('bug 2: Escape closes only the topmost (nested) overlay, not both', async () => {
    const user = userEvent.setup()
    const onSheetClose = vi.fn()
    const onModalClose = vi.fn()
    render(<NestedOverlaysHarness onSheetClose={onSheetClose} onModalClose={onModalClose} />)

    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    })

    await user.keyboard('{Escape}')

    expect(onModalClose).toHaveBeenCalledOnce()
    expect(onSheetClose).not.toHaveBeenCalled()
  })

  it('Escape falls through to the sheet once the nested modal has actually closed', async () => {
    const user = userEvent.setup()
    const onSheetClose = vi.fn()

    function Wrapper() {
      const [modalOpen, setModalOpen] = useState(true)
      return (
        <BottomSheet open onClose={onSheetClose} ariaLabel="Sheet exterior">
          <button type="button">Eliminar</button>
          <CenterModal open={modalOpen} onClose={() => setModalOpen(false)} ariaLabel="Confirmar">
            <button type="button">Cancelar</button>
          </CenterModal>
        </BottomSheet>
      )
    }

    render(<Wrapper />)
    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    })

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Confirmar' })).not.toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(onSheetClose).toHaveBeenCalledOnce()
  })

  it('traps Tab within the nested modal only while it is open, never reaching the outer sheet', async () => {
    const user = userEvent.setup()
    render(<NestedOverlaysHarness onSheetClose={() => {}} onModalClose={() => {}} />)

    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    })

    await user.tab()
    expect(screen.getByRole('button', { name: 'Confirmar' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  })

  it('keeps the body scroll lock held while the nested modal closes but the outer sheet stays open', async () => {
    const user = userEvent.setup()

    function Wrapper() {
      const [modalOpen, setModalOpen] = useState(true)
      return (
        <BottomSheet open onClose={() => {}} ariaLabel="Sheet exterior">
          <button type="button">Eliminar</button>
          <CenterModal open={modalOpen} onClose={() => setModalOpen(false)} ariaLabel="Confirmar">
            <button type="button">Cancelar</button>
          </CenterModal>
        </BottomSheet>
      )
    }

    render(<Wrapper />)
    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    })
    expect(document.body.style.overflow).toBe('hidden')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Confirmar' })).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('releases the body scroll lock once the last overlay closes', async () => {
    const previousOverflow = document.body.style.overflow

    function Wrapper() {
      const [open, setOpen] = useState(true)
      return (
        <BottomSheet open={open} onClose={() => setOpen(false)} ariaLabel="Sheet único">
          <button type="button">Único</button>
        </BottomSheet>
      )
    }

    const { rerender } = render(<Wrapper />)
    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: 'Único' })).toHaveFocus()
    })
    expect(document.body.style.overflow).toBe('hidden')

    function ClosedHarness() {
      return <Harness open={false} onClose={() => {}} />
    }
    rerender(<ClosedHarness />)

    expect(document.body.style.overflow).toBe(previousOverflow)
  })
})

describe('useOverlay + useEscapeToClose — DateChipPicker inside a BottomSheet', () => {
  it('Escape closes the picker popover first, not the sheet behind it', async () => {
    const user = userEvent.setup()
    const onSheetClose = vi.fn()

    function Wrapper() {
      const [date, setDate] = useState('2026-08-10')
      return (
        <BottomSheet open onClose={onSheetClose} ariaLabel="Sheet con selector de fecha">
          <DateChipPicker value={date} onChange={setDate} />
        </BottomSheet>
      )
    }

    render(<Wrapper />)
    await user.click(screen.getByRole('button', { name: /10 de agosto/ }))
    expect(screen.getByRole('group', { name: 'Selector de fecha' })).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('group', { name: 'Selector de fecha' })).not.toBeInTheDocument()
    expect(onSheetClose).not.toHaveBeenCalled()
  })
})
