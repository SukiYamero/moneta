import { describe, it, expect, vi } from 'vitest'
import type { Config } from '@/lib/schema'
import {
  formatMonto,
  getMovimientoAmountView,
  getMovimientoVisual,
  resolveCategoria,
} from '@/components/shared/movimientoView'

describe('getMovimientoVisual', () => {
  it("uses the category's own icono/color when it has one", () => {
    const visual = getMovimientoVisual({ icono: 'briefcase', color: 'emerald' }, 'ingreso')
    expect(visual.tint).toBe('emerald')
  })

  it('falls back to a type-based visual for a category with no icono/color (every pre-migration seed)', () => {
    const income = getMovimientoVisual({}, 'ingreso')
    const expense = getMovimientoVisual({}, 'gasto')
    expect(income.tint).toBe('emerald')
    expect(expense.tint).toBe('neutral')
  })

  it('falls back to a type-based visual when the category is undefined (unresolved id)', () => {
    const visual = getMovimientoVisual(undefined, 'gasto')
    expect(visual.tint).toBe('neutral')
  })

  it('falls back to the type-based icon when icono is an unknown key (older/newer build, hand-edited Drive file)', () => {
    const visual = getMovimientoVisual(
      { icono: 'not-a-real-key' as never, color: 'purple' },
      'gasto',
    )
    expect(visual.tint).toBe('purple')
  })
})

describe('resolveCategoria', () => {
  const config: Pick<Config, 'categorias'> = {
    categorias: [{ id: 'cat_1', nombre: 'Comida', seccionId: 'sec_1', tipo: 'gasto' }],
  }

  it('finds a category by id', () => {
    expect(resolveCategoria('cat_1', config)?.nombre).toBe('Comida')
  })

  it('returns undefined for an id not in Config, never throws', () => {
    expect(resolveCategoria('cat_missing', config)).toBeUndefined()
  })

  it('returns undefined when Config itself is null/undefined (not loaded yet)', () => {
    expect(resolveCategoria('cat_1', null)).toBeUndefined()
    expect(resolveCategoria('cat_1', undefined)).toBeUndefined()
  })
})

describe('formatMonto', () => {
  it.each([
    ['COP', '1.200'],
    ['USD', '$'],
  ] as const)(
    'formats a positive amount as %s currency, narrowSymbol only (never the ISO code)',
    (moneda, expectedSubstring) => {
      const text = formatMonto(1200, moneda, 'es-CO')
      expect(text).toContain(expectedSubstring)
      expect(text).not.toContain(moneda)
    },
  )

  it('accepts an explicit locale and formats accordingly', () => {
    expect(formatMonto(1200, 'USD', 'en-US')).toContain('1,200')
    expect(formatMonto(1200, 'USD', 'en-US')).not.toContain('1.200')
  })

  it('reuses one Intl.NumberFormat per (locale, currency) pair, never building one per call', () => {
    formatMonto(500, 'COP', 'pt-BR')
    formatMonto(500, 'USD', 'pt-BR')
    const constructorSpy = vi.spyOn(Intl, 'NumberFormat')

    formatMonto(1000, 'COP', 'pt-BR')
    formatMonto(2000, 'USD', 'pt-BR')

    expect(constructorSpy).not.toHaveBeenCalled()
    constructorSpy.mockRestore()
  })

  it('attaches a negative sign to the number, not to the currency, across locales', () => {
    const cases: Array<[locale: string, moneda: 'COP' | 'USD' | 'BRL']> = [
      ['es-CO', 'COP'],
      ['en-US', 'USD'],
      ['pt-BR', 'BRL'],
    ]
    for (const [locale, moneda] of cases) {
      const text = formatMonto(-12000, moneda, locale)
      expect(text.startsWith('-')).toBe(false)
      expect(text).toMatch(/-\d/)
    }
  })

  it('shows no sign at all for a positive amount', () => {
    expect(formatMonto(12000, 'COP', 'es-CO')).not.toContain('-')
    expect(formatMonto(12000, 'COP', 'es-CO')).not.toContain('+')
  })

  it('attaches the sign to the number even when there is no integer part (Infinity)', () => {
    expect(formatMonto(-Infinity, 'COP', 'es-CO')).not.toMatch(/^-/)
    expect(formatMonto(-Infinity, 'COP', 'es-CO')).toMatch(/\$\s*-/)
  })
})

describe('getMovimientoAmountView', () => {
  it('attaches + to the number for income, across locales, and colors it success', () => {
    const cases: Array<[locale: string, moneda: 'COP' | 'USD' | 'BRL']> = [
      ['es-CO', 'COP'],
      ['en-US', 'USD'],
      ['pt-BR', 'BRL'],
    ]
    for (const [locale, moneda] of cases) {
      const view = getMovimientoAmountView({ monto: 50, moneda, tipo: 'ingreso' }, locale)
      expect(view.text.startsWith('+')).toBe(false)
      expect(view.text).toMatch(/\+\d/)
      expect(view.colorClass).toBe('text-success')
    }
  })

  it('attaches - to the number for expense, across locales, and colors it foreground', () => {
    const cases: Array<[locale: string, moneda: 'COP' | 'USD' | 'BRL']> = [
      ['es-CO', 'COP'],
      ['en-US', 'USD'],
      ['pt-BR', 'BRL'],
    ]
    for (const [locale, moneda] of cases) {
      const view = getMovimientoAmountView({ monto: 50, moneda, tipo: 'gasto' }, locale)
      expect(view.text.startsWith('-')).toBe(false)
      expect(view.text).toMatch(/-\d/)
      expect(view.colorClass).toBe('text-foreground')
    }
  })

  it('forwards an explicit locale through to formatMonto without leaking the ISO code', () => {
    const view = getMovimientoAmountView({ monto: 1200, moneda: 'USD', tipo: 'ingreso' }, 'en-US')
    expect(view.text).toContain('1,200')
    expect(view.text).not.toContain('USD')
  })

  it('reuses one signed Intl.NumberFormat per (locale, currency) pair across repeat calls', () => {
    getMovimientoAmountView({ monto: 500, moneda: 'PEN', tipo: 'ingreso' }, 'es-CO')
    const constructorSpy = vi.spyOn(Intl, 'NumberFormat')

    getMovimientoAmountView({ monto: 1000, moneda: 'PEN', tipo: 'ingreso' }, 'es-CO')
    getMovimientoAmountView({ monto: 2000, moneda: 'PEN', tipo: 'gasto' }, 'es-CO')

    expect(constructorSpy).not.toHaveBeenCalled()
    constructorSpy.mockRestore()
  })
})
