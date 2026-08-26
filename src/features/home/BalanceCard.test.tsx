import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BalanceCard } from '@/features/home/BalanceCard'

const totals = { ingresos: 1_000_000, gastos: 400_000, balance: 600_000 }

describe('BalanceCard', () => {
  it('gives the hide/show toggle a real 44px touch target', () => {
    render(<BalanceCard totals={totals} moneda="COP" />)

    expect(screen.getByRole('button', { name: /ocultar montos/i })).toHaveClass(
      'min-h-11',
      'min-w-11',
    )
  })

  it('keeps the visible pill at its designed 34px size, growing only the tap target', () => {
    render(<BalanceCard totals={totals} moneda="COP" />)

    const button = screen.getByRole('button', { name: /ocultar montos/i })
    expect(button).not.toHaveClass('bg-success/15')
    expect(button.querySelector('span')).toHaveClass('size-8.5', 'bg-success/15')
  })

  it('masks the balance and mini-totals on toggle, and restores them on toggle again', async () => {
    const user = userEvent.setup()
    render(<BalanceCard totals={totals} moneda="COP" />)

    expect(screen.getByText('$ 600.000,00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /ocultar montos/i }))
    expect(screen.queryByText('$ 600.000,00')).not.toBeInTheDocument()
    expect(screen.getByText('••••••')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /mostrar montos/i }))
    expect(screen.getByText('$ 600.000,00')).toBeInTheDocument()
  })
})
