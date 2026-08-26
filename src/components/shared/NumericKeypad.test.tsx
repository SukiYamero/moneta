import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NumericKeypad } from '@/components/shared/NumericKeypad'

describe('NumericKeypad', () => {
  it('renders digit buttons 0-9 and calls onDigit with the pressed digit', async () => {
    const user = userEvent.setup()
    const onDigit = vi.fn()
    render(<NumericKeypad onDigit={onDigit} onDelete={() => {}} deleteAriaLabel="Delete" />)

    await user.click(screen.getByRole('button', { name: '7' }))

    expect(onDigit).toHaveBeenCalledWith(7)
  })

  it('calls onDelete when the delete button is pressed', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(<NumericKeypad onDigit={() => {}} onDelete={onDelete} deleteAriaLabel="Delete" />)

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('renders a blank cell (no decimal key) when decimalLabel is omitted — the PIN pad shape', () => {
    render(<NumericKeypad onDigit={() => {}} onDelete={() => {}} deleteAriaLabel="Delete" />)

    // 10 digits + delete, no decimal key
    expect(screen.getAllByRole('button')).toHaveLength(11)
  })

  it('renders a decimal key showing the given label and calls onDecimal when pressed', async () => {
    const user = userEvent.setup()
    const onDecimal = vi.fn()
    render(
      <NumericKeypad
        onDigit={() => {}}
        onDelete={() => {}}
        onDecimal={onDecimal}
        decimalLabel=","
        decimalAriaLabel="Decimal separator"
        deleteAriaLabel="Delete"
      />,
    )

    const decimalButton = screen.getByRole('button', { name: 'Decimal separator' })
    expect(decimalButton).toHaveTextContent(',')
    await user.click(decimalButton)

    expect(onDecimal).toHaveBeenCalledOnce()
  })

  it('disables every digit button when digitsDisabled is true', () => {
    render(
      <NumericKeypad
        onDigit={() => {}}
        onDelete={() => {}}
        deleteAriaLabel="Delete"
        digitsDisabled
      />,
    )

    for (const digit of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(screen.getByRole('button', { name: String(digit) })).toBeDisabled()
    }
  })

  it('disables the decimal button when decimalDisabled is true', () => {
    render(
      <NumericKeypad
        onDigit={() => {}}
        onDelete={() => {}}
        onDecimal={() => {}}
        decimalLabel=","
        decimalAriaLabel="Decimal separator"
        deleteAriaLabel="Delete"
        decimalDisabled
      />,
    )

    expect(screen.getByRole('button', { name: 'Decimal separator' })).toBeDisabled()
  })

  it('disables the delete button when deleteDisabled is true', () => {
    render(
      <NumericKeypad
        onDigit={() => {}}
        onDelete={() => {}}
        deleteAriaLabel="Delete"
        deleteDisabled
      />,
    )

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  })

  it('does not steal focus from another element when a key is tapped — a bare button would take focus on its own mousedown/pointerdown default action, which is exactly what would blur/unmount a focus-gated keypad mid-tap', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <input aria-label="Elsewhere" />
        <NumericKeypad onDigit={() => {}} onDelete={() => {}} deleteAriaLabel="Delete" />
      </div>,
    )
    const elsewhere = screen.getByLabelText('Elsewhere')
    await user.click(elsewhere)
    expect(elsewhere).toHaveFocus()

    await user.click(screen.getByRole('button', { name: '5' }))

    expect(elsewhere).toHaveFocus()
  })

  it('disables every key when disabled is true, regardless of the individual flags', () => {
    render(
      <NumericKeypad
        onDigit={() => {}}
        onDelete={() => {}}
        onDecimal={() => {}}
        decimalLabel=","
        decimalAriaLabel="Decimal separator"
        deleteAriaLabel="Delete"
        disabled
      />,
    )

    expect(screen.getByRole('button', { name: '1' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Decimal separator' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  })

  describe('the opt-in dismiss bar', () => {
    it('renders nothing extra when onDismiss is omitted — the PIN-shaped usage stays byte-identical', () => {
      render(<NumericKeypad onDigit={() => {}} onDelete={() => {}} deleteAriaLabel="Delete" />)

      // Same 10 digits + delete as the plain PIN shape — no dismiss button added.
      expect(screen.getAllByRole('button')).toHaveLength(11)
    })

    it('renders a real, accessibly-labeled button when onDismiss is provided, and tapping it calls onDismiss', async () => {
      const user = userEvent.setup()
      const onDismiss = vi.fn()
      render(
        <NumericKeypad
          onDigit={() => {}}
          onDelete={() => {}}
          deleteAriaLabel="Delete"
          onDismiss={onDismiss}
          dismissAriaLabel="Close keypad"
        />,
      )

      const bar = screen.getByRole('button', { name: 'Close keypad' })
      await user.click(bar)

      expect(onDismiss).toHaveBeenCalledOnce()
    })

    it('is keyboard-reachable and activates on Enter — the drag is an enhancement, never the only path', async () => {
      const user = userEvent.setup()
      const onDismiss = vi.fn()
      render(
        <NumericKeypad
          onDigit={() => {}}
          onDelete={() => {}}
          deleteAriaLabel="Delete"
          onDismiss={onDismiss}
          dismissAriaLabel="Close keypad"
        />,
      )

      screen.getByRole('button', { name: 'Close keypad' }).focus()
      await user.keyboard('{Enter}')

      expect(onDismiss).toHaveBeenCalledOnce()
    })

    it('calls onDismiss when the bar is dragged down past the dismiss threshold', async () => {
      const user = userEvent.setup()
      const onDismiss = vi.fn()
      render(
        <NumericKeypad
          onDigit={() => {}}
          onDelete={() => {}}
          deleteAriaLabel="Delete"
          onDismiss={onDismiss}
          dismissAriaLabel="Close keypad"
        />,
      )
      const bar = screen.getByRole('button', { name: 'Close keypad' })

      await user.pointer([
        { keys: '[MouseLeft>]', target: bar, coords: { clientY: 0 } },
        { coords: { clientY: 80 } },
        '[/MouseLeft]',
      ])

      expect(onDismiss).toHaveBeenCalledOnce()
    })

    it('springs back without calling onDismiss when dragged below the threshold', async () => {
      const user = userEvent.setup()
      const onDismiss = vi.fn()
      render(
        <NumericKeypad
          onDigit={() => {}}
          onDelete={() => {}}
          deleteAriaLabel="Delete"
          onDismiss={onDismiss}
          dismissAriaLabel="Close keypad"
        />,
      )
      const bar = screen.getByRole('button', { name: 'Close keypad' })

      await user.pointer([
        { keys: '[MouseLeft>]', target: bar, coords: { clientY: 0 } },
        { coords: { clientY: 10 } },
        '[/MouseLeft]',
      ])

      expect(onDismiss).not.toHaveBeenCalled()
    })

    it("never dismisses on pointercancel, regardless of drag distance — a cancelled gesture is not user intent, same rule BottomSheet's own drag-to-dismiss follows", async () => {
      const user = userEvent.setup()
      const onDismiss = vi.fn()
      render(
        <NumericKeypad
          onDigit={() => {}}
          onDelete={() => {}}
          deleteAriaLabel="Delete"
          onDismiss={onDismiss}
          dismissAriaLabel="Close keypad"
        />,
      )
      const bar = screen.getByRole('button', { name: 'Close keypad' })

      await user.pointer({ keys: '[MouseLeft>]', target: bar, coords: { clientY: 0 } })
      await user.pointer({ coords: { clientY: 200 } })
      bar.dispatchEvent(
        new PointerEvent('pointercancel', { bubbles: true, cancelable: true, pointerId: 1 }),
      )

      expect(onDismiss).not.toHaveBeenCalled()
    })

    it('dragging the bar does not steal focus from the amount input mid-gesture', async () => {
      const user = userEvent.setup()
      render(
        <div>
          <input aria-label="Elsewhere" />
          <NumericKeypad
            onDigit={() => {}}
            onDelete={() => {}}
            deleteAriaLabel="Delete"
            onDismiss={() => {}}
            dismissAriaLabel="Close keypad"
          />
        </div>,
      )
      const elsewhere = screen.getByLabelText('Elsewhere')
      await user.click(elsewhere)
      expect(elsewhere).toHaveFocus()

      const bar = screen.getByRole('button', { name: 'Close keypad' })
      await user.pointer([
        { keys: '[MouseLeft>]', target: bar, coords: { clientY: 0 } },
        { coords: { clientY: 10 } },
        '[/MouseLeft]',
      ])

      expect(elsewhere).toHaveFocus()
    })
  })
})
