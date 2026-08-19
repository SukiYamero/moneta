import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InfoButton } from '@/components/shared/InfoButton'

describe('InfoButton', () => {
  it('invokes onClick and exposes an accessible label', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<InfoButton onClick={onClick} label="Sobre el balance" />)

    await user.click(screen.getByRole('button', { name: 'Sobre el balance' }))

    expect(onClick).toHaveBeenCalledOnce()
  })
})
