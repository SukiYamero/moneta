import { act, useRef, useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { es } from 'date-fns/locale'
import { BottomSheet } from '@/components/shared/BottomSheet'
import { CenterModal } from '@/components/shared/CenterModal'
import { DateChipPicker } from '@/components/shared/DateChipPicker'
import { OVERLAY_BODY_DIM_BACKGROUND, useHasOpenOverlay } from '@/components/shared/useOverlay'

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

describe('useOverlay — inline onClose identity must not steal focus', () => {
  it('keeps focus where the user tabbed to when a parent re-render hands the sheet a brand-new onClose identity', async () => {
    const { rerender } = render(<Harness open onClose={() => {}} />)

    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: 'Primero' })).toHaveFocus()
    })

    screen.getByRole('button', { name: 'Segundo' }).focus()
    expect(screen.getByRole('button', { name: 'Segundo' })).toHaveFocus()

    rerender(<Harness open onClose={() => {}} />)
    await new Promise((resolve) => requestAnimationFrame(resolve))

    expect(screen.getByRole('button', { name: 'Segundo' })).toHaveFocus()
  })
})

describe('useOverlay — nested overlays', () => {
  it('gives initial focus to the nested modal, not the outer sheet, when both mount already open', async () => {
    render(<NestedOverlaysHarness onSheetClose={() => {}} onModalClose={() => {}} />)

    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    })

    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  })

  it('Escape closes only the topmost (nested) overlay, not both', async () => {
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

describe('useOverlay — initial focus lands in the same task as the trigger click', () => {
  // user-event dispatches asynchronously and so can't prove the absence of a scheduler yield; a raw `.click()` in `act` can.
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

describe('useOverlay — autoFocus opt-out', () => {
  it('focuses the panel, not the first focusable control, when autoFocus is false', async () => {
    render(
      <BottomSheet open onClose={() => {}} ariaLabel="Sheet sin autofoco" autoFocus={false}>
        <input aria-label="Buscar" />
      </BottomSheet>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Sheet sin autofoco' })

    await vi.waitFor(() => {
      expect(dialog).toHaveFocus()
    })
    expect(screen.getByRole('textbox', { name: 'Buscar' })).not.toHaveFocus()
  })

  it('ignores initialFocus when autoFocus is false', async () => {
    const Harness = () => {
      const inputRef = useRef<HTMLInputElement>(null)
      return (
        <BottomSheet
          open
          onClose={() => {}}
          ariaLabel="Sheet con ambos props"
          autoFocus={false}
          initialFocus={inputRef}
        >
          <input ref={inputRef} aria-label="Buscar" />
        </BottomSheet>
      )
    }
    render(<Harness />)
    const dialog = screen.getByRole('dialog', { name: 'Sheet con ambos props' })

    await vi.waitFor(() => {
      expect(dialog).toHaveFocus()
    })
    expect(screen.getByRole('textbox', { name: 'Buscar' })).not.toHaveFocus()
  })

  it('still closes on Escape when autoFocus is false', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <BottomSheet open onClose={onClose} ariaLabel="Sheet sin autofoco" autoFocus={false}>
        <input aria-label="Buscar" />
      </BottomSheet>,
    )
    await vi.waitFor(() => {
      expect(screen.getByRole('dialog')).toHaveFocus()
    })

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('traps Tab from the panel itself, before any control has been focused, when autoFocus is false', async () => {
    const user = userEvent.setup()
    render(
      <BottomSheet open onClose={() => {}} ariaLabel="Sheet sin autofoco" autoFocus={false}>
        <button type="button">Primero</button>
        <button type="button">Segundo</button>
      </BottomSheet>,
    )
    await vi.waitFor(() => {
      expect(screen.getByRole('dialog')).toHaveFocus()
    })

    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Segundo' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Primero' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Segundo' })).toHaveFocus()
  })

  it('restores focus to the trigger on close, whether or not autoFocus is false', async () => {
    const user = userEvent.setup()
    const Harness = () => {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Abrir
          </button>
          <BottomSheet
            open={open}
            onClose={() => setOpen(false)}
            ariaLabel="Sheet sin autofoco"
            autoFocus={false}
          >
            <input aria-label="Buscar" />
          </BottomSheet>
        </>
      )
    }
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Abrir' })
    await user.click(trigger)

    await vi.waitFor(() => {
      expect(screen.getByRole('dialog')).toHaveFocus()
    })

    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
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

describe('useHasOpenOverlay — module-level overlay-stack exposed to React', () => {
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
    expect(screen.getByTestId('probe')).toHaveTextContent('true')
  })
})
