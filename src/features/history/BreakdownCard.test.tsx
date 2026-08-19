import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BreakdownCard } from '@/features/history/BreakdownCard'
import type { Totals } from '@/lib/movimientoStats'

const totals: Totals = { ingresos: 12000, gastos: 5000, balance: 7000 }

describe('BreakdownCard', () => {
  // specs.md §10.7: the sign attaches to the number, not the currency
  // ("$ -12.000,00", not "-$ 12.000,00") — found during the sweep for
  // string-prepended signs the same bug shape `getMovimientoAmountView`
  // had. `BreakdownCard` built its ingreso/gasto mini-totals and its
  // negative-balance case the same broken way.
  it('never renders a sign before the currency symbol', () => {
    render(
      <BreakdownCard
        scope="dia"
        totals={totals}
        breakdown={[]}
        bdType="gasto"
        onBdTypeChange={vi.fn()}
        moneda="COP"
      />,
    )

    expect(screen.queryAllByText(/^\+\$|^-\$/)).toHaveLength(0)
    expect(screen.getByText(/\$\s*\+12\.000,00/)).toBeInTheDocument()
    expect(screen.getByText(/\$\s*-5\.000,00/)).toBeInTheDocument()
  })

  it('attaches the sign to the number for a negative balance too', () => {
    render(
      <BreakdownCard
        scope="dia"
        totals={{ ingresos: 1000, gastos: 5000, balance: -4000 }}
        breakdown={[]}
        bdType="gasto"
        onBdTypeChange={vi.fn()}
        moneda="COP"
      />,
    )

    expect(screen.queryAllByText(/^-\$/)).toHaveLength(0)
    expect(screen.getByText(/\$\s*-4\.000,00/)).toBeInTheDocument()
  })
})
