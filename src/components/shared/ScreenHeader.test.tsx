import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScreenHeader } from '@/components/shared/ScreenHeader'

describe('ScreenHeader', () => {
  it('renders the title as the page heading', () => {
    render(<ScreenHeader title="Ajustes" onBack={() => {}} backLabel="Volver" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeInTheDocument()
  })

  it('calls onBack when the back button is clicked', async () => {
    const onBack = vi.fn()
    render(<ScreenHeader title="Ajustes" onBack={onBack} backLabel="Volver" />)
    await userEvent.click(screen.getByRole('button', { name: 'Volver' }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('wires an explicit titleId onto the heading when a caller needs to reference it', () => {
    render(
      <ScreenHeader title="Bloqueo" onBack={() => {}} backLabel="Volver" titleId="lock-title" />,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Bloqueo' })).toHaveAttribute(
      'id',
      'lock-title',
    )
  })
})
