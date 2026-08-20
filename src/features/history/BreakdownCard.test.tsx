import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BreakdownCard } from '@/features/history/BreakdownCard'
import type { BreakdownEntry, Totals } from '@/lib/movimientoStats'
import type { Categoria } from '@/lib/schema'

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
        categorias={[]}
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
        categorias={[]}
      />,
    )

    expect(screen.queryAllByText(/^-\$/)).toHaveLength(0)
    expect(screen.getByText(/\$\s*-4\.000,00/)).toBeInTheDocument()
  })

  it('resolves a breakdown entry (a category id) to its name, never rendering the raw id', () => {
    const breakdown: BreakdownEntry[] = [{ key: 'cat_comida', total: 5000, share: 1 }]
    const categorias: Categoria[] = [
      { id: 'cat_comida', nombre: 'Comida', seccionId: 'sec_1', tipo: 'gasto' },
    ]
    render(
      <BreakdownCard
        scope="dia"
        totals={totals}
        breakdown={breakdown}
        bdType="gasto"
        onBdTypeChange={vi.fn()}
        moneda="COP"
        categorias={categorias}
      />,
    )

    expect(screen.getByText('Comida')).toBeInTheDocument()
    expect(screen.queryByText('cat_comida')).not.toBeInTheDocument()
  })

  it('falls back to "sin categoría" for an entry whose category id is not in Config', () => {
    const breakdown: BreakdownEntry[] = [{ key: 'cat_missing', total: 5000, share: 1 }]
    render(
      <BreakdownCard
        scope="dia"
        totals={totals}
        breakdown={breakdown}
        bdType="gasto"
        onBdTypeChange={vi.fn()}
        moneda="COP"
        categorias={[]}
      />,
    )

    expect(screen.getByText('Sin categoría')).toBeInTheDocument()
    expect(screen.queryByText('cat_missing')).not.toBeInTheDocument()
  })
})
