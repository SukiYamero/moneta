import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { i18next } from '@/lib/i18n'
import { PinPad, PIN_LENGTH } from '@/features/lock/PinPad'

const deleteLabel = () => i18next.t('lock:screen.deleteCta')

describe('PinPad', () => {
  it('appends a tapped digit to the current value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PinPad value="12" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: '3' }))

    expect(onChange).toHaveBeenCalledWith('123')
  })

  it('removes the last digit when delete is pressed', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PinPad value="123" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: deleteLabel() }))

    expect(onChange).toHaveBeenCalledWith('12')
  })

  it('marks every digit aria-disabled once maxLength is reached, and ignores a tap on one', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PinPad value="1234" onChange={onChange} maxLength={PIN_LENGTH} />)

    const digit = screen.getByRole('button', { name: '5' })
    expect(digit).toHaveAttribute('aria-disabled', 'true')
    await user.click(digit)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('marks delete aria-disabled when the value is empty, and ignores a tap on it', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PinPad value="" onChange={onChange} />)

    const deleteButton = screen.getByRole('button', { name: deleteLabel() })
    expect(deleteButton).toHaveAttribute('aria-disabled', 'true')
    await user.click(deleteButton)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('renders no decimal key — the PIN pad never groups by locale', () => {
    render(<PinPad value="" onChange={() => {}} />)

    // 10 digits + delete, no decimal key
    expect(screen.getAllByRole('button')).toHaveLength(11)
  })

  it('marks every key aria-disabled when disabled is true, and ignores taps on them', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PinPad value="12" onChange={onChange} disabled />)

    const digit = screen.getByRole('button', { name: '3' })
    const deleteButton = screen.getByRole('button', { name: deleteLabel() })
    expect(digit).toHaveAttribute('aria-disabled', 'true')
    expect(deleteButton).toHaveAttribute('aria-disabled', 'true')
    await user.click(digit)
    await user.click(deleteButton)
    expect(onChange).not.toHaveBeenCalled()
  })
})
