import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BreakdownCard } from '@/features/history/BreakdownCard'
import type { BreakdownEntry, Totals } from '@/lib/movimientoStats'
import type { Categoria } from '@/lib/schema'

const totals: Totals = { ingresos: 12000, gastos: 5000, balance: 7000 }

describe('BreakdownCard', () => {
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
        otherCurrencies={[]}
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
        otherCurrencies={[]}
      />,
    )

    expect(screen.queryAllByText(/^-\$/)).toHaveLength(0)
    expect(screen.getByText(/\$\s*-4\.000,00/)).toBeInTheDocument()
  })

  it('resolves a breakdown entry (a category id) to its name, never rendering the raw id', () => {
    const breakdown: BreakdownEntry[] = [{ key: 'cat_comida', total: 5000, share: 1 }]
    const categorias: Categoria[] = [{ id: 'cat_comida', nombre: 'Comida' }]
    render(
      <BreakdownCard
        scope="dia"
        totals={totals}
        breakdown={breakdown}
        bdType="gasto"
        onBdTypeChange={vi.fn()}
        moneda="COP"
        categorias={categorias}
        otherCurrencies={[]}
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
        otherCurrencies={[]}
      />,
    )

    expect(screen.getByText('Sin categoría')).toBeInTheDocument()
    expect(screen.queryByText('cat_missing')).not.toBeInTheDocument()
  })

  describe('other-currency note', () => {
    it('renders nothing when otherCurrencies is empty (the common case)', () => {
      render(
        <BreakdownCard
          scope="dia"
          totals={totals}
          breakdown={[]}
          bdType="gasto"
          onBdTypeChange={vi.fn()}
          moneda="COP"
          categorias={[]}
          otherCurrencies={[]}
        />,
      )

      expect(screen.queryByText(/USD/)).not.toBeInTheDocument()
    })

    it('names the other currencies when the period has movements in them', () => {
      render(
        <BreakdownCard
          scope="dia"
          totals={totals}
          breakdown={[]}
          bdType="gasto"
          onBdTypeChange={vi.fn()}
          moneda="COP"
          categorias={[]}
          otherCurrencies={['USD', 'MXN']}
        />,
      )

      expect(screen.getByText(/USD/)).toBeInTheDocument()
      expect(screen.getByText(/MXN/)).toBeInTheDocument()
    })
  })
})
