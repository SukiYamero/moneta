import { describe, it, expect } from 'vitest'
import { monedaForRegion } from '@/lib/i18n/regionCurrency'

describe('monedaForRegion', () => {
  it('maps each targeted region to its currency', () => {
    expect(monedaForRegion('MX')).toBe('MXN')
    expect(monedaForRegion('AR')).toBe('ARS')
    expect(monedaForRegion('BR')).toBe('BRL')
    expect(monedaForRegion('PE')).toBe('PEN')
    expect(monedaForRegion('CO')).toBe('COP')
  })

  it('maps both EC and US to USD', () => {
    expect(monedaForRegion('EC')).toBe('USD')
    expect(monedaForRegion('US')).toBe('USD')
  })

  it('is case-insensitive', () => {
    expect(monedaForRegion('mx')).toBe('MXN')
  })

  it("falls back to COP for an unknown region, today's behavior rather than guessing", () => {
    expect(monedaForRegion('ES')).toBe('COP')
    expect(monedaForRegion('ZZ')).toBe('COP')
  })

  it('falls back to COP for an undefined region', () => {
    expect(monedaForRegion(undefined)).toBe('COP')
  })
})
