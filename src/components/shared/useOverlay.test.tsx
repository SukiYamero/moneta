import { act, useRef, useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { es } from 'date-fns/locale'
import { BottomSheet } from '@/components/shared/BottomSheet'
import { CenterModal } from '@/components/shared/CenterModal'
import { DateChipPicker } from '@/components/shared/DateChipPicker'
import { OVERLAY_BODY_DIM_BACKGROUND, useHasOpenOverlay } from '@/components/shared/useOverlay'

/**
 * These tests cover the interaction *between* two overlay instances — the
 * exact scenario absent from BottomSheet.test.tsx/CenterModal.test.tsx,
 * which only ever exercise one overlay at a time. The design genuinely
 * nests overlays (delete-confirm CenterModal opening from inside the
 * Movement BottomSheet), so this is a real, reachable flow.
 */
const Harness = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Panel de prueba">
      <button type="button">Primero</button>
      <button type="button">Segundo</button>
    </BottomSheet>
  )
}

const NestedOverlaysHarness = ({
  onSheetClose,
  onModalClose,
}: {
  onSheetClose: () => void
  onModalClose: () => void
}) => {
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

    const Wrapper = () => {
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

    const Wrapper = () => {
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

    const Wrapper = () => {
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

    const ClosedHarness = () => {
      return <Harness open={false} onClose={() => {}} />
    }
    rerender(<ClosedHarness />)

    expect(document.body.style.overflow).toBe(previousOverflow)
  })

  it('dims the body background while any overlay is open and restores it once the last one closes', async () => {
    const previousBackground = document.body.style.backgroundColor

    const Wrapper = () => {
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
    expect(document.body.style.backgroundColor).toBe(OVERLAY_BODY_DIM_BACKGROUND)

    const ClosedHarness = () => {
      return <Harness open={false} onClose={() => {}} />
    }
    rerender(<ClosedHarness />)

    expect(document.body.style.backgroundColor).toBe(previousBackground)
  })

  it('keeps the body background dimmed while a nested modal closes but the outer sheet stays open', async () => {
    const user = userEvent.setup()

    const Wrapper = () => {
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
    expect(document.body.style.backgroundColor).toBe(OVERLAY_BODY_DIM_BACKGROUND)

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Confirmar' })).not.toBeInTheDocument()
    expect(document.body.style.backgroundColor).toBe(OVERLAY_BODY_DIM_BACKGROUND)
  })
})

describe('useOverlay — item 1: initial focus lands in the same task as the trigger click', () => {
  /**
   * This proves the *mechanism* only — that `.focus()` now runs
   * synchronously inside the click that opens the overlay, not that iOS
   * Safari actually raises its software keyboard (no agent here can drive
   * real iOS Safari; that stays unverified, see the AJ2-B report).
   *
   * A raw, synchronous `.click()` wrapped in `act`, not `user-event`: the
   * property under test is "zero scheduler yields between the click and
   * the focus call," and `user-event`'s API is itself `async` — an
   * `await user.click()` cannot prove the absence of a yield its own call
   * necessarily introduces, whatever margin happens to exist between that
   * yield and this bug's `requestAnimationFrame` delay. (That margin was
   * checked, not assumed: a `user-event` version of this exact assertion
   * also fails against the pre-fix implementation in this environment —
   * jsdom's `requestAnimationFrame` polyfill runs later than `user-event`'s
   * own internal delay here, so it isn't a masking risk today. But that's
   * an implementation detail of jsdom's timers, not something this test
   * can rely on going forward — a synchronous call is the only instrument
   * that proves the actual claim outright, matching the existing "reaching
   * for the banned `fireEvent`" precedent in `BottomSheet.test.tsx`: a
   * native DOM call used where `user-event`'s API structurally cannot make
   * the same guarantee, not a general preference over it.) Asserting focus
   * immediately after, with no `await`/`waitFor`, only ever passes if
   * focus was set inside the same synchronous flush as the click. Before
   * this change (a passive `useEffect` deferring focus into a
   * `requestAnimationFrame`), this exact assertion fails — focus lands a
   * task or more later, which is the bug: iOS Safari only opens the
   * keyboard for a `.focus()` still inside the task that carries user
   * activation.
   */
  it('focuses initialFocus synchronously when open flips true inside a click handler', () => {
    const Harness = () => {
      const [open, setOpen] = useState(false)
      const amountInputRef = useRef<HTMLInputElement>(null)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Agregar
          </button>
          <BottomSheet
            open={open}
            onClose={() => setOpen(false)}
            ariaLabel="Agregar movimiento"
            initialFocus={amountInputRef}
          >
            <input ref={amountInputRef} aria-label="Monto" />
          </BottomSheet>
        </>
      )
    }

    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Agregar' })

    act(() => {
      trigger.click()
    })

    expect(screen.getByRole('textbox', { name: 'Monto' })).toHaveFocus()
  })
})

describe('useOverlay + useEscapeToClose — DateChipPicker inside a BottomSheet', () => {
  it('Escape closes the picker popover first, not the sheet behind it', async () => {
    const user = userEvent.setup()
    const onSheetClose = vi.fn()

    const Wrapper = () => {
      const [date, setDate] = useState('2026-08-10')
      return (
        <BottomSheet open onClose={onSheetClose} ariaLabel="Sheet con selector de fecha">
          <DateChipPicker value={date} onChange={setDate} locale="es-CO" dateFnsLocale={es} />
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

describe('useHasOpenOverlay — module-level overlay-stack exposed to React (specs.md §10.53)', () => {
  // Any consumer (BottomNav) reacting to "is *some* overlay open" must not
  // special-case which overlay it is — this is the same nesting-aware
  // `stack` the Escape/Tab-trap logic above already shares between
  // BottomSheet, CenterModal and useEscapeToClose, exposed via
  // useSyncExternalStore instead of read locally by AppShell (which would
  // only ever see the Add/Profile sheets it happens to own).
  const Probe = () => {
    const hasOpenOverlay = useHasOpenOverlay()
    return <span data-testid="probe">{String(hasOpenOverlay)}</span>
  }

  it('is false with nothing open, flips true while a BottomSheet is open, and flips back false once it closes', async () => {
    const user = userEvent.setup()
    const Wrapper = () => {
      const [open, setOpen] = useState(false)
      return (
        <>
          <Probe />
          <button type="button" onClick={() => setOpen(true)}>
            Abrir
          </button>
          <BottomSheet open={open} onClose={() => setOpen(false)} ariaLabel="Sheet de prueba">
            <button type="button" onClick={() => setOpen(false)}>
              Cerrar
            </button>
          </BottomSheet>
        </>
      )
    }

    render(<Wrapper />)
    expect(screen.getByTestId('probe')).toHaveTextContent('false')

    await user.click(screen.getByRole('button', { name: 'Abrir' }))
    await vi.waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('true'))

    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    await vi.waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('false'))
  })

  it('stays true while an outer sheet remains open even after a nested CenterModal inside it closes', async () => {
    const user = userEvent.setup()
    const Wrapper = () => {
      const [modalOpen, setModalOpen] = useState(true)
      return (
        <>
          <Probe />
          <BottomSheet open onClose={() => {}} ariaLabel="Sheet exterior">
            <CenterModal
              open={modalOpen}
              onClose={() => setModalOpen(false)}
              ariaLabel="Modal anidado"
            >
              <button type="button" onClick={() => setModalOpen(false)}>
                Cerrar modal
              </button>
            </CenterModal>
          </BottomSheet>
        </>
      )
    }

    render(<Wrapper />)
    await vi.waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('true'))

    await user.click(screen.getByRole('button', { name: 'Cerrar modal' }))
    // The outer sheet is still open — never expect this to read 'false'.
    expect(screen.getByTestId('probe')).toHaveTextContent('true')
  })
})
