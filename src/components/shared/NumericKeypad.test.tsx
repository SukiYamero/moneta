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

  it('marks every digit button aria-disabled and ignores taps on them when digitsDisabled is true', async () => {
    const user = userEvent.setup()
    const onDigit = vi.fn()
    render(
      <NumericKeypad
        onDigit={onDigit}
        onDelete={() => {}}
        deleteAriaLabel="Delete"
        digitsDisabled
      />,
    )

    for (const digit of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const button = screen.getByRole('button', { name: String(digit) })
      expect(button).toHaveAttribute('aria-disabled', 'true')
      expect(button).not.toBeDisabled()
    }
    await user.click(screen.getByRole('button', { name: '7' }))
    expect(onDigit).not.toHaveBeenCalled()
  })

  it('marks the decimal button aria-disabled and ignores taps on it when decimalDisabled is true', async () => {
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
        decimalDisabled
      />,
    )

    const button = screen.getByRole('button', { name: 'Decimal separator' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).not.toBeDisabled()
    await user.click(button)
    expect(onDecimal).not.toHaveBeenCalled()
  })

  it('marks the delete button aria-disabled and ignores taps on it when deleteDisabled is true', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(
      <NumericKeypad
        onDigit={() => {}}
        onDelete={onDelete}
        deleteAriaLabel="Delete"
        deleteDisabled
      />,
    )

    const button = screen.getByRole('button', { name: 'Delete' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).not.toBeDisabled()
    await user.click(button)
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('a logically-disabled key still dispatches pointerdown, so a container-level focus guard still runs for it — unlike a native `disabled` button, which dispatches no pointer events at all', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <input aria-label="Elsewhere" />
        <NumericKeypad
          onDigit={() => {}}
          onDelete={() => {}}
          deleteAriaLabel="Delete"
          deleteDisabled
        />
      </div>,
    )
    const elsewhere = screen.getByLabelText('Elsewhere')
    await user.click(elsewhere)
    expect(elsewhere).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(elsewhere).toHaveFocus()
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

  it('marks every key aria-disabled when disabled is true, regardless of the individual flags', () => {
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

    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: 'Decimal separator' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveAttribute('aria-disabled', 'true')
  })

  describe('key size', () => {
    it('renders the default PIN-shaped height when size is omitted', () => {
      render(<NumericKeypad onDigit={() => {}} onDelete={() => {}} deleteAriaLabel="Delete" />)

      expect(screen.getByRole('button', { name: '1' })).toHaveClass('min-h-15.5')
    })

    it("renders a smaller height for the amount field's compact usage, without affecting the PIN shape", () => {
      render(
        <NumericKeypad
          onDigit={() => {}}
          onDelete={() => {}}
          deleteAriaLabel="Delete"
          size="compact"
        />,
      )

      const key = screen.getByRole('button', { name: '1' })
      expect(key).toHaveClass('min-h-13.25')
      expect(key).not.toHaveClass('min-h-15.5')
    })
  })
})
