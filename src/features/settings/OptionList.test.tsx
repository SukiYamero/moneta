import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OptionList } from '@/features/settings/OptionList'

const items = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B' },
]

describe('OptionList', () => {
  it('marks the selected option as checked', () => {
    render(<OptionList items={items} value="b" onChange={vi.fn()} aria-label="Options" />)
    expect(screen.getByRole('radio', { name: 'Option A' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: 'Option B' })).toHaveAttribute('aria-checked', 'true')
  })

  it('calls onChange with the tapped option value', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<OptionList items={items} value="a" onChange={onChange} aria-label="Options" />)
    await user.click(screen.getByRole('radio', { name: 'Option B' }))
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('gives every option a 44px touch target', () => {
    render(<OptionList items={items} value="a" onChange={vi.fn()} aria-label="Options" />)
    for (const radio of screen.getAllByRole('radio')) expect(radio).toHaveClass('min-h-11')
  })
})
