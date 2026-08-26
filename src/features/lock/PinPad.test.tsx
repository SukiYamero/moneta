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

  it('disables every digit once maxLength is reached', () => {
    render(<PinPad value="1234" onChange={() => {}} maxLength={PIN_LENGTH} />)

    expect(screen.getByRole('button', { name: '5' })).toBeDisabled()
  })

  it('disables delete when the value is empty', () => {
    render(<PinPad value="" onChange={() => {}} />)

    expect(screen.getByRole('button', { name: deleteLabel() })).toBeDisabled()
  })

  it('renders no decimal key — the PIN pad never groups by locale', () => {
    render(<PinPad value="" onChange={() => {}} />)

    // 10 digits + delete, no decimal key
    expect(screen.getAllByRole('button')).toHaveLength(11)
  })

  it('disables every key when disabled is true', () => {
    render(<PinPad value="12" onChange={() => {}} disabled />)

    expect(screen.getByRole('button', { name: '3' })).toBeDisabled()
    expect(screen.getByRole('button', { name: deleteLabel() })).toBeDisabled()
  })
})
