import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SegmentedControl } from '@/components/shared/SegmentedControl'

const options = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
] as const

describe('SegmentedControl', () => {
  it('marks the current value as the checked radio', () => {
    render(
      <SegmentedControl
        options={[...options]}
        value="week"
        onChange={() => {}}
        aria-label="Alcance"
      />,
    )

    expect(screen.getByRole('radio', { name: 'Semana' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Día' })).toHaveAttribute('aria-checked', 'false')
  })

  it('calls onChange with the clicked option value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl
        options={[...options]}
        value="day"
        onChange={onChange}
        aria-label="Alcance"
      />,
    )

    await user.click(screen.getByRole('radio', { name: 'Mes' }))

    expect(onChange).toHaveBeenCalledWith('month')
  })

  it('moves selection with ArrowRight/ArrowLeft, wrapping at the edges', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl
        options={[...options]}
        value="month"
        onChange={onChange}
        aria-label="Alcance"
      />,
    )

    screen.getByRole('radio', { name: 'Mes' }).focus()
    await user.keyboard('{ArrowRight}')

    expect(onChange).toHaveBeenCalledWith('day')
  })

  it('moves DOM focus onto the newly-selected segment via a ref, not DOM traversal', async () => {
    const user = userEvent.setup()
    render(
      <SegmentedControl
        options={[...options]}
        value="day"
        onChange={() => {}}
        aria-label="Alcance"
      />,
    )

    screen.getByRole('radio', { name: 'Día' }).focus()
    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('radio', { name: 'Semana' })).toHaveFocus()
  })

  it('skips disabled options when navigating with arrow keys', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const optionsWithDisabled = [
      { value: 'day', label: 'Día' },
      { value: 'week', label: 'Semana', disabled: true },
      { value: 'month', label: 'Mes' },
    ] as const
    render(
      <SegmentedControl
        options={[...optionsWithDisabled]}
        value="day"
        onChange={onChange}
        aria-label="Alcance"
      />,
    )

    screen.getByRole('radio', { name: 'Día' }).focus()
    await user.keyboard('{ArrowRight}')

    expect(onChange).toHaveBeenCalledWith('month')
    expect(screen.getByRole('radio', { name: 'Mes' })).toHaveFocus()
  })

  it('renders a disabled option as a native disabled radio', () => {
    const optionsWithDisabled = [
      { value: 'day', label: 'Día' },
      { value: 'week', label: 'Semana', disabled: true },
    ] as const
    render(
      <SegmentedControl
        options={[...optionsWithDisabled]}
        value="day"
        onChange={() => {}}
        aria-label="Alcance"
      />,
    )

    expect(screen.getByRole('radio', { name: 'Semana' })).toBeDisabled()
  })

  it('meets the 44px touch-target floor per segment without inflating the visible pill', () => {
    render(
      <SegmentedControl
        options={[...options]}
        value="day"
        onChange={() => {}}
        aria-label="Alcance"
      />,
    )

    const radio = screen.getByRole('radio', { name: 'Día' })
    expect(radio).toHaveClass('min-h-11')
    expect(radio.firstElementChild).toHaveClass('h-9')
  })
})
