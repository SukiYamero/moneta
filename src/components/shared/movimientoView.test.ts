import { describe, it, expect } from 'vitest'
import {
  formatMonto,
  getMovimientoAmountView,
  getMovimientoVisual,
} from '@/components/shared/movimientoView'

describe('getMovimientoVisual', () => {
  it('maps a known category to its icon/tint', () => {
    const visual = getMovimientoVisual({ categoria: 'Sueldo', tipo: 'ingreso' })
    expect(visual.tint).toBe('emerald')
  })

  it('falls back to a type-based visual for an unknown (custom) category', () => {
    const income = getMovimientoVisual({ categoria: 'Etiqueta inventada', tipo: 'ingreso' })
    const expense = getMovimientoVisual({ categoria: 'Etiqueta inventada', tipo: 'gasto' })
    expect(income.tint).toBe('emerald')
    expect(expense.tint).toBe('neutral')
  })
})

describe('formatMonto', () => {
  it('formats a positive amount as COP currency', () => {
    expect(formatMonto(1200, 'COP')).toContain('1.200')
  })
})

describe('getMovimientoAmountView', () => {
  it('prefixes income with + and colors it success', () => {
    const view = getMovimientoAmountView({ monto: 50, moneda: 'COP', tipo: 'ingreso' })
    expect(view.text.startsWith('+')).toBe(true)
    expect(view.colorClass).toBe('text-success')
  })

  it('prefixes expense with - and colors it foreground', () => {
    const view = getMovimientoAmountView({ monto: 50, moneda: 'COP', tipo: 'gasto' })
    expect(view.text.startsWith('-')).toBe(true)
    expect(view.colorClass).toBe('text-foreground')
  })
})
