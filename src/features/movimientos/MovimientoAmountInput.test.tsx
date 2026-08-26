import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BottomSheet } from '@/components/shared/BottomSheet'
import {
  MovimientoAmountInput,
  type MovimientoAmountInputProps,
} from '@/features/movimientos/MovimientoAmountInput'

type HarnessProps = Omit<MovimientoAmountInputProps, 'value' | 'onChange'> & {
  initialValue?: string
}

/** A real controlled parent — `useMovimientoForm`'s own shape — needed to
 * exercise live reformatting and caret placement across keystrokes; a
 * `value` prop that never updates can't accumulate typed input. */
const ControlledHarness = ({ initialValue = '', ...props }: HarnessProps) => {
  const [value, setValue] = useState(initialValue)
  return <MovimientoAmountInput {...props} value={value} onChange={setValue} />
}

describe('MovimientoAmountInput', () => {
  it('labels the field via aria-label, and never renders type=number', () => {
    render(
      <MovimientoAmountInput
        value=""
        onChange={() => {}}
        locale="es-CO"
        moneda="COP"
        tipo="gasto"
      />,
    )
    const input = screen.getByLabelText('Monto')
    expect(input).toBeInTheDocument()
    expect(input).not.toHaveAttribute('type', 'number')
  })

  it('renders the currency symbol as a decorative element, plus an invisible mirror that balances it for centering', () => {
    render(
      <MovimientoAmountInput
        value=""
        onChange={() => {}}
        locale="es-CO"
        moneda="COP"
        tipo="gasto"
      />,
    )
    const symbols = screen.getAllByText('$')
    expect(symbols).toHaveLength(2)
    expect(symbols[0]).toHaveAttribute('aria-hidden', 'true')
    expect(symbols[0]).not.toHaveClass('invisible')
    expect(symbols[1]).toHaveAttribute('aria-hidden', 'true')
    expect(symbols[1]).toHaveClass('invisible')
  })

  it('the input sits between the real symbol and its invisible mirror, both siblings inside the same centered row', () => {
    render(
      <MovimientoAmountInput
        value=""
        onChange={() => {}}
        locale="es-CO"
        moneda="COP"
        tipo="gasto"
      />,
    )
    const input = screen.getByLabelText('Monto')
    const row = input.parentElement
    expect(row?.children).toHaveLength(3)
    expect(row?.children[1]).toBe(input)
  })

  it("the row itself is w-full — jsdom has no layout engine to prove it, but a real-browser repro (specs.md §10.45) showed the row is otherwise shrink-to-fit under its flex-col items-center parent, making the input's max-w-[calc(100%-3rem)] resolve against the row's own unbounded content width instead of the sheet's real one, so a six-digit PEN amount overflowed the sheet with the clamp doing nothing", () => {
    render(
      <MovimientoAmountInput
        value=""
        onChange={() => {}}
        locale="es-CO"
        moneda="COP"
        tipo="gasto"
      />,
    )
    const row = screen.getByLabelText('Monto').parentElement
    expect(row?.className).toContain('w-full')
  })

  it('calls onChange with the raw typed text for a short, ungrouped amount', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <MovimientoAmountInput
        value=""
        onChange={onChange}
        locale="es-CO"
        moneda="COP"
        tipo="gasto"
      />,
    )

    await user.type(screen.getByLabelText('Monto'), '1')

    expect(onChange).toHaveBeenLastCalledWith('1')
  })

  it('is not aria-invalid for well-formed text under the given locale', () => {
    render(
      <MovimientoAmountInput
        value="1.234,56"
        onChange={() => {}}
        locale="es-CO"
        moneda="COP"
        tipo="gasto"
      />,
    )
    expect(screen.getByLabelText('Monto')).toHaveAttribute('aria-invalid', 'false')
  })

  it('is aria-invalid for text that fails to parse under the given locale, even with no error prop', () => {
    render(
      <MovimientoAmountInput
        value="12.34.56"
        onChange={() => {}}
        locale="en-US"
        moneda="USD"
        tipo="gasto"
      />,
    )
    expect(screen.getByLabelText('Monto')).toHaveAttribute('aria-invalid', 'true')
  })

  it('wires an explicit error message via aria-describedby and role=alert', () => {
    render(
      <MovimientoAmountInput
        value="100"
        onChange={() => {}}
        locale="es-CO"
        moneda="COP"
        tipo="gasto"
        error="Ingresa un monto"
      />,
    )
    const input = screen.getByLabelText('Monto')
    const error = screen.getByRole('alert')

    expect(error).toHaveTextContent('Ingresa un monto')
    expect(input).toHaveAttribute('aria-describedby', error.id)
  })

  it('carries field-sizing: content for auto-width, with a fixed-width fallback overridden via @supports, bounded by a relative max-width', () => {
    render(
      <MovimientoAmountInput
        value=""
        onChange={() => {}}
        locale="es-CO"
        moneda="COP"
        tipo="gasto"
      />,
    )
    const input = screen.getByLabelText('Monto')
    expect(input.className).toContain('[field-sizing:content]')
    expect(input.className).toContain('w-40')
    expect(input.className).toContain('supports-[field-sizing:content]:w-auto')
    expect(input.className).toContain('max-w-[calc(100%-3rem)]')
  })

  it('colors the digits per tipo, mirroring movimientoView.ts — income green, expense plain foreground', () => {
    const { rerender } = render(
      <MovimientoAmountInput
        value=""
        onChange={() => {}}
        locale="es-CO"
        moneda="COP"
        tipo="ingreso"
      />,
    )
    expect(screen.getByLabelText('Monto')).toHaveClass('text-success')

    rerender(
      <MovimientoAmountInput
        value=""
        onChange={() => {}}
        locale="es-CO"
        moneda="COP"
        tipo="gasto"
      />,
    )
    expect(screen.getByLabelText('Monto')).toHaveClass('text-foreground')
  })

  describe('live locale grouping', () => {
    it('groups digits as the user types under a dot-grouping locale', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto')

      await user.type(input, '1234567')

      expect(input).toHaveValue('1.234.567')
    })

    it('groups digits as the user types under a comma-grouping locale', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="en-US" moneda="USD" tipo="gasto" />)
      const input = screen.getByLabelText('Monto')

      await user.type(input, '1234567')

      expect(input).toHaveValue('1,234,567')
    })

    it('groups digits as the user types under a space-grouping locale', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="fr-FR" moneda="USD" tipo="gasto" />)
      const input = screen.getByLabelText('Monto')

      await user.type(input, '1234567')

      const expected = new Intl.NumberFormat('fr-FR').format(1234567)
      expect(input).toHaveValue(expected)
    })

    it('keeps a trailing decimal separator mid-entry, on the way to a fraction', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto')

      await user.type(input, '1,')

      expect(input).toHaveValue('1,')
    })

    it('does not collapse a trailing fraction zero', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto')

      await user.type(input, '1,50')

      expect(input).toHaveValue('1,50')
    })

    it('handles a paste of a plain digit string, grouping it', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto')

      await user.click(input)
      await user.paste('1234567')

      expect(input).toHaveValue('1.234.567')
    })

    it('leaves malformed pasted text untouched, still flagged invalid downstream', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto')

      await user.click(input)
      await user.paste('abc')

      expect(input).toHaveValue('abc')
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })
  })

  describe('caret placement across a live reformat', () => {
    it('does not send the caret to the end when a separator is inserted ahead of it', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness initialValue="1.234" locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto') as HTMLInputElement

      // "1.234" -> place caret at index 3 (right after "1.2", before "34")
      // and type "9": the browser splices it in as "1.2934", which regroups
      // to "12.934" — 3 digits now precede the caret ("1", "2", "9"), so the
      // caret must land right after the "9", not at the string's end.
      await user.type(input, '9', { initialSelectionStart: 3, initialSelectionEnd: 3 })

      expect(input.value).toBe('12.934')
      expect(input.selectionStart).toBe(4)
      expect(input.selectionEnd).toBe(4)
    })

    it('keeps the caret in place when backspacing across a grouping separator', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness initialValue="12.345" locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto') as HTMLInputElement

      // caret right after the separator (index 3); backspace removes it,
      // the separator is derived so it reappears, and the caret must land
      // back in the same visual spot — still right after it, not wedged
      // before it (which would misdirect the next keystroke).
      await user.type(input, '{backspace}', { initialSelectionStart: 3, initialSelectionEnd: 3 })

      expect(input.value).toBe('12.345')
      expect(input.selectionStart).toBe(3)
    })

    it('deleting a grouping separator directly is a no-op — it is derived, not literal', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness initialValue="12.345" locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto') as HTMLInputElement

      // select just the "." (index 2 to 3) and delete it
      await user.type(input, '{delete}', { initialSelectionStart: 2, initialSelectionEnd: 3 })

      expect(input.value).toBe('12.345')
    })
  })

  describe('on-screen keypad (native software keyboard suppressed)', () => {
    it('sets inputMode=none so no software keyboard rises, instead of decimal', () => {
      render(
        <MovimientoAmountInput
          value=""
          onChange={() => {}}
          locale="es-CO"
          moneda="COP"
          tipo="gasto"
        />,
      )

      expect(screen.getByLabelText('Monto')).toHaveAttribute('inputMode', 'none')
    })

    it("renders a decimal key labeled with the locale's own separator, once the input is focused", async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      await user.click(screen.getByLabelText('Monto'))
      expect(screen.getByRole('button', { name: 'Separador decimal' })).toHaveTextContent(',')
    })

    it('renders the dot as the decimal key under a dot-decimal locale', async () => {
      // `locale` drives `Intl`-based number formatting; the UI copy (aria-label)
      // stays whatever `i18next`'s language is — forced to `es` in tests
      // (`src/test/setup.ts`) independently of the `locale` prop here.
      const user = userEvent.setup()
      render(<ControlledHarness locale="en-US" moneda="USD" tipo="gasto" />)
      await user.click(screen.getByLabelText('Monto'))
      expect(screen.getByRole('button', { name: 'Separador decimal' })).toHaveTextContent('.')
    })

    it('tapping digit keys appends through the same live-grouping pipeline as typing', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      await user.click(screen.getByLabelText('Monto'))

      for (const digit of ['1', '2', '3', '4', '5', '6', '7']) {
        await user.click(screen.getByRole('button', { name: digit }))
      }

      expect(screen.getByLabelText('Monto')).toHaveValue('1.234.567')
    })

    it('tapping the decimal key inserts the locale separator', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness initialValue="12" locale="es-CO" moneda="COP" tipo="gasto" />)
      await user.click(screen.getByLabelText('Monto'))

      await user.click(screen.getByRole('button', { name: 'Separador decimal' }))
      await user.click(screen.getByRole('button', { name: '5' }))

      expect(screen.getByLabelText('Monto')).toHaveValue('12,5')
    })

    it('disables the decimal key once the value already has a separator', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness initialValue="12,5" locale="es-CO" moneda="COP" tipo="gasto" />)
      await user.click(screen.getByLabelText('Monto'))

      expect(screen.getByRole('button', { name: 'Separador decimal' })).toBeDisabled()
    })

    it('disables delete when the value is empty', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      await user.click(screen.getByLabelText('Monto'))

      expect(screen.getByRole('button', { name: 'Borrar' })).toBeDisabled()
    })

    it('tapping delete removes the last digit through the same reformat pipeline as backspace', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness initialValue="1.234" locale="es-CO" moneda="COP" tipo="gasto" />)
      await user.click(screen.getByLabelText('Monto'))

      await user.click(screen.getByRole('button', { name: 'Borrar' }))

      expect(screen.getByLabelText('Monto')).toHaveValue('123')
    })

    it('deletes the current selection instead of just the last character, when one exists', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness initialValue="12.345" locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto') as HTMLInputElement

      // select "345" (indices 3 to 6) then tap delete
      await user.click(input)
      input.setSelectionRange(3, 6)
      await user.click(screen.getByRole('button', { name: 'Borrar' }))

      expect(input.value).toBe('12')
    })

    it('inserts a tapped digit at the current caret position, not just at the end', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness initialValue="1.234" locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto') as HTMLInputElement

      // caret right after "1.2" (index 3, before "34")
      await user.click(input)
      input.setSelectionRange(3, 3)
      await user.click(screen.getByRole('button', { name: '9' }))

      expect(input.value).toBe('12.934')
    })
  })

  describe("the keypad bleeds past the sheet's own side padding to the true screen edges", () => {
    // `BottomSheet`'s scrollable body applies `px-5.5` — the pad's wrapper
    // stops at that padded content edge, so without this, the ~22px strip
    // down each side of the phone sits genuinely outside `wrapperRef` and a
    // tap there dismissed the pad (reproduced live: a tap well inside that
    // strip closed it). A user perceives that strip as part of the
    // full-width pad, not "outside" it (it is not "the note field" or
    // "the category picker" — nothing else lives there), so the fix moves
    // the pad's own DOM box to match what is visually there — expressed as
    // an explicit width plus a matching negative margin, both resolved
    // against this element's own parent alone (never the viewport), so a
    // reserved-space scrollbar narrowing that parent narrows the bleed
    // right along with it instead of leaving it centered on stale geometry
    // (specs.md §10.54). The grid itself — `NumericKeypad`'s only rendered
    // element, once the dismiss bar is gone — carries the bleed and the
    // sheet's own `px-5.5` at once: jsdom has no layout engine to prove the
    // resulting box reaches the true edges, so this only asserts the
    // classes that produce that box are present.
    it('renders with the full-bleed width/margin classes, and the same padding the rest of the sheet uses, on the one grid element', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      await user.click(screen.getByLabelText('Monto'))

      const grid = screen.getByRole('button', { name: '1' }).parentElement
      expect(grid?.className).toContain('w-[calc(100%+2.75rem)]')
      expect(grid?.className).toContain('-mx-5.5')
      expect(grid?.className).toContain('px-5.5')
    })

    // The bleed's three numbers — this element's own `px-5.5`, its
    // `-mx-5.5`, and the `2.75rem` inside its `calc()` width (twice the
    // padding it bleeds past) — must each track `BottomSheet`'s own
    // `px-5.5` on the scrollable body. Nothing in the type system enforces
    // that; this test does, so a change to either side breaks the build
    // instead of a user's thumb finding it.
    it("keeps its bleed numbers locked to BottomSheet's own scrollable-body padding", async () => {
      render(
        <BottomSheet open onClose={() => {}} ariaLabel="Sheet de prueba">
          <p>contenido</p>
        </BottomSheet>,
      )
      const sheetBody = document.querySelector('.overflow-y-auto') as HTMLElement
      const sheetPaddingMatch = [...sheetBody.classList]
        .map((c) => /^px-(\d+(?:\.\d+)?)$/.exec(c))
        .find((m) => m !== null)
      const sheetPaddingUnits = Number(sheetPaddingMatch?.[1])
      expect(sheetPaddingUnits).toBeGreaterThan(0)

      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      await user.click(screen.getByLabelText('Monto'))
      const grid = screen.getByRole('button', { name: '1' }).parentElement as HTMLElement

      const gridPaddingMatch = [...grid.classList]
        .map((c) => /^px-(\d+(?:\.\d+)?)$/.exec(c))
        .find((m) => m !== null)
      const gridMarginMatch = [...grid.classList]
        .map((c) => /^-mx-(\d+(?:\.\d+)?)$/.exec(c))
        .find((m) => m !== null)
      const gridWidthMatch = [...grid.classList]
        .map((c) => /^w-\[calc\(100%\+(\d+(?:\.\d+)?)rem\)\]$/.exec(c))
        .find((m) => m !== null)

      expect(Number(gridPaddingMatch?.[1])).toBe(sheetPaddingUnits)
      expect(Number(gridMarginMatch?.[1])).toBe(sheetPaddingUnits)
      // Tailwind's spacing scale is 0.25rem per unit; the calc's rem value
      // must equal two of this element's own paddings (one bled past on
      // each side).
      expect(Number(gridWidthMatch?.[1])).toBe(sheetPaddingUnits * 0.25 * 2)
    })
  })

  describe('keypad shows only while the amount field is focused', () => {
    it('renders no keypad at all before the input is focused', () => {
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()
    })

    it('shows the keypad once the input is focused', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)

      await user.click(screen.getByLabelText('Monto'))

      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    })

    it('hides the keypad once focus moves to an unrelated element entirely', async () => {
      const user = userEvent.setup()
      render(
        <div>
          <ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />
          <input aria-label="Nota" />
        </div>,
      )
      await user.click(screen.getByLabelText('Monto'))
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()

      await user.click(screen.getByLabelText('Nota'))

      expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()
    })

    it(
      'keeps the keypad open — and the tap still registers — across a tap on one of its own keys: a naive ' +
        'implementation that hides the pad on the input’s bare blur would unmount the very button being tapped ' +
        'before its click fires',
      async () => {
        const user = userEvent.setup()
        render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
        await user.click(screen.getByLabelText('Monto'))

        await user.click(screen.getByRole('button', { name: '7' }))
        await user.click(screen.getByRole('button', { name: '7' }))

        expect(screen.getByRole('button', { name: '7' })).toBeInTheDocument()
        expect(screen.getByLabelText('Monto')).toHaveValue('77')
      },
    )

    it('keeps the keypad open when focus tabs from the input onto one of the pad’s own keys', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      await user.click(screen.getByLabelText('Monto'))

      await user.tab()

      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    })
  })

  describe('dismissing on an outside tap that never fires a native blur', () => {
    // iOS Safari does not shift focus away from a focused input when the tap
    // target itself isn't focusable (a plain div, dead space, a label) — the
    // native `blur`/`focusout` this component relied on simply never fires
    // there, so `handleWrapperBlur` never runs and the pad is stuck open
    // (the user's report). jsdom's own default click behavior already moves
    // focus to `<body>` on any non-focusable target, matching Chromium, not
    // WebKit — so it can't reproduce the bug directly. A `mousedown` handler
    // on the outside target that calls `preventDefault()` produces the same
    // observable DOM state a real WebKit tap does (the input stays
    // `document.activeElement`), which is the accurate, browser-agnostic way
    // to exercise this without an actual iOS device.
    const OutsideNonFocusableTarget = ({ onMouseDown }: { onMouseDown?: () => void }) => (
      <div
        data-testid="outside"
        onMouseDown={(event) => {
          event.preventDefault()
          onMouseDown?.()
        }}
      >
        dead space
      </div>
    )

    it('closes the pad on an outside tap even when the target never lets native focus move', async () => {
      const user = userEvent.setup()
      render(
        <div>
          <ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />
          <OutsideNonFocusableTarget />
        </div>,
      )
      const input = screen.getByLabelText('Monto')
      await user.click(input)
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()

      await user.click(screen.getByTestId('outside'))

      expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()
      expect(input).not.toHaveFocus()
    })

    it('tapping the amount field again after such a dismissal reopens the pad', async () => {
      const user = userEvent.setup()
      render(
        <div>
          <ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />
          <OutsideNonFocusableTarget />
        </div>,
      )
      const input = screen.getByLabelText('Monto')
      await user.click(input)
      await user.click(screen.getByTestId('outside'))
      expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()

      await user.click(input)

      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    })

    it('a tap on one of the pad’s own keys never triggers the outside-dismiss path', async () => {
      const user = userEvent.setup()
      render(<ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />)
      const input = screen.getByLabelText('Monto')
      await user.click(input)

      await user.click(screen.getByRole('button', { name: '7' }))

      expect(screen.getByRole('button', { name: '7' })).toBeInTheDocument()
      expect(input).toHaveValue('7')
    })

    // A discrete-event state update inside a document-level `pointerdown`
    // listener collapses the pad — and the whole layout shifts up to fill
    // the space it occupied — before the finger lifts. The browser
    // hit-tests `pointerup`/`click` against whatever now sits at those raw
    // coordinates, which is a different element than the one `pointerdown`
    // hit (reproduced live in Chromium: a tap on a category chip behind the
    // pad landed its `click` on an unrelated ancestor once the pad's
    // collapse ran on `pointerdown`, and the category was never selected —
    // `aria-pressed` stayed `false`). Gating the collapse on `pointerup`
    // instead means the browser has already resolved that event's own
    // hit-test before our handler runs, so a mutation inside it can no
    // longer retarget the gesture already in flight.
    it('does not close the pad on pointerdown alone — only once the pointer lifts, so an in-flight tap on a control behind the pad cannot be retargeted by an early collapse', async () => {
      // A real, natively-focusable outside target (a plain `<button>`) would
      // blur the input via the browser's own mousedown-driven focus-shift —
      // the existing `handleWrapperBlur` path, unrelated to the pointerup
      // listener this test isolates. `OutsideNonFocusableTarget` blocks that
      // native focus-shift (as the sibling describe block above does), so
      // the *only* thing that can close the pad here is this handler.
      const user = userEvent.setup()
      render(
        <div>
          <ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />
          <OutsideNonFocusableTarget />
        </div>,
      )
      const input = screen.getByLabelText('Monto')
      await user.click(input)
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()

      const outside = screen.getByTestId('outside')
      await user.pointer({ keys: '[MouseLeft>]', target: outside })
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
      expect(input).toHaveFocus()

      await user.pointer('[/MouseLeft]')
      expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()
      expect(input).not.toHaveFocus()
    })

    // A genuinely focusable outside control (a category chip, in the real
    // sheet) never reaches the handler above at all: the browser's own
    // mousedown default action focuses it directly, firing a real native
    // `blur` on the amount input during the same down-phase — well before
    // `pointerup`. `handleWrapperBlur` predates this fix and reacted to
    // that blur immediately, so it collapsed the pad on `pointerdown` too,
    // just via a different path than the listener above (reproduced live:
    // tapping a category chip while the pad was open left `aria-pressed`
    // `false` on it — the tap never registered). It must defer the same
    // way.
    it('a native blur from tapping a genuinely focusable outside control is deferred the same way, so the pad does not collapse before the pointer lifts', async () => {
      const user = userEvent.setup()
      render(
        <div>
          <ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />
          <button type="button">Elsewhere</button>
        </div>,
      )
      const input = screen.getByLabelText('Monto')
      await user.click(input)
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()

      const outside = screen.getByRole('button', { name: 'Elsewhere' })
      await user.pointer({ keys: '[MouseLeft>]', target: outside })
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()

      await user.pointer('[/MouseLeft]')
      expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()
    })
  })

  describe('a gesture that starts on the pad never dismisses it, whatever the browser did with focus in between', () => {
    // A tap that starts inside the pad's own wrapper — a key, the dead
    // space between keys, the full-bleed side gutters — must never be read
    // as "outside", even if focus drifts to some other focusable ancestor
    // mid-gesture (e.g. a dialog panel this field is nested inside, via
    // `tabIndex={-1}`) before the pointer lifts. Deciding from the
    // gesture's own origin, captured once at `pointerdown`, rather than
    // from whatever the DOM's focus state happens to be by `pointerup`,
    // makes the pad robust to that class of in-between focus change
    // without needing to know its exact cause.
    it('stays open and restores focus to the input when a mid-gesture blur lands on a focusable ancestor outside the wrapper', async () => {
      const user = userEvent.setup()
      render(
        // Stands in for `BottomSheet`'s own `role="dialog"` panel, which carries `tabIndex={-1}` for the same reason.
        <div tabIndex={-1} data-testid="dialog-panel">
          <ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />
        </div>,
      )
      const input = screen.getByLabelText('Monto')
      await user.click(input)
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()

      // The pad's own grid — the origin of a tap that lands in the dead
      // space between keys rather than on any one of them.
      const gridContainer = screen.getByRole('button', { name: '1' }).parentElement as HTMLElement
      const dialogPanel = screen.getByTestId('dialog-panel')

      gridContainer.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }),
      )
      // Focus landing on an ancestor mid-gesture fires a genuine native
      // `blur` on the input with `relatedTarget` set to that ancestor —
      // exactly the DOM state a platform-driven focus shift would produce.
      dialogPanel.focus()
      gridContainer.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1 }),
      )

      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
      expect(input).toHaveFocus()
    })
  })

  describe('a keyboard user can still leave the pad', () => {
    it('closes the pad when Tab moves focus past its last key with no pointer gesture involved', async () => {
      const user = userEvent.setup()
      render(
        <div>
          <ControlledHarness locale="es-CO" moneda="COP" tipo="gasto" />
          <button type="button">After</button>
        </div>,
      )
      const input = screen.getByLabelText('Monto')
      await user.click(input)
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()

      // 9 digits + decimal + 0 = 11 tabbable keys (delete starts disabled,
      // the value is empty) between the input and "After".
      for (let i = 0; i < 12; i += 1) await user.tab()

      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus()
      expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()
    })
  })
})
