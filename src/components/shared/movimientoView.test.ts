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
    expect(visual.tint).toBe('purple') // color still resolves — only icono was invalid
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
  it('formats a positive amount as COP currency, narrowSymbol only (never the ISO code)', () => {
    const text = formatMonto(1200, 'COP', 'es-CO')
    expect(text).toContain('1.200')
    expect(text).not.toContain('COP')
  })

  it('formats a positive amount as USD currency, narrowSymbol only (never the ISO code)', () => {
    const text = formatMonto(1200, 'USD', 'es-CO')
    expect(text).toContain('$')
    expect(text).not.toContain('USD')
  })

  it('reuses one Intl.NumberFormat per currency instead of constructing one per call', () => {
    // The formatters are built once at module scope on import — spying
    // after import and calling formatMonto repeatedly (including a
    // currency switch) must never trigger a new construction, otherwise
    // MovimientoRow would be doing this per row per render.
    const constructorSpy = vi.spyOn(Intl, 'NumberFormat')

    formatMonto(1000, 'COP', 'es-CO')
    formatMonto(2000, 'COP', 'es-CO')
    formatMonto(3000, 'USD', 'es-CO')
    formatMonto(4000, 'USD', 'es-CO')

    expect(constructorSpy).not.toHaveBeenCalled()
    constructorSpy.mockRestore()
  })

  // `locale` has no default (docs/wave-2/track-m.md) — the only way to get
  // es-CO formatting is to pass it explicitly, same as any other locale.
  it('formats es-CO explicitly the same way on repeat calls', () => {
    expect(formatMonto(1200, 'COP', 'es-CO')).toBe(formatMonto(1200, 'COP', 'es-CO'))
  })

  it('accepts an explicit locale and formats accordingly', () => {
    // en-US groups thousands with a comma and uses a period as the decimal
    // separator — the opposite of es-CO's convention — so this is a real
    // behavioral difference, not just a different currency symbol.
    expect(formatMonto(1200, 'USD', 'en-US')).toContain('1,200')
    expect(formatMonto(1200, 'USD', 'en-US')).not.toContain('1.200')
  })

  it('reuses one Intl.NumberFormat per (locale, currency) pair across repeat calls', () => {
    formatMonto(500, 'COP', 'pt-BR') // warm the cache before spying, same pattern as the test above
    const constructorSpy = vi.spyOn(Intl, 'NumberFormat')

    formatMonto(1000, 'COP', 'pt-BR')
    formatMonto(2000, 'COP', 'pt-BR')

    expect(constructorSpy).not.toHaveBeenCalled()
    constructorSpy.mockRestore()
  })

  // specs.md §10.7: a negative amount (e.g. totals.balance) attaches its
  // sign to the number, not to the currency — "$ -12.000,00", not
  // "-$ 12.000,00" (Intl's own default). Checked via formatToParts-level
  // reasoning (the sign must immediately precede the first digit) across
  // several locales whose symbol placement differs (R$ leads in pt-BR,
  // trails in es-CO/en-US) rather than a single hardcoded string.
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

  // formatToParts has no "integer" part for a non-finite value (only a
  // "nan"/"infinity" part) — attachSignToNumber's no-integer fallback must
  // still land the sign next to the number, not reproduce the
  // sign-before-currency bug this whole rework closes.
  it('attaches the sign to the number even when there is no integer part (Infinity)', () => {
    expect(formatMonto(-Infinity, 'COP', 'es-CO')).not.toMatch(/^-/)
    expect(formatMonto(-Infinity, 'COP', 'es-CO')).toMatch(/\$\s*-/)
  })
})

describe('getMovimientoAmountView', () => {
  // Same formatToParts-attached-sign rule as formatMonto, but always shown
  // (income always reads "+", expense always reads "-") — verified across
  // locales with different symbol placement, not one hardcoded string.
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

  it('forwards an explicit locale through to formatMonto', () => {
    const view = getMovimientoAmountView({ monto: 1200, moneda: 'USD', tipo: 'ingreso' }, 'en-US')
    expect(view.text).toContain('1,200')
  })

  it('never renders the ISO currency code, only narrowSymbol', () => {
    const view = getMovimientoAmountView({ monto: 1200, moneda: 'USD', tipo: 'ingreso' }, 'en-US')
    expect(view.text).not.toContain('USD')
  })

  it('reuses one signed Intl.NumberFormat per (locale, currency) pair across repeat calls', () => {
    getMovimientoAmountView({ monto: 500, moneda: 'PEN', tipo: 'ingreso' }, 'es-CO') // warm the cache
    const constructorSpy = vi.spyOn(Intl, 'NumberFormat')

    getMovimientoAmountView({ monto: 1000, moneda: 'PEN', tipo: 'ingreso' }, 'es-CO')
    getMovimientoAmountView({ monto: 2000, moneda: 'PEN', tipo: 'gasto' }, 'es-CO')

    expect(constructorSpy).not.toHaveBeenCalled()
    constructorSpy.mockRestore()
  })
})
