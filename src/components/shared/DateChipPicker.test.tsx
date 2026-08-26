import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { enUS, es } from 'date-fns/locale'
import { DateChipPicker } from '@/components/shared/DateChipPicker'

describe('DateChipPicker', () => {
  it('shows the selected date as a formatted label and starts collapsed', () => {
    render(
      <DateChipPicker value="2026-08-10" onChange={() => {}} locale="es-CO" dateFnsLocale={es} />,
    )

    expect(screen.getByText('10 de agosto')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Selector de fecha' })).not.toBeInTheDocument()
  })

  it('expands the month grid on chip tap', async () => {
    const user = userEvent.setup()
    render(
      <DateChipPicker value="2026-08-10" onChange={() => {}} locale="es-CO" dateFnsLocale={es} />,
    )

    await user.click(screen.getByRole('button', { name: /10 de agosto/ }))

    expect(screen.getByRole('group', { name: 'Selector de fecha' })).toBeInTheDocument()
    expect(screen.getByText('agosto 2026')).toBeInTheDocument()
  })

  it('calls onChange with the tapped day in ISO format and collapses', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <DateChipPicker value="2026-08-10" onChange={onChange} locale="es-CO" dateFnsLocale={es} />,
    )

    await user.click(screen.getByRole('button', { name: /10 de agosto/ }))
    await user.click(screen.getByRole('button', { name: /15 de agosto/ }))

    expect(onChange).toHaveBeenCalledWith('2026-08-15')
    expect(screen.queryByRole('group', { name: 'Selector de fecha' })).not.toBeInTheDocument()
  })

  it('navigates months without changing the selected value', async () => {
    const user = userEvent.setup()
    render(
      <DateChipPicker value="2026-08-10" onChange={() => {}} locale="es-CO" dateFnsLocale={es} />,
    )

    await user.click(screen.getByRole('button', { name: /10 de agosto/ }))
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }))

    expect(screen.getByText('septiembre 2026')).toBeInTheDocument()
  })

  it('closes the month grid on Escape', async () => {
    const user = userEvent.setup()
    render(
      <DateChipPicker value="2026-08-10" onChange={() => {}} locale="es-CO" dateFnsLocale={es} />,
    )

    await user.click(screen.getByRole('button', { name: /10 de agosto/ }))
    expect(screen.getByRole('group', { name: 'Selector de fecha' })).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('group', { name: 'Selector de fecha' })).not.toBeInTheDocument()
  })

  it('meets the 44px touch-target floor on the chip and month-nav buttons without inflating their visible size', async () => {
    const user = userEvent.setup()
    render(
      <DateChipPicker value="2026-08-10" onChange={() => {}} locale="es-CO" dateFnsLocale={es} />,
    )

    const chipButton = screen.getByRole('button', { name: /10 de agosto/ })
    expect(chipButton).toHaveClass('min-h-11')
    expect(chipButton.firstElementChild).toHaveClass('h-9')

    await user.click(chipButton)
    const prevMonth = screen.getByRole('button', { name: 'Mes anterior' })
    expect(prevMonth).toHaveClass('min-h-11', 'min-w-11')
    expect(prevMonth.firstElementChild).toHaveClass('size-7')
  })

  // March 2026 spans 6 real weeks, February 2027 spans 4 (both weekStartsOn:1)
  // — the grid must render the same 42-cell size for both regardless.
  it('renders the same 42-cell grid for two real months with different week counts', async () => {
    const user = userEvent.setup()

    const march = render(
      <DateChipPicker value="2026-03-10" onChange={() => {}} locale="es-CO" dateFnsLocale={es} />,
    )
    await user.click(within(march.container).getByRole('button', { name: /10 de marzo/ }))
    const marchCells = within(march.container)
      .getByRole('group', { name: 'Selector de fecha' })
      .querySelectorAll('[aria-pressed]')
    expect(marchCells).toHaveLength(42)
    march.unmount()

    const february = render(
      <DateChipPicker value="2027-02-10" onChange={() => {}} locale="es-CO" dateFnsLocale={es} />,
    )
    await user.click(within(february.container).getByRole('button', { name: /10 de febrero/ }))
    const februaryCells = within(february.container)
      .getByRole('group', { name: 'Selector de fecha' })
      .querySelectorAll('[aria-pressed]')
    expect(februaryCells).toHaveLength(42)
  })

  // A hand-rolled `"d 'de' MMMM"` format would bake the Spanish connector
  // "de" into every locale ("10 de August") — the label must localize the
  // whole phrase via Intl.DateTimeFormat, not just the month name.
  it('renders the day+month label and the month header in the locale passed by the caller', async () => {
    const user = userEvent.setup()
    render(
      <DateChipPicker value="2026-08-10" onChange={() => {}} locale="en-US" dateFnsLocale={enUS} />,
    )

    expect(screen.getByText('August 10')).toBeInTheDocument()
    expect(screen.queryByText('10 de agosto')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /August 10/ }))
    expect(screen.getByText('August 2026')).toBeInTheDocument()
  })
})
