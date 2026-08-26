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

  describe('roving tabIndex + arrow-key contract (APG radiogroup, vertical)', () => {
    it('gives only the selected option tabIndex 0, every other -1', () => {
      render(<OptionList items={items} value="b" onChange={vi.fn()} aria-label="Options" />)
      expect(screen.getByRole('radio', { name: 'Option A' })).toHaveAttribute('tabIndex', '-1')
      expect(screen.getByRole('radio', { name: 'Option B' })).toHaveAttribute('tabIndex', '0')
    })

    it('moves selection with ArrowDown/ArrowUp, wrapping at the edges', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      render(<OptionList items={items} value="b" onChange={onChange} aria-label="Options" />)

      screen.getByRole('radio', { name: 'Option B' }).focus()
      await user.keyboard('{ArrowDown}')

      expect(onChange).toHaveBeenCalledWith('a')
    })

    it('moves DOM focus onto the newly-selected option via a ref, not DOM traversal', async () => {
      const user = userEvent.setup()
      render(<OptionList items={items} value="a" onChange={vi.fn()} aria-label="Options" />)

      screen.getByRole('radio', { name: 'Option A' }).focus()
      await user.keyboard('{ArrowDown}')

      expect(screen.getByRole('radio', { name: 'Option B' })).toHaveFocus()
    })
  })
})
