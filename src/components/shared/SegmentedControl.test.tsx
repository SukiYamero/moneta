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
})
